"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.waClient = exports.WhatsAppClient = void 0;
const baileys_1 = __importStar(require("@whiskeysockets/baileys"));
const qrcode_terminal_1 = __importDefault(require("qrcode-terminal"));
const pino_1 = __importDefault(require("pino"));
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const events_1 = require("events");
// Suppressed logger to filter out Baileys noise
const suppressedLogger = (0, pino_1.default)({
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
class WhatsAppClient extends events_1.EventEmitter {
    sock = null;
    isConnected = false;
    groupMetaCache = new Map();
    pendingQR = null;
    qrTimer = null;
    async connect() {
        const sessionPath = path.join(__dirname, '../sessions');
        // Ensure session directory exists
        if (!fs.existsSync(sessionPath)) {
            fs.mkdirSync(sessionPath, { recursive: true });
        }
        const { state, saveCreds } = await (0, baileys_1.useMultiFileAuthState)(sessionPath);
        const { version } = await (0, baileys_1.fetchLatestBaileysVersion)();
        this.sock = (0, baileys_1.default)({
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
                qrcode_terminal_1.default.generate(qr, { small: true });
                console.log('='.repeat(50));
                console.log('Or open WhatsApp > Settings > Linked Devices > Link Device\n');
                if (this.qrTimer)
                    clearInterval(this.qrTimer);
                this.qrTimer = setInterval(() => {
                    if (!this.isConnected && this.pendingQR) {
                        console.log('\n📱 QR CODE (rescan if expired):');
                        qrcode_terminal_1.default.generate(this.pendingQR, { small: false });
                    }
                }, 30000);
            }
            if (connection === 'close') {
                if (this.qrTimer) {
                    clearInterval(this.qrTimer);
                    this.qrTimer = null;
                }
                const statusCode = lastDisconnect?.error?.output?.statusCode;
                const shouldReconnect = statusCode !== baileys_1.DisconnectReason.loggedOut;
                if (shouldReconnect) {
                    console.log('❌ Connection closed. Reconnecting in 5 seconds...');
                    setTimeout(() => this.connect(), 5000);
                }
                else {
                    this.isConnected = false;
                    this.emit('disconnected');
                }
            }
            else if (connection === 'open') {
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
            if (type !== 'notify')
                return;
            for (const msg of messages) {
                console.log(`📧 Processing message: key.fromMe=${msg.key.fromMe}, hasMessage=${!!msg.message}, remoteJid=${msg.key.remoteJid}, participant=${msg.key.participant}`);
                try {
                    // Skip messages that can't be decrypted
                    if (!msg.message)
                        continue;
                    // Skip messages that can't be decrypted
                    if (!msg.message)
                        continue;
                    const jid = msg.key.remoteJid;
                    const isGroup = jid.endsWith('@g.us');
                    if (isGroup) {
                        try {
                            // Fetch group metadata which helps establish sessions
                            const metadata = await this.sock.groupMetadata(jid);
                            this.groupMetaCache.set(jid, metadata);
                            console.log(`📍 Group JID: ${jid} - Session established`);
                        }
                        catch (e) {
                            // Ignore errors here
                        }
                    }
                    this.emit('message', {
                        msg,
                        jid,
                        isGroup,
                        senderJid: msg.key.remoteJid,
                        text: this.getMessageText(msg),
                        isMentioned: this.isMentioned(msg),
                        mentionedJids: msg.message?.contextInfo?.mentionedJid || [],
                    });
                    console.log('✅ Message emitted successfully');
                }
                catch (err) {
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
            if (action === 'add' && botJid) {
                const isBotAdded = participants.some((p) => p.id === botJid);
                if (isBotAdded) {
                    try {
                        // Send a message to establish sender key
                        await this.sock?.sendMessage(id, { text: '👋 Bot connected! Use .help for commands.' });
                    }
                    catch (e) {
                        console.log('Could not send join message');
                    }
                }
            }
            this.emit('groupUpdate', { jid: id, participants, action });
        });
    }
    getMessageText(msg) {
        const message = msg.message;
        if (!message)
            return '';
        if (message.conversation)
            return message.conversation;
        if (message.extendedTextMessage?.text)
            return message.extendedTextMessage.text;
        if (message.imageMessage?.caption)
            return message.imageMessage.caption;
        if (message.videoMessage?.caption)
            return message.videoMessage.caption;
        if (message.documentMessage?.caption)
            return message.documentMessage.caption;
        return '';
    }
    isMentioned(msg) {
        return !!msg.message?.contextInfo?.mentionedJid?.length;
    }
    async sendMessage(jid, text) {
        if (!this.sock)
            return null;
        try {
            return await this.sock.sendMessage(jid, { text });
        }
        catch (error) {
            const errorMsg = error?.message || String(error);
            const statusCode = error?.data?.statusCode || error?.output?.statusCode;
            // Handle session errors
            if (errorMsg.includes('SessionError') || errorMsg.includes('No sessions') || errorMsg.includes('sender-key')) {
                console.log('Session not established, attempting to establish...');
                try {
                    if (jid.endsWith('@g.us')) {
                        try {
                            await this.sock.groupMetadata(jid);
                        }
                        catch (e) { /* ignore */ }
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    return await this.sock.sendMessage(jid, { text });
                }
                catch (retryError) {
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
    async sendReply(jid, messageId, text) {
        if (!this.sock)
            return null;
        try {
            return await this.sock.sendMessage(jid, { text }, { quoted: { key: { remoteJid: jid }, message: {} } });
        }
        catch (error) {
            const errorMsg = error?.message || String(error);
            if (errorMsg.includes('SessionError') || errorMsg.includes('No sessions') || errorMsg.includes('sender-key')) {
                console.log('Session not established for reply, attempting to establish...');
                try {
                    if (jid.endsWith('@g.us')) {
                        try {
                            await this.sock.groupMetadata(jid);
                        }
                        catch (e) { /* ignore */ }
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    return await this.sock.sendMessage(jid, { text }, { quoted: { key: { remoteJid: jid }, message: {} } });
                }
                catch (retryError) {
                    console.error('Failed to establish session for reply:', retryError);
                    throw error;
                }
            }
            throw error;
        }
    }
    async reply(messageId, jid, text) {
        if (!this.sock)
            return null;
        try {
            return await this.sock.sendMessage(jid, { text }, { quoted: { key: { remoteJid: jid }, message: {} } });
        }
        catch (error) {
            const errorMsg = error?.message || String(error);
            if (errorMsg.includes('SessionError') || errorMsg.includes('No sessions') || errorMsg.includes('sender-key')) {
                console.log('Session not established for reply, attempting to establish...');
                try {
                    if (jid.endsWith('@g.us')) {
                        try {
                            await this.sock.groupMetadata(jid);
                        }
                        catch (e) { /* ignore */ }
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    return await this.sock.sendMessage(jid, { text }, { quoted: { key: { remoteJid: jid }, message: {} } });
                }
                catch (retryError) {
                    console.error('Failed to establish session for reply:', retryError);
                    throw error;
                }
            }
            throw error;
        }
    }
    async sendMention(jid, text, mentionedJids) {
        if (!this.sock)
            return null;
        try {
            return await this.sock.sendMessage(jid, { text, mentions: mentionedJids });
        }
        catch (error) {
            const errorMsg = error?.message || String(error);
            if (errorMsg.includes('SessionError') || errorMsg.includes('No sessions') || errorMsg.includes('sender-key')) {
                console.log('Session not established for mention, attempting to establish...');
                try {
                    if (jid.endsWith('@g.us')) {
                        try {
                            await this.sock.groupMetadata(jid);
                        }
                        catch (e) { /* ignore */ }
                        await new Promise(resolve => setTimeout(resolve, 1000));
                        await new Promise(resolve => setTimeout(resolve, 500));
                    }
                    return await this.sock.sendMessage(jid, { text, mentions: mentionedJids });
                }
                catch (retryError) {
                    console.error('Failed to establish session for mention:', retryError);
                    throw error;
                }
            }
            throw error;
        }
    }
    async getGroupMetadata(jid) {
        if (!this.sock)
            return null;
        return this.sock.groupMetadata(jid);
    }
    async getGroupAdmins(groupJid) {
        try {
            const metadata = this.groupMetaCache.get(groupJid);
            if (!metadata?.participants)
                return [];
            return metadata.participants.filter((p) => p.admin).map((p) => p.id);
        }
        catch {
            return [];
        }
    }
    async removeParticipant(groupJid, participantJid) {
        if (!this.sock)
            return null;
        return this.sock.groupParticipantsUpdate(groupJid, [participantJid], 'remove');
    }
    async addParticipant(groupJid, participantJid) {
        if (!this.sock)
            return null;
        return this.sock.groupParticipantsUpdate(groupJid, [participantJid], 'add');
    }
    async promoteParticipant(groupJid, participantJid) {
        if (!this.sock)
            return null;
        return this.sock.groupParticipantsUpdate(groupJid, [participantJid], 'promote');
    }
    async demoteParticipant(groupJid, participantJid) {
        if (!this.sock)
            return null;
        return this.sock.groupParticipantsUpdate(groupJid, [participantJid], 'demote');
    }
    getSocket() { return this.sock; }
    isReady() { return this.isConnected; }
    getjid() {
        if (!this.sock?.user?.id)
            return null;
        return this.sock.user.id;
    }
}
exports.WhatsAppClient = WhatsAppClient;
exports.waClient = new WhatsAppClient();
exports.default = exports.waClient;
//# sourceMappingURL=client.js.map