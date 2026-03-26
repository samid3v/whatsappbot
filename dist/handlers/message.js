"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.messageHandler = exports.MessageHandler = void 0;
const client_1 = require("../client");
const role_manager_1 = require("../services/role-manager");
const warn_manager_1 = require("../services/warn-manager");
const mute_manager_1 = require("../services/mute-manager");
const commands_1 = require("./commands");
const link_detector_1 = require("./link-detector");
const db_1 = require("../database/db");
const config_1 = require("../utils/config");
const helpers_1 = require("../utils/helpers");
class MessageHandler {
    initialized = false;
    async initialize() {
        // Set up event listeners
        client_1.waClient.on('message', this.handleMessage.bind(this));
        client_1.waClient.on('connected', this.onConnected.bind(this));
        client_1.waClient.on('disconnected', this.onDisconnected.bind(this));
        this.initialized = true;
        console.log('✅ Message handler initialized');
    }
    async onConnected() {
        const botJid = client_1.waClient.getjid();
        if (botJid) {
            role_manager_1.roleManager.setOwner(botJid);
            console.log(`👑 Bot owner set: ${botJid}`);
        }
    }
    onDisconnected() {
        console.log('❌ Disconnected from WhatsApp');
    }
    async handleMessage(data) {
        console.log('🚀 handleMessage called!');
        try {
            const { jid, isGroup, senderJid, text } = data;
            // Debug: log all incoming messages
            console.log(`📥 Message: "${text?.substring(0, 30)}..." from ${senderJid}, group: ${isGroup}, jid: ${jid}`);
            // Only process group messages for moderation
            if (!isGroup)
                return;
            // Check if this group is allowed to use the bot
            if (!(0, config_1.isGroupAllowed)(jid)) {
                return;
            }
            try {
                // Ensure user exists in database
                const pushName = data.msg?.pushName || 'Unknown';
                db_1.userOps.getOrCreate(senderJid, pushName);
                // Get user role
                const userRole = await role_manager_1.roleManager.getUserRole(senderJid);
                // Check if user is muted - must check AFTER user is in database
                console.log(`[MessageHandler] Checking mute for: ${senderJid}`);
                const mutedCheck = await mute_manager_1.muteManager.isMuted(senderJid);
                console.log(`[MessageHandler] Mute check result for ${senderJid}: ${mutedCheck}`);
                if (mutedCheck) {
                    // User is muted - delete their message and handle spam
                    console.log(`🔇 Muted user ${senderJid} tried to send message, deleting`);
                    // Delete the muted user's message
                    try {
                        await client_1.waClient.deleteMessage(jid, data.msg.key);
                    }
                    catch (e) {
                        console.log('Could not delete message:', e);
                    }
                    // Track muted message count for spam detection
                    console.log(`[MuteSpam] About to increment count for ${senderJid}`);
                    const messageCount = db_1.userOps.incrementMutedMessageCount(senderJid);
                    console.log(`[MuteSpam] Count after increment: ${messageCount}`);
                    const user = db_1.userOps.get(senderJid);
                    console.log(`[MuteSpam] User ${senderJid} has sent ${messageCount} messages while muted, user.is_muted=${user?.is_muted}, user.muted_messages_count=${user?.muted_messages_count}`);
                    // Handle spam: warn at 3 messages, kick at 5
                    if (messageCount >= 5) {
                        // Get user name for the message
                        const userName = user?.name || (0, helpers_1.formatJid)(senderJid);
                        // Kick the user from group
                        console.log(`[MuteSpam] Kicking user ${senderJid} for spam (${messageCount} messages)`);
                        try {
                            await client_1.waClient.removeParticipant(jid, senderJid);
                            // Clear mute data since user is kicked
                            db_1.userOps.unmute(senderJid);
                            db_1.userOps.clearMutedSpamData(senderJid);
                            await client_1.waClient.sendMessage(jid, `🚫 *User Kicked*\n\n👤 User: ${userName}\n\n⚠️ Removed from group for sending ${messageCount} messages while muted.`);
                        }
                        catch (e) {
                            console.log('Could not kick user:', e);
                            await client_1.waClient.sendMessage(jid, `⚠️ ${userName} has been muted ${messageCount} times and should be removed manually.`);
                        }
                    }
                    else if (messageCount >= 3) {
                        // Warn the user about being kicked
                        const remaining = 5 - messageCount;
                        console.log(`[MuteSpam] Warning user ${senderJid} - ${remaining} messages until kick`);
                        await client_1.waClient.sendMessage(jid, `⚠️ *Mute Warning*\n\n👤 ${user?.name || (0, helpers_1.formatJid)(senderJid)}\n\nYou have sent ${messageCount} messages while muted.\n${remaining} more messages will result in removal from the group!\n\nPlease respect the mute.`);
                    }
                    return;
                }
                // Check for link in message
                if (text && (0, link_detector_1.shouldWarnForLink)(text, userRole)) {
                    await warn_manager_1.warnManager.warnUser(senderJid, jid, 'Link detected');
                    // Note: Can't delete message with Baileys, but we warned them
                    return;
                }
                // Check if it's a command
                const command = (0, commands_1.parseCommand)(text);
                if (!command)
                    return;
                // Get command handler
                const cmd = (0, commands_1.getCommand)(command.name);
                console.log(`📦 Command handler: ${cmd ? cmd.name : 'NOT FOUND'}`);
                if (!cmd) {
                    await client_1.waClient.sendMessage(jid, `❓ Unknown command: ${command.name}\nUse !help for available commands.`);
                    return;
                }
                // Check if user has permission
                const permission = await this.getCommandContext(data, command.name);
                const canExecute = await (0, commands_1.checkPermission)(permission, cmd.requiredRole);
                if (!canExecute.allowed) {
                    if (canExecute.message) {
                        await client_1.waClient.sendMessage(jid, canExecute.message);
                    }
                    return;
                }
                // Check minimum arguments
                if (cmd.minArgs && command.args.length < cmd.minArgs) {
                    await client_1.waClient.sendMessage(jid, `📋 Usage: ${cmd.usage}`);
                    return;
                }
                // Execute command with error handling for session issues
                try {
                    await cmd.execute(command.args, permission);
                }
                catch (error) {
                    const errorMsg = error?.message || String(error);
                    // Check for session-related errors
                    if (errorMsg.includes('SessionError') || errorMsg.includes('No sessions') || errorMsg.includes('sender-key')) {
                        console.log('Session not established for group, attempting to establish...');
                        try {
                            // Try to establish session by sending a message
                            await client_1.waClient.sendMessage(jid, '🔄 Initializing bot session...');
                            // Retry the command
                            await cmd.execute(command.args, permission);
                        }
                        catch (retryError) {
                            console.error('Session establishment failed:', retryError);
                            // Don't try to send message - the group may be inaccessible
                        }
                    }
                    else if (errorMsg.includes('Cannot send to this group') || errorMsg.includes('not-acceptable')) {
                        console.log('Bot cannot send to this group - may have been removed');
                        // Don't try to send any message
                    }
                    else {
                        console.error('Command execution error:', error);
                        // Only try to send error message if we can send to this group
                        try {
                            await client_1.waClient.sendMessage(jid, '❌ An error occurred while executing the command.');
                        }
                        catch (sendError) {
                            console.log('Cannot send error message to group');
                        }
                    }
                }
            }
            catch (error) {
                console.error('Error handling message:', error);
            }
        }
        catch (err) {
            console.error('Outer catch:', err);
        }
    }
    async getCommandContext(data, commandName) {
        const { jid, senderJid, isGroup } = data;
        // Get user role from database
        const userRole = await role_manager_1.roleManager.getUserRole(senderJid);
        const isOwner = senderJid === role_manager_1.roleManager.getOwner();
        // Check WhatsApp group admin status if in a group
        let isWhatsAppAdmin = false;
        if (isGroup) {
            isWhatsAppAdmin = await role_manager_1.roleManager.isGroupAdmin(jid, senderJid);
        }
        // User is admin if they're WhatsApp admin OR have admin role in database
        const isAdmin = userRole === 'admin' || isWhatsAppAdmin || isOwner;
        const isModerator = userRole === 'moderator' || isAdmin;
        // Get user info
        const user = db_1.userOps.get(senderJid);
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
        };
    }
    isReady() {
        return this.initialized;
    }
}
exports.MessageHandler = MessageHandler;
exports.messageHandler = new MessageHandler();
exports.default = exports.messageHandler;
//# sourceMappingURL=message.js.map