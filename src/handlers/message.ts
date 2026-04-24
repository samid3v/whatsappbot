import { waClient } from '../client';
import { roleManager } from '../services/role-manager';
import { warnManager } from '../services/warn-manager';
import { muteManager } from '../services/mute-manager';
import { parseCommand, getCommand, checkPermission } from './commands';
import { shouldWarnForLink } from './link-detector';
import { userOps } from '../database/db';
import { CommandContext } from '../types';
import config, { isGroupAllowed } from '../utils/config';
import { formatJid } from '../utils/helpers';
import { msg } from '../utils/messages';

interface MessageData {
    msg: any;
    jid: string;
    isGroup: boolean;
    senderJid: string;
    text: string;
    isMentioned: boolean;
    mentionedJids: string[];
    quotedSenderJid?: string;
    hasImage: boolean;
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

                // Check if user is muted - must check AFTER user is in database
                console.log(`[MessageHandler] Checking mute for: ${senderJid}`);
                const mutedCheck = await muteManager.isMuted(senderJid);
                console.log(`[MessageHandler] Mute check result for ${senderJid}: ${mutedCheck}`);
                if (mutedCheck) {
                    // User is muted - delete their message and handle spam
                    console.log(`🔇 Muted user ${senderJid} tried to send message, deleting`);

                    // Delete the muted user's message
                    try {
                        await waClient.deleteMessage(jid, data.msg.key);
                    } catch (e) {
                        console.log('Could not delete message:', e);
                    }

                    // Track muted message count for spam detection
                    console.log(`[MuteSpam] About to increment count for ${senderJid}`);
                    const messageCount = userOps.incrementMutedMessageCount(senderJid);
                    console.log(`[MuteSpam] Count after increment: ${messageCount}`);
                    const user = userOps.get(senderJid);
                    console.log(`[MuteSpam] User ${senderJid} has sent ${messageCount} messages while muted, user.is_muted=${user?.is_muted}, user.muted_messages_count=${user?.muted_messages_count}`);

                    // Handle spam: warn at 3 messages, kick at 5
                    if (messageCount >= 5) {
                        // Get user name for the message
                        const userName = user?.name || formatJid(senderJid);

                        // Kick the user from group
                        console.log(`[MuteSpam] Kicking user ${senderJid} for spam (${messageCount} messages)`);
                        try {
                            await waClient.removeParticipant(jid, senderJid);
                            // Clear mute data since user is kicked
                            userOps.unmute(senderJid);
                            userOps.clearMutedSpamData(senderJid);
                            await waClient.sendMention(jid, msg.userKicked(formatJid(senderJid), `${messageCount} messages while muted`), [senderJid]);
                        } catch (e) {
                            console.log('Could not kick user:', e);
                            await waClient.sendMessage(jid, `⚠️ ${userName} should be removed manually (${messageCount} muted messages).`);
                        }
                    } else if (messageCount >= 3) {
                        // Warn the user about being kicked
                        const remaining = 5 - messageCount;
                        console.log(`[MuteSpam] Warning user ${senderJid} - ${remaining} messages until kick`);
                        await waClient.sendMention(jid, msg.muteWarning(remaining), [senderJid]);
                    }

                    return;
                }

                // Check for link in message
                if (text && shouldWarnForLink(text, userRole)) {
                    console.log(`[LinkSpam] Link detected from ${senderJid}`);

                    // Delete the message with link
                    try {
                        await waClient.deleteMessage(jid, data.msg.key);
                    } catch (e) {
                        console.log('Could not delete link message:', e);
                    }

                    // Track link violations
                    const linkCount = userOps.incrementLinkCount(senderJid);
                    const user = userOps.get(senderJid);
                    const userName = user?.name || formatJid(senderJid);

                    // Link spam: 1-2 = warn, 3-4 = mute, 5+ = kick
                    if (linkCount >= 5) {
                        // Kick for link spam
                        console.log(`[LinkSpam] Kicking ${senderJid} for link spam (${linkCount} links)`);
                        try {
                            await waClient.removeParticipant(jid, senderJid);
                            userOps.clearLinkSpamData(senderJid);
                            await waClient.sendMention(jid, msg.linkSpamKicked(linkCount), [senderJid]);
                        } catch (e) {
                            console.log('Could not kick user:', e);
                        }
                    } else if (linkCount >= 3) {
                        // Mute for repeated links
                        console.log(`[LinkSpam] Muting ${senderJid} for link spam (${linkCount} links)`);
                        await muteManager.muteUser(senderJid, jid, 60, 'Link spam');
                        userOps.clearLinkSpamData(senderJid);
                    } else if (linkCount >= 1) {
                        // Warn for first links
                        console.log(`[LinkSpam] Warning ${senderJid} for link (${linkCount}/5)`);
                        await waClient.sendMention(jid, msg.linkWarning(linkCount), [senderJid]);
                    }
                    return;
                }

                // Check for Kasongo mention (AI coach)
                if (text && text.toLowerCase().includes('blitza')) {
                    try {
                        const { blitzaPersonality } = await import('../services/blitza-personality');
                        const { chatFlowAnalyzer } = await import('../services/chat-flow-analyzer');
                        
                        const language = chatFlowAnalyzer.getGroupLanguage(jid);
                        const response = await blitzaPersonality.processMessage({
                            groupJid: jid,
                            senderJid,
                            messageText: text,
                            language
                        });

                        if (response) {
                            await waClient.sendMessage(jid, response);
                        }
                    } catch (error) {
                        console.error('Error processing Kasongo message:', error);
                    }
                    // Don't return - allow command processing too
                }

                // Check if it's a command
                const command = parseCommand(text);

                if (!command) return;

                // Get command handler
                const cmd = getCommand(command.name);
                console.log(`📦 Command handler: ${cmd ? cmd.name : 'NOT FOUND'}`);
                if (!cmd) {
                    await waClient.sendMessage(jid, msg.unknownCommand(command.name));
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
                    await waClient.sendMessage(jid, msg.usage(cmd.usage));
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
                            await waClient.sendMessage(jid, msg.sessionInit());
                            await cmd.execute(command.args, permission);
                        } catch (retryError) {
                            console.error('Session establishment failed:', retryError);
                        }
                    } else if (errorMsg.includes('Cannot send to this group') || errorMsg.includes('not-acceptable')) {
                        console.log('Bot cannot send to this group - may have been removed');
                    } else {
                        console.error('Command execution error:', error);
                        try {
                            await waClient.sendMessage(jid, msg.error());
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
            quotedSenderJid: data.quotedSenderJid,
            mentionedJids: data.mentionedJids,
            hasImage: data.hasImage,
        };
    }

    isReady(): boolean {
        return this.initialized;
    }
}

export const messageHandler = new MessageHandler();
export default messageHandler;
