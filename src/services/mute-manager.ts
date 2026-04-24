import { userOps, logOps } from '../database/db';
import { waClient } from '../client';
import { formatJid, formatDate, formatDurationString } from '../utils/helpers';
import { msg } from '../utils/messages';

export class MuteManager {
    private muteTimers: Map<string, NodeJS.Timeout> = new Map();

    async muteUser(jid: string, groupJid: string, durationMinutes: number, reason: string = 'Violation'): Promise<{
        success: boolean;
        expiresAt: string;
        message: string;
    }> {
        // Get phone number for logging
        const phoneNumber = jid.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '');
        console.log(`[muteUser] Attempting to mute jid=${jid}, phone=${phoneNumber}, duration=${durationMinutes}m`);

        // Ensure user exists in database first
        const { user } = userOps.getOrCreate(jid);
        console.log(`[muteUser] User after getOrCreate:`, user ? `id=${user.id}, jid=${user.jid}, is_muted=${user.is_muted}` : 'null');

        // Calculate expiry time
        const expiresAt = new Date(Date.now() + durationMinutes * 60 * 1000).toISOString();

        // Mute user in database
        userOps.mute(jid, expiresAt);

        // Verify the mute was set
        const userAfterMute = userOps.get(jid);
        console.log(`[muteUser] After mute: is_muted=${userAfterMute?.is_muted}, expires=${userAfterMute?.mute_expires_at}`);

        // Log the mute
        logOps.add('mute', groupJid, jid, `${reason} - ${durationMinutes} minutes`);

        // Get user name - try to get from database, or from WhatsApp group metadata
        let userName = user?.name;

        // Try to get better name from WhatsApp group participants
        if (!userName) {
            try {
                const metadata = await waClient.getGroupMetadata(groupJid);
                const participant = metadata?.participants?.find((p: any) => p.id === jid);
                if (participant?.name || participant?.notify || participant?.vname) {
                    userName = participant.name || participant.notify || participant.vname;
                }
            } catch (e) {
                // Ignore errors getting group metadata
            }
        }

        // Final fallback to formatted JID
        if (!userName) {
            userName = formatJid(jid);
        }

        // Send mute message to group with mention
        await waClient.sendMention(groupJid, msg.muted(userName, reason, formatDurationString(durationMinutes), formatDate(expiresAt), jid), [jid]);

        // Set auto-unmute timer
        const timer = setTimeout(async () => {
            await this.unmuteUser(jid, groupJid);
        }, durationMinutes * 60 * 1000);

        this.muteTimers.set(jid, timer);

        return {
            success: true,
            expiresAt,
            message: 'User muted',
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

        // Check if user is still in the group before trying to unmute
        // If they're not in the group, don't send the unmute message
        try {
            const metadata = await waClient.getGroupMetadata(groupJid);
            const participant = metadata?.participants?.find((p: any) => p.id === jid);
            if (!participant) {
                console.log(`[unmuteUser] User ${jid} is no longer in group ${groupJid}, skipping unmute message`);
                // Still update the database but don't send message
                userOps.unmute(jid);
                userOps.clearMutedSpamData(jid);
                logOps.add('unmute', groupJid, jid, 'User was kicked - auto unmute');
                return {
                    success: true,
                    message: 'User was kicked - no message sent',
                };
            }
        } catch (e) {
            console.log('[unmuteUser] Could not check group participants:', e);
        }

        // Clear muted spam data
        userOps.clearMutedSpamData(jid);

        // Log the unmute
        logOps.add('unmute', groupJid, jid);

        // Get user name - try to get from database, or from WhatsApp group metadata
        let userName: string | undefined;

        // Try to get better name from WhatsApp group participants
        try {
            const user = userOps.get(jid);
            if (user?.name) {
                userName = user.name;
            } else {
                const metadata = await waClient.getGroupMetadata(groupJid);
                const participant = metadata?.participants?.find((p: any) => p.id === jid);
                if (participant?.name || participant?.notify || participant?.vname) {
                    userName = participant.name || participant.notify || participant.vname;
                }
            }
        } catch (e) {
            // Ignore errors getting group metadata
        }
        
        // Final fallback to formatted JID
        if (!userName) {
            userName = formatJid(jid);
        }

        let message = `🔊 𝚄𝚂𝙴𝚁 𝚄𝙽𝙼𝚄𝚃𝙴𝙳 🔊\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `𝚄𝚂𝙴𝚁: @~~ ${userName}\n`;
        message += `𝚂𝚃𝙰𝚃𝚄𝚂: Can send messages again ✅`;

        // Send unmute message to group with mention
        await waClient.sendMention(groupJid, message, [jid]);

        return {
            success: true,
            message: 'User unmuted',
        };
    }

    async isMuted(jid: string): Promise<boolean> {
        try {
            const user = userOps.get(jid);
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
                userOps.unmute(jid);
                return false;
            }

            return true;
        } catch (error) {
            console.error(`[isMuted] Error checking mute status:`, error);
            return false;
        }
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
