import { CommandContext, Command, UserRole } from '../types';
import { roleManager } from '../services/role-manager';
import config from '../utils/config';
import { parseArgs, hasPermission, parseDuration, formatDurationString, extractUserJidFromMention } from '../utils/helpers';
import { warnManager } from '../services/warn-manager';
import { muteManager } from '../services/mute-manager';
import { waClient } from '../client';
import { userOps, logOps } from '../database/db';
import { formatJid, formatDate } from '../utils/helpers';
import { statsManager } from '../services/stats-manager';
import { msg } from '../utils/messages';
import { tournamentManager } from '../services/tournament-manager';

// Command map
const commands: Map<string, Command> = new Map();

// Register command
export function registerCommand(command: Command): void {
    commands.set(command.name, command);
    if (command.aliases) {
        for (const alias of command.aliases) {
            commands.set(alias, command);
        }
    }
}

// Get command
export function getCommand(name: string): Command | undefined {
    return commands.get(name.toLowerCase());
}

// Get all commands
export function getAllCommands(): Command[] {
    return Array.from(commands.values());
}

// Parse command from text
export function parseCommand(text: string): { name: string; args: string[] } | null {
    // Check both ! and . prefixes
    const prefixes = [config.commandPrefix, '!', '.'];
    let commandText = text;

    for (const prefix of prefixes) {
        if (text.startsWith(prefix)) {
            commandText = text.slice(prefix.length);
            break;
        }
    }

    if (commandText === text) return null; // No prefix found

    const parts = commandText.trim().split(/\s+/);
    const name = parts[0]?.toLowerCase();
    const args = parts.slice(1);

    if (!name) return null;

    return { name, args };
}

// Check permission
export async function checkPermission(context: CommandContext, requiredRole?: UserRole[]): Promise<{
    allowed: boolean;
    message?: string;
}> {
    if (!requiredRole || requiredRole.length === 0) {
        return { allowed: true };
    }

    for (const role of requiredRole) {
        if (hasPermission(context.isOwner ? 'owner' : context.isAdmin ? 'admin' : context.isModerator ? 'moderator' : 'member', role)) {
            return { allowed: true };
        }
    }

    return {
        allowed: false,
        message: msg.permissionDenied(requiredRole[0]),
    };
}

// ==================== MODERATION COMMANDS ====================

// Warn
registerCommand({
    name: 'warn',
    aliases: ['w'],
    description: 'Warn a user',
    usage: '.warn @user [reason]',
    minArgs: 1,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const mention = args[0];
        const reason = args.slice(1).join(' ') || 'No reason';
        const userJid = mention.replace('@', '') + '@s.whatsapp.net';
        await warnManager.warnUser(userJid, context.jid, reason);
    },
});

// Warnings
registerCommand({
    name: 'warnings',
    aliases: ['ws'],
    description: 'Check warnings',
    usage: '.warnings @user',
    minArgs: 1,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const mention = args[0];
        const userJid = mention.replace('@', '') + '@s.whatsapp.net';
        const warnings = await warnManager.getWarnings(userJid);
        const user = userOps.get(userJid);
        const userName = user?.name || formatJid(userJid);
        await waClient.sendMessage(context.jid,
            msg.warningsCheck(userName, warnings, config.warnThreshold)
        );
    },
});

// Mute
registerCommand({
    name: 'mute',
    aliases: ['m'],
    description: 'Mute a user (reply to their message or use @mention)',
    usage: '.mute @user [duration] [reason]\n.mute [duration] [reason] (reply to user)',
    minArgs: 1,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        let userJid: string | null = null;

        // First check if args contain @mention (e.g., @254103608133 or @Mido)
        const extractedJid = extractUserJidFromMention(args, context.mentionedJids || []);
        if (extractedJid) {
            userJid = extractedJid;
        }
        // Then check if user replied to a message
        else if (context.quotedSenderJid) {
            userJid = context.quotedSenderJid;
        }

        if (!userJid) {
            await waClient.sendMessage(context.jid, msg.missingMention('.mute @user [duration] [reason]'));
            return;
        }

        // Try to get user's display name from WhatsApp group metadata
        let userName: string | undefined;
        try {
            const user = userOps.get(userJid);
            if (user?.name) {
                userName = user.name;
            } else {
                const metadata = await waClient.getGroupMetadata(context.jid);
                const participant = metadata?.participants?.find((p: any) => p.id === userJid);
                if (participant?.name || participant?.notify || participant?.vname) {
                    userName = participant.name || participant.notify || participant.vname;
                }
            }
        } catch (e) {
            // Ignore - muteManager will handle name
        }

        const durationStr = args[1] || '60m';
        const durationMinutes = parseDuration(durationStr);
        const reason = args.slice(2).join(' ') || 'Violation';

        // If we have the userName, update the user in DB so muteManager uses it
        if (userName) {
            const user = userOps.get(userJid);
            if (user) {
                user.name = userName;
            }
        }

        await muteManager.muteUser(userJid, context.jid, durationMinutes, reason);
    },
});

// Unmute
registerCommand({
    name: 'unmute',
    aliases: ['um'],
    description: 'Unmute a user (reply to their message or use @mention)',
    usage: '.unmute @user\n.unmute (reply to user)',
    minArgs: 1,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        let userJid: string | null = null;

        // First check if args contain @mention
        const extractedJid = extractUserJidFromMention(args, context.mentionedJids || []);
        if (extractedJid) {
            userJid = extractedJid;
        }
        // Then check if user replied to a message
        else if (context.quotedSenderJid) {
            userJid = context.quotedSenderJid;
        }

        if (!userJid) {
            await waClient.sendMessage(context.jid, msg.missingMention('.unmute @user'));
            return;
        }

        await muteManager.unmuteUser(userJid, context.jid);
    },
});

// Mute Info - show mute status and time remaining
registerCommand({
    name: 'muteinfo',
    aliases: ['mi'],
    description: 'Show mute information for a user',
    usage: '.muteinfo @user\n.muteinfo (reply to user)',
    minArgs: 1,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        let userJid: string | null = null;

        const extractedJid = extractUserJidFromMention(args, context.mentionedJids || []);
        if (extractedJid) {
            userJid = extractedJid;
        } else if (context.quotedSenderJid) {
            userJid = context.quotedSenderJid;
        }

        if (!userJid) {
            await waClient.sendMessage(context.jid, msg.missingMention('.muteinfo @user'));
            return;
        }

        const user = userOps.get(userJid);
        if (!user || !user.is_muted) {
            await waClient.sendMessage(context.jid, msg.muteInfo('Unknown'));
            return;
        }

        // Try to get user's display name from WhatsApp group metadata
        let userName = user?.name;
        if (!userName) {
            try {
                const metadata = await waClient.getGroupMetadata(context.jid);
                const participant = metadata?.participants?.find((p: any) => p.id === userJid);
                if (participant?.name || participant?.notify || participant?.vname) {
                    userName = participant.name || participant.notify || participant.vname;
                }
            } catch (e) {
                // Ignore - use fallback
            }
        }
        // Final fallback to formatted JID
        if (!userName) {
            userName = formatJid(userJid);
        }

        const expiresAt = user.mute_expires_at;

        if (expiresAt) {
            const expiryDate = new Date(expiresAt);
            const now = new Date();
            const remainingMs = expiryDate.getTime() - now.getTime();
            const remainingMinutes = Math.max(0, Math.ceil(remainingMs / 60000));

            await waClient.sendMention(context.jid, msg.muteInfo(userName, `${remainingMinutes} min`, formatDate(expiresAt)), [userJid]);
        } else {
            await waClient.sendMention(context.jid, msg.muteInfo(userName), [userJid]);
        }
    },
});

