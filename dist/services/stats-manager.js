"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.statsManager = exports.StatsManager = void 0;
const db_1 = require("../database/db");
const client_1 = require("../client");
const helpers_1 = require("../utils/helpers");
class StatsManager {
    async getPlayerStats(userJid) {
        const stats = db_1.statsOps.getOrCreate(userJid);
        const user = db_1.userOps.get(userJid);
        if (!user)
            return null;
        const totalMatches = stats.wins + stats.losses + stats.draws;
        const winRate = totalMatches > 0 ? Math.round((stats.wins / totalMatches) * 100) : 0;
        const avgGoals = totalMatches > 0 ? Math.round(stats.goals_scored / totalMatches * 10) / 10 : 0;
        return {
            wins: stats.wins,
            losses: stats.losses,
            draws: stats.draws,
            goalsScored: stats.goals_scored,
            goalsConceded: stats.goals_conceded,
            tournamentsWon: stats.tournaments_won,
            tournamentsPlayed: stats.tournaments_played,
            challengesCompleted: stats.challenge_completed,
            winRate,
            avgGoals,
        };
    }
    async recordMatchResult(winnerJid, loserJid, winnerGoals, loserGoals, isDraw = false) {
        if (isDraw) {
            db_1.statsOps.recordDraw(winnerJid, winnerGoals, loserGoals);
            db_1.statsOps.recordDraw(loserJid, loserGoals, winnerGoals);
        }
        else {
            db_1.statsOps.recordWin(winnerJid, winnerGoals, loserGoals);
            db_1.statsOps.recordLoss(loserJid, loserGoals, winnerGoals);
        }
    }
    async getLeaderboard(limit = 10) {
        return db_1.statsOps.getLeaderboard(limit);
    }
    async formatLeaderboard(limit = 10) {
        const leaderboard = await this.getLeaderboard(limit);
        if (leaderboard.length === 0) {
            return '📊 No players on the leaderboard yet!';
        }
        let message = '🏆 *Leaderboard* 🏆\n\n';
        leaderboard.forEach((player, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            const name = player.name || (0, helpers_1.formatJid)(player.user_jid);
            const points = player.points || 0;
            message += `${medal} *${name}*\n`;
            message += `   📊 ${player.wins}W/${player.losses}L (${player.points} pts)\n`;
            message += `   ⚽ ${player.goals_scored} goals\n`;
            message += `\n`;
        });
        return message;
    }
    async sendLeaderboard(jid, limit = 10) {
        const leaderboard = await this.formatLeaderboard(limit);
        await client_1.waClient.sendMessage(jid, leaderboard);
    }
    async sendProfile(jid, targetJid) {
        const user = db_1.userOps.get(targetJid);
        const name = user?.name || (0, helpers_1.formatJid)(targetJid);
        const stats = await this.getPlayerStats(targetJid);
        if (!stats) {
            await client_1.waClient.sendMessage(jid, `❌ No stats found for ${name}`);
            return;
        }
        let message = `👤 *Player Profile: ${name}*\n\n`;
        message += `📊 *Match Stats*\n`;
        message += `   Wins: ${stats.wins}\n`;
        message += `   Losses: ${stats.losses}\n`;
        message += `   Draws: ${stats.draws}\n`;
        message += `   Win Rate: ${stats.winRate}%\n\n`;
        message += `⚽ *Goals*\n`;
        message += `   Scored: ${stats.goalsScored}\n`;
        message += `   Conceded: ${stats.goalsConceded}\n`;
        message += `   Average: ${stats.avgGoals} per match\n\n`;
        message += `🏆 *Tournaments*\n`;
        message += `   Won: ${stats.tournamentsWon}\n`;
        message += `   Played: ${stats.tournamentsPlayed}\n\n`;
        message += `🎯 *Challenges*\n`;
        message += `   Completed: ${stats.challengesCompleted}`;
        await client_1.waClient.sendMessage(jid, message);
    }
}
exports.StatsManager = StatsManager;
exports.statsManager = new StatsManager();
exports.default = exports.statsManager;
//# sourceMappingURL=stats-manager.js.map