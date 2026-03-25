import { waClient } from '../client';
import { roleManager } from '../services/role-manager';
import { warnManager } from '../services/warn-manager';
import { muteManager } from '../services/mute-manager';
import { parseCommand, getCommand, checkPermission } from './commands';
import { shouldWarnForLink } from './link-detector';
import { userOps } from '../database/db';
import { CommandContext } from '../types';
import config, { isGroupAllowed } from '../utils/config';

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
        console.log('🚀 handleMessage called!');

        try {
            const { jid, isGroup, senderJid, text } = data;

            // Debug: log all incoming messages
            console.log(`📥 Message: "${text?.substring(0, 30)}..." from ${senderJid}, group: ${isGroup}, jid: ${jid}`);

            // Only process group messages for moderation
            if (!isGroup) return;

            // Check if this group is allowed to use the bot
            if (!isGroupAllowed(jid)) {
                return;
            }

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
                console.log(`🔍 Parsed command: ${JSON.stringify(command)}`);

                if (!command) return;

                // Get command handler
                const cmd = getCommand(command.name);
                console.log(`📦 Command handler: ${cmd ? cmd.name : 'NOT FOUND'}`);
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
                            console.error('Session establishment failed:', retryError);
                            // Don't try to send message - the group may be inaccessible
                        }
                    } else if (errorMsg.includes('Cannot send to this group') || errorMsg.includes('not-acceptable')) {
                        console.log('Bot cannot send to this group - may have been removed');
                        // Don't try to send any message
                    } else {
                        console.error('Command execution error:', error);
                        // Only try to send error message if we can send to this group
                        try {
                            await waClient.sendMessage(jid, '❌ An error occurred while executing the command.');
                        } catch (sendError) {
                            console.log('Cannot send error message to group');
                        }
                    }
                }

            } catch (error) {
                console.error('Error handling message:', error);
            }
        } catch (err) {
            console.error('Outer catch:', err);
        }
    }

    private async getCommandContext(data: MessageData, commandName: string): Promise<CommandContext> {
        const { jid, senderJid, isGroup } = data;

        // Get user role from database
        const userRole = await roleManager.getUserRole(senderJid);
        const isOwner = senderJid === roleManager.getOwner();

        // Check WhatsApp group admin status if in a group
        let isWhatsAppAdmin = false;
        if (isGroup) {
            isWhatsAppAdmin = await roleManager.isGroupAdmin(jid, senderJid);
        }

        // User is admin if they're WhatsApp admin OR have admin role in database
        const isAdmin = userRole === 'admin' || isWhatsAppAdmin || isOwner;
        const isModerator = userRole === 'moderator' || isAdmin;

        // Get user info
        const user = userOps.get(senderJid);
        const name = user?.name || data.msg?.pushName || 'Unknown';

        return {
            jid,
            name,
            isGroup,
            isAdmin,
            isOwner,
            isModerator,
            senderJid,
        };
    }

    isReady(): boolean {
        return this.initialized;
    }
}

export const messageHandler = new MessageHandler();
export default messageHandler;