// Adjust Mute Time - change remaining mute duration
registerCommand({
    name: 'mutetime',
    aliases: ['mt'],
    description: 'Adjust mute duration (extend or reduce)',
    usage: '.mutetime @user 30m (set to 30 min)\n.mutetime @user +30m (add 30 min)\n.mutetime @user -30m (reduce 30 min)',
    minArgs: 2,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        let userJid: string | null = null;

        const extractedJid = extractUserJidFromMention(args, context.mentionedJids || []);
        if (extractedJid) {
            userJid = extractedJid;
        } else if (context.quotedSenderJid) {
            userJid = context.quotedSenderJid;
        }

        if (!userJid) {
            await waClient.sendMessage(context.jid, msg.missingMention('.mutetime @user <duration>'));
            return;
        }

        const user = userOps.get(userJid);
        if (!user || !user.is_muted) {
            await waClient.sendMessage(context.jid, msg.muteInfo('Unknown'));
            return;
        }

        const currentExpiry = user.mute_expires_at ? new Date(user.mute_expires_at) : null;
        const now = new Date();

        // Calculate current remaining time
        let currentRemaining = 0;
        if (currentExpiry && currentExpiry > now) {
            currentRemaining = Math.ceil((currentExpiry.getTime() - now.getTime()) / 60000);
        }

        // Parse the new duration
        const durationStr = args[1];
        let newMinutes = 0;

        if (durationStr.startsWith('+')) {
            // Add time
            const addMinutes = parseDuration(durationStr.substring(1));
            newMinutes = currentRemaining + addMinutes;
        } else if (durationStr.startsWith('-')) {
            // Reduce time
            const subMinutes = parseDuration(durationStr.substring(1));
            newMinutes = Math.max(0, currentRemaining - subMinutes);
        } else {
            // Set absolute time
            newMinutes = parseDuration(durationStr);
        }

        if (newMinutes <= 0) {
            // Unmute user
            await muteManager.unmuteUser(userJid, context.jid);
            return;
        }

        // Calculate new expiry
        const newExpiry = new Date(Date.now() + newMinutes * 60 * 1000);

        // Update mute
        userOps.mute(userJid, newExpiry.toISOString());

        // Try to get user's display name from WhatsApp group metadata
        let userName = user?.name;
        if (!userName) {
            try {
                const metadata = await waClient.getGroupMetadata(context.jid);
                const participant = metadata?.participants?.find((p: any) => p.id === userJid);
                if (participant?.name || participant?.notify || participant?.vname) {
                    userName = participant.name || participant.notify || participant.vname;
                }
            } catch (e) {
                // Ignore - use fallback
            }
        }
        if (!userName) {
            userName = formatJid(userJid);
        }

        await waClient.sendMention(context.jid, msg.muteTimeAdjusted(userName, `${currentRemaining}`, `${newMinutes}`, formatDate(newExpiry)), [userJid]);
    },
});

// Kick
registerCommand({
    name: 'kick',
    aliases: ['k'],
    description: 'Remove user from group',
    usage: '.kick @user',
    minArgs: 1,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const mention = args[0];
        const userJid = mention.replace('@', '') + '@s.whatsapp.net';
        await waClient.removeParticipant(context.jid, userJid);
        logOps.add('kick', context.jid, userJid);
        await waClient.sendMessage(context.jid, msg.userRemoved());
    },
});

// Promote
registerCommand({
    name: 'promote',
    aliases: ['prom'],
    description: 'Promote to moderator',
    usage: '.promote @user',
    minArgs: 1,
    requiredRole: ['owner'],
    execute: async (args: string[], context: CommandContext) => {
        const mention = args[0];
        const userJid = mention.replace('@', '') + '@s.whatsapp.net';
        await roleManager.setUserRole(userJid, 'moderator');
        await waClient.promoteParticipant(context.jid, userJid);
        await waClient.sendMention(context.jid, msg.promoted(formatJid(userJid), '🛡️ Moderator'), [userJid]);
    },
});

// Demote
registerCommand({
    name: 'demote',
    aliases: ['dem'],
    description: 'Demote to member',
    usage: '.demote @user',
    minArgs: 1,
    requiredRole: ['owner'],
    execute: async (args: string[], context: CommandContext) => {
        const mention = args[0];
        const userJid = mention.replace('@', '') + '@s.whatsapp.net';
        await roleManager.setUserRole(userJid, 'member');
        await waClient.demoteParticipant(context.jid, userJid);
        await waClient.sendMention(context.jid, msg.demoted(formatJid(userJid), '👤 Member'), [userJid]);
    },
});

// Setadmin
registerCommand({
    name: 'setadmin',
    aliases: ['sa'],
    description: 'Set as admin',
    usage: '.setadmin @user',
    minArgs: 1,
    requiredRole: ['owner'],
    execute: async (args: string[], context: CommandContext) => {
        const mention = args[0];
        const userJid = mention.replace('@', '') + '@s.whatsapp.net';
        await roleManager.setUserRole(userJid, 'admin');
        await waClient.promoteParticipant(context.jid, userJid);
        await waClient.sendMention(context.jid, msg.promoted(formatJid(userJid), '⚡ Admin'), [userJid]);
    },
});

// Tagall
registerCommand({
    name: 'tagall',
    aliases: ['ta', 'all'],
    description: 'Mention all group members',
    usage: '.tagall [message]',
    requiredRole: ['moderator'],
    execute: async (args: string[], context: CommandContext) => {
        const message = args.join(' ') || '📢 Attention everyone!';
        const metadata = await waClient.getGroupMetadata(context.jid);

        if (!metadata?.participants) {
            await waClient.sendMessage(context.jid, msg.error());
            return;
        }

        const mentions = metadata.participants.map((p: any) => p.id);
        const memberNames = metadata.participants.map((p: any) => p.name || p.id.replace('@s.whatsapp.net', ''));

        let tagMessage = `📢 ${'ATTENTION'}\n━━━━━━━━━━━━━━━━━━━━━━━━\n${message}\n\n`;
        for (const name of memberNames.slice(0, 30)) {
            tagMessage += `@${name}\n`;
        }
        if (memberNames.length > 30) {
            tagMessage += `_...and ${memberNames.length - 30} more_`;
        }

        await waClient.sendMention(context.jid, tagMessage, mentions);
    },
});

// Tagadmin
registerCommand({
    name: 'tagadmin',
    aliases: ['tagad'],
    description: 'Mention group admins',
    usage: '.tagadmin [message]',
    requiredRole: ['moderator'],
    execute: async (args: string[], context: CommandContext) => {
        const message = args.join(' ') || '📢 Admins needed!';
        const admins = await waClient.getGroupAdmins(context.jid);

        if (admins.length === 0) {
            await waClient.sendMessage(context.jid, msg.error());
            return;
        }

        const adminMsg = `📢 𝙰𝙳𝙼𝙸𝙽𝚂 𝙽𝙴𝙴𝙳𝙴𝙳\n━━━━━━━━━━━━━━━━━━━━━━━━\n${message}`;
        await waClient.sendMention(context.jid, adminMsg, admins);
    },
});

// Settings
registerCommand({
    name: 'settings',
    aliases: ['set'],
    description: 'View bot settings',
    usage: '.settings',
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        await waClient.sendMessage(context.jid, msg.settings(config.commandPrefix, config.warnThreshold, config.muteDurationHours));
    },
});

// Group info
registerCommand({
    name: 'groupinfo',
    aliases: ['gi', 'ginfo'],
    description: 'View group info',
    usage: '.groupinfo',
    execute: async (args: string[], context: CommandContext) => {
        const metadata = await waClient.getGroupMetadata(context.jid);
        if (!metadata) {
            await waClient.sendMessage(context.jid, msg.error());
            return;
        }

        await waClient.sendMessage(context.jid,
            msg.groupInfo(metadata.subject, metadata.participants?.length || 0, new Date(metadata.creation * 1000).toLocaleDateString())
        );
    },
});

