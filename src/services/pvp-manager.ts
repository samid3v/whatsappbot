import { waClient } from '../client';
import { pvpOps, pvpStatsOps, userOps } from '../database/db';
import { formatJid, formatDate } from '../utils/helpers';

// ==================== PVP MANAGER ====================

class PvpManager {
    // Record a match result (as pending for admin approval)
    async recordMatch(
        player1Jid: string,
        player2Jid: string,
        player1Score: number,
        player2Score: number,
        groupJid: string
    ): Promise<string> {
        // Record the match as pending
        const match = pvpOps.recordMatch(player1Jid, player2Jid, player1Score, player2Score);

        // Get player names
        const p1User = userOps.get(player1Jid);
        const p2User = userOps.get(player2Jid);
        const p1Name = p1User?.name || formatJid(player1Jid);
        const p2Name = p2User?.name || formatJid(player2Jid);

        const message = `⚽ *Match Submitted!* ⚽\n\n` +
            `🆔 Match #${match.id}\n` +
            `${p1Name} ${player1Score} - ${player2Score} ${p2Name}\n\n` +
            `⏳ *Status: Pending Admin Approval*\n\n` +
            `📸 Screenshot proof attached\n` +
            `An admin needs to verify and approve this match.\n\n` +
            `Admins: Use .pvpapprove ${match.id} or .pvpreject ${match.id}`;

        return message;
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

        const message = `✅ *Match Approved!* ⚽\n\n` +
            `🆔 Match #${matchId}\n` +
            `${p1Name} ${match.player1_score} - ${match.player2_score} ${p2Name}\n\n` +
            `${resultText}\n\n` +
            `📊 Points applied:\n` +
            `${p1Name}: ${match.player1_score > match.player2_score ? '+3' : match.player1_score < match.player2_score ? '+0' : '+1'}\n` +
            `${p2Name}: ${match.player2_score > match.player1_score ? '+3' : match.player2_score < match.player1_score ? '+0' : '+1'}\n\n` +
            `👑 Approved by ${adminName}`;

        return message;
    }

    // Reject a pending match (admin only)
    async rejectMatch(matchId: number, adminJid: string, reason: string): Promise<string> {
        const match = pvpOps.getById(matchId);
        if (!match) {
            return `❌ Match #${matchId} not found.`;
        }
        if (match.status !== 'pending') {
            return `❌ Match #${matchId} is already ${match.status}.`;
        }

        pvpOps.reject(matchId, adminJid, reason);

        const p1User = userOps.get(match.player1_jid);
        const p2User = userOps.get(match.player2_jid);
        const p1Name = p1User?.name || formatJid(match.player1_jid);
        const p2Name = p2User?.name || formatJid(match.player2_jid);

        const adminUser = userOps.get(adminJid);
        const adminName = adminUser?.name || formatJid(adminJid);

        const message = `❌ *Match Rejected*\n\n` +
            `🆔 Match #${matchId}\n` +
            `${p1Name} ${match.player1_score} - ${match.player2_score} ${p2Name}\n\n` +
            `📌 Reason: ${reason}\n\n` +
            `👑 Rejected by ${adminName}\n` +
            `No stats were updated.`;

        return message;
    }

    // List pending matches
    async sendPendingMatches(groupJid: string): Promise<void> {
        const pending = pvpOps.getPendingMatches();

        if (pending.length === 0) {
            await waClient.sendMessage(groupJid, `📋 *Pending Matches*\n\nNo matches waiting for approval.`);
            return;
        }

        let message = `📋 *Pending Matches (${pending.length})*\n\n`;

        for (const match of pending) {
            const p1User = userOps.get(match.player1_jid);
            const p2User = userOps.get(match.player2_jid);
            const p1Name = p1User?.name || formatJid(match.player1_jid);
            const p2Name = p2User?.name || formatJid(match.player2_jid);

            message += `🆔 #${match.id} | ${p1Name} ${match.player1_score}-${match.player2_score} ${p2Name}\n`;
        }

        message += `\n✅ .pvpapprove <id> — Approve match\n`;
        message += `❌ .pvpreject <id> <reason> — Reject match`;

        await waClient.sendMessage(groupJid, message);
    }

    // Send the PVP leaderboard
    async sendLeaderboard(groupJid: string, limit: number = 10): Promise<void> {
        const leaderboard = pvpStatsOps.getLeaderboard(limit);

        if (leaderboard.length === 0) {
            await waClient.sendMessage(groupJid,
                `📊 *PVP Leaderboard*\n\nNo matches recorded yet!\n` +
                `Use ${'.'}pvpscores @user1 vs @user2 3:1 to record a match.`
            );
            return;
        }

        let message = `🏆 *eFootball PVP Leaderboard* 🏆\n\n`;
        message += `📊 *Top ${leaderboard.length} Players*\n\n`;
        message += `Pos | Player | Pts | W | D | L | GF:GA\n`;
        message += `─────────────────────────────────────\n`;

        for (let i = 0; i < leaderboard.length; i++) {
            const stats = leaderboard[i];
            const user = userOps.get(stats.user_jid);
            const name = user?.name || formatJid(stats.user_jid);

            const displayName = name.length > 12 ? name.substring(0, 10) + '..' : name;

            message += `${i + 1}.  | ${displayName} | ${stats.points || 0} | ${stats.wins || 0} | ${stats.draws || 0} | ${stats.losses || 0} | ${stats.goals_for || 0}:${stats.goals_against || 0}\n`;
        }

        message += `\n📈 *Points:* Win=3 | Draw=1 | Loss=0`;

        await waClient.sendMessage(groupJid, message);
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

        let message = `👤 *${name}'s PVP Profile* 👤\n\n`;
        message += `📊 *Statistics*\n`;
        message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
        message += `🏆 Points: ${stats.points || 0}\n`;
        message += `✅ Wins: ${stats.wins || 0}\n`;
        message += `🔄 Draws: ${stats.draws || 0}\n`;
        message += `❌ Losses: ${stats.losses || 0}\n`;
        message += `⚽ Goals For: ${stats.goals_for || 0}\n`;
        message += `🥅 Goals Against: ${stats.goals_against || 0}\n`;
        message += `🎮 Matches Played: ${stats.matches_played || 0}\n\n`;

        if (recentMatches.length > 0) {
            message += `📋 *Recent Matches*\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━\n`;

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

                message += `${resultIcon} vs ${opponentName}: ${myScore}-${oppScore} (${dateStr})\n`;
            }
        } else {
            message += `📋 *Recent Matches*\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
            message += `No matches played yet.\n`;
        }

        await waClient.sendMessage(groupJid, message);
    }
}

export const pvpManager = new PvpManager();
export default pvpManager;
