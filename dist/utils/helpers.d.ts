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
 */
export declare function extractMention(text: string): string | null;
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
//# sourceMappingURL=helpers.d.ts.map