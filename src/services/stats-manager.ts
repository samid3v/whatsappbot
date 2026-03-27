import { statsOps, userOps } from '../database/db';
import { waClient } from '../client';
import { formatJid } from '../utils/helpers';
import { msg } from '../utils/messages';

export class StatsManager {
    async getPlayerStats(userJid: string): Promise<{
        wins: number;
        losses: number;
        draws: number;
        goalsScored: number;
        goalsConceded: number;
        tournamentsWon: number;
        tournamentsPlayed: number;
        challengesCompleted: number;
        winRate: number;
        avgGoals: number;
    } | null> {
        const stats = statsOps.getOrCreate(userJid);
        const user = userOps.get(userJid);

        if (!user) return null;

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

    async recordMatchResult(
        winnerJid: string,
        loserJid: string,
        winnerGoals: number,
        loserGoals: number,
        isDraw: boolean = false
    ): Promise<void> {
        if (isDraw) {
            statsOps.recordDraw(winnerJid, winnerGoals, loserGoals);
            statsOps.recordDraw(loserJid, loserGoals, winnerGoals);
        } else {
            statsOps.recordWin(winnerJid, winnerGoals, loserGoals);
            statsOps.recordLoss(loserJid, loserGoals, winnerGoals);
        }
    }

    async getLeaderboard(limit: number = 10): Promise<any[]> {
        return statsOps.getLeaderboard(limit);
    }

    async formatLeaderboard(limit: number = 10): Promise<string> {
        const leaderboard = await this.getLeaderboard(limit);

        if (leaderboard.length === 0) {
            return msg.leaderboardEmpty();
        }

        let entries = '';
        leaderboard.forEach((player, index) => {
            const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : `${index + 1}.`;
            const name = player.name || formatJid(player.user_jid);

            entries += `${medal} *${name}*\n`;
            entries += `   ${player.wins}W/${player.losses}L (${player.points} pts) | ⚽ ${player.goals_scored} goals\n`;
            entries += `\n`;
        });

        return msg.leaderboard(entries);
    }

    async sendLeaderboard(jid: string, limit: number = 10): Promise<void> {
        const leaderboard = await this.formatLeaderboard(limit);
        await waClient.sendMessage(jid, leaderboard);
    }

    async sendProfile(jid: string, targetJid: string): Promise<void> {
        const user = userOps.get(targetJid);
        const name = user?.name || formatJid(targetJid);
        const stats = await this.getPlayerStats(targetJid);

        if (!stats) {
            await waClient.sendMessage(jid, `❌ No stats found for ${name}`);
            return;
        }

        await waClient.sendMessage(jid, msg.statsProfile(
            name,
            stats.wins, stats.losses, stats.draws, stats.winRate,
            stats.goalsScored, stats.goalsConceded, stats.avgGoals,
            stats.tournamentsWon, stats.tournamentsPlayed, stats.challengesCompleted
        ));
    }
}

export const statsManager = new StatsManager();
export default statsManager;
