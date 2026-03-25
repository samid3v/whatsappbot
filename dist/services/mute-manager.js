"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.muteManager = exports.MuteManager = void 0;
const db_1 = require("../database/db");
const client_1 = require("../client");
const helpers_1 = require("../utils/helpers");
class MuteManager {
    muteTimers = new Map();
    async muteUser(jid, groupJid, durationMinutes, reason = 'Violation') {
        // Calculate expiry time
        const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();
        // Mute user in database
        db_1.userOps.mute(jid, expiresAt);
        // Log the mute
        db_1.logOps.add('mute', groupJid, jid, `${reason} - ${durationMinutes} minutes`);
        // Get user name for message
        const userName = (0, helpers_1.formatJid)(jid);
        let message = `🔇 *User Muted*\n\n`;
        message += `👤 User: ${userName}\n`;
        message += `📌 Reason: ${reason}\n`;
        message += `⏱️ Duration: ${Math.floor(durationMinutes / 60)} hours ${durationMinutes % 60} minutes\n`;
        message += `🕐 Expires: ${(0, helpers_1.formatDate)(expiresAt)}`;
        // Send mute message to group
        await client_1.waClient.sendMessage(groupJid, message);
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
        // Unmute user in database
        db_1.userOps.unmute(jid);
        // Log the unmute
        db_1.logOps.add('unmute', groupJid, jid);
        // Get user name for message
        const userName = (0, helpers_1.formatJid)(jid);
        let message = `🔊 *User Unmuted*\n\n`;
        message += `👤 User: ${userName}\n`;
        message += `✅ The user can now send messages again.`;
        // Send unmute message to group
        await client_1.waClient.sendMessage(groupJid, message);
        return {
            success: true,
            message,
        };
    }
    async isMuted(jid) {
        const user = db_1.userOps.get(jid);
        if (!user?.is_muted)
            return false;
        // Check if mute has expired
        if (user.mute_expires_at && new Date(user.mute_expires_at) <= new Date()) {
            // Auto-unmute expired
            db_1.userOps.unmute(jid);
            return false;
        }
        return true;
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