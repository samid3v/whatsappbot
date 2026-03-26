import { User, UserRole } from '../types';

/**
 * Get the numeric level of a role (higher = more权限)
 */
export function getRoleLevel(role: UserRole): number {
    const levels: Record<UserRole, number> = {
        owner: 4,
        admin: 3,
        moderator: 2,
        member: 1,
    };
    return levels[role] || 0;
}

/**
 * Check if role has permission to perform action
 */
export function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean {
    return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}

/**
 * Format WhatsApp jid to user-friendly format
 * Handles @s.whatsapp.net, @lid, and @g.us formats
 */
export function formatJid(jid: string): string {
    // Handle different JID formats
    let formatted = jid
        .replace('@s.whatsapp.net', '')
        .replace('@g.us', '')
        .replace('@lid', '');

    // If it looks like a phone number (starts with + or digits), keep it clean
    // Otherwise, it's likely a LID or other format - just return as is
    return formatted;
}

/**
 * Extract user mention from message
 * Handles formats: @254103608133, @Mido 🎮 (with name), or any text with @mention
 */
export function extractMention(text: string): string | null {
    // First try to match @ followed by digits (phone number format)
    const mentionMatch = text.match(/@(\d+)/);
    if (mentionMatch) {
        return `${mentionMatch[1]}@s.whatsapp.net`;
    }
    return null;
}

/**
 * Extract user JID from mention text or mentionedJids array
 * Takes the first valid mention from the text
 * NOTE: Only uses mentionedJids if args actually contain an @ symbol
 */
export function extractUserJidFromMention(args: string[], mentionedJids: string[]): string | null {
    // If args contain @mention, use it
    const argText = args.join(' ');
    const extracted = extractMention(argText);
    if (extracted) return extracted;

    // Only use mentionedJids if args actually contain an @ symbol (explicit mention)
    // This prevents accidentally using stale mentionedJids from previous messages
    if (argText.includes('@') && mentionedJids && mentionedJids.length > 0) {
        return mentionedJids[0];
    }

    return null;
}

/**
 * Parse command arguments
 */
export function parseArgs(text: string): string[] {
    return text.trim().split(/\s+/).filter(Boolean);
}

/**
 * Format date for display
 */
export function formatDate(date: Date | string): string {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
}

/**
 * Format duration in human readable format
 */
export function formatDuration(minutes: number): string {
    if (minutes < 60) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) {
        return `${hours} hour${hours !== 1 ? 's' : ''}${mins > 0 ? ` ${mins} min${mins !== 1 ? 's' : ''}` : ''}`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return `${days} day${days !== 1 ? 's' : ''}${remainingHours > 0 ? ` ${remainingHours} hour${remainingHours !== 1 ? 's' : ''}` : ''}`;
}

/**
 * Get current timestamp
 */
export function getTimestamp(): string {
    return new Date().toISOString();
}

/**
 * Calculate time until a date
 */
export function timeUntil(date: Date | string): string {
    const target = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();

    if (diffMs <= 0) return 'now';

    const diffMins = Math.floor(diffMs / 60000);
    return formatDuration(diffMins);
}

/**
 * Validate if jid is a group
 */
export function isGroupJid(jid: string): boolean {
    return jid.endsWith('@g.us');
}

/**
 * Validate if jid is a user
 */
export function isUserJid(jid: string): boolean {
    return jid.endsWith('@s.whatsapp.net');
}

/**
 * Get the group subject (name) from message
 */
export function getGroupName(metadata: { subject?: string } | null): string {
    return metadata?.subject || 'Unknown Group';
}

/**
 * Parse duration string to minutes
 * Supports: 1s (seconds), 1m (minutes), 1h (hours), 1d (days)
 * Examples: "30s" = 0.5 min, "1m" = 1 min, "1h" = 60 min, "1d" = 1440 min
 * If just a number is provided, it's treated as minutes
 */
export function parseDuration(durationStr: string): number {
    if (!durationStr) return 60; // Default 60 minutes

    const str = durationStr.trim().toLowerCase();
    const match = str.match(/^(\d+(?:\.\d+)?)([smhd]?)$/);

    if (!match) {
        console.log(`[parseDuration] Invalid duration string: "${durationStr}", defaulting to 60 minutes`);
        return 60; // Default 60 minutes if invalid
    }

    const value = parseFloat(match[1]);
    const unit = match[2] || 'm'; // Default to minutes if no unit

    let minutes: number;
    switch (unit) {
        case 's': // seconds
            minutes = value / 60;
            break;
        case 'm': // minutes
            minutes = value;
            break;
        case 'h': // hours
            minutes = value * 60;
            break;
        case 'd': // days
            minutes = value * 1440;
            break;
        default:
            minutes = value;
    }

    // For seconds, minimum is 1 second (rounded up), otherwise minimum 1 minute
    const result = unit === 's' ? Math.max(1 / 60, minutes) : Math.max(1, minutes);
    console.log(`[parseDuration] "${durationStr}" -> value=${value}, unit=${unit || 'default m'} -> ${result} minutes`);
    return result;
}

/**
 * Format duration string for display
 * Takes minutes and formats as "1h 30m" etc.
 */
export function formatDurationString(minutes: number): string {
    if (minutes < 60) {
        return `${minutes}m`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours < 24) {
        return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
    }
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    return remainingHours > 0 ? `${days}d ${remainingHours}h` : `${days}d`;
}
