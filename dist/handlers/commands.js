"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerCommand = registerCommand;
exports.getCommand = getCommand;
exports.getAllCommands = getAllCommands;
exports.parseCommand = parseCommand;
exports.checkPermission = checkPermission;
const role_manager_1 = require("../services/role-manager");
const config_1 = __importDefault(require("../utils/config"));
const helpers_1 = require("../utils/helpers");
const warn_manager_1 = require("../services/warn-manager");
const mute_manager_1 = require("../services/mute-manager");
const client_1 = require("../client");
const db_1 = require("../database/db");
const helpers_2 = require("../utils/helpers");
const stats_manager_1 = require("../services/stats-manager");
const tournament_manager_1 = __importDefault(require("../services/tournament-manager"));
// Command map
const commands = new Map();
// Register command
function registerCommand(command) {
    commands.set(command.name, command);
    if (command.aliases) {
        for (const alias of command.aliases) {
            commands.set(alias, command);
        }
    }
}
// Get command
function getCommand(name) {
    return commands.get(name.toLowerCase());
}
// Get all commands
function getAllCommands() {
    return Array.from(commands.values());
}
// Parse command from text
function parseCommand(text) {
    // Check both ! and . prefixes
    const prefixes = [config_1.default.commandPrefix, '!', '.'];
    let commandText = text;
    for (const prefix of prefixes) {
        if (text.startsWith(prefix)) {
            commandText = text.slice(prefix.length);
            break;
        }
    }
    if (commandText === text)
        return null; // No prefix found
    const parts = commandText.trim().split(/\s+/);
    const name = parts[0]?.toLowerCase();
    const args = parts.slice(1);
    if (!name)
        return null;
    return { name, args };
}
// Check permission
async function checkPermission(context, requiredRole) {
    if (!requiredRole || requiredRole.length === 0) {
        return { allowed: true };
    }
    for (const role of requiredRole) {
        if ((0, helpers_1.hasPermission)(context.isOwner ? 'owner' : context.isAdmin ? 'admin' : context.isModerator ? 'moderator' : 'member', role)) {
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
    execute: async (args, context) => {
        const mention = args[0];
        const reason = args.slice(1).join(' ') || 'No reason';
        const userJid = mention.replace('@', '') + '@s.whatsapp.net';
        await warn_manager_1.warnManager.warnUser(userJid, context.jid, reason);
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
    execute: async (args, context) => {
        const mention = args[0];
        const userJid = mention.replace('@', '') + '@s.whatsapp.net';
        const warnings = await warn_manager_1.warnManager.getWarnings(userJid);
        const user = db_1.userOps.get(userJid);
        const userName = user?.name || (0, helpers_2.formatJid)(userJid);
        await client_1.waClient.sendMessage(context.jid, `📊 *${userName}* has ${warnings}/${config_1.default.warnThreshold} warnings`);
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
    execute: async (args, context) => {
        let userJid = null;
        // First check if args contain @mention (e.g., @254103608133 or @Mido)
        const extractedJid = (0, helpers_1.extractUserJidFromMention)(args, context.mentionedJids || []);
        if (extractedJid) {
            userJid = extractedJid;
        }
        // Then check if user replied to a message
        else if (context.quotedSenderJid) {
            userJid = context.quotedSenderJid;
        }
        if (!userJid) {
            await client_1.waClient.sendMessage(context.jid, `❌ Please mention a user to mute or reply to their message!\nUsage: .mute @user [duration] [reason]`);
            return;
        }
        const durationStr = args[1] || '60m';
        const durationMinutes = (0, helpers_1.parseDuration)(durationStr);
        const reason = args.slice(2).join(' ') || 'Violation';
        await mute_manager_1.muteManager.muteUser(userJid, context.jid, durationMinutes, reason);
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
    execute: async (args, context) => {
        let userJid = null;
        // First check if args contain @mention
        const extractedJid = (0, helpers_1.extractUserJidFromMention)(args, context.mentionedJids || []);
        if (extractedJid) {
            userJid = extractedJid;
        }
        // Then check if user replied to a message
        else if (context.quotedSenderJid) {
            userJid = context.quotedSenderJid;
        }
        if (!userJid) {
            await client_1.waClient.sendMessage(context.jid, `❌ Please mention a user to unmute or reply to their message!\nUsage: .unmute @user`);
            return;
        }
        await mute_manager_1.muteManager.unmuteUser(userJid, context.jid);
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
    execute: async (args, context) => {
        const mention = args[0];
        const userJid = mention.replace('@', '') + '@s.whatsapp.net';
        await client_1.waClient.removeParticipant(context.jid, userJid);
        db_1.logOps.add('kick', context.jid, userJid);
        await client_1.waClient.sendMessage(context.jid, `👋 User removed`);
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
    execute: async (args, context) => {
        const mention = args[0];
        const userJid = mention.replace('@', '') + '@s.whatsapp.net';
        await role_manager_1.roleManager.setUserRole(userJid, 'moderator');
        await client_1.waClient.promoteParticipant(context.jid, userJid);
        await client_1.waClient.sendMention(context.jid, `⬆️ @${(0, helpers_2.formatJid)(userJid)} is now a Moderator!`, [userJid]);
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
    execute: async (args, context) => {
        const mention = args[0];
        const userJid = mention.replace('@', '') + '@s.whatsapp.net';
        await role_manager_1.roleManager.setUserRole(userJid, 'member');
        await client_1.waClient.demoteParticipant(context.jid, userJid);
        await client_1.waClient.sendMention(context.jid, `⬇️ @${(0, helpers_2.formatJid)(userJid)} is now a Member`, [userJid]);
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
    execute: async (args, context) => {
        const mention = args[0];
        const userJid = mention.replace('@', '') + '@s.whatsapp.net';
        await role_manager_1.roleManager.setUserRole(userJid, 'admin');
        await client_1.waClient.promoteParticipant(context.jid, userJid);
        await client_1.waClient.sendMention(context.jid, `⬆️ @${(0, helpers_2.formatJid)(userJid)} is now an Admin!`, [userJid]);
    },
});
// Tagall
registerCommand({
    name: 'tagall',
    aliases: ['ta', 'all'],
    description: 'Mention all group members',
    usage: '.tagall [message]',
    requiredRole: ['moderator'],
    execute: async (args, context) => {
        const message = args.join(' ') || '📢 Attention everyone!';
        const metadata = await client_1.waClient.getGroupMetadata(context.jid);
        if (!metadata?.participants) {
            await client_1.waClient.sendMessage(context.jid, '❌ Could not get group members');
            return;
        }
        const mentions = metadata.participants.map((p) => p.id);
        const memberNames = metadata.participants.map((p) => p.name || p.id.replace('@s.whatsapp.net', ''));
        let tagMessage = `${message}\n\n`;
        for (const name of memberNames.slice(0, 30)) {
            tagMessage += `@${name}\n`;
        }
        if (memberNames.length > 30) {
            tagMessage += `_...and ${memberNames.length - 30} more_`;
        }
        await client_1.waClient.sendMention(context.jid, tagMessage, mentions);
    },
});
// Tagadmin
registerCommand({
    name: 'tagadmin',
    aliases: ['tagad'],
    description: 'Mention group admins',
    usage: '.tagadmin [message]',
    requiredRole: ['moderator'],
    execute: async (args, context) => {
        const message = args.join(' ') || '📢 Admins needed!';
        const admins = await client_1.waClient.getGroupAdmins(context.jid);
        if (admins.length === 0) {
            await client_1.waClient.sendMessage(context.jid, '❌ No admins found');
            return;
        }
        await client_1.waClient.sendMention(context.jid, message, admins);
    },
});
// Settings
registerCommand({
    name: 'settings',
    aliases: ['set'],
    description: 'View bot settings',
    usage: '.settings',
    requiredRole: ['admin'],
    execute: async (args, context) => {
        let message = `⚙️ *Bot Settings*\n\n`;
        message += `📝 Prefix: ${config_1.default.commandPrefix}\n`;
        message += `⚠️ Warn Limit: ${config_1.default.warnThreshold}\n`;
        message += `🔇 Mute Duration: ${config_1.default.muteDurationHours}h`;
        await client_1.waClient.sendMessage(context.jid, message);
    },
});
// Group info
registerCommand({
    name: 'groupinfo',
    aliases: ['gi', 'ginfo'],
    description: 'View group info',
    usage: '.groupinfo',
    execute: async (args, context) => {
        const metadata = await client_1.waClient.getGroupMetadata(context.jid);
        if (!metadata) {
            await client_1.waClient.sendMessage(context.jid, '❌ Could not get group info');
            return;
        }
        let message = `📋 *Group Info*\n\n`;
        message += `📛 Name: ${metadata.subject}\n`;
        message += `👥 Members: ${metadata.participants?.length || 0}\n`;
        message += `📅 Created: ${new Date(metadata.creation * 1000).toLocaleDateString()}`;
        await client_1.waClient.sendMessage(context.jid, message);
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
    execute: async (args, context) => {
        const name = args[0];
        const type = args[1];
        const maxPlayers = args[2] ? parseInt(args[2], 10) : null;
        if (!['se', 'de', 'rr', 'single_elimination', 'double_elimination', 'round_robin'].includes(type)) {
            await client_1.waClient.sendMessage(context.jid, `❌ Type: se (single), de (double), rr (round robin)`);
            return;
        }
        const typeMap = {
            'se': 'single_elimination', 'single_elimination': 'single_elimination',
            'de': 'double_elimination', 'double_elimination': 'double_elimination',
            'rr': 'round_robin', 'round_robin': 'round_robin'
        };
        const tournamentType = typeMap[type] || 'single_elimination';
        const tournament = tournament_manager_1.default.create(name, tournamentType, maxPlayers, context.senderJid);
        let msg = `🏆 *Tournament Created!*\n\n`;
        msg += `📛 Name: ${name}\n`;
        msg += `📋 Type: ${tournamentType.replace('_', ' ')}\n`;
        if (maxPlayers)
            msg += `👥 Max: ${maxPlayers}\n`;
        msg += `\nUse .tj to join!`;
        await client_1.waClient.sendMessage(context.jid, msg);
    },
});
// Tournament join
registerCommand({
    name: 'tj',
    aliases: ['tourneyjoin', 'tj'],
    description: 'Join tournament',
    usage: '.tj',
    execute: async (args, context) => {
        const active = tournament_manager_1.default.getActive();
        if (active.length === 0) {
            await client_1.waClient.sendMessage(context.jid, `❌ No active tournaments. Use .tcr to create!`);
            return;
        }
        const t = active[0];
        if (t.status !== 'registration') {
            await client_1.waClient.sendMessage(context.jid, `❌ Registration closed`);
            return;
        }
        const participants = tournament_manager_1.default.getParticipants(t.id);
        if (t.max_players && participants.length >= t.max_players) {
            await client_1.waClient.sendMessage(context.jid, `❌ Tournament full!`);
            return;
        }
        tournament_manager_1.default.addParticipant(t.id, context.senderJid);
        await client_1.waClient.sendMessage(context.jid, `✅ Joined *${t.name}!* (${participants.length + 1} players)`);
    },
});
// Tournament leave
registerCommand({
    name: 'tl',
    aliases: ['tourneyleave'],
    description: 'Leave tournament',
    usage: '.tl',
    execute: async (args, context) => {
        const active = tournament_manager_1.default.getActive();
        if (active.length === 0) {
            await client_1.waClient.sendMessage(context.jid, `❌ No active tournaments`);
            return;
        }
        const t = active[0];
        if (t.status !== 'registration') {
            await client_1.waClient.sendMessage(context.jid, `❌ Cannot leave - in progress`);
            return;
        }
        tournament_manager_1.default.removeParticipant(t.id, context.senderJid);
        await client_1.waClient.sendMessage(context.jid, `✅ Left *${t.name}*`);
    },
});
// Tournament status
registerCommand({
    name: 'ts',
    aliases: ['tourneystatus'],
    description: 'Tournament status',
    usage: '.ts',
    execute: async (args, context) => {
        const active = tournament_manager_1.default.getActive();
        if (active.length === 0) {
            await client_1.waClient.sendMessage(context.jid, `❌ No active tournaments`);
            return;
        }
        const t = active[0];
        const participants = tournament_manager_1.default.getParticipants(t.id);
        let msg = `🏆 *${t.name}*\n\n`;
        msg += `📋 Status: ${t.status}\n`;
        msg += `👥 Players: ${participants.length}`;
        await client_1.waClient.sendMessage(context.jid, msg);
    },
});
// Tournament bracket
registerCommand({
    name: 'tb',
    aliases: ['tourneybracket'],
    description: 'View bracket',
    usage: '.tb',
    execute: async (args, context) => {
        const active = tournament_manager_1.default.getActive();
        if (active.length === 0) {
            await client_1.waClient.sendMessage(context.jid, `❌ No active tournaments`);
            return;
        }
        const t = active[0];
        const matches = tournament_manager_1.default.getMatches(t.id);
        if (matches.length === 0) {
            await client_1.waClient.sendMessage(context.jid, `📊 No matches yet`);
            return;
        }
        let msg = `📊 *Bracket - ${t.name}*\n\n`;
        const rounds = {};
        for (const m of matches) {
            if (!rounds[m.round_number])
                rounds[m.round_number] = [];
            rounds[m.round_number].push(m);
        }
        for (const roundNum in rounds) {
            msg += `*Round ${roundNum}*\n`;
            for (const m of rounds[roundNum]) {
                const p1 = m.player1_name || (0, helpers_2.formatJid)(m.player1_jid);
                const p2 = m.player2_name || (0, helpers_2.formatJid)(m.player2_jid);
                msg += m.status === 'completed'
                    ? `${p1} ${m.player1_score}-${m.player2_score} ${p2}\n`
                    : `${p1} vs ${p2}\n`;
            }
        }
        await client_1.waClient.sendMessage(context.jid, msg);
    },
});
// Tournament result
registerCommand({
    name: 'tres',
    aliases: ['tourneyresult'],
    description: 'Report result',
    usage: '.tres 3-1',
    minArgs: 1,
    execute: async (args, context) => {
        const score = args[0];
        const match = score.match(/(\d+)-(\d+)/);
        if (!match) {
            await client_1.waClient.sendMessage(context.jid, `❌ Use: .tres 3-1`);
            return;
        }
        const myScore = parseInt(match[1], 10);
        const oppScore = parseInt(match[2], 10);
        await client_1.waClient.sendMessage(context.jid, `✅ Result: ${myScore}-${oppScore}\nWinner: ${myScore > oppScore ? context.name : 'Opponent'}`);
    },
});
// ==================== STATS COMMANDS ====================
// Leaderboard
registerCommand({
    name: 'lb',
    aliases: ['leaderboard', 'rank', 'ranking'],
    description: 'View leaderboard',
    usage: '.lb [count]',
    execute: async (args, context) => {
        const limit = parseInt(args[0], 10) || 10;
        await stats_manager_1.statsManager.sendLeaderboard(context.jid, limit);
    },
});
// Profile
registerCommand({
    name: 'profile',
    aliases: ['p', 'stats'],
    description: 'View player profile',
    usage: '.profile [@user]',
    execute: async (args, context) => {
        let targetJid = context.senderJid;
        if (args[0]) {
            targetJid = args[0].replace('@', '') + '@s.whatsapp.net';
        }
        await stats_manager_1.statsManager.sendProfile(context.jid, targetJid);
    },
});
// ==================== GENERAL COMMANDS ====================
// Help
registerCommand({
    name: 'help',
    aliases: ['h', 'cmd', 'commands'],
    description: 'Show help',
    usage: '.help [command]',
    execute: async (args, context) => {
        if (args[0]) {
            const cmd = getCommand(args[0]);
            if (cmd) {
                let msg = `📖 *${cmd.name}*\n\n📝 ${cmd.description}\n📋 ${cmd.usage}`;
                await client_1.waClient.sendMessage(context.jid, msg);
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
        await client_1.waClient.sendMessage(context.jid, msg);
    },
});
exports.default = {
    registerCommand,
    getCommand,
    getAllCommands,
    parseCommand,
    checkPermission,
};
//# sourceMappingURL=commands.js.map