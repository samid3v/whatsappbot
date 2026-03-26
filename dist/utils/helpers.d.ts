import { UserRole } from '../types';
/**
 * Get the numeric level of a role (higher = more权限)
 */
export declare function getRoleLevel(role: UserRole): number;
/**
 * Check if role has permission to perform action
 */
export declare function hasPermission(userRole: UserRole, requiredRole: UserRole): boolean;
/**
 * Format WhatsApp jid to user-friendly format
 */
export declare function formatJid(jid: string): string;
/**
 * Extract user mention from message
 * Handles formats: @254103608133, @Mido 🎮 (with name), or any text with @mention
 */
export declare function extractMention(text: string): string | null;
/**
 * Extract user JID from mention text or mentionedJids array
 * Takes the first valid mention from the text
 */
export declare function extractUserJidFromMention(args: string[], mentionedJids: string[]): string | null;
/**
 * Parse command arguments
 */
export declare function parseArgs(text: string): string[];
/**
 * Format date for display
 */
export declare function formatDate(date: Date | string): string;
/**
 * Format duration in human readable format
 */
export declare function formatDuration(minutes: number): string;
/**
 * Get current timestamp
 */
export declare function getTimestamp(): string;
/**
 * Calculate time until a date
 */
export declare function timeUntil(date: Date | string): string;
/**
 * Validate if jid is a group
 */
export declare function isGroupJid(jid: string): boolean;
/**
 * Validate if jid is a user
 */
export declare function isUserJid(jid: string): boolean;
/**
 * Get the group subject (name) from message
 */
export declare function getGroupName(metadata: {
    subject?: string;
} | null): string;
/**
 * Parse duration string to minutes
 * Supports: 1s (seconds), 1m (minutes), 1h (hours), 1d (days)
 * Examples: "30s" = 0.5 min, "1m" = 1 min, "1h" = 60 min, "1d" = 1440 min
 * If just a number is provided, it's treated as minutes
 */
export declare function parseDuration(durationStr: string): number;
/**
 * Format duration string for display
 * Takes minutes and formats as "1h 30m" etc.
 */
export declare function formatDurationString(minutes: number): string;
//# sourceMappingURL=helpers.d.ts.map