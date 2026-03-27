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
import tournamentOps from '../services/tournament-manager';

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

// Tournament create
registerCommand({
    name: 'tcr',
    aliases: ['tourneycreate', 'tc'],
    description: 'Create tournament',
    usage: '.tcr [name] [type] [max]',
    minArgs: 2,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const name = args[0];
        const type = args[1];
        const maxPlayers = args[2] ? parseInt(args[2], 10) : null;

        if (!['se', 'de', 'rr', 'single_elimination', 'double_elimination', 'round_robin'].includes(type)) {
            await waClient.sendMessage(context.jid, msg.tournamentInvalidType());
            return;
        }

        const typeMap: Record<string, string> = {
            'se': 'single_elimination', 'single_elimination': 'single_elimination',
            'de': 'double_elimination', 'double_elimination': 'double_elimination',
            'rr': 'round_robin', 'round_robin': 'round_robin'
        };

        const tournamentType = typeMap[type] || 'single_elimination';
        const tournament = tournamentOps.create(name, tournamentType, maxPlayers, context.senderJid);

        await waClient.sendMessage(context.jid, msg.tournamentCreated(name, tournamentType.replace('_', ' '), maxPlayers));
    },
});

// Tournament join
registerCommand({
    name: 'tj',
    aliases: ['tourneyjoin', 'tj'],
    description: 'Join tournament',
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

        await waClient.sendMessage(context.jid, msg.tournamentStatus(t.name, t.status, participants.length));
    },
});

// Tournament bracket
registerCommand({
    name: 'tb',
    aliases: ['tourneybracket'],
    description: 'View bracket',
    usage: '.tb',
    execute: async (args: string[], context: CommandContext) => {
        const active = tournamentOps.getActive();
        if (active.length === 0) {
            await waClient.sendMessage(context.jid, msg.noActiveTournament());
            return;
        }

        const t = active[0];
        const matches = tournamentOps.getMatches(t.id);

        if (matches.length === 0) {
            await waClient.sendMessage(context.jid, msg.noMatchesYet());
            return;
        }

        let roundsText = '';
        const rounds: Record<number, any[]> = {};
        for (const m of matches) {
            if (!rounds[m.round_number]) rounds[m.round_number] = [];
            rounds[m.round_number].push(m);
        }

        for (const roundNum in rounds) {
            roundsText += `Round ${roundNum}\n`;
            for (const m of rounds[roundNum]) {
                const p1 = m.player1_name || formatJid(m.player1_jid);
                const p2 = m.player2_name || formatJid(m.player2_jid);
                roundsText += m.status === 'completed'
                    ? `  ${p1} ${m.player1_score}-${m.player2_score} ${p2}\n`
                    : `  ${p1} vs ${p2}\n`;
            }
        }
        await waClient.sendMessage(context.jid, msg.tournamentBracket(t.name, roundsText));
    },
});

// Tournament result
registerCommand({
    name: 'tres',
    aliases: ['tourneyresult'],
    description: 'Report result',
    usage: '.tres 3-1',
    minArgs: 1,
    execute: async (args: string[], context: CommandContext) => {
        const score = args[0];
        const match = score.match(/(\d+)-(\d+)/);
        if (!match) {
            await waClient.sendMessage(context.jid, msg.invalidScore());
            return;
        }

        const myScore = parseInt(match[1], 10);
        const oppScore = parseInt(match[2], 10);
        await waClient.sendMessage(context.jid,
            msg.tournamentResult(myScore, oppScore, myScore > oppScore ? context.name : 'Opponent')
        );
    },
});

// Tournament Help - show all tournament commands
registerCommand({
    name: 'tourneyhelp',
    aliases: ['th', 'tournamenthelp', 'tourneycmds'],
    description: 'Show all tournament commands',
    usage: '.tourneyhelp',
    execute: async (args: string[], context: CommandContext) => {
        const text = `🏆 𝚃𝙾𝚄𝚁𝙽𝙰𝙼𝙴𝙽𝚃 𝙲𝙾𝙼𝙼𝙰𝙽𝙳𝚂 🏆\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `𝚝𝚌𝚛 — Create tournament\n` +
            `  Usage: .tcr [name] [type] [max]\n` +
            `  Types: se (single) | de (double) | rr (round robin)\n\n` +
            `𝚝𝚓 — Join active tournament\n` +
            `𝚝𝚕 — Leave tournament\n` +
            `𝚝𝚜 — View tournament status\n` +
            `𝚝𝚋 — View bracket\n` +
            `𝚝𝚛𝚎𝚜 — Report match result\n` +
            `  Usage: .tres 3-1\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `Aliases: .tc, .tourneyjoin, .tourneyleave, .tourneystatus, .tourneybracket, .tourneyresult`;
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
            context.jid
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
        const result = await pvpManager.approveMatch(matchId, context.senderJid);
        await waClient.sendMessage(context.jid, result);

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
            `𝚃𝚘𝚞𝚛𝚗𝚊𝚖𝚎𝚗𝚝\n` +
            `  .tcr  .tj  .tl  .ts  .tb  .tres\n\n` +
            `𝚂𝚝𝚊𝚝𝚜\n` +
            `  .lb  .profile\n\n` +
            `𝙿𝚅𝙿\n` +
            `  .pvpscores  .pvplb  .pvpstats\n` +
            `  .pvpapprove  .pvpreject  .pvppending`;

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
