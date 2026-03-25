import { userOps, logOps } from '../database/db';
import { waClient } from '../client';
import { formatJid, formatDate } from '../utils/helpers';

export class MuteManager {
    private muteTimers: Map<string, NodeJS.Timeout> = new Map();

    async muteUser(jid: string, groupJid: string, durationMinutes: number, reason: string = 'Violation'): Promise<{
        success: boolean;
        expiresAt: string;
        message: string;
    }> {
        // Calculate expiry time
        const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

        // Mute user in database
        userOps.mute(jid, expiresAt);

        // Log the mute
        logOps.add('mute', groupJid, jid, `${reason} - ${durationMinutes} minutes`);

        // Get user name for message
        const userName = formatJid(jid);

        let message = `🔇 *User Muted*\n\n`;
        message += `👤 User: ${userName}\n`;
        message += `📌 Reason: ${reason}\n`;
        message += `⏱️ Duration: ${Math.floor(durationMinutes / 60)} hours ${durationMinutes % 60} minutes\n`;
        message += `🕐 Expires: ${formatDate(expiresAt)}`;

        // Send mute message to group
        await waClient.sendMessage(groupJid, message);

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

    async unmuteUser(jid: string, groupJid: string): Promise<{
        success: boolean;
        message: string;
    }> {
        // Clear any existing timer
        const existingTimer = this.muteTimers.get(jid);
        if (existingTimer) {
            clearTimeout(existingTimer);
            this.muteTimers.delete(jid);
        }

        // Unmute user in database
        userOps.unmute(jid);

        // Log the unmute
        logOps.add('unmute', groupJid, jid);

        // Get user name for message
        const userName = formatJid(jid);

        let message = `🔊 *User Unmuted*\n\n`;
        message += `👤 User: ${userName}\n`;
        message += `✅ The user can now send messages again.`;

        // Send unmute message to group
        await waClient.sendMessage(groupJid, message);

        return {
            success: true,
            message,
        };
    }

    async isMuted(jid: string): Promise<boolean> {
        const user = userOps.get(jid);
        if (!user?.is_muted) return false;

        // Check if mute has expired
        if (user.mute_expires_at && new Date(user.mute_expires_at) <= new Date()) {
            // Auto-unmute expired
            userOps.unmute(jid);
            return false;
        }

        return true;
    }

    async checkExpiredMutes(): Promise<void> {
        const expiredMutes = userOps.getExpiredMutes();
        for (const user of expiredMutes) {
            // These will be handled by the check in isMuted
            // But we can also notify the group if needed
        }
    }

    getMuteExpiry(jid: string): string | null {
        const user = userOps.get(jid);
        return user?.mute_expires_at || null;
    }
}

export const muteManager = new MuteManager();
export default muteManager;
