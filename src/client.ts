import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion, // ✅ ADD THIS
  WASocket,
} from 'baileys';
import qrcodeTerminal from 'qrcode-terminal';
import * as fs from 'fs';
import * as path from 'path';
import { EventEmitter } from 'events';

// Simple logger
const logger = {
  info: (...args: any[]) => console.log('[INFO]', ...args),
  error: (...args: any[]) => console.error('[ERROR]', ...args),
  warn: (...args: any[]) => console.warn('[WARN]', ...args),
  debug: (...args: any[]) => console.log('[DEBUG]', ...args),
  child: () => logger,
  level: 'info',
  trace: () => { },
};

export class WhatsAppClient extends EventEmitter {
  private sock: WASocket | null = null;
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
      version, // ✅ CRITICAL FIX
      auth: state,
      printQRInTerminal: false,
      logger: logger as any,
      browser: ['eFootball Bot', 'Chrome', '1.0.0'],
      connectTimeoutMs: 60000,
      keepAliveIntervalMs: 10000,

      // ✅ Stability improvements
      syncFullHistory: true, // ✅ IMPORTANT
      markOnlineOnConnect: false,
      shouldSyncHistoryMessage: () => true, // ✅ CRITICAL
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
      if (type !== 'notify') return;

      for (const msg of messages) {
        try {
          // Skip if from me
          if (msg.key.fromMe) continue;

          // Skip messages that can't be decrypted
          if (!msg.message) continue;

          const jid = msg.key.remoteJid!;
          const isGroup = jid.endsWith('@g.us');

          if (isGroup) {
            try {
              const metadata = await this.sock!.groupMetadata(jid);
              this.groupMetaCache.set(jid, metadata);
            } catch (e) {
              // Ignore
            }
          }

          this.emit('message', {
            msg,
            jid,
            isGroup,
            senderJid: msg.key.remoteJid!,
            text: this.getMessageText(msg),
            isMentioned: this.isMentioned(msg),
            mentionedJids: (msg.message as any)?.contextInfo?.mentionedJid || [],
          });
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
      if (action === 'add' && botJid && participants.includes(botJid)) {
        try {
          // Send a message to establish sender key
          await this.sock?.sendMessage(id, { text: '👋 Bot connected! Use .help for commands.' });
        } catch (e) {
          console.log('Could not send join message');
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

  async sendMessage(jid: string, text: string): Promise<any> {
    if (!this.sock) return null;
    try {
      return await this.sock.sendMessage(jid, { text });
    } catch (error: any) {
      const errorMsg = error?.message || String(error);
      // If session error, try to establish session first
      if (errorMsg.includes('SessionError') || errorMsg.includes('No sessions') || errorMsg.includes('sender-key')) {
        console.log('Session not established, attempting to establish...');
        // Try sending a simple message to establish the session
        try {
          // Send a presence message to establish session
          await this.sock.sendPresenceUpdate('available', jid);
          // Small delay to allow session establishment
          await new Promise(resolve => setTimeout(resolve, 500));
          // Retry sending the message
          return await this.sock.sendMessage(jid, { text });
        } catch (retryError) {
          console.error('Failed to establish session:', retryError);
          throw error;
        }
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
          await this.sock.sendPresenceUpdate('available', jid);
          await new Promise(resolve => setTimeout(resolve, 500));
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
          await this.sock.sendPresenceUpdate('available', jid);
          await new Promise(resolve => setTimeout(resolve, 500));
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
          await this.sock.sendPresenceUpdate('available', jid);
          await new Promise(resolve => setTimeout(resolve, 500));
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
      const metadata = this.groupMetaCache.get(groupJid);
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

  getSocket(): WASocket | null { return this.sock; }
  isReady(): boolean { return this.isConnected; }
  getjid(): string | null {
    if (!this.sock?.user?.id) return null;
    return this.sock.user.id;
  }
}

export const waClient = new WhatsAppClient();
export default waClient;
