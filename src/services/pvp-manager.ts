import { waClient } from '../client';
import { pvpOps, pvpStatsOps, userOps } from '../database/db';
import { formatJid, formatDate } from '../utils/helpers';
import { msg } from '../utils/messages';

// ==================== PVP MANAGER ====================

class PvpManager {
    // Record a match result (as pending for admin approval)
    async recordMatch(
        player1Jid: string,
        player2Jid: string,
        player1Score: number,
        player2Score: number,
        groupJid: string,
        hasProof: boolean = false
    ): Promise<string> {
        // Record the match as pending
        const match = pvpOps.recordMatch(player1Jid, player2Jid, player1Score, player2Score);

        // Get player names
        const p1User = userOps.get(player1Jid);
        const p2User = userOps.get(player2Jid);
        const p1Name = p1User?.name || formatJid(player1Jid);
        const p2Name = p2User?.name || formatJid(player2Jid);

        return msg.matchSubmitted(match.id, p1Name, player1Score, player2Score, p2Name, hasProof);
    }

    // Approve a pending match (admin only)
    async approveMatch(matchId: number, adminJid: string): Promise<string> {
        const match = pvpOps.getById(matchId);
        if (!match) {
            return `❌ Match #${matchId} not found.`;
        }
        if (match.status !== 'pending') {
            return `❌ Match #${matchId} is already ${match.status}.`;
        }

        // Apply stats
        pvpStatsOps.applyMatchStats(match.player1_jid, match.player2_jid, match.player1_score, match.player2_score);

        // Mark as approved
        pvpOps.approve(matchId, adminJid);

        // Get names
        const p1User = userOps.get(match.player1_jid);
        const p2User = userOps.get(match.player2_jid);
        const p1Name = p1User?.name || formatJid(match.player1_jid);
        const p2Name = p2User?.name || formatJid(match.player2_jid);

        // Determine result
        let resultText: string;
        if (match.player1_score > match.player2_score) {
            resultText = `🏆 ${p1Name} wins!`;
        } else if (match.player1_score < match.player2_score) {
            resultText = `🏆 ${p2Name} wins!`;
        } else {
            resultText = `🤝 It's a draw!`;
        }

        const adminUser = userOps.get(adminJid);
        const adminName = adminUser?.name || formatJid(adminJid);

        const p1Points = match.player1_score > match.player2_score ? '+3' : match.player1_score < match.player2_score ? '+0' : '+1';
        const p2Points = match.player2_score > match.player1_score ? '+3' : match.player2_score < match.player1_score ? '+0' : '+1';

        return msg.matchApproved(matchId, p1Name, match.player1_score, match.player2_score, p2Name, resultText, p1Points, p2Points, adminName);
    }

    // Reject a pending match (admin only)
    async rejectMatch(matchId: number, adminJid: string, reason: string): Promise<string> {
        const match = pvpOps.getById(matchId);
        if (!match) {
            return msg.matchNotFound(matchId);
        }
        if (match.status !== 'pending') {
            return msg.matchAlreadyProcessed(matchId, match.status);
        }

        pvpOps.reject(matchId, adminJid, reason);

        const p1User = userOps.get(match.player1_jid);
        const p2User = userOps.get(match.player2_jid);
        const p1Name = p1User?.name || formatJid(match.player1_jid);
        const p2Name = p2User?.name || formatJid(match.player2_jid);

        const adminUser = userOps.get(adminJid);
        const adminName = adminUser?.name || formatJid(adminJid);

        return msg.matchRejected(matchId, p1Name, match.player1_score, match.player2_score, p2Name, reason, adminName);
    }

    // List pending matches
    async sendPendingMatches(groupJid: string): Promise<void> {
        const pending = pvpOps.getPendingMatches();

        if (pending.length === 0) {
            await waClient.sendMessage(groupJid, msg.pendingMatchesEmpty());
            return;
        }

        let matchesText = '';
        for (const match of pending) {
            const p1User = userOps.get(match.player1_jid);
            const p2User = userOps.get(match.player2_jid);
            const p1Name = p1User?.name || formatJid(match.player1_jid);
            const p2Name = p2User?.name || formatJid(match.player2_jid);

            matchesText += `#${match.id} | ${p1Name} ${match.player1_score}-${match.player2_score} ${p2Name}\n`;
        }

        await waClient.sendMessage(groupJid, msg.pendingMatches(matchesText));
    }

    // Send the PVP leaderboard
    async sendLeaderboard(groupJid: string, limit: number = 10): Promise<void> {
        const leaderboard = pvpStatsOps.getLeaderboard(limit);

        if (leaderboard.length === 0) {
            await waClient.sendMessage(groupJid, msg.pvpLeaderboardEmpty());
            return;
        }

        let table = 'Pos | Player | Pts | W | D | L | GF:GA\n';
        table += '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n';

        for (let i = 0; i < leaderboard.length; i++) {
            const stats = leaderboard[i];
            const user = userOps.get(stats.user_jid);
            const name = user?.name || formatJid(stats.user_jid);

            const displayName = name.length > 12 ? name.substring(0, 10) + '..' : name;

            table += `${i + 1}. | ${displayName} | ${stats.points || 0} | ${stats.wins || 0} | ${stats.draws || 0} | ${stats.losses || 0} | ${stats.goals_for || 0}:${stats.goals_against || 0}\n`;
        }

        await waClient.sendMessage(groupJid, msg.pvpLeaderboard(table, leaderboard.length));
    }

    // Send player profile/stats
    async sendProfile(groupJid: string, targetJid: string): Promise<void> {
        pvpStatsOps.getOrCreate(targetJid);
        const stats = pvpStatsOps.get(targetJid);

        if (!stats) {
            await waClient.sendMessage(groupJid, `❌ Could not find stats for this player.`);
            return;
        }

        const user = userOps.get(targetJid);
        const name = user?.name || formatJid(targetJid);

        const recentMatches = pvpOps.getMatchHistory(targetJid, 5);

        const statsText = msg.pvpProfileStats(
            stats.points || 0,
            stats.wins || 0,
            stats.draws || 0,
            stats.losses || 0,
            stats.goals_for || 0,
            stats.goals_against || 0,
            stats.matches_played || 0
        );

        let recentText = '';
        if (recentMatches.length > 0) {
            for (const match of recentMatches) {
                const isPlayer1 = match.player1_jid === targetJid;
                const opponentJid = isPlayer1 ? match.player2_jid : match.player1_jid;
                const opponentUser = userOps.get(opponentJid);
                const opponentName = opponentUser?.name || formatJid(opponentJid);

                const myScore = isPlayer1 ? match.player1_score : match.player2_score;
                const oppScore = isPlayer1 ? match.player2_score : match.player1_score;

                let resultIcon: string;
                if (myScore > oppScore) {
                    resultIcon = '✅';
                } else if (myScore < oppScore) {
                    resultIcon = '❌';
                } else {
                    resultIcon = '🔄';
                }

                const matchDate = new Date(match.created_at);
                const dateStr = `${matchDate.getDate()}/${matchDate.getMonth() + 1}`;

                recentText += `${resultIcon} vs ${opponentName}: ${myScore}-${oppScore} (${dateStr})\n`;
            }
        } else {
            recentText = 'No matches played yet.';
        }

        await waClient.sendMessage(groupJid, msg.pvpProfile(name, statsText, recentText));
    }
}

export const pvpManager = new PvpManager();
export default pvpManager;
