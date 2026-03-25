import { CommandContext, UserRole } from '../types';
import { waClient } from '../client';
import { statsManager } from '../services/stats-manager';
import tournamentOps from '../services/tournament-manager';
import { userOps } from '../database/db';
import { formatJid } from '../utils/helpers';
import config from '../utils/config';

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

            const tournament = tournamentOps.create(name, type, maxPlayers, context.senderJid);

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

export default {
    statsCommands,
    tournamentCommands,
};
