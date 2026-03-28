import { CommandContext, UserRole } from '../types';
import { waClient } from '../client';
import { statsManager } from '../services/stats-manager';
import { tournamentOps } from '../database/db';
import { userOps } from '../database/db';
import { formatJid } from '../utils/helpers';
import config from '../utils/config';
import { pvpManager } from '../services/pvp-manager';

// ==================== STATS COMMANDS ====================

export const statsCommands = {
    // Leaderboard command
    leaderboard: {
        name: 'leaderboard',
        aliases: ['rank', 'lb'],
        description: 'View the player leaderboard',
        usage: '!leaderboard [count]',
        execute: async (args: string[], context: CommandContext) => {
            const limit = parseInt(args[0], 10) || 10;
            await statsManager.sendLeaderboard(context.jid, limit);
        },
    },

    // Profile command
    profile: {
        name: 'profile',
        aliases: ['stats'],
        description: 'View player profile and stats',
        usage: '!profile [@user]',
        execute: async (args: string[], context: CommandContext) => {
            let targetJid = context.senderJid;

            if (args[0]) {
                targetJid = args[0].replace('@', '') + '@s.whatsapp.net';
            }

            await statsManager.sendProfile(context.jid, targetJid);
        },
    },

    // My stats command
    mystats: {
        name: 'mystats',
        description: 'View your own stats',
        usage: '!mystats',
        execute: async (args: string[], context: CommandContext) => {
            await statsManager.sendProfile(context.jid, context.senderJid);
        },
    },
};

// ==================== TOURNAMENT COMMANDS ====================

export const tournamentCommands = {
    // Create tournament
    tourneyCreate: {
        name: 'tourney',
        description: 'Create a new tournament',
        usage: '!tourney create [name] [type] [max_players]',
        minArgs: 2,
        requiredRole: ['admin'],
        execute: async (args: string[], context: CommandContext) => {
            const name = args[0];
            const type = args[1];
            const maxPlayers = args[2] ? parseInt(args[2], 10) : null;

            if (!['single_elimination', 'double_elimination', 'round_robin'].includes(type)) {
                await waClient.sendMessage(context.jid,
                    `❌ Invalid tournament type. Use: single_elimination, double_elimination, or round_robin`
                );
                return;
            }

            const tournament = tournamentOps.create(name, type, 1, maxPlayers, context.senderJid);

            let message = `🏆 *Tournament Created!* 🏆\n\n`;
            message += `📛 Name: ${name}\n`;
            message += `📋 Type: ${type.replace('_', ' ')}\n`;
            if (maxPlayers) {
                message += `👥 Max Players: ${maxPlayers}\n`;
            }
            message += `\nUse ${config.commandPrefix}tourney join to register!`;

            await waClient.sendMessage(context.jid, message);
        },
    },

    // Join tournament
    tourneyJoin: {
        name: 'tourney',
        description: 'Join a tournament',
        usage: '!tourney join',
        execute: async (args: string[], context: CommandContext) => {
            const activeTournaments = tournamentOps.getActive();

            if (activeTournaments.length === 0) {
                await waClient.sendMessage(context.jid, `❌ No active tournaments. Use ${config.commandPrefix}tourney create to start one!`);
                return;
            }

            const tournament = activeTournaments[0];

            if (tournament.status !== 'registration') {
                await waClient.sendMessage(context.jid, `❌ Tournament is not open for registration.`);
                return;
            }

            const participants = tournamentOps.getParticipants(tournament.id);
            if (tournament.max_players && participants.length >= tournament.max_players) {
                await waClient.sendMessage(context.jid, `❌ Tournament is full!`);
                return;
            }

            tournamentOps.addParticipant(tournament.id, context.senderJid);

            await waClient.sendMessage(context.jid,
                `✅ You've joined *${tournament.name}*!\n\n` +
                `Current participants: ${participants.length + 1}`
            );
        },
    },

    // Leave tournament
    tourneyLeave: {
        name: 'tourney',
        description: 'Leave a tournament',
        usage: '!tourney leave',
        execute: async (args: string[], context: CommandContext) => {
            const activeTournaments = tournamentOps.getActive();

            if (activeTournaments.length === 0) {
                await waClient.sendMessage(context.jid, `❌ No active tournaments.`);
                return;
            }

            const tournament = activeTournaments[0];

            if (tournament.status !== 'registration') {
                await waClient.sendMessage(context.jid, `❌ Cannot leave tournament - it's already in progress.`);
                return;
            }

            tournamentOps.removeParticipant(tournament.id, context.senderJid);

            await waClient.sendMessage(context.jid, `✅ You've left *${tournament.name}*.`);
        },
    },

    // Tournament status
    tourneyStatus: {
        name: 'tourney',
        description: 'View tournament status',
        usage: '!tourney status',
        execute: async (args: string[], context: CommandContext) => {
            const activeTournaments = tournamentOps.getActive();

            if (activeTournaments.length === 0) {
                await waClient.sendMessage(context.jid, `❌ No active tournaments.`);
                return;
            }

            const tournament = activeTournaments[0];
            const participants = tournamentOps.getParticipants(tournament.id);

            let message = `🏆 *${tournament.name}*\n\n`;
            message += `📋 Status: ${tournament.status}\n`;
            message += `📋 Type: ${tournament.type.replace('_', ' ')}\n`;
            message += `👥 Participants: ${participants.length}`;

            if (tournament.max_players) {
                message += ` / ${tournament.max_players}`;
            }

            await waClient.sendMessage(context.jid, message);
        },
    },

    // Tournament bracket
    tourneyBracket: {
        name: 'tourney',
        description: 'View tournament bracket',
        usage: '!tourney bracket',
        execute: async (args: string[], context: CommandContext) => {
            const activeTournaments = tournamentOps.getActive();

            if (activeTournaments.length === 0) {
                await waClient.sendMessage(context.jid, `❌ No active tournaments.`);
                return;
            }

            const tournament = activeTournaments[0];
            const matches = tournamentOps.getMatches(tournament.id);

            if (matches.length === 0) {
                await waClient.sendMessage(context.jid, `📊 No matches yet. Tournament not started.`);
                return;
            }

            let message = `📊 *Tournament Bracket - ${tournament.name}*\n\n`;

            // Group by round
            const rounds: Record<number, any[]> = {};
            for (const match of matches) {
                if (!rounds[match.round_number]) {
                    rounds[match.round_number] = [];
                }
                rounds[match.round_number].push(match);
            }

            for (const roundNum in rounds) {
                message += `*Round ${roundNum}*\n`;
                for (const match of rounds[roundNum]) {
                    const p1 = match.player1_name || formatJid(match.player1_jid);
                    const p2 = match.player2_name || formatJid(match.player2_jid);

                    if (match.status === 'completed') {
                        message += `${p1} ${match.player1_score} - ${match.player2_score} ${p2}\n`;
                    } else {
                        message += `${p1} vs ${p2}\n`;
                    }
                }
                message += '\n';
            }

            await waClient.sendMessage(context.jid, message);
        },
    },

    // Report match result
    tourneyResult: {
        name: 'tourney',
        description: 'Report tournament match result',
        usage: '!tourney result [your_score]-[opponent_score]',
        minArgs: 1,
        execute: async (args: string[], context: CommandContext) => {
            const score = args[0];
            const scoreMatch = score.match(/(\d+)-(\d+)/);

            if (!scoreMatch) {
                await waClient.sendMessage(context.jid, `❌ Invalid format. Use: !tourney result 3-1`);
                return;
            }

            const myScore = parseInt(scoreMatch[1], 10);
            const opponentScore = parseInt(scoreMatch[2], 10);

            await waClient.sendMessage(context.jid,
                `✅ Match result recorded: ${myScore}-${opponentScore}\n\n` +
                `Winner: ${myScore > opponentScore ? context.name : 'Opponent'}`
            );
        },
    },
};

