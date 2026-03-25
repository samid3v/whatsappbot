import { CommandContext, Command, UserRole } from '../types';
import { roleManager } from '../services/role-manager';
import config from '../utils/config';
import { parseArgs, hasPermission } from '../utils/helpers';
import { warnManager } from '../services/warn-manager';
import { muteManager } from '../services/mute-manager';
import { waClient } from '../client';
import { userOps, logOps } from '../database/db';
import { formatJid } from '../utils/helpers';
import { statsManager } from '../services/stats-manager';
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
        message: `⚠️ You need to be at least a ${requiredRole[0]} to use this command.`,
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
            `📊 *${userName}* has ${warnings}/${config.warnThreshold} warnings`
        );
    },
});

// Mute
registerCommand({
    name: 'mute',
    aliases: ['m'],
    description: 'Mute a user',
    usage: '.mute @user [minutes]',
    minArgs: 1,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const mention = args[0];
        const userJid = mention.replace('@', '') + '@s.whatsapp.net';
        const duration = parseInt(args[1], 10) || 60;
        const reason = args.slice(2).join(' ') || 'Violation';
        await muteManager.muteUser(userJid, context.jid, duration, reason);
    },
});

// Unmute
registerCommand({
    name: 'unmute',
    aliases: ['um'],
    description: 'Unmute a user',
    usage: '.unmute @user',
    minArgs: 1,
    requiredRole: ['admin'],
    execute: async (args: string[], context: CommandContext) => {
        const mention = args[0];
        const userJid = mention.replace('@', '') + '@s.whatsapp.net';
        await muteManager.unmuteUser(userJid, context.jid);
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
        await waClient.sendMessage(context.jid, `👋 User removed`);
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
        await waClient.sendMention(context.jid, `⬆️ @${formatJid(userJid)} is now a Moderator!`, [userJid]);
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
        await waClient.sendMention(context.jid, `⬇️ @${formatJid(userJid)} is now a Member`, [userJid]);
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
        await waClient.sendMention(context.jid, `⬆️ @${formatJid(userJid)} is now an Admin!`, [userJid]);
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
            await waClient.sendMessage(context.jid, '❌ Could not get group members');
            return;
        }

        const mentions = metadata.participants.map((p: any) => p.id);
        const memberNames = metadata.participants.map((p: any) => p.name || p.id.replace('@s.whatsapp.net', ''));

        let tagMessage = `${message}\n\n`;
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
            await waClient.sendMessage(context.jid, '❌ No admins found');
            return;
        }

        await waClient.sendMention(context.jid, message, admins);
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
        let message = `⚙️ *Bot Settings*\n\n`;
        message += `📝 Prefix: ${config.commandPrefix}\n`;
        message += `⚠️ Warn Limit: ${config.warnThreshold}\n`;
        message += `🔇 Mute Duration: ${config.muteDurationHours}h`;
        await waClient.sendMessage(context.jid, message);
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
            await waClient.sendMessage(context.jid, '❌ Could not get group info');
            return;
        }

        let message = `📋 *Group Info*\n\n`;
        message += `📛 Name: ${metadata.subject}\n`;
        message += `👥 Members: ${metadata.participants?.length || 0}\n`;
        message += `📅 Created: ${new Date(metadata.creation * 1000).toLocaleDateString()}`;
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
            await waClient.sendMessage(context.jid, `❌ Type: se (single), de (double), rr (round robin)`);
            return;
        }

        const typeMap: Record<string, string> = {
            'se': 'single_elimination', 'single_elimination': 'single_elimination',
            'de': 'double_elimination', 'double_elimination': 'double_elimination',
            'rr': 'round_robin', 'round_robin': 'round_robin'
        };

        const tournamentType = typeMap[type] || 'single_elimination';
        const tournament = tournamentOps.create(name, tournamentType, maxPlayers, context.senderJid);

        let msg = `🏆 *Tournament Created!*\n\n`;
        msg += `📛 Name: ${name}\n`;
        msg += `📋 Type: ${tournamentType.replace('_', ' ')}\n`;
        if (maxPlayers) msg += `👥 Max: ${maxPlayers}\n`;
        msg += `\nUse .tj to join!`;
        await waClient.sendMessage(context.jid, msg);
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
            await waClient.sendMessage(context.jid, `❌ No active tournaments. Use .tcr to create!`);
            return;
        }

        const t = active[0];
        if (t.status !== 'registration') {
            await waClient.sendMessage(context.jid, `❌ Registration closed`);
            return;
        }

        const participants = tournamentOps.getParticipants(t.id);
        if (t.max_players && participants.length >= t.max_players) {
            await waClient.sendMessage(context.jid, `❌ Tournament full!`);
            return;
        }

        tournamentOps.addParticipant(t.id, context.senderJid);
        await waClient.sendMessage(context.jid, `✅ Joined *${t.name}!* (${participants.length + 1} players)`);
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
            await waClient.sendMessage(context.jid, `❌ No active tournaments`);
            return;
        }

        const t = active[0];
        if (t.status !== 'registration') {
            await waClient.sendMessage(context.jid, `❌ Cannot leave - in progress`);
            return;
        }

        tournamentOps.removeParticipant(t.id, context.senderJid);
        await waClient.sendMessage(context.jid, `✅ Left *${t.name}*`);
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
            await waClient.sendMessage(context.jid, `❌ No active tournaments`);
            return;
        }

        const t = active[0];
        const participants = tournamentOps.getParticipants(t.id);

        let msg = `🏆 *${t.name}*\n\n`;
        msg += `📋 Status: ${t.status}\n`;
        msg += `👥 Players: ${participants.length}`;
        await waClient.sendMessage(context.jid, msg);
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
            await waClient.sendMessage(context.jid, `❌ No active tournaments`);
            return;
        }

        const t = active[0];
        const matches = tournamentOps.getMatches(t.id);

        if (matches.length === 0) {
            await waClient.sendMessage(context.jid, `📊 No matches yet`);
            return;
        }

        let msg = `📊 *Bracket - ${t.name}*\n\n`;
        const rounds: Record<number, any[]> = {};
        for (const m of matches) {
            if (!rounds[m.round_number]) rounds[m.round_number] = [];
            rounds[m.round_number].push(m);
        }

        for (const roundNum in rounds) {
            msg += `*Round ${roundNum}*\n`;
            for (const m of rounds[roundNum]) {
                const p1 = m.player1_name || formatJid(m.player1_jid);
                const p2 = m.player2_name || formatJid(m.player2_jid);
                msg += m.status === 'completed'
                    ? `${p1} ${m.player1_score}-${m.player2_score} ${p2}\n`
                    : `${p1} vs ${p2}\n`;
            }
        }
        await waClient.sendMessage(context.jid, msg);
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
            await waClient.sendMessage(context.jid, `❌ Use: .tres 3-1`);
            return;
        }

        const myScore = parseInt(match[1], 10);
        const oppScore = parseInt(match[2], 10);
        await waClient.sendMessage(context.jid,
            `✅ Result: ${myScore}-${oppScore}\nWinner: ${myScore > oppScore ? context.name : 'Opponent'}`
        );
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
                let msg = `📖 *${cmd.name}*\n\n📝 ${cmd.description}\n📋 ${cmd.usage}`;
                await waClient.sendMessage(context.jid, msg);
                return;
            }
        }

        let msg = `📖 *Commands*\n\n`;
        msg += `*Moderation:*\n`;
        msg += `.warn, .mute, .unmute, .kick\n`;
        msg += `.promote, .demote, .setadmin\n`;
        msg += `.tagall, .tagadmin\n\n`;
        msg += `*Tournament:*\n`;
        msg += `.tcr, .tj, .tl, .ts, .tb, .tres\n\n`;
        msg += `*Stats:*\n`;
        msg += `.lb, .profile\n\n`;
        msg += `.help [cmd] for details`;
        await waClient.sendMessage(context.jid, msg);
    },
});

export default {
    registerCommand,
    getCommand,
    getAllCommands,
    parseCommand,
    checkPermission,
};
