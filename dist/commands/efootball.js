"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.pvpCommands = exports.tournamentCommands = exports.statsCommands = void 0;
const client_1 = require("../client");
const stats_manager_1 = require("../services/stats-manager");
const tournament_manager_1 = __importDefault(require("../services/tournament-manager"));
const helpers_1 = require("../utils/helpers");
const config_1 = __importDefault(require("../utils/config"));
const pvp_manager_1 = require("../services/pvp-manager");
// ==================== STATS COMMANDS ====================
exports.statsCommands = {
    // Leaderboard command
    leaderboard: {
        name: 'leaderboard',
        aliases: ['rank', 'lb'],
        description: 'View the player leaderboard',
        usage: '!leaderboard [count]',
        execute: async (args, context) => {
            const limit = parseInt(args[0], 10) || 10;
            await stats_manager_1.statsManager.sendLeaderboard(context.jid, limit);
        },
    },
    // Profile command
    profile: {
        name: 'profile',
        aliases: ['stats'],
        description: 'View player profile and stats',
        usage: '!profile [@user]',
        execute: async (args, context) => {
            let targetJid = context.senderJid;
            if (args[0]) {
                targetJid = args[0].replace('@', '') + '@s.whatsapp.net';
            }
            await stats_manager_1.statsManager.sendProfile(context.jid, targetJid);
        },
    },
    // My stats command
    mystats: {
        name: 'mystats',
        description: 'View your own stats',
        usage: '!mystats',
        execute: async (args, context) => {
            await stats_manager_1.statsManager.sendProfile(context.jid, context.senderJid);
        },
    },
};
// ==================== TOURNAMENT COMMANDS ====================
exports.tournamentCommands = {
    // Create tournament
    tourneyCreate: {
        name: 'tourney',
        description: 'Create a new tournament',
        usage: '!tourney create [name] [type] [max_players]',
        minArgs: 2,
        requiredRole: ['admin'],
        execute: async (args, context) => {
            const name = args[0];
            const type = args[1];
            const maxPlayers = args[2] ? parseInt(args[2], 10) : null;
            if (!['single_elimination', 'double_elimination', 'round_robin'].includes(type)) {
                await client_1.waClient.sendMessage(context.jid, `❌ Invalid tournament type. Use: single_elimination, double_elimination, or round_robin`);
                return;
            }
            const tournament = tournament_manager_1.default.create(name, type, maxPlayers, context.senderJid);
            let message = `🏆 *Tournament Created!* 🏆\n\n`;
            message += `📛 Name: ${name}\n`;
            message += `📋 Type: ${type.replace('_', ' ')}\n`;
            if (maxPlayers) {
                message += `👥 Max Players: ${maxPlayers}\n`;
            }
            message += `\nUse ${config_1.default.commandPrefix}tourney join to register!`;
            await client_1.waClient.sendMessage(context.jid, message);
        },
    },
    // Join tournament
    tourneyJoin: {
        name: 'tourney',
        description: 'Join a tournament',
        usage: '!tourney join',
        execute: async (args, context) => {
            const activeTournaments = tournament_manager_1.default.getActive();
            if (activeTournaments.length === 0) {
                await client_1.waClient.sendMessage(context.jid, `❌ No active tournaments. Use ${config_1.default.commandPrefix}tourney create to start one!`);
                return;
            }
            const tournament = activeTournaments[0];
            if (tournament.status !== 'registration') {
                await client_1.waClient.sendMessage(context.jid, `❌ Tournament is not open for registration.`);
                return;
            }
            const participants = tournament_manager_1.default.getParticipants(tournament.id);
            if (tournament.max_players && participants.length >= tournament.max_players) {
                await client_1.waClient.sendMessage(context.jid, `❌ Tournament is full!`);
                return;
            }
            tournament_manager_1.default.addParticipant(tournament.id, context.senderJid);
            await client_1.waClient.sendMessage(context.jid, `✅ You've joined *${tournament.name}*!\n\n` +
                `Current participants: ${participants.length + 1}`);
        },
    },
    // Leave tournament
    tourneyLeave: {
        name: 'tourney',
        description: 'Leave a tournament',
        usage: '!tourney leave',
        execute: async (args, context) => {
            const activeTournaments = tournament_manager_1.default.getActive();
            if (activeTournaments.length === 0) {
                await client_1.waClient.sendMessage(context.jid, `❌ No active tournaments.`);
                return;
            }
            const tournament = activeTournaments[0];
            if (tournament.status !== 'registration') {
                await client_1.waClient.sendMessage(context.jid, `❌ Cannot leave tournament - it's already in progress.`);
                return;
            }
            tournament_manager_1.default.removeParticipant(tournament.id, context.senderJid);
            await client_1.waClient.sendMessage(context.jid, `✅ You've left *${tournament.name}*.`);
        },
    },
    // Tournament status
    tourneyStatus: {
        name: 'tourney',
        description: 'View tournament status',
        usage: '!tourney status',
        execute: async (args, context) => {
            const activeTournaments = tournament_manager_1.default.getActive();
            if (activeTournaments.length === 0) {
                await client_1.waClient.sendMessage(context.jid, `❌ No active tournaments.`);
                return;
            }
            const tournament = activeTournaments[0];
            const participants = tournament_manager_1.default.getParticipants(tournament.id);
            let message = `🏆 *${tournament.name}*\n\n`;
            message += `📋 Status: ${tournament.status}\n`;
            message += `📋 Type: ${tournament.type.replace('_', ' ')}\n`;
            message += `👥 Participants: ${participants.length}`;
            if (tournament.max_players) {
                message += ` / ${tournament.max_players}`;
            }
            await client_1.waClient.sendMessage(context.jid, message);
        },
    },
    // Tournament bracket
    tourneyBracket: {
        name: 'tourney',
        description: 'View tournament bracket',
        usage: '!tourney bracket',
        execute: async (args, context) => {
            const activeTournaments = tournament_manager_1.default.getActive();
            if (activeTournaments.length === 0) {
                await client_1.waClient.sendMessage(context.jid, `❌ No active tournaments.`);
                return;
            }
            const tournament = activeTournaments[0];
            const matches = tournament_manager_1.default.getMatches(tournament.id);
            if (matches.length === 0) {
                await client_1.waClient.sendMessage(context.jid, `📊 No matches yet. Tournament not started.`);
                return;
            }
            let message = `📊 *Tournament Bracket - ${tournament.name}*\n\n`;
            // Group by round
            const rounds = {};
            for (const match of matches) {
                if (!rounds[match.round_number]) {
                    rounds[match.round_number] = [];
                }
                rounds[match.round_number].push(match);
            }
            for (const roundNum in rounds) {
                message += `*Round ${roundNum}*\n`;
                for (const match of rounds[roundNum]) {
                    const p1 = match.player1_name || (0, helpers_1.formatJid)(match.player1_jid);
                    const p2 = match.player2_name || (0, helpers_1.formatJid)(match.player2_jid);
                    if (match.status === 'completed') {
                        message += `${p1} ${match.player1_score} - ${match.player2_score} ${p2}\n`;
                    }
                    else {
                        message += `${p1} vs ${p2}\n`;
                    }
                }
                message += '\n';
            }
            await client_1.waClient.sendMessage(context.jid, message);
        },
    },
    // Report match result
    tourneyResult: {
        name: 'tourney',
        description: 'Report tournament match result',
        usage: '!tourney result [your_score]-[opponent_score]',
        minArgs: 1,
        execute: async (args, context) => {
            const score = args[0];
            const scoreMatch = score.match(/(\d+)-(\d+)/);
            if (!scoreMatch) {
                await client_1.waClient.sendMessage(context.jid, `❌ Invalid format. Use: !tourney result 3-1`);
                return;
            }
            const myScore = parseInt(scoreMatch[1], 10);
            const opponentScore = parseInt(scoreMatch[2], 10);
            await client_1.waClient.sendMessage(context.jid, `✅ Match result recorded: ${myScore}-${opponentScore}\n\n` +
                `Winner: ${myScore > opponentScore ? context.name : 'Opponent'}`);
        },
    },
};
// ==================== PVP COMMANDS ====================
exports.pvpCommands = {
    // Record match score
    pvpscores: {
        name: 'pvpscores',
        aliases: ['pvp'],
        description: 'Record PVP match score',
        usage: '.pvpscores @user1 vs @user2 3:1',
        minArgs: 3,
        execute: async (args, context) => {
            // Parse format: @user1 vs @user2 3:1 or @user1 vs @user2 3-1
            // Or: @user2 vs @user1 1:3
            // Find the vs separator
            const vsIndex = args.findIndex(arg => arg.toLowerCase() === 'vs');
            if (vsIndex === -1 || vsIndex < 1 || vsIndex >= args.length - 1) {
                await client_1.waClient.sendMessage(context.jid, `❌ Invalid format. Use: .pvpscores @user1 vs @user2 3:1\n` +
                    `Example: .pvpscores @player1 vs @player2 3-1`);
                return;
            }
            // Get player mentions from context
            const mentionedJids = context.mentionedJids || [];
            if (mentionedJids.length < 2) {
                await client_1.waClient.sendMessage(context.jid, `❌ Please mention two players!\n` +
                    `Usage: .pvpscores @user1 vs @user2 3:1`);
                return;
            }
            const player1Jid = mentionedJids[0];
            const player2Jid = mentionedJids[1];
            // Get the score argument (last argument)
            const scoreArg = args[args.length - 1];
            // Parse score - support both : and -
            const scoreMatch = scoreArg.match(/(\d+)[:\-](\d+)/);
            if (!scoreMatch) {
                await client_1.waClient.sendMessage(context.jid, `❌ Invalid score format. Use: 3:1 or 3-1`);
                return;
            }
            const player1Score = parseInt(scoreMatch[1], 10);
            const player2Score = parseInt(scoreMatch[2], 10);
            // Record the match
            const result = await pvp_manager_1.pvpManager.recordMatch(player1Jid, player2Jid, player1Score, player2Score, context.jid);
            await client_1.waClient.sendMessage(context.jid, result);
        },
    },
    // Leaderboard
    pvplb: {
        name: 'pvplb',
        aliases: ['pvlb', 'pvpLB'],
        description: 'View PVP leaderboard',
        usage: '.pvplb [count]',
        execute: async (args, context) => {
            const limit = parseInt(args[0], 10) || 10;
            await pvp_manager_1.pvpManager.sendLeaderboard(context.jid, limit);
        },
    },
    // Player stats/profile
    pvpstats: {
        name: 'pvpstats',
        aliases: ['pvpp', 'pvprofile'],
        description: 'View player PVP stats',
        usage: '.pvpstats [@user]',
        execute: async (args, context) => {
            let targetJid = context.senderJid;
            if (args[0]) {
                // Check if it's a mention
                if (args[0].startsWith('@')) {
                    targetJid = args[0].replace('@', '') + '@s.whatsapp.net';
                }
            }
            await pvp_manager_1.pvpManager.sendProfile(context.jid, targetJid);
        },
    },
};
exports.default = {
    statsCommands: exports.statsCommands,
    tournamentCommands: exports.tournamentCommands,
    pvpCommands: exports.pvpCommands,
};
//# sourceMappingURL=efootball.js.map