// ==================== PVP COMMANDS ====================

export const pvpCommands = {
    // Record match score
    pvpscores: {
        name: 'pvpscores',
        aliases: ['pvp'],
        description: 'Record PVP match score',
        usage: '.pvpscores @user1 vs @user2 3:1',
        minArgs: 3,
        execute: async (args: string[], context: CommandContext) => {
            // Parse format: @user1 vs @user2 3:1 or @user1 vs @user2 3-1
            // Or: @user2 vs @user1 1:3

            // Find the vs separator
            const vsIndex = args.findIndex(arg => arg.toLowerCase() === 'vs');

            if (vsIndex === -1 || vsIndex < 1 || vsIndex >= args.length - 1) {
                await waClient.sendMessage(context.jid,
                    `❌ Invalid format. Use: .pvpscores @user1 vs @user2 3:1\n` +
                    `Example: .pvpscores @player1 vs @player2 3-1`
                );
                return;
            }

            // Get player mentions from context
            const mentionedJids = context.mentionedJids || [];

            if (mentionedJids.length < 2) {
                await waClient.sendMessage(context.jid,
                    `❌ Please mention two players!\n` +
                    `Usage: .pvpscores @user1 vs @user2 3:1`
                );
                return;
            }

            const player1Jid = mentionedJids[0];
            const player2Jid = mentionedJids[1];

            // Get the score argument (last argument)
            const scoreArg = args[args.length - 1];

            // Parse score - support both : and -
            const scoreMatch = scoreArg.match(/(\d+)[:\-](\d+)/);

            if (!scoreMatch) {
                await waClient.sendMessage(context.jid,
                    `❌ Invalid score format. Use: 3:1 or 3-1`
                );
                return;
            }

            const player1Score = parseInt(scoreMatch[1], 10);
            const player2Score = parseInt(scoreMatch[2], 10);

            // Record the match
            const result = await pvpManager.recordMatch(
                player1Jid,
                player2Jid,
                player1Score,
                player2Score,
                context.jid
            );

            await waClient.sendMessage(context.jid, result);
        },
    },

    // Leaderboard
    pvplb: {
        name: 'pvplb',
        aliases: ['pvlb', 'pvpLB'],
        description: 'View PVP leaderboard',
        usage: '.pvplb [count]',
        execute: async (args: string[], context: CommandContext) => {
            const limit = parseInt(args[0], 10) || 10;
            await pvpManager.sendLeaderboard(context.jid, limit);
        },
    },

    // Player stats/profile
    pvpstats: {
        name: 'pvpstats',
        aliases: ['pvpp', 'pvprofile'],
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

            await pvpManager.sendProfile(context.jid, targetJid);
        },
    },
};

export default {
    statsCommands,
    tournamentCommands,
    pvpCommands,
};
