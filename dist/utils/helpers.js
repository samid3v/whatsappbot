"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getRoleLevel = getRoleLevel;
exports.hasPermission = hasPermission;
exports.formatJid = formatJid;
exports.extractMention = extractMention;
exports.parseArgs = parseArgs;
exports.formatDate = formatDate;
exports.formatDuration = formatDuration;
exports.getTimestamp = getTimestamp;
exports.timeUntil = timeUntil;
exports.isGroupJid = isGroupJid;
exports.isUserJid = isUserJid;
exports.getGroupName = getGroupName;
/**
 * Get the numeric level of a role (higher = more权限)
 */
function getRoleLevel(role) {
    const levels = {
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
function hasPermission(userRole, requiredRole) {
    return getRoleLevel(userRole) >= getRoleLevel(requiredRole);
}
/**
 * Format WhatsApp jid to user-friendly format
 */
function formatJid(jid) {
    return jid.replace('@s.whatsapp.net', '').replace('@g.us', '');
}
/**
 * Extract user mention from message
 */
function extractMention(text) {
    const mentionMatch = text.match(/@(\d+)/);
    if (mentionMatch) {
        return `${mentionMatch[1]}@s.whatsapp.net`;
    }
    return null;
}
/**
 * Parse command arguments
 */
function parseArgs(text) {
    return text.trim().split(/\s+/).filter(Boolean);
}
/**
 * Format date for display
 */
function formatDate(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleString();
}
/**
 * Format duration in human readable format
 */
function formatDuration(minutes) {
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
function getTimestamp() {
    return new Date().toISOString();
}
/**
 * Calculate time until a date
 */
function timeUntil(date) {
    const target = typeof date === 'string' ? new Date(date) : date;
    const now = new Date();
    const diffMs = target.getTime() - now.getTime();
    if (diffMs <= 0)
        return 'now';
    const diffMins = Math.floor(diffMs / 60000);
    return formatDuration(diffMins);
}
/**
 * Validate if jid is a group
 */
function isGroupJid(jid) {
    return jid.endsWith('@g.us');
}
/**
 * Validate if jid is a user
 */
function isUserJid(jid) {
    return jid.endsWith('@s.whatsapp.net');
}
/**
 * Get the group subject (name) from message
 */
function getGroupName(metadata) {
    return metadata?.subject || 'Unknown Group';
}
//# sourceMappingURL=helpers.js.map