// Mute Help - show all mute commands
registerCommand({
    name: 'mutehelp',
    aliases: ['mh', 'mutecommands', 'mc'],
    description: 'Show all mute commands',
    usage: '.mutehelp',
    execute: async (args: string[], context: CommandContext) => {
        const message = `🔇 𝙼𝚄𝚃𝙴 𝙲𝙾𝙼𝙼𝙰𝙽𝙳𝚂 🔇\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `𝚖𝚞𝚝𝚎 — Mute a user\n` +
            `  Usage: .mute @user [duration] [reason]\n` +
            `  Examples: .mute @user 1h spam | .mute @user 30m\n\n` +
            `𝚞𝚗𝚖𝚞𝚝𝚎 — Unmute a user\n` +
            `  Usage: .unmute @user\n\n` +
            `𝚖𝚞𝚝𝚎𝚒𝚗𝚏𝚘 — Check mute status\n` +
            `  Usage: .mi @user\n\n` +
            `𝚖𝚞𝚝𝚎𝚝𝚒𝚖𝚎 — Adjust mute duration\n` +
            `  Usage: .mt @user 30m | .mt @user +15m | .mt @user -10m\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Duration: s (seconds) | m (minutes) | h (hours) | d (days)`;
        await waClient.sendMessage(context.jid, message);
    },
});

// ==================== TOURNAMENT COMMANDS ====================
// Tournament system is SEPARATE from PVP.
// PVP = daily friendly games with global leaderboard
// Tournament = isolated competition with per-tournament standings, knockout/league brackets
// Real football model: knockout needs 4/8/16/32/64 players, matches require screenshot + admin approval

import { tournamentOps } from '../database/db';

// Tournament create — block if one is already active
registerCommand({
    name: 'tcr',
    aliases: ['tourneycreate', 'tc'],
    description: 'Create tournament (opens registration)',
    usage: '.tcr [name] [type] [max]',
    minArgs: 2,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        // Block if any tournament is active
        const active = tournamentOps.getActive();
        if (active.length > 0) {
            const t = active[0];
            await waClient.sendMessage(context.jid,
                `❌ Cannot create — *${t.name}* is still ${t.status}.\n` +
                `Complete or end it first with .tend`
            );
            return;
        }

        const name = args[0];
        const type = args[1];
        const maxPlayers = args[2] ? parseInt(args[2], 10) : null;

        if (!['se', 'de', 'rr', 'rr1', 'rr2', 'single_elimination', 'double_elimination', 'round_robin'].includes(type)) {
            await waClient.sendMessage(context.jid, msg.tournamentInvalidType());
            return;
        }

        const typeMap: Record<string, { type: string; legs: number }> = {
            'se': { type: 'single_elimination', legs: 1 },
            'single_elimination': { type: 'single_elimination', legs: 1 },
            'de': { type: 'double_elimination', legs: 1 },
            'double_elimination': { type: 'double_elimination', legs: 1 },
            'rr': { type: 'round_robin', legs: 1 },
            'rr1': { type: 'round_robin', legs: 1 },
            'rr2': { type: 'round_robin', legs: 2 },
            'round_robin': { type: 'round_robin', legs: 1 },
        };

        const mapped = typeMap[type] || { type: 'single_elimination', legs: 1 };
        const tournamentType = mapped.type;
        const legs = mapped.legs;
        const tournament = tournamentOps.create(name, tournamentType, legs, maxPlayers, context.senderJid);

        const typeName = tournamentType === 'single_elimination' ? 'Knockout (4/8/16/32/64 players)' :
            tournamentType === 'double_elimination' ? 'Double Elimination' :
            legs === 2 ? 'League (1st & 2nd Leg)' : 'League (1st Leg)';

        await waClient.sendMessage(context.jid,
            `🏆 *TOURNAMENT CREATED* 🏆\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📛 Name: ${name}\n` +
            `📋 Type: ${typeName}\n` +
            `${maxPlayers ? `👥 Max: ${maxPlayers}\n` : ''}` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `⏳ Registration open — use .tj to join!\n` +
            `📸 Screenshot proof will be required`
        );
    },
});

// Tournament join
registerCommand({
    name: 'tj',
    aliases: ['tourneyjoin'],
    description: 'Join active tournament',
    usage: '.tj',
    execute: async (args: string[], context: CommandContext) => {
        const active = tournamentOps.getActive();
        if (active.length === 0) {
            await waClient.sendMessage(context.jid, msg.noActiveTournament());
            return;
        }

        const t = active[0];
        if (t.status !== 'registration') {
            await waClient.sendMessage(context.jid, msg.registrationClosed());
            return;
        }

        const participants = tournamentOps.getParticipants(t.id);
        if (t.max_players && participants.length >= t.max_players) {
            await waClient.sendMessage(context.jid, msg.tournamentFull());
            return;
        }

        tournamentOps.addParticipant(t.id, context.senderJid);
        await waClient.sendMessage(context.jid, msg.tournamentJoined(t.name, participants.length + 1));
    },
});

// Tournament leave
registerCommand({
    name: 'tl',
    aliases: ['tourneyleave'],
    description: 'Leave tournament',
    usage: '.tl',
    execute: async (args: string[], context: CommandContext) => {
        const active = tournamentOps.getActive();
        if (active.length === 0) {
            await waClient.sendMessage(context.jid, msg.noActiveTournament());
            return;
        }

        const t = active[0];
        if (t.status !== 'registration') {
            await waClient.sendMessage(context.jid, msg.cannotLeaveInProgress());
            return;
        }

        tournamentOps.removeParticipant(t.id, context.senderJid);
        await waClient.sendMessage(context.jid, msg.tournamentLeft(t.name));
    },
});

// Tournament start — validates knockout sizes, generates bracket
registerCommand({
    name: 'tstart',
    aliases: ['tourneystart'],
    description: 'Start tournament (generates bracket)',
    usage: '.tstart',
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const active = tournamentOps.getActive();
        if (active.length === 0) {
            await waClient.sendMessage(context.jid, msg.noActiveTournament());
            return;
        }

        const t = active[0];
        const result = tournamentManager.startTournament(t.id);
        await waClient.sendMessage(context.jid, result);
    },
});

// Tournament status
registerCommand({
    name: 'ts',
    aliases: ['tourneystatus'],
    description: 'Tournament status',
    usage: '.ts',
    execute: async (args: string[], context: CommandContext) => {
        const active = tournamentOps.getActive();
        if (active.length === 0) {
            await waClient.sendMessage(context.jid, msg.noActiveTournament());
            return;
        }

        const t = active[0];
        const participants = tournamentOps.getParticipants(t.id);
        const pendingApproval = tournamentOps.getPendingApproval(t.id);

        const typeName = t.type === 'single_elimination' ? 'Knockout' :
            t.type === 'double_elimination' ? 'Double Elim' : 'League';

        let statusMsg = `🏆 *${t.name}*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📊 Type: ${typeName}\n` +
            `📋 Status: ${t.status}\n` +
            `👥 Players: ${participants.length}\n` +
            `🔄 Round: ${t.current_round}\n`;

        if (pendingApproval.length > 0) {
            statusMsg += `⏳ Pending approval: ${pendingApproval.length}\n`;
        }

        if (t.status === 'completed' && t.winner_jid) {
            const winnerUser = userOps.get(t.winner_jid);
            statusMsg += `🏆 Winner: ${winnerUser?.name || formatJid(t.winner_jid)}\n`;
        }

        await waClient.sendMessage(context.jid, statusMsg);
    },
});

// Tournament bracket
registerCommand({
    name: 'tb',
    aliases: ['tourneybracket'],
    description: 'View tournament bracket',
    usage: '.tb',
    execute: async (args: string[], context: CommandContext) => {
        const active = tournamentOps.getActive();
        if (active.length === 0) {
            await waClient.sendMessage(context.jid, msg.noActiveTournament());
            return;
        }

        const t = active[0];
        tournamentManager.sendBracket(context.jid, t.id);
    },
});

// Tournament submit result — submits for admin approval (screenshot proof required)
registerCommand({
    name: 'tres',
    aliases: ['tourneyresult'],
    description: 'Submit tournament match result (requires proof)',
    usage: '.tres [match_id] [score]',
    minArgs: 2,
    execute: async (args: string[], context: CommandContext) => {
        const active = tournamentOps.getActive();
        if (active.length === 0) {
            await waClient.sendMessage(context.jid, msg.noActiveTournament());
            return;
        }

        const matchId = parseInt(args[0], 10);
        if (isNaN(matchId)) {
            await waClient.sendMessage(context.jid,
                `❌ Invalid match ID.\nUsage: .tres [match_id] [score]\nExample: .tres 3 2-1\nUse .tb to see match IDs.`
            );
            return;
        }

        const scoreStr = args[1];
        const scoreMatch = scoreStr.match(/(\d+)[-:](\d+)/);
        if (!scoreMatch) {
            await waClient.sendMessage(context.jid, msg.invalidScore());
            return;
        }

        const player1Score = parseInt(scoreMatch[1], 10);
        const player2Score = parseInt(scoreMatch[2], 10);

        // Check if message has an image (proof)
        const hasProof = context.hasImage;

        const result = tournamentManager.submitResult(matchId, player1Score, player2Score, hasProof);
        await waClient.sendMessage(context.jid, result);
    },
});

// Tournament pending approval — admin views queue
registerCommand({
    name: 'tpending',
    aliases: ['tpend', 'tp'],
    description: 'View matches pending approval',
    usage: '.tpending',
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const active = tournamentOps.getActive();
        if (active.length === 0) {
            await waClient.sendMessage(context.jid, msg.noActiveTournament());
            return;
        }

        const t = active[0];
        tournamentManager.sendPendingApproval(context.jid, t.id);
    },
});

// Tournament approve match
registerCommand({
    name: 'tapprove',
    aliases: ['tok', 'tyes'],
    description: 'Approve a tournament match result',
    usage: '.tapprove <match_id>',
    minArgs: 1,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const matchId = parseInt(args[0], 10);
        if (isNaN(matchId)) {
            await waClient.sendMessage(context.jid, msg.usage('.tapprove <match_id>'));
            return;
        }

        const result = tournamentManager.approveMatch(matchId, context.senderJid);
        await waClient.sendMessage(context.jid, result);
    },
});

// Tournament reject match
registerCommand({
    name: 'treject',
    aliases: ['tno', 'tdeny'],
    description: 'Reject a tournament match result',
    usage: '.treject <match_id> <reason>',
    minArgs: 2,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const matchId = parseInt(args[0], 10);
        if (isNaN(matchId)) {
            await waClient.sendMessage(context.jid, msg.usage('.treject <match_id> <reason>'));
            return;
        }

        const reason = args.slice(1).join(' ');
        const result = tournamentManager.rejectMatch(matchId, context.senderJid, reason);
        await waClient.sendMessage(context.jid, result);
    },
});

// Tournament standings (per-tournament leaderboard)
registerCommand({
    name: 'tlb',
    aliases: ['tourneystandings', 'tstandings'],
    description: 'View tournament standings',
    usage: '.tlb',
    execute: async (args: string[], context: CommandContext) => {
        const active = tournamentOps.getActive();
        if (active.length === 0) {
            await waClient.sendMessage(context.jid, msg.noActiveTournament());
            return;
        }

        const t = active[0];
        tournamentManager.sendStandings(context.jid, t.id);
    },
});

// Tournament advance round (admin only)
registerCommand({
    name: 'tnext',
    aliases: ['tnextround', 'tnr'],
    description: 'Advance to next round (knockout)',
    usage: '.tnext',
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const active = tournamentOps.getActive();
        if (active.length === 0) {
            await waClient.sendMessage(context.jid, msg.noActiveTournament());
            return;
        }

        const t = active[0];
        const result = tournamentManager.advanceRound(t.id);
        await waClient.sendMessage(context.jid, result);
    },
});

// Tournament complete (admin only)
registerCommand({
    name: 'tend',
    aliases: ['tourneyend', 'tcomplete'],
    description: 'Complete the tournament',
    usage: '.tend',
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const active = tournamentOps.getActive();
        if (active.length === 0) {
            await waClient.sendMessage(context.jid, msg.noActiveTournament());
            return;
        }

        const t = active[0];
        const result = tournamentManager.completeTournament(t.id);
        await waClient.sendMessage(context.jid, result);
    },
});

// Tournament Help
registerCommand({
    name: 'tourneyhelp',
    aliases: ['th', 'tournamenthelp', 'tourneycmds'],
    description: 'Show all tournament commands',
    usage: '.tourneyhelp',
    execute: async (args: string[], context: CommandContext) => {
        const text = `🏆 𝚃𝙾𝚄𝚁𝙽𝙰𝙼𝙴𝙽𝚃 𝙲𝙾𝙼𝙼𝙰𝙽𝙳𝚂 🏆\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `𝚝𝚌𝚛 — Create tournament (blocks if one active)\n` +
            `  Usage: .tcr [name] [type] [max]\n` +
            `  Types:\n` +
            `    se — Knockout (needs 4/8/16/32/64 players)\n` +
            `    de — Double Elimination\n` +
            `    rr / rr1 — League, 1st Leg only\n` +
            `    rr2 — League, 1st & 2nd Leg (home & away)\n\n` +
            `𝚝𝚓 — Join active tournament\n` +
            `𝚝𝚕 — Leave tournament\n` +
            `𝚝𝚜𝚝𝚊𝚛𝚝 — Start (generates bracket)\n` +
            `𝚝𝚜 — View tournament status\n` +
            `𝚝𝚋 — View bracket with match IDs\n\n` +
            `𝚝𝚛𝚎𝚜 — Submit match result (needs proof)\n` +
            `  Usage: .tres [match_id] [score]\n` +
            `  Example: .tres 3 2-1\n` +
            `  📸 Attach screenshot with the command!\n\n` +
            `𝚝𝚕𝚋 — View tournament standings\n` +
            `𝚝𝚗𝚎𝚡𝚝 — Advance to next round (knockout)\n` +
            `𝚝𝚎𝚗𝚍 — Complete the tournament\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `𝙰𝚍𝚖𝚒𝚗 — 𝙰𝚙𝚙𝚛𝚘𝚟𝚊𝚕 𝚆𝚘𝚛𝚔𝚏𝚕𝚘𝚠\n` +
            `𝚝𝚙𝚎𝚗𝚍𝚒𝚗𝚐 — View matches awaiting approval\n` +
            `𝚝𝚊𝚙𝚙𝚛𝚘𝚟𝚎 <𝚒𝚍> — Approve a match result\n` +
            `𝚝𝚛𝚎𝚓𝚎𝚌𝚝 <𝚒𝚍> <𝚛𝚎𝚊𝚜𝚘𝚗> — Reject & require replay`;
        await waClient.sendMessage(context.jid, text);
    },
});

// ==================== TOURNAMENT SCHEDULING ====================

// Tournament Schedule - View full schedule
registerCommand({
    name: 'tschedule',
    aliases: ['tsched', 'tschedules'],
    description: 'View tournament schedule',
    usage: '.tschedule',
    requiredRole: ['member'],
    execute: async (args: string[], context: CommandContext) => {
        const { tournamentScheduler } = await import('../services/tournament-scheduler');

        const active = tournamentOps.getActive();
        if (active.length === 0) {
            return await waClient.sendMessage(context.jid, '❌ No active tournament');
        }

        const tournament = active[0];
        const schedule = tournamentScheduler.getSchedule(tournament.id);

        if (!schedule) {
            return await waClient.sendMessage(context.jid, '❌ No schedule found for this tournament');
        }

        const text = tournamentScheduler.formatSchedule(tournament.id);
        await waClient.sendMessage(context.jid, text);
    },
});

// Tournament Current Stage - View current stage info
registerCommand({
    name: 'tstage',
    aliases: ['tcurrentstage', 'tstageinfo'],
    description: 'View current stage information',
    usage: '.tstage',
    requiredRole: ['member'],
    execute: async (args: string[], context: CommandContext) => {
        const { tournamentScheduler } = await import('../services/tournament-scheduler');

        const active = tournamentOps.getActive();
        if (active.length === 0) {
            return await waClient.sendMessage(context.jid, '❌ No active tournament');
        }

        const tournament = active[0];
        const text = tournamentScheduler.formatCurrentStageInfo(tournament.id);
        await waClient.sendMessage(context.jid, text);
    },
});

// Tournament Stages - View all stages with details
registerCommand({
    name: 'tstages',
    aliases: ['tallstages', 'tstagedetails'],
    description: 'View all tournament stages',
    usage: '.tstages',
    requiredRole: ['member'],
    execute: async (args: string[], context: CommandContext) => {
        const { tournamentScheduler } = await import('../services/tournament-scheduler');

        const active = tournamentOps.getActive();
        if (active.length === 0) {
            return await waClient.sendMessage(context.jid, '❌ No active tournament');
        }

        const tournament = active[0];
        const schedule = tournamentScheduler.getSchedule(tournament.id);

        if (!schedule) {
            return await waClient.sendMessage(context.jid, '❌ No schedule found');
        }

        let text = `📅 *${tournament.name} - All Stages*\n\n`;

        for (const stage of schedule.stages) {
            const icon = stage.status === 'active' ? '🔴' : stage.status === 'completed' ? '✅' : '⏳';
            const startStr = stage.startDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const endStr = stage.endDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            text += `${icon} *Stage ${stage.stageNumber}: ${stage.name}*\n`;
            text += `   📅 ${startStr} → ${endStr}\n`;
            text += `   ⏱️ Duration: ${stage.durationDays} days\n`;
            text += `   🎮 Matches: ${stage.matchesCount}\n`;
            text += `   ✅ Completed: ${stage.completedMatches}\n\n`;
        }

        await waClient.sendMessage(context.jid, text);
    },
});

// ==================== STATS COMMANDS ====================

// Leaderboard
registerCommand({
    name: 'lb',
    aliases: ['leaderboard', 'rank', 'ranking'],
    description: 'View leaderboard',
    usage: '.lb [count]',
    execute: async (args: string[], context: CommandContext) => {
        const limit = parseInt(args[0], 10) || 10;
        await statsManager.sendLeaderboard(context.jid, limit);
    },
});

// Profile
registerCommand({
    name: 'profile',
    aliases: ['p', 'stats'],
    description: 'View player profile',
    usage: '.profile [@user]',
    execute: async (args: string[], context: CommandContext) => {
        let targetJid = context.senderJid;
        if (args[0]) {
            targetJid = args[0].replace('@', '') + '@s.whatsapp.net';
        }
        await statsManager.sendProfile(context.jid, targetJid);
    },
});

// ==================== PVP COMMANDS ====================

// PVP Scores - record match result (requires screenshot proof)
registerCommand({
    name: 'pvpscores',
    aliases: ['pvp', 'pvpresult', 'pvpscore'],
    description: 'Record PVP match score (attach screenshot proof)',
    usage: '.pvpscores @user1 vs @user2 3:1 (with screenshot)\n.vs @opponent 3:1\n.me vs @opponent 3:1\n.25412345678 vs 25487654321 2:0',
    minArgs: 3,
    execute: async (args: string[], context: CommandContext) => {
        // Rate limiting
        const { rateLimiter } = await import('../services/rate-limiter');
        if (rateLimiter.isLimited(context.senderJid, 'pvpscores')) {
            const resetTime = rateLimiter.getResetTime(context.senderJid, 'pvpscores');
            await waClient.sendMessage(context.jid, `⏱️ Too many match submissions. Try again in ${resetTime}s`);
            return;
        }

        // Require image proof
        if (!context.hasImage) {
            await waClient.sendMessage(context.jid, msg.proofRequired());
            return;
        }

        // Parse format: player1 vs player2 score
        // Supported formats:
        //   .pvpscores @user1 vs @user2 3:1
        //   .pvpscores me vs @user 3:1
        //   .pvpscores me vs 25412345678 3:1
        //   .pvpscores 25412345678 vs 25487654321 2:0
        const vsIndex = args.findIndex(arg => arg.toLowerCase() === 'vs');

        if (vsIndex === -1 || vsIndex >= args.length - 1) {
            await waClient.sendMessage(context.jid,
                msg.invalidFormat(
                    `.pvpscores @user1 vs @user2 3:1\n` +
                    `.pvpscores vs @opponent 3:1\n` +
                    `.me vs @opponent 3:1\n` +
                    `.25412345678 vs 25487654321 1:1`
                )
            );
            return;
        }

        // Parse score (last arg) - support both : and -
        const scoreArg = args[args.length - 1];
        const scoreMatch = scoreArg.match(/(\d+)[:\-](\d+)/);

        if (!scoreMatch) {
            await waClient.sendMessage(context.jid, msg.invalidScore());
            return;
        }

        const player1Score = parseInt(scoreMatch[1], 10);
        const player2Score = parseInt(scoreMatch[2], 10);

        // Resolve player identifiers to JIDs
        // If vs is at index 0, sender is player1 (e.g. ".pvpscores vs @opponent 3:1")
        const leftSide = vsIndex === 0 ? ['me'] : args.slice(0, vsIndex);
        const rightSide = args.slice(vsIndex + 1, args.length - 1);

        const mentionedJids = context.mentionedJids || [];
        let mentionIndex = 0;

        // Cache group metadata for resolving tags when tagging is disabled
        let groupParticipants: { id: string; name?: string; notify?: string }[] | null = null;
        async function getGroupParticipants() {
            if (!groupParticipants) {
                try {
                    const metadata = await waClient.getGroupMetadata(context.jid);
                    groupParticipants = metadata?.participants || [];
                } catch { groupParticipants = []; }
            }
            return groupParticipants;
        }

        async function resolvePlayer(tokens: string[]): Promise<string | null> {
            for (const token of tokens) {
                const lower = token.toLowerCase();

                // "me" or "m" = sender themselves
                if (lower === 'me' || lower === 'm') {
                    return context.senderJid;
                }

                // @mention from WhatsApp
                if (token.startsWith('@')) {
                    const cleanTag = token.replace('@', '');

                    // Try real mention JID first
                    if (mentionIndex < mentionedJids.length) {
                        const jid = mentionedJids[mentionIndex++];
                        if (jid !== context.senderJid) {
                            return jid;
                        }
                        // Skip self-mentions - don't increment mentionIndex for skipped entries
                        // Fall through to try other resolution methods
                    }

                    // Phone number fallback (e.g. @25412345678)
                    if (/^\d{7,15}$/.test(cleanTag)) {
                        const jid = cleanTag + '@s.whatsapp.net';
                        if (jid !== context.senderJid) return jid;
                    }

                    // Match against group participants (for tagging-disabled users)
                    const participants = await getGroupParticipants();
                    if (participants) {
                        for (const p of participants) {
                            const phone = p.id.replace('@s.whatsapp.net', '').replace('@lid', '');
                            if (phone === cleanTag && p.id !== context.senderJid) return p.id;
                            if (p.name && p.name.toLowerCase() === cleanTag.toLowerCase() && p.id !== context.senderJid) return p.id;
                            if (p.notify && p.notify === cleanTag && p.id !== context.senderJid) return p.id;
                        }
                    }
                }

                // Raw phone number (7-15 digits)
                const cleanPhone = token.replace(/[^0-9]/g, '');
                if (/^\d{7,15}$/.test(cleanPhone)) {
                    const jid = cleanPhone + '@s.whatsapp.net';
                    if (jid !== context.senderJid) return jid;
                }
            }
            return null;
        }

        const player1Jid = await resolvePlayer(leftSide);
        const player2Jid = await resolvePlayer(rightSide);

        if (!player1Jid || !player2Jid) {
            await waClient.sendMessage(context.jid, msg.unresolvedPlayers());
            return;
        }

        if (player1Jid === player2Jid) {
            await waClient.sendMessage(context.jid, msg.selfMatch());
            return;
        }

        // Record the match as pending
        const { pvpManager } = await import('../services/pvp-manager');
        const result = await pvpManager.recordMatch(
            player1Jid,
            player2Jid,
            player1Score,
            player2Score,
            context.jid,
            context.hasImage
        );

        await waClient.sendMessage(context.jid, result);
    },
});

// PVP Approve - admin approves a pending match
registerCommand({
    name: 'pvpapprove',
    aliases: ['pvpok', 'pvpyes'],
    description: 'Approve a pending PVP match',
    usage: '.pvpapprove <match_id>',
    minArgs: 1,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const matchId = parseInt(args[0], 10);
        if (isNaN(matchId)) {
            await waClient.sendMessage(context.jid, msg.usage('.pvpapprove <match_id>'));
            return;
        }

        const { pvpManager } = await import('../services/pvp-manager');
        const { challengeManager } = await import('../services/challenge-manager');
        const { pvpOps } = await import('../database/db');
        
        const result = await pvpManager.approveMatch(matchId, context.senderJid);
        await waClient.sendMessage(context.jid, result);

        // Update challenges for both players
        const match = pvpOps.getById(matchId);
        if (match) {
            const player1Score = match.player1_score;
            const player2Score = match.player2_score;

            let result1: 'win' | 'draw' | 'loss';
            let result2: 'win' | 'draw' | 'loss';

            if (player1Score > player2Score) {
                result1 = 'win';
                result2 = 'loss';
            } else if (player1Score < player2Score) {
                result1 = 'loss';
                result2 = 'win';
            } else {
                result1 = 'draw';
                result2 = 'draw';
            }

            challengeManager.updateProgress(match.player1_jid, result1, player1Score, player2Score);
            challengeManager.updateProgress(match.player2_jid, result2, player2Score, player1Score);
        }

        // Show updated leaderboard after approval
        await pvpManager.sendLeaderboard(context.jid, 10);
    },
});

// PVP Reject - admin rejects a pending match
registerCommand({
    name: 'pvpreject',
    aliases: ['pvpno', 'pvpdeny'],
    description: 'Reject a pending PVP match',
    usage: '.pvpreject <match_id> <reason>',
    minArgs: 2,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const matchId = parseInt(args[0], 10);
        if (isNaN(matchId)) {
            await waClient.sendMessage(context.jid, msg.usage('.pvpreject <match_id> <reason>'));
            return;
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        const { pvpManager } = await import('../services/pvp-manager');
        const result = await pvpManager.rejectMatch(matchId, context.senderJid, reason);
        await waClient.sendMessage(context.jid, result);
    },
});

// PVP Pending - list all pending matches
registerCommand({
    name: 'pvppending',
    aliases: ['pvpqueue', 'pvpq'],
    description: 'View pending PVP matches',
    usage: '.pvppending',
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const { pvpManager } = await import('../services/pvp-manager');
        await pvpManager.sendPendingMatches(context.jid);
    },
});

// PVP Leaderboard
registerCommand({
    name: 'pvplb',
    aliases: ['pvlb', 'pvpLB', 'pvprank', 'pvpranking'],
    description: 'View PVP leaderboard',
    usage: '.pvplb [count]',
    execute: async (args: string[], context: CommandContext) => {
        const limit = parseInt(args[0], 10) || 10;
        const { pvpManager } = await import('../services/pvp-manager');
        await pvpManager.sendLeaderboard(context.jid, limit);
    },
});

// PVP Stats/Profile
registerCommand({
    name: 'pvpstats',
    aliases: ['pvpp', 'pvprofile', 'pvps'],
    description: 'View player PVP stats',
    usage: '.pvpstats [@user]',
    execute: async (args: string[], context: CommandContext) => {
        let targetJid = context.senderJid;

        if (args[0]) {
            // Check if it's a mention
            if (args[0].startsWith('@')) {
                targetJid = args[0].replace('@', '') + '@s.whatsapp.net';
            }
        }

        const { pvpManager } = await import('../services/pvp-manager');
        await pvpManager.sendProfile(context.jid, targetJid);
    },
});

// PVP Help - show all PVP commands
registerCommand({
    name: 'pvphelp',
    aliases: ['ph', 'pvpcmds'],
    description: 'Show all PVP commands',
    usage: '.pvphelp',
    execute: async (args: string[], context: CommandContext) => {
        const text = `⚔️ 𝙿𝚅𝙿 𝙲𝙾𝙼𝙼𝙰𝙽𝙳𝚂 (𝚍𝚊𝚒𝚕𝚢 𝚏𝚛𝚒𝚎𝚗𝚍𝚕𝚒𝚎𝚜) ⚔️\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `𝚙𝚟𝚙𝚜𝚌𝚘𝚛𝚎𝚜 — Record a match result\n` +
            `  Usage: .pvpscores @user1 vs @user2 3:1\n` +
            `  Shortcuts: .vs @opponent 3:1 | .me vs @opponent 2:0\n` +
            `  ⚠️ Screenshot proof required!\n\n` +
            `𝚙𝚟𝚙𝚕𝚋 — View PVP leaderboard\n` +
            `  Usage: .pvplb [count]\n` +
            `  Points: Win=3 | Draw=1 | Loss=0\n\n` +
            `𝚙𝚟𝚙𝚜𝚝𝚊𝚝𝚜 — View player PVP profile\n` +
            `  Usage: .pvpstats | .pvpstats @user\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `𝙰𝚍𝚖𝚒𝚗 𝙲𝚘𝚖𝚖𝚊𝚗𝚍𝚜\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `𝚙𝚟𝚙𝚊𝚙𝚙𝚛𝚘𝚟𝚎 — Approve a pending match\n` +
            `  Usage: .pvpapprove <match_id>\n\n` +
            `𝚙𝚟𝚙𝚛𝚎𝚓𝚎𝚌𝚝 — Reject a pending match\n` +
            `  Usage: .pvpreject <match_id> <reason>\n\n` +
            `𝚙𝚟𝚙𝚙𝚎𝚗𝚍𝚒𝚗𝚐 — View match approval queue\n` +
            `  Usage: .pvppending\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Aliases: .vs, .pvp, .pvlb, .pvpp, .pvpok, .pvpno, .pvpq`;
        await waClient.sendMessage(context.jid, text);
    },
});

