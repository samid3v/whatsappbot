import * as dotenv from 'dotenv';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { BotConfig } from '../types';

// ES module compatibility
const __dirname = path.dirname(fileURLToPath(import.meta.url));

dotenv.config();

// Parse allowed groups from env variable (comma-separated group JIDs)
const allowedGroupsEnv = process.env.ALLOWED_GROUPS || '';
const allowedGroups = allowedGroupsEnv
    .split(',')
    .map(g => g.trim())
    .filter(g => g.length > 0);

export const config: BotConfig = {
    commandPrefix: process.env.COMMAND_PREFIX || '!',
    warnThreshold: parseInt(process.env.WARN_THRESHOLD || '3', 10),
    muteDurationHours: parseInt(process.env.MUTE_DURATION_HOURS || '2', 10),
    sessionPath: path.join(__dirname, '../../sessions'),
    dataPath: path.join(__dirname, '../../data'),
    allowedGroups: allowedGroups,
};

// Helper function to check if a group is allowed
export function isGroupAllowed(jid: string): boolean {
    // If no allowed groups are configured, allow all groups
    if (config.allowedGroups.length === 0) {
        return true;
    }
    return config.allowedGroups.includes(jid);
}

export default config;
