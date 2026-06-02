import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  proto,
  WAMessage,
} from '@whiskeysockets/baileys';
import qrcodeTerminal from 'qrcode-terminal';
import pino from 'pino';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { EventEmitter } from 'events';
import { userOps } from './database/db';
import { formatJid } from './utils/helpers';

// ES module compatibility
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Suppressed logger to filter out Baileys noise
const suppressedLogger = pino({
  level: 'silent',
  customLevels: {
    trace: 0,
    debug: 1,
    info: 2,
    warn: 3,
    error: 4,
    fatal: 5
  }
});

// Define socket type
type WhatsAppSocket = ReturnType<typeof makeWASocket>;

export class WhatsAppClient extends EventEmitter {
  private sock: WhatsAppSocket | null = null;
  private isConnected: boolean = false;
  private groupMetaCache: Map<string, any> = new Map();
  private pendingQR: string | null = null;
  private qrTimer: NodeJS.Timeout | null = null;

  async connect(): Promise<void> {
    const sessionPath = path.join(__dirname, '../sessions');

    // Ensure session directory exists
    if (!fs.existsSync(sessionPath)) {
      fs.mkdirSync(sessionPath, { recursive: true });
    }

    const { state, saveCreds } = await useMultiFileAuthState(sessionPath);

    const { version } = await fetchLatestBaileysVersion();

    this.sock = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: false,
      logger: suppressedLogger,
      browser: ['Chrome', 'Windows', '10.0'],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,

      // Memory optimization: prevent loading old messages into RAM
      syncFullHistory: false,
      markOnlineOnConnect: false,
      getMessage: async () => undefined
    });

    // Handle authentication
    this.sock.ev.on('creds.update', saveCreds);

    // Handle connection
    this.sock.ev.on('connection.update', (update) => {
      const { connection, lastDisconnect, qr } = update;

      // Show QR code if available
      if (qr) {
        this.pendingQR = qr;
        console.log('\n' + '='.repeat(50));
        console.log('📱  SCAN THIS QR CODE WITH WHATSAPP  📱');
        console.log('='.repeat(50));
        qrcodeTerminal.generate(qr, { small: true });
        console.log('='.repeat(50));
        console.log('Or open WhatsApp > Settings > Linked Devices > Link Device\n');

        if (this.qrTimer) clearInterval(this.qrTimer);
        this.qrTimer = setInterval(() => {
          if (!this.isConnected && this.pendingQR) {
            console.log('\n📱 QR CODE (rescan if expired):');
            qrcodeTerminal.generate(this.pendingQR, { small: false });
          }
        }, 30000);
      }

      if (connection === 'close') {
        if (this.qrTimer) {
          clearInterval(this.qrTimer);
          this.qrTimer = null;
        }

        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;

        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        if (shouldReconnect) {
          console.log('❌ Connection closed. Reconnecting in 5 seconds...');
          setTimeout(() => this.connect(), 5000);
        } else {
          this.isConnected = false;
          this.emit('disconnected');
        }
      } else if (connection === 'open') {
        this.isConnected = true;
        if (this.qrTimer) {
          clearInterval(this.qrTimer);
          this.qrTimer = null;
        }

        // Show bot number
        const botNumber = this.sock?.user?.id?.replace('@s.whatsapp.net', '');

        console.log('\n' + '🎉'.repeat(20));
        console.log('✅✅ CONNECTED TO WHATSAPP! ✅✅\n');
        console.log('📱 Bot Number: ' + botNumber);
        console.log('👥 Add this number to your group to start using!\n');
        console.log('🎮 Bot is ready! Use .help for commands\n');
        console.log('🎉'.repeat(20) + '\n');

        this.emit('connected');
      }
    });

    // Handle incoming messages
    this.sock.ev.on('messages.upsert', async ({ messages, type }) => {
      console.log(`📨 messages.upsert event: type=${type}, messageCount=${messages.length}`);

      if (type !== 'notify') return;

      for (const msg of messages) {
        console.log(`📧 Processing message: key.fromMe=${msg.key.fromMe}, hasMessage=${!!msg.message}, remoteJid=${msg.key.remoteJid}, participant=${msg.key.participant}`);

        try {
          // Skip messages that can't be decrypted
          if (!msg.message) continue;

          // Skip messages that can't be decrypted
          if (!msg.message) continue;

          const jid = msg.key.remoteJid!;
          const isGroup = jid.endsWith('@g.us');

          if (isGroup) {
            try {
              // Fetch group metadata which helps establish sessions
              const metadata = await this.sock!.groupMetadata(jid);
              this.groupMetaCache.set(jid, metadata);

              console.log(`📍 Group JID: ${jid} - Session established`);
            } catch (e) {
              // Ignore errors here
            }
          }

          const contextInfo = (msg.message as any)?.contextInfo;
          const quotedSenderJid = contextInfo?.quotedMessage?.key?.participant ||
            (contextInfo?.participant ? contextInfo.participant.replace('@', '') + '@s.whatsapp.net' : undefined);

          this.emit('message', {
            msg,
            jid,
            isGroup,
            senderJid: isGroup ? (msg.key.participant || msg.key.remoteJid!) : msg.key.remoteJid!,
            text: this.getMessageText(msg),
            isMentioned: this.isMentioned(msg),
            mentionedJids: contextInfo?.mentionedJid || [],
            quotedSenderJid,
            hasImage: this.messageHasImage(msg),
          });

          console.log('✅ Message emitted successfully');
        } catch (err) {
          // Skip decryption errors - these are session-related
          const errorMsg = err instanceof Error ? err.message : String(err);
          if (errorMsg.includes('SessionError') || errorMsg.includes('No sessions')) {
            continue;
          }
          console.error('Error processing message:', err);
        }
      }
    });

    this.sock.ev.on('group-participants.update', async ({ id, participants, action }) => {
      // When bot is added to group, send a message to establish sessions
      const botJid = this.sock?.user?.id;

      // Handle new members joining (welcome)
      if (action === 'add') {
        for (const participant of participants) {
          // Don't welcome the bot itself
          if (participant.id !== botJid) {
            try {
              const userName = participant.name || participant.notify || formatJid(participant.id);
              const welcomeMsg = `🎮 *Welcome to Gaming Hub!* \n\n` +
                `Hey @${formatJid(participant.id)}! 👋\n\n` +
                `📱 You're now part of our eFootball community!\n\n` +
                `🎯 *What you can do:*\n` +
                `• Request friendlies - use .request or .challenge\n` +
                `• Join tournaments - use .tournament\n` +
                `• Check your stats - use .stats\n` +
                `• Compete on the leaderboard - use .leaderboard\n\n` +
                `⚽ Let's play some eFootball!`;

              await this.sendMention(id, welcomeMsg, [participant.id]);

              // Create user in database
              const { user, isNew } = userOps.getOrCreate(participant.id, userName);

              console.log(`[Welcome] New member joined: ${participant.id}`);
            } catch (e) {
              console.log('[Welcome] Could not send welcome message:', e);
            }
          }
        }
      }

      // Handle members leaving (goodbye)
      if (action === 'remove') {
        for (const participant of participants) {
          try {
            const userName = participant.name || participant.notify || formatJid(participant.id);
            const goodbyeMsg = `👋 *Goodbye!* \n\n` +
              `@${formatJid(participant.id)} has left the group.\n\n` +
              `Hope you enjoyed your time in Gaming Hub! 🎮\n` +
              `You're always welcome to join again!`;

            await this.sendMention(id, goodbyeMsg, [participant.id]);

            console.log(`[Goodbye] Member left: ${participant.id}`);
          } catch (e) {
            console.log('[Goodbye] Could not send goodbye message:', e);
          }
        }
      }

      // When bot is added to group, send a message to establish sessions
      if (action === 'add' && botJid) {
        const isBotAdded = participants.some((p: any) => p.id === botJid);
        if (isBotAdded) {
          try {
            // Send a message to establish sender key
            await this.sock?.sendMessage(id, { text: '👋 Bot connected! Use .help for commands.' });
          } catch (e) {
            console.log('Could not send join message');
          }
        }
      }
      this.emit('groupUpdate', { jid: id, participants, action });
    });
  }

  private getMessageText(msg: any): string {
    const message = msg.message;
    if (!message) return '';
    if (message.conversation) return message.conversation;
    if (message.extendedTextMessage?.text) return message.extendedTextMessage.text;
    if (message.imageMessage?.caption) return message.imageMessage.caption;
    if (message.videoMessage?.caption) return message.videoMessage.caption;
    if (message.documentMessage?.caption) return message.documentMessage.caption;
    return '';
  }

  private isMentioned(msg: any): boolean {
    return !!(msg.message as any)?.contextInfo?.mentionedJid?.length;
  }

  private messageHasImage(msg: any): boolean {
    const message = msg.message;
    if (!message) return false;
    if (message.imageMessage) return true;
    if (message.extendedTextMessage?.contextInfo?.quotedMessage?.imageMessage) return true;
    return false;
  }

  async sendMessage(jid: string, text: string): Promise<any> {
    if (!this.sock) return null;
    try {
      return await this.sock.sendMessage(jid, { text });
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      const statusCode = error?.data?.statusCode || error?.output?.statusCode;

      // Handle session errors
      if (errorMsg.includes('SessionError') || errorMsg.includes('No sessions') || errorMsg.includes('sender-key')) {
        console.log('Session not established, attempting to establish...');
        try {
          if (jid.endsWith('@g.us')) {
            try {
              await this.sock.groupMetadata(jid);
            } catch (e) { /* ignore */ }
            await new Promise(resolve => setTimeout(resolve, 1000));
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          return await this.sock.sendMessage(jid, { text });
        } catch (retryError) {
          console.error('Failed to establish session:', retryError);
          throw error;
        }
      }

      // Handle not-acceptable (406) - bot may not have permission or left group
      if (statusCode === 406 || errorMsg.includes('not-acceptable')) {
        console.log('⚠️ Cannot send to group - bot may have been removed or not allowed to send');
        throw new Error('Cannot send to this group. The bot may have been removed or does not have permission.');
      }

      throw error;
    }
  }

  async sendReply(jid: string, messageId: string, text: string): Promise<any> {
    if (!this.sock) return null;
    try {
      return await this.sock.sendMessage(jid, { text }, { quoted: { key: { remoteJid: jid }, message: {} } });
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes('SessionError') || errorMsg.includes('No sessions') || errorMsg.includes('sender-key')) {
        console.log('Session not established for reply, attempting to establish...');
        try {
          if (jid.endsWith('@g.us')) {
            try {
              await this.sock.groupMetadata(jid);
            } catch (e) { /* ignore */ }
            await new Promise(resolve => setTimeout(resolve, 1000));
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          return await this.sock.sendMessage(jid, { text }, { quoted: { key: { remoteJid: jid }, message: {} } });
        } catch (retryError) {
          console.error('Failed to establish session for reply:', retryError);
          throw error;
        }
      }
      throw error;
    }
  }

  async reply(messageId: string, jid: string, text: string): Promise<any> {
    if (!this.sock) return null;
    try {
      return await this.sock.sendMessage(jid, { text }, { quoted: { key: { remoteJid: jid }, message: {} } });
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes('SessionError') || errorMsg.includes('No sessions') || errorMsg.includes('sender-key')) {
        console.log('Session not established for reply, attempting to establish...');
        try {
          if (jid.endsWith('@g.us')) {
            try {
              await this.sock.groupMetadata(jid);
            } catch (e) { /* ignore */ }
            await new Promise(resolve => setTimeout(resolve, 1000));
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          return await this.sock.sendMessage(jid, { text }, { quoted: { key: { remoteJid: jid }, message: {} } });
        } catch (retryError) {
          console.error('Failed to establish session for reply:', retryError);
          throw error;
        }
      }
      throw error;
    }
  }

  async sendMention(jid: string, text: string, mentionedJids: string[]): Promise<any> {
    if (!this.sock) return null;
    try {
      return await this.sock.sendMessage(jid, { text, mentions: mentionedJids });
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      if (errorMsg.includes('SessionError') || errorMsg.includes('No sessions') || errorMsg.includes('sender-key')) {
        console.log('Session not established for mention, attempting to establish...');
        try {
          if (jid.endsWith('@g.us')) {
            try {
              await this.sock.groupMetadata(jid);
            } catch (e) { /* ignore */ }
            await new Promise(resolve => setTimeout(resolve, 1000));
            await new Promise(resolve => setTimeout(resolve, 500));
          }
          return await this.sock.sendMessage(jid, { text, mentions: mentionedJids });
        } catch (retryError) {
          console.error('Failed to establish session for mention:', retryError);
          throw error;
        }
      }
      throw error;
    }
  }

  async getGroupMetadata(jid: string): Promise<any> {
    if (!this.sock) return null;
    return this.sock.groupMetadata(jid);
  }

  async getGroupAdmins(groupJid: string): Promise<string[]> {
    try {
      // Try to get from cache first
      let metadata = this.groupMetaCache.get(groupJid);

      // If not in cache or cache is old, fetch fresh metadata
      if (!metadata?.participants) {
        if (!this.sock) return [];
        metadata = await this.sock.groupMetadata(groupJid);
        this.groupMetaCache.set(groupJid, metadata);
      }

      if (!metadata?.participants) return [];
      return metadata.participants.filter((p: any) => p.admin).map((p: any) => p.id);
    } catch {
      return [];
    }
  }

  async removeParticipant(groupJid: string, participantJid: string): Promise<any> {
    if (!this.sock) return null;
    return this.sock.groupParticipantsUpdate(groupJid, [participantJid], 'remove');
  }

  async addParticipant(groupJid: string, participantJid: string): Promise<any> {
    if (!this.sock) return null;
    return this.sock.groupParticipantsUpdate(groupJid, [participantJid], 'add');
  }

  async promoteParticipant(groupJid: string, participantJid: string): Promise<any> {
    if (!this.sock) return null;
    return this.sock.groupParticipantsUpdate(groupJid, [participantJid], 'promote');
  }

  async demoteParticipant(groupJid: string, participantJid: string): Promise<any> {
    if (!this.sock) return null;
    return this.sock.groupParticipantsUpdate(groupJid, [participantJid], 'demote');
  }

  async deleteMessage(jid: string, key: any): Promise<any> {
    // Delete a message from the group
    if (!this.sock) return null;
    try {
      return await this.sock.sendMessage(jid, { delete: key });
    } catch (error) {
      console.log('[deleteMessage] Error:', error);
      return null;
    }
  }

  getSocket(): WhatsAppSocket | null { return this.sock; }
  isReady(): boolean { return this.isConnected; }
  getjid(): string | null {
    if (!this.sock?.user?.id) return null;
    return this.sock.user.id;
  }
}

export const waClient = new WhatsAppClient();
export default waClient;