// ==================== PVP ADMIN COMMANDS ====================

// Clear all PVP records (admin only)
registerCommand({
    name: 'pvpclear',
    aliases: ['clearpvp'],
    description: 'Clear all PVP records (admin only)',
    usage: '.pvpclear confirm',
    minArgs: 1,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        if (args[0]?.toLowerCase() !== 'confirm') {
            await waClient.sendMessage(context.jid,
                `⚠️ This will delete ALL PVP records!\n\n` +
                `To confirm, use: .pvpclear confirm\n\n` +
                `This action cannot be undone.`
            );
            return;
        }

        try {
            const { seasonOps } = await import('../database/db');
            seasonOps.clearAllPvpRecords();
            await waClient.sendMessage(context.jid,
                `✅ All PVP records cleared!\n\n` +
                `• All matches deleted\n` +
                `• All stats deleted\n` +
                `• All seasons deleted\n\n` +
                `Use .pvpreset to reinitialize the system.`
            );
        } catch (error) {
            await waClient.sendMessage(context.jid, `❌ Error clearing PVP records: ${error}`);
        }
    },
});

// Reinitialize PVP system (admin only)
registerCommand({
    name: 'pvpreset',
    aliases: ['resetpvp'],
    description: 'Reinitialize PVP system (admin only)',
    usage: '.pvpreset confirm',
    minArgs: 1,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        if (args[0]?.toLowerCase() !== 'confirm') {
            await waClient.sendMessage(context.jid,
                `⚠️ This will reinitialize the PVP system!\n\n` +
                `To confirm, use: .pvpreset confirm\n\n` +
                `This will:\n` +
                `• Clear all PVP records\n` +
                `• Create Season 1\n` +
                `• Reset all stats`
            );
            return;
        }

        try {
            const { seasonOps } = await import('../database/db');
            const season = seasonOps.reinitializePvp();
            await waClient.sendMessage(context.jid,
                `✅ PVP system reinitialized!\n\n` +
                `📊 Season ${season.season_number} created\n` +
                `🔄 All stats reset\n` +
                `✅ Ready to go!`
            );
        } catch (error) {
            await waClient.sendMessage(context.jid, `❌ Error reinitializing PVP: ${error}`);
        }
    },
});

