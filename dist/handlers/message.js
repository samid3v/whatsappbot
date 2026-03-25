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
                // Check if user is muted
                if (await mute_manager_1.muteManager.isMuted(senderJid)) {
                    // Delete the message silently (can't do this with Baileys, just ignore)
                    console.log(`🔇 Muted user ${senderJid} tried to send message`);
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
                console.log(`🔍 Parsed command: ${JSON.stringify(command)}`);
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