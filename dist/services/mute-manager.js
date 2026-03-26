"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.muteManager = exports.MuteManager = void 0;
const db_1 = require("../database/db");
const client_1 = require("../client");
const helpers_1 = require("../utils/helpers");
class MuteManager {
    muteTimers = new Map();
    async muteUser(jid, groupJid, durationMinutes, reason = 'Violation') {
        // Get phone number for logging
        const phoneNumber = jid.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '');
        console.log(`[muteUser] Attempting to mute jid=${jid}, phone=${phoneNumber}, duration=${durationMinutes}m`);
        // Ensure user exists in database first
        const user = db_1.userOps.getOrCreate(jid);
        console.log(`[muteUser] User after getOrCreate:`, user ? `id=${user.id}, jid=${user.jid}, is_muted=${user.is_muted}` : 'null');
        // Calculate expiry time
        const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
        // Mute user in database
        db_1.userOps.mute(jid, expiresAt);
        // Verify the mute was set
        const userAfterMute = db_1.userOps.get(jid);
        console.log(`[muteUser] After mute: is_muted=${userAfterMute?.is_muted}, expires=${userAfterMute?.mute_expires_at}`);
        // Log the mute
        db_1.logOps.add('mute', groupJid, jid, `${reason} - ${durationMinutes} minutes`);
        // Get user name - try to get from database, or from WhatsApp group metadata
        let userName = user?.name || (0, helpers_1.formatJid)(jid);
        // Try to get better name from WhatsApp group participants
        try {
            const metadata = await client_1.waClient.getGroupMetadata(groupJid);
            const participant = metadata?.participants?.find((p) => p.id === jid);
            if (participant?.name || participant?.notify) {
                userName = participant.name || participant.notify;
            }
        }
        catch (e) {
            // Ignore errors getting group metadata
        }
        let message = `🔇 *User Muted*

`;
        message += `👤 User: ${userName}\n`;
        message += `📌 Reason: ${reason}\n`;
        message += `⏱️ Duration: ${(0, helpers_1.formatDurationString)(durationMinutes)}\n`;
        message += `🕐 Expires: ${(0, helpers_1.formatDate)(expiresAt)}\n\n`;
        message += `⚠️ *Your messages will be deleted while muted!*\n`;
        message += `🚫 Repeated messages may result in removal from group.`;
        // Send mute message to group with mention
        await client_1.waClient.sendMention(groupJid, message, [jid]);
        // Set auto-unmute timer
        const timer = setTimeout(async () => {
            await this.unmuteUser(jid, groupJid);
        }, durationMinutes * 60 * 1000);
        this.muteTimers.set(jid, timer);
        return {
            success: true,
            expiresAt,
            message,
        };
    }
    async unmuteUser(jid, groupJid) {
        // Clear any existing timer
        const existingTimer = this.muteTimers.get(jid);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.muteTimers.delete(jid);
        }
        // Check if user is still in the group before trying to unmute
        // If they're not in the group, don't send the unmute message
        try {
            const metadata = await client_1.waClient.getGroupMetadata(groupJid);
            const participant = metadata?.participants?.find((p) => p.id === jid);
            if (!participant) {
                console.log(`[unmuteUser] User ${jid} is no longer in group ${groupJid}, skipping unmute message`);
                // Still update the database but don't send message
                db_1.userOps.unmute(jid);
                db_1.userOps.clearMutedSpamData(jid);
                db_1.logOps.add('unmute', groupJid, jid, 'User was kicked - auto unmute');
                return {
                    success: true,
                    message: 'User was kicked - no message sent',
                };
            }
        }
        catch (e) {
            console.log('[unmuteUser] Could not check group participants:', e);
        }
        // Clear muted spam data
        db_1.userOps.clearMutedSpamData(jid);
        // Log the unmute
        db_1.logOps.add('unmute', groupJid, jid);
        // Get user name - try to get from database, or from WhatsApp group metadata
        let userName = (0, helpers_1.formatJid)(jid);
        // Try to get better name from WhatsApp group participants
        try {
            const user = db_1.userOps.get(jid);
            if (user?.name) {
                userName = user.name;
            }
            else {
                const metadata = await client_1.waClient.getGroupMetadata(groupJid);
                const participant = metadata?.participants?.find((p) => p.id === jid);
                if (participant?.name || participant?.notify) {
                    userName = participant.name || participant.notify;
                }
            }
        }
        catch (e) {
            // Ignore errors getting group metadata
        }
        let message = `🔊 *User Unmuted*\n\n`;
        message += `👤 User: ${userName}\n`;
        message += `✅ The user can now send messages again.`;
        // Send unmute message to group with mention
        await client_1.waClient.sendMention(groupJid, message, [jid]);
        return {
            success: true,
            message,
        };
    }
    async isMuted(jid) {
        try {
            const user = db_1.userOps.get(jid);
            console.log(`[isMuted] Checking mute for jid: ${jid}, user found: ${!!user}, is_muted: ${user?.is_muted}`);
            if (!user) {
                // User not found in database - they can't be muted
                return false;
            }
            if (!user.is_muted) {
                return false;
            }
            // Check if mute has expired
            if (user.mute_expires_at && new Date(user.mute_expires_at) <= new Date()) {
                // Auto-unmute expired
                console.log(`[isMuted] Mute expired for ${jid}, auto-unmuting`);
                db_1.userOps.unmute(jid);
                return false;
            }
            return true;
        }
        catch (error) {
            console.error(`[isMuted] Error checking mute status:`, error);
            return false;
        }
    }
    async checkExpiredMutes() {
        const expiredMutes = db_1.userOps.getExpiredMutes();
        for (const user of expiredMutes) {
            // These will be handled by the check in isMuted
            // But we can also notify the group if needed
        }
    }
    getMuteExpiry(jid) {
        const user = db_1.userOps.get(jid);
        return user?.mute_expires_at || null;
    }
}
exports.MuteManager = MuteManager;
exports.muteManager = new MuteManager();
exports.default = exports.muteManager;
//# sourceMappingURL=mute-manager.js.map