// Manually trigger week reset (admin only)
registerCommand({
    name: 'pvpweek',
    aliases: ['weekreset', 'newweek'],
    description: 'Manually trigger week reset (admin only)',
    usage: '.pvpweek confirm',
    minArgs: 1,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        if (args[0]?.toLowerCase() !== 'confirm') {
            await waClient.sendMessage(context.jid,
                `⚠️ This will manually trigger the weekly reset!\n\n` +
                `To confirm, use: .pvpweek confirm\n\n` +
                `This will:\n` +
                `• Close current season\n` +
                `• Create new season\n` +
                `• Reset all stats`
            );
            return;
        }

        try {
            const { seasonManager } = await import('../services/season-manager');
            const { seasonOps } = await import('../database/db');
            await seasonManager.resetSeason();
            const season = seasonOps.getCurrentSeason();
            await waClient.sendMessage(context.jid,
                `✅ Weekly reset completed!\n\n` +
                `📊 Season ${season.season_number} is now active\n` +
                `🔄 All stats reset\n` +
                `📅 New week started (Monday-Sunday)`
            );
        } catch (error) {
            await waClient.sendMessage(context.jid, `❌ Error triggering week reset: ${error}`);
        }
    },
});

// ==================== CHALLENGE REPORTS ====================

// Daily challenge report
registerCommand({
    name: 'dailyreport',
    aliases: ['dreport', 'dchallenge'],
    description: 'View daily challenge report',
    usage: '.dailyreport [@player] [date]',
    requiredRole: ['member'],
    execute: async (args: string[], context: CommandContext) => {
        const { challengeTracker } = await import('../services/challenge-tracker');

        let targetJid = context.senderJid;
        let date = args[0];

        // If first arg is a mention, use that player
        if (context.mentionedJids && context.mentionedJids.length > 0) {
            targetJid = context.mentionedJids[0];
            date = args[1];
        }

        const text = challengeTracker.formatDailyReport(targetJid, date);
        await waClient.sendMessage(context.jid, text);
    },
});

