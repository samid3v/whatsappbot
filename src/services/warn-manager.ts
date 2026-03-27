import { userOps, logOps } from '../database/db';
import { waClient } from '../client';
import config from '../utils/config';
import { formatJid, getTimestamp } from '../utils/helpers';
import { muteManager } from '../services/mute-manager.js';
import { msg } from '../utils/messages';

export class WarnManager {
    private warnThreshold = config.warnThreshold;
    private muteDurationHours = config.muteDurationHours;

    async warnUser(jid: string, groupJid: string, reason: string = 'Link detected'): Promise<{
        success: boolean;
        warning: number;
        message: string;
        shouldMute: boolean;
    }> {
        // Get user and increment warning
        const user = userOps.addWarning(jid);
        const warnings = user.warnings;

        // Log the warning
        logOps.add('warn', groupJid, jid, reason);

        // Get user name for message
        const userName = user.name || formatJid(jid);

        const shouldMute = warnings >= this.warnThreshold;

        await waClient.sendMessage(groupJid, msg.warningIssued(userName, reason, warnings, this.warnThreshold, shouldMute));

        // Check if should mute
        if (warnings >= this.warnThreshold) {
            await muteManager.muteUser(jid, groupJid, this.muteDurationHours * 60, 'Automatic mute due to excessive warnings');
            return {
                success: true,
                warning: warnings,
                message: 'Warning issued - auto-muting',
                shouldMute: true,
            };
        }

        return {
            success: true,
            warning: warnings,
            message: 'Warning issued',
            shouldMute: false,
        };
    }

    async getWarnings(jid: string): Promise<number> {
        const user = userOps.get(jid);
        return user?.warnings || 0;
    }

    async clearWarnings(jid: string, groupJid: string): Promise<boolean> {
        userOps.clearWarnings(jid);
        logOps.add('clear_warnings', groupJid, jid);
        return true;
    }

    async checkUserWarnings(jid: string): Promise<number> {
        const user = userOps.get(jid);
        return user?.warnings || 0;
    }
}

export const warnManager = new WarnManager();
export default warnManager;
