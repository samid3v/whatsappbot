"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.pvpManager = void 0;
const client_1 = require("../client");
const db_1 = require("../database/db");
const helpers_1 = require("../utils/helpers");
// ==================== PVP MANAGER ====================
class PvpManager {
    // Record a match result (as pending for admin approval)
    async recordMatch(player1Jid, player2Jid, player1Score, player2Score, groupJid) {
        // Record the match as pending
        const match = db_1.pvpOps.recordMatch(player1Jid, player2Jid, player1Score, player2Score);
        // Get player names
        const p1User = db_1.userOps.get(player1Jid);
        const p2User = db_1.userOps.get(player2Jid);
        const p1Name = p1User?.name || (0, helpers_1.formatJid)(player1Jid);
        const p2Name = p2User?.name || (0, helpers_1.formatJid)(player2Jid);
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
    async approveMatch(matchId, adminJid) {
        const match = db_1.pvpOps.getById(matchId);
        if (!match) {
            return `❌ Match #${matchId} not found.`;
        }
        if (match.status !== 'pending') {
            return `❌ Match #${matchId} is already ${match.status}.`;
        }
        // Apply stats
        db_1.pvpStatsOps.applyMatchStats(match.player1_jid, match.player2_jid, match.player1_score, match.player2_score);
        // Mark as approved
        db_1.pvpOps.approve(matchId, adminJid);
        // Get names
        const p1User = db_1.userOps.get(match.player1_jid);
        const p2User = db_1.userOps.get(match.player2_jid);
        const p1Name = p1User?.name || (0, helpers_1.formatJid)(match.player1_jid);
        const p2Name = p2User?.name || (0, helpers_1.formatJid)(match.player2_jid);
        // Determine result
        let resultText;
        if (match.player1_score > match.player2_score) {
            resultText = `🏆 ${p1Name} wins!`;
        }
        else if (match.player1_score < match.player2_score) {
            resultText = `🏆 ${p2Name} wins!`;
        }
        else {
            resultText = `🤝 It's a draw!`;
        }
        const adminUser = db_1.userOps.get(adminJid);
        const adminName = adminUser?.name || (0, helpers_1.formatJid)(adminJid);
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
    async rejectMatch(matchId, adminJid, reason) {
        const match = db_1.pvpOps.getById(matchId);
        if (!match) {
            return `❌ Match #${matchId} not found.`;
        }
        if (match.status !== 'pending') {
            return `❌ Match #${matchId} is already ${match.status}.`;
        }
        db_1.pvpOps.reject(matchId, adminJid, reason);
        const p1User = db_1.userOps.get(match.player1_jid);
        const p2User = db_1.userOps.get(match.player2_jid);
        const p1Name = p1User?.name || (0, helpers_1.formatJid)(match.player1_jid);
        const p2Name = p2User?.name || (0, helpers_1.formatJid)(match.player2_jid);
        const adminUser = db_1.userOps.get(adminJid);
        const adminName = adminUser?.name || (0, helpers_1.formatJid)(adminJid);
        const message = `❌ *Match Rejected*\n\n` +
            `🆔 Match #${matchId}\n` +
            `${p1Name} ${match.player1_score} - ${match.player2_score} ${p2Name}\n\n` +
            `📌 Reason: ${reason}\n\n` +
            `👑 Rejected by ${adminName}\n` +
            `No stats were updated.`;
        return message;
    }
    // List pending matches
    async sendPendingMatches(groupJid) {
        const pending = db_1.pvpOps.getPendingMatches();
        if (pending.length === 0) {
            await client_1.waClient.sendMessage(groupJid, `📋 *Pending Matches*\n\nNo matches waiting for approval.`);
            return;
        }
        let message = `📋 *Pending Matches (${pending.length})*\n\n`;
        for (const match of pending) {
            const p1User = db_1.userOps.get(match.player1_jid);
            const p2User = db_1.userOps.get(match.player2_jid);
            const p1Name = p1User?.name || (0, helpers_1.formatJid)(match.player1_jid);
            const p2Name = p2User?.name || (0, helpers_1.formatJid)(match.player2_jid);
            message += `🆔 #${match.id} | ${p1Name} ${match.player1_score}-${match.player2_score} ${p2Name}\n`;
        }
        message += `\n✅ .pvpapprove <id> — Approve match\n`;
        message += `❌ .pvpreject <id> <reason> — Reject match`;
        await client_1.waClient.sendMessage(groupJid, message);
    }
    // Send the PVP leaderboard
    async sendLeaderboard(groupJid, limit = 10) {
        const leaderboard = db_1.pvpStatsOps.getLeaderboard(limit);
        if (leaderboard.length === 0) {
            await client_1.waClient.sendMessage(groupJid, `📊 *PVP Leaderboard*\n\nNo matches recorded yet!\n` +
                `Use ${'.'}pvpscores @user1 vs @user2 3:1 to record a match.`);
            return;
        }
        let message = `🏆 *eFootball PVP Leaderboard* 🏆\n\n`;
        message += `📊 *Top ${leaderboard.length} Players*\n\n`;
        message += `Pos | Player | Pts | W | D | L | GF:GA\n`;
        message += `─────────────────────────────────────\n`;
        for (let i = 0; i < leaderboard.length; i++) {
            const stats = leaderboard[i];
            const user = db_1.userOps.get(stats.user_jid);
            const name = user?.name || (0, helpers_1.formatJid)(stats.user_jid);
            const displayName = name.length > 12 ? name.substring(0, 10) + '..' : name;
            message += `${i + 1}.  | ${displayName} | ${stats.points || 0} | ${stats.wins || 0} | ${stats.draws || 0} | ${stats.losses || 0} | ${stats.goals_for || 0}:${stats.goals_against || 0}\n`;
        }
        message += `\n📈 *Points:* Win=3 | Draw=1 | Loss=0`;
        await client_1.waClient.sendMessage(groupJid, message);
    }
    // Send player profile/stats
    async sendProfile(groupJid, targetJid) {
        db_1.pvpStatsOps.getOrCreate(targetJid);
        const stats = db_1.pvpStatsOps.get(targetJid);
        if (!stats) {
            await client_1.waClient.sendMessage(groupJid, `❌ Could not find stats for this player.`);
            return;
        }
        const user = db_1.userOps.get(targetJid);
        const name = user?.name || (0, helpers_1.formatJid)(targetJid);
        const recentMatches = db_1.pvpOps.getMatchHistory(targetJid, 5);
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
                const opponentUser = db_1.userOps.get(opponentJid);
                const opponentName = opponentUser?.name || (0, helpers_1.formatJid)(opponentJid);
                const myScore = isPlayer1 ? match.player1_score : match.player2_score;
                const oppScore = isPlayer1 ? match.player2_score : match.player1_score;
                let resultIcon;
                if (myScore > oppScore) {
                    resultIcon = '✅';
                }
                else if (myScore < oppScore) {
                    resultIcon = '❌';
                }
                else {
                    resultIcon = '🔄';
                }
                const matchDate = new Date(match.created_at);
                const dateStr = `${matchDate.getDate()}/${matchDate.getMonth() + 1}`;
                message += `${resultIcon} vs ${opponentName}: ${myScore}-${oppScore} (${dateStr})\n`;
            }
        }
        else {
            message += `📋 *Recent Matches*\n`;
            message += `━━━━━━━━━━━━━━━━━━━━━━\n`;
            message += `No matches played yet.\n`;
        }
        await client_1.waClient.sendMessage(groupJid, message);
    }
}
exports.pvpManager = new PvpManager();
exports.default = exports.pvpManager;
//# sourceMappingURL=pvp-manager.js.map