// Weekly challenge report
registerCommand({
    name: 'weeklyreport',
    aliases: ['wreport', 'wchallenge'],
    description: 'View weekly challenge report',
    usage: '.weeklyreport [@player] [week_start_date]',
    requiredRole: ['member'],
    execute: async (args: string[], context: CommandContext) => {
        const { challengeTracker } = await import('../services/challenge-tracker');

        let targetJid = context.senderJid;
        let weekStart = args[0];

        // If first arg is a mention, use that player
        if (context.mentionedJids && context.mentionedJids.length > 0) {
            targetJid = context.mentionedJids[0];
            weekStart = args[1];
        }

        const text = challengeTracker.formatWeeklyReport(targetJid, weekStart);
        await waClient.sendMessage(context.jid, text);
    },
});

// Group weekly challenge summary
registerCommand({
    name: 'weeklysummary',
    aliases: ['wsummary', 'groupweekly'],
    description: 'View group weekly challenge summary',
    usage: '.weeklysummary [week_start_date]',
    requiredRole: ['member'],
    execute: async (args: string[], context: CommandContext) => {
        const { challengeTracker } = await import('../services/challenge-tracker');

        const weekStart = args[0];
        const text = challengeTracker.formatGroupWeeklySummary(weekStart);
        await waClient.sendMessage(context.jid, text);
    },
});

