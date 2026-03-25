import { waClient } from '../client';
import { roleManager } from '../services/role-manager';
import { warnManager } from '../services/warn-manager';
import { muteManager } from '../services/mute-manager';
import { parseCommand, getCommand, checkPermission } from './commands';
import { shouldWarnForLink } from './link-detector';
import { userOps } from '../database/db';
import { CommandContext } from '../types';

interface MessageData {
    msg: any;
    jid: string;
    isGroup: boolean;
    senderJid: string;
    text: string;
    isMentioned: boolean;
    mentionedJids: string[];
}

export class MessageHandler {
    private initialized: boolean = false;

    async initialize(): Promise<void> {
        // Set up event listeners
        waClient.on('message', this.handleMessage.bind(this));
        waClient.on('connected', this.onConnected.bind(this));
        waClient.on('disconnected', this.onDisconnected.bind(this));

        this.initialized = true;
        console.log('✅ Message handler initialized');
    }

    private async onConnected(): Promise<void> {
        const botJid = waClient.getjid();
        if (botJid) {
            roleManager.setOwner(botJid);
            console.log(`👑 Bot owner set: ${botJid}`);
        }
    }

    private onDisconnected(): void {
        console.log('❌ Disconnected from WhatsApp');
    }

    private async handleMessage(data: MessageData): Promise<void> {
        const { jid, isGroup, senderJid, text } = data;

        // Only process group messages for moderation
        if (!isGroup) return;

        try {
            // Ensure user exists in database
            const pushName = data.msg?.pushName || 'Unknown';
            userOps.getOrCreate(senderJid, pushName);

            // Get user role
            const userRole = await roleManager.getUserRole(senderJid);

            // Check if user is muted
            if (await muteManager.isMuted(senderJid)) {
                // Delete the message silently (can't do this with Baileys, just ignore)
                console.log(`🔇 Muted user ${senderJid} tried to send message`);
                return;
            }

            // Check for link in message
            if (text && shouldWarnForLink(text, userRole)) {
                await warnManager.warnUser(senderJid, jid, 'Link detected');
                // Note: Can't delete message with Baileys, but we warned them
                return;
            }

            // Check if it's a command
            const command = parseCommand(text);
            if (!command) return;

            // Get command handler
            const cmd = getCommand(command.name);
            if (!cmd) {
                await waClient.sendMessage(jid, `❓ Unknown command: ${command.name}\nUse !help for available commands.`);
                return;
            }

            // Check if user has permission
            const permission = await this.getCommandContext(data, command.name);
            const canExecute = await checkPermission(permission, cmd.requiredRole);

            if (!canExecute.allowed) {
                if (canExecute.message) {
                    await waClient.sendMessage(jid, canExecute.message);
                }
                return;
            }

            // Check minimum arguments
            if (cmd.minArgs && command.args.length < cmd.minArgs) {
                await waClient.sendMessage(jid, `📋 Usage: ${cmd.usage}`);
                return;
            }

            // Execute command with error handling for session issues
            try {
                await cmd.execute(command.args, permission);
            } catch (error: any) {
                const errorMsg = error?.message || String(error);
                // Check for session-related errors
                if (errorMsg.includes('SessionError') || errorMsg.includes('No sessions') || errorMsg.includes('sender-key')) {
                    console.log('Session not established for group, attempting to establish...');
                    try {
                        // Try to establish session by sending a message
                        await waClient.sendMessage(jid, '🔄 Initializing bot session...');
                        // Retry the command
                        await cmd.execute(command.args, permission);
                    } catch (retryError) {
                        await waClient.sendMessage(jid, '⚠️ Session issue. Please wait a moment and try again.');
                        console.error('Session establishment failed:', retryError);
                    }
               