import makeWASocket from '@whiskeysockets/baileys';
import { EventEmitter } from 'events';
type WhatsAppSocket = ReturnType<typeof makeWASocket>;
export declare class WhatsAppClient extends EventEmitter {
    private sock;
    private isConnected;
    private groupMetaCache;
    private pendingQR;
    private qrTimer;
    connect(): Promise<void>;
    private getMessageText;
    private isMentioned;
    sendMessage(jid: string, text: string): Promise<any>;
    sendReply(jid: string, messageId: string, text: string): Promise<any>;
    reply(messageId: string, jid: string, text: string): Promise<any>;
    sendMention(jid: string, text: string, mentionedJids: string[]): Promise<any>;
    getGroupMetadata(jid: string): Promise<any>;
    getGroupAdmins(groupJid: string): Promise<string[]>;
    removeParticipant(groupJid: string, participantJid: string): Promise<any>;
    addParticipant(groupJid: string, participantJid: string): Promise<any>;
    promoteParticipant(groupJid: string, participantJid: string): Promise<any>;
    demoteParticipant(groupJid: string, participantJid: string): Promise<any>;
    deleteMessage(jid: string, key: any): Promise<any>;
    getSocket(): WhatsAppSocket | null;
    isReady(): boolean;
    getjid(): string | null;
}
export declare const waClient: WhatsAppClient;
export default waClient;
//# sourceMappingURL=client.d.ts.map