// ==================== FRIENDLY REQUESTS ====================

// Request a friendly match
registerCommand({
    name: 'request',
    aliases: ['req', 'friendly'],
    description: 'Request a friendly match from active players',
    usage: '.request',
    requiredRole: ['member'],
    execute: async (args: string[], context: CommandContext) => {
        const { friendlyRequestManager } = await import('../services/friendly-request');
        const { rateLimiter } = await import('../services/rate-limiter');

        if (rateLimiter.isLimited(context.senderJid, 'request')) {
            const resetTime = rateLimiter.getResetTime(context.senderJid, 'request');
            return await waClient.sendMessage(context.jid, `⏱️ Too many requests. Try again in ${resetTime}s`);
        }

        // Create request
        const requestId = friendlyRequestManager.createRequest(context.senderJid, context.jid);
        const request = friendlyRequestManager.getRequest(requestId);

        if (!request) {
            return await waClient.sendMessage(context.jid, '❌ Error creating request');
        }

        // Get frequent players to tag
        const frequentPlayers = friendlyRequestManager.getFrequentPlayers(context.jid, 5);
        const requester = userOps.get(context.senderJid);
        const requesterName = requester?.name || formatJid(context.senderJid);

        let message = `🎮 *Friendly Match Request*\n\n`;
        message += `${requesterName} is looking for a friendly match!\n\n`;

        // Tag frequent players
        if (frequentPlayers.length > 0) {
            message += `👥 Tagging active players:\n`;
            for (const player of frequentPlayers) {
                const user = userOps.get(player.jid);
                const name = user?.name || formatJid(player.jid);
                message += `  @${name}\n`;
            }
            message += `\n`;
        }

        message += `⏱️ Expires in 30 minutes\n`;
        message += `🆔 Request ID: ${requestId}\n\n`;
        message += `To accept: .accept ${requestId}\n`;
        message += `To decline: .decline ${requestId}`;

        await waClient.sendMessage(context.jid, message);
    },
});

// Accept a friendly request
registerCommand({
    name: 'accept',
    aliases: ['yes', 'ok'],
    description: 'Accept a friendly match request',
    usage: '.accept [request_id]',
    minArgs: 1,
    requiredRole: ['member'],
    execute: async (args: string[], context: CommandContext) => {
        const { friendlyRequestManager } = await import('../services/friendly-request');

        const requestId = args[0];
        const request = friendlyRequestManager.getRequest(requestId);

        if (!request) {
            return await waClient.sendMessage(context.jid, '❌ Request not found');
        }

        if (request.status !== 'pending') {
            return await waClient.sendMessage(context.jid, `❌ Request is ${request.status}`);
        }

        friendlyRequestManager.acceptRequest(requestId, context.senderJid);

        const user = userOps.get(context.senderJid);
        const name = user?.name || formatJid(context.senderJid);
        const requester = userOps.get(request.requesterJid);
        const requesterName = requester?.name || formatJid(request.requesterJid);

        let message = `✅ *Match Accepted*\n\n`;
        message += `${name} accepted ${requesterName}'s friendly request!\n\n`;

        if (request.acceptedBy && request.acceptedBy.length > 1) {
            message += `👥 Accepted by:\n`;
            for (const jid of request.acceptedBy) {
                const u = userOps.get(jid);
                const n = u?.name || formatJid(jid);
                message += `  ✅ ${n}\n`;
            }
        }

        message += `\n🎮 Get ready for the match!`;

        await waClient.sendMessage(context.jid, message);
    },
});

