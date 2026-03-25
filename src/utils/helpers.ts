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
 */
export function formatJid(jid: string): string {
    return jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
}

/**
 * Extract user mention from message
 */
export function extractMention(text: string): string | null {
    const mentionMatch = text.match(/@(\d+)/);
    if (mentionMatch) {
        return `${mentionMatch[1]}@s.whatsapp.net`;
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