// Decline a friendly request
registerCommand({
    name: 'decline',
    aliases: ['no', 'deny'],
    description: 'Decline a friendly match request',
    usage: '.decline [request_id]',
    minArgs: 1,
    requiredRole: ['member'],
    execute: async (args: string[], context: CommandContext) => {
        const { friendlyRequestManager } = await import('../services/friendly-request');

        const requestId = args[0];
        const request = friendlyRequestManager.getRequest(requestId);

        if (!request) {
            return await waClient.sendMessage(context.jid, '❌ Request not found');
        }

        if (request.status !== 'pending') {
            return await waClient.sendMessage(context.jid, `❌ Request is ${request.status}`);
        }

        friendlyRequestManager.declineRequest(requestId);

        const user = userOps.get(context.senderJid);
        const name = user?.name || formatJid(context.senderJid);

        await waClient.sendMessage(context.jid, `❌ ${name} declined the friendly request`);
    },
});

// View active players
registerCommand({
    name: 'activeplayers',
    aliases: ['active', 'frequent'],
    description: 'View most active players this week',
    usage: '.activeplayers [limit]',
    requiredRole: ['member'],
    execute: async (args: string[], context: CommandContext) => {
        const { friendlyRequestManager } = await import('../services/friendly-request');

        const limit = parseInt(args[0], 10) || 10;
        const players = friendlyRequestManager.getFrequentPlayers(context.jid, limit);
        const text = friendlyRequestManager.formatFrequentPlayersForTag(players);

        await waClient.sendMessage(context.jid, `📊 *Active Players This Week*\n\n${text}`);
    },
});

// ==================== MATCH SCHEDULING ====================

// Schedule a match
registerCommand({
    name: 'schedule',
    aliases: ['sched', 'book'],
    description: 'Schedule a match',
    usage: '.schedule @player [date] [time]',
    minArgs: 2,
    requiredRole: ['member'],
    execute: async (args: string[], context: CommandContext) => {
        const { matchScheduler } = await import('../services/match-scheduler');
        const { rateLimiter } = await import('../services/rate-limiter');

        if (rateLimiter.isLimited(context.senderJid, 'schedule')) {
            const resetTime = rateLimiter.getResetTime(context.senderJid, 'schedule');
            return await waClient.sendMessage(context.jid, `⏱️ Too many schedule requests. Try again in ${resetTime}s`);
        }

        if (!context.mentionedJids || context.mentionedJids.length === 0) {
            return await waClient.sendMessage(context.jid, '❌ Please mention a player to schedule with');
        }

        const opponent = context.mentionedJids[0];
        const dateStr = args[1];
        const timeStr = args[2] || '18:00';

        try {
            const scheduledTime = new Date(`${dateStr}T${timeStr}`);
            if (isNaN(scheduledTime.getTime())) {
                return await waClient.sendMessage(context.jid, '❌ Invalid date/time format. Use: YYYY-MM-DD HH:MM');
            }

            const matchId = matchScheduler.schedule(context.senderJid, opponent, scheduledTime, context.jid);
            const opponentUser = userOps.get(opponent);
            const opponentName = opponentUser?.name || formatJid(opponent);
            const senderUser = userOps.get(context.senderJid);
            const senderName = senderUser?.name || formatJid(context.senderJid);

            const timeStr2 = scheduledTime.toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });

            await waClient.sendMessage(context.jid, `✅ *Match Scheduled*\n\n🎮 ${senderName} vs ${opponentName}\n📅 ${timeStr2}\n🆔 ID: ${matchId}`);
        } catch (error) {
            console.error('Error scheduling match:', error);
            await waClient.sendMessage(context.jid, '❌ Error scheduling match');
        }
    },
});

// View scheduled matches
registerCommand({
    name: 'scheduled',
    aliases: ['sched', 'upcoming'],
    description: 'View scheduled matches',
    usage: '.scheduled',
    requiredRole: ['member'],
    execute: async (args: string[], context: CommandContext) => {
        const { matchScheduler } = await import('../services/match-scheduler');

        const matches = matchScheduler.getByGroup(context.jid);
        if (matches.length === 0) {
            return await waClient.sendMessage(context.jid, '📭 No scheduled matches');
        }

        let text = '📅 *Upcoming Matches*\n\n';
        for (const match of matches) {
            text += matchScheduler.formatMatch(match) + '\n';
        }

        await waClient.sendMessage(context.jid, text);
    },
});

// ==================== DAILY CHALLENGES ====================

// View daily challenges
registerCommand({
    name: 'challenges',
    aliases: ['ch', 'daily', 'quest'],
    description: 'View daily challenges',
    usage: '.challenges',
    requiredRole: ['member'],
    execute: async (args: string[], context: CommandContext) => {
        const { challengeManager } = await import('../services/challenge-manager');

        const text = challengeManager.formatChallenges(context.senderJid);
        await waClient.sendMessage(context.jid, text);
    },
});

// Claim challenge reward
registerCommand({
    name: 'claimreward',
    aliases: ['claim', 'reward'],
    description: 'Claim challenge reward',
    usage: '.claimreward [challenge_id]',
    minArgs: 1,
    requiredRole: ['member'],
    execute: async (args: string[], context: CommandContext) => {
        const { challengeManager } = await import('../services/challenge-manager');

        const challengeId = args[0];
        const reward = challengeManager.claimReward(context.senderJid, challengeId);

        if (reward === 0) {
            return await waClient.sendMessage(context.jid, '❌ Challenge not found or already claimed');
        }

        const user = userOps.get(context.senderJid);
        const name = user?.name || formatJid(context.senderJid);

        await waClient.sendMessage(context.jid, `🎁 *Reward Claimed*\n\n${name} earned +${reward} points!`);
    },
});

// ==================== GENERAL COMMANDS ====================

// Help
registerCommand({
    name: 'help',
    aliases: ['h', 'cmd', 'commands'],
    description: 'Show help',
    usage: '.help [command]',
    execute: async (args: string[], context: CommandContext) => {
        if (args[0]) {
            const cmd = getCommand(args[0]);
            if (cmd) {
                await waClient.sendMessage(context.jid, msg.helpCommand(cmd.name, cmd.description, cmd.usage));
                return;
            }
        }

        const categories = `𝙼𝚘𝚍𝚎𝚛𝚊𝚝𝚒𝚘𝚗\n` +
            `  .warn  .mute  .unmute  .kick\n` +
            `  .promote  .demote  .setadmin\n` +
            `  .tagall  .tagadmin\n\n` +
            `𝚃𝚘𝚞𝚛𝚗𝚊𝚖𝚎𝚗𝚝 (competition with brackets)\n` +
            `  .tcr  .tj  .tl  .tstart  .ts\n` +
            `  .tb  .tres  .tlb  .tnext  .tend\n` +
            `  .tpending  .tapprove  .treject\n\n` +
            `𝙿𝚅𝙿 (daily friendlies)\n` +
            `  .pvpscores  .pvplb  .pvpstats\n` +
            `  .pvpapprove  .pvpreject  .pvppending\n\n` +
            `𝙶𝚎𝚗𝚎𝚛𝚊𝚕\n` +
            `  .lb  .profile  .help\n` +
            `  .pvphelp  .tourneyhelp  .mutehelp`;

        await waClient.sendMessage(context.jid, msg.helpGeneral(categories));
    },
});

export default {
    registerCommand,
    getCommand,
    getAllCommands,
    parseCommand,
    checkPermission,
};
