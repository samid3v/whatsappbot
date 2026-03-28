import { tournamentOps, userOps } from '../database/db';
import { waClient } from '../client';
import { formatJid } from '../utils/helpers';
import { msg } from '../utils/messages';

// ==================== TOURNAMENT MANAGER ====================
// Completely separate from the PVP system.
// PVP = daily friendly games with global leaderboard (approved by admin)
// Tournament = isolated competition with per-tournament standings, knockout/round-robin brackets

const VALID_KNOCKOUT_SIZES = [4, 8, 16, 32, 64];

class TournamentManager {

    // ===== VALIDATION =====

    isKnockoutValid(count: number): boolean {
        return VALID_KNOCKOUT_SIZES.includes(count);
    }

    getKnockoutError(count: number): string {
        if (count < 4) return `❌ Knockout needs at least 4 players. You have ${count}.`;
        if (count > 64) return `❌ Maximum 64 players for knockout. You have ${count}.`;
        return `❌ Knockout requires a power-of-2 bracket: ${VALID_KNOCKOUT_SIZES.join(', ')}.\n` +
            `You have ${count} players. Either add or remove players to reach a valid size.`;
    }

    // ===== LIFECYCLE =====

    startTournament(tournamentId: number): string {
        const t = tournamentOps.get(tournamentId);
        if (!t) return '❌ Tournament not found.';
        if (t.status !== 'registration') return '❌ Tournament already started or completed.';

        const participants = tournamentOps.getParticipants(tournamentId);
        const count = participants.length;

        if (count < 2) return '❌ Need at least 2 participants to start.';

        // Validate knockout bracket size
        if (t.type === 'single_elimination' || t.type === 'double_elimination') {
            if (!this.isKnockoutValid(count)) {
                return this.getKnockoutError(count);
            }
        }

        // Generate bracket
        const matchesGenerated = this.generateBracket(tournamentId, t.type);

        tournamentOps.updateStatus(tournamentId, 'in_progress');
        tournamentOps.updateRound(tournamentId, 1);

        const typeName = t.type === 'single_elimination' ? 'Knockout' :
            t.type === 'double_elimination' ? 'Double Elimination' :
            t.legs === 2 ? 'League (1st & 2nd Leg)' : 'League (1st Leg)';

        return `🏆 *${t.name}* — ${typeName} STARTED!\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `👥 ${count} players\n` +
            `📋 ${matchesGenerated} matches in Round 1\n` +
            `📸 Screenshot proof required!\n` +
            `Use .tb to view the bracket!`;
    }

    completeTournament(tournamentId: number, winnerJid?: string): string {
        const t = tournamentOps.get(tournamentId);
        if (!t) return '❌ Tournament not found.';
        if (t.status === 'completed') return '❌ Tournament already completed.';

        tournamentOps.recalculatePositions(tournamentId);
        tournamentOps.updateStatus(tournamentId, 'completed', winnerJid);

        const standings = tournamentOps.getStandings(tournamentId);
        const winner = standings[0];
        const winnerName = winner ? (userOps.get(winner.user_jid)?.name || formatJid(winner.user_jid)) : 'Unknown';

        return `🏆 *${t.name}* — COMPLETED! 🏆\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🥇 Winner: ${winnerName}\n` +
            `${winner ? `📊 ${winner.wins}W ${winner.draws}D ${winner.losses}L | ${winner.points} pts` : ''}\n` +
            `Use .tlb to see full standings!`;
    }

    // ===== BRACKET GENERATION =====

    generateBracket(tournamentId: number, type: string): number {
        const t = tournamentOps.get(tournamentId);
        const legs = t?.legs || 1;
        const participants = tournamentOps.getParticipants(tournamentId);
        const jids = participants.map((p: any) => p.user_jid);

        // Shuffle for random seeding
        for (let i = jids.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [jids[i], jids[j]] = [jids[j], jids[i]];
        }

        // Initialize standings
        for (const jid of jids) {
            tournamentOps.getOrCreateStanding(tournamentId, jid);
        }

        if (type === 'round_robin') {
            return this.generateRoundRobin(tournamentId, jids, legs);
        }
        return this.generateKnockout(tournamentId, jids);
    }

    private generateKnockout(tournamentId: number, jids: string[]): number {
        let matchCount = 0;
        for (let i = 0; i < jids.length; i += 2) {
            tournamentOps.addMatch(tournamentId, jids[i], jids[i + 1], 1);
            matchCount++;
        }
        return matchCount;
    }

    private generateRoundRobin(tournamentId: number, jids: string[], legs: number = 1): number {
        let matchCount = 0;
        const n = jids.length;

        // Round robin: everyone plays everyone
        for (let i = 0; i < n; i++) {
            for (let j = i + 1; j < n; j++) {
                // 1st leg
                tournamentOps.addMatch(tournamentId, jids[i], jids[j], 1);
                matchCount++;

                // 2nd leg (reversed home/away)
                if (legs === 2) {
                    tournamentOps.addMatch(tournamentId, jids[j], jids[i], 2);
                    matchCount++;
                }
            }
        }

        return matchCount;
    }

    // ===== MATCH RESULT SUBMISSION (approval workflow) =====

    submitResult(
        matchId: number,
        player1Score: number,
        player2Score: number,
        hasProof: boolean = false
    ): string {
        const match = tournamentOps.getMatchById(matchId);
        if (!match) return `❌ Match #${matchId} not found.`;

        if (match.match_status === 'pending_approval') {
            return `❌ Match #${matchId} is already pending admin approval.`;
        }
        if (match.match_status === 'approved') {
            return `❌ Match #${matchId} is already approved.`;
        }

        const tournamentId = match.tournament_id;
        const t = tournamentOps.get(tournamentId);
        if (!t) return '❌ Tournament not found.';

        // Determine winner
        let winnerJid: string;
        if (player1Score > player2Score) {
            winnerJid = match.player1_jid;
        } else if (player2Score > player1Score) {
            winnerJid = match.player2_jid;
        } else {
            if (t.type !== 'round_robin') {
                return '❌ Draws are not allowed in knockout tournaments!';
            }
            winnerJid = match.player1_jid;
        }

        // Submit for approval
        tournamentOps.submitResult(matchId, player1Score, player2Score, winnerJid);

        // Get names
        const p1User = userOps.get(match.player1_jid);
        const p2User = userOps.get(match.player2_jid);
        const p1Name = p1User?.name || formatJid(match.player1_jid);
        const p2Name = p2User?.name || formatJid(match.player2_jid);

        return msg.tourneyMatchSubmitted(matchId, p1Name, player1Score, player2Score, p2Name, t.name, match.round_number, hasProof);
    }

    // ===== ADMIN APPROVAL WORKFLOW =====

    approveMatch(matchId: number, adminJid: string): string {
        const match = tournamentOps.getMatchById(matchId);
        if (!match) return `❌ Match #${matchId} not found.`;
        if (match.match_status !== 'pending_approval') {
            return `❌ Match #${matchId} is ${match.match_status}, not pending approval.`;
        }

        // Apply to standings
        tournamentOps.applyMatchToStandings(
            match.tournament_id,
            match.player1_jid,
            match.player2_jid,
            match.player1_score,
            match.player2_score
        );

        // Mark approved
        tournamentOps.approveMatch(matchId, adminJid);
        tournamentOps.recalculatePositions(match.tournament_id);

        // Get names
        const p1User = userOps.get(match.player1_jid);
        const p2User = userOps.get(match.player2_jid);
        const p1Name = p1User?.name || formatJid(match.player1_jid);
        const p2Name = p2User?.name || formatJid(match.player2_jid);
        const winnerUser = userOps.get(match.winner_jid);
        const winnerName = winnerUser?.name || formatJid(match.winner_jid);
        const adminUser = userOps.get(adminJid);
        const adminName = adminUser?.name || formatJid(adminJid);
        const t = tournamentOps.get(match.tournament_id);

        const isDraw = match.player1_score === match.player2_score;
        const resultText = isDraw ? '🤝 Draw' : `🏆 ${winnerName} wins!`;

        return msg.tourneyMatchApproved(
            matchId, p1Name, match.player1_score, match.player2_score, p2Name,
            resultText, t?.name || 'Tournament', adminName
        );
    }

    rejectMatch(matchId: number, adminJid: string, reason: string): string {
        const match = tournamentOps.getMatchById(matchId);
        if (!match) return `❌ Match #${matchId} not found.`;
        if (match.match_status !== 'pending_approval') {
            return `❌ Match #${matchId} is ${match.match_status}, not pending approval.`;
        }

        tournamentOps.rejectMatch(matchId, adminJid, reason);

        const p1User = userOps.get(match.player1_jid);
        const p2User = userOps.get(match.player2_jid);
        const p1Name = p1User?.name || formatJid(match.player1_jid);
        const p2Name = p2User?.name || formatJid(match.player2_jid);
        const adminUser = userOps.get(adminJid);
        const adminName = adminUser?.name || formatJid(adminJid);
        const t = tournamentOps.get(match.tournament_id);

        return msg.tourneyMatchRejected(
            matchId, p1Name, match.player1_score, match.player2_score, p2Name,
            reason, t?.name || 'Tournament', adminName
        );
    }

    // ===== ADVANCE ROUND (knockout) =====

    advanceRound(tournamentId: number): string {
        const t = tournamentOps.get(tournamentId);
        if (!t) return '❌ Tournament not found.';
        if (t.type === 'round_robin') {
            return t.legs === 2
                ? '❌ League (1st & 2nd Leg) — all matches play out in one go.'
                : '❌ League (1st Leg) — all matches play out in one go.';
        }

        // Check all current round matches are approved
        const allMatches = tournamentOps.getMatches(tournamentId);
        const currentRound = t.current_round;
        const roundMatches = allMatches.filter((m: any) => m.round_number === currentRound);

        const pending = roundMatches.filter((m: any) => m.match_status === 'pending_approval');
        if (pending.length > 0) {
            return `❌ ${pending.length} match(es) still pending approval in Round ${currentRound}.\n` +
                `Use .tapprove <id> to approve them first.`;
        }

        // Get winners from approved matches
        const approved = roundMatches.filter((m: any) => m.match_status === 'approved');
        const winners: string[] = [];
        for (const m of approved) {
            winners.push(m.winner_jid);
        }

        if (winners.length === 0) return '❌ No approved winners found.';

        if (winners.length === 1) {
            return this.completeTournament(tournamentId, winners[0]);
        }

        // Generate next round
        const nextRound = currentRound + 1;
        let matchCount = 0;
        for (let i = 0; i < winners.length; i += 2) {
            tournamentOps.addMatch(tournamentId, winners[i], winners[i + 1], nextRound);
            matchCount++;
        }

        tournamentOps.updateRound(tournamentId, nextRound);

        return `📋 *Round ${nextRound}*\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `${matchCount} matches generated\n` +
            `📸 Screenshot proof required\n` +
            `Use .tb to see the bracket!`;
    }

    // ===== DISPLAY =====

    sendStandings(groupJid: string, tournamentId: number): void {
        const t = tournamentOps.get(tournamentId);
        if (!t) return;

        const standings = tournamentOps.getStandings(tournamentId);
        if (standings.length === 0) {
            waClient.sendMessage(groupJid, '📊 No standings yet.');
            return;
        }

        let table = `Pos | Player | P | W | D | L | GF:GA | Pts\n`;
        table += `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        for (const s of standings) {
            const user = userOps.get(s.user_jid);
            const name = user?.name || formatJid(s.user_jid);
            const displayName = name.length > 12 ? name.substring(0, 10) + '..' : name;
            const gd = s.goals_for - s.goals_against;
            const gdStr = gd >= 0 ? `+${gd}` : `${gd}`;
            const pos = s.position || '-';

            table += `${pos}. | ${displayName} | ${s.played} | ${s.wins} | ${s.draws} | ${s.losses} | ${s.goals_for}:${s.goals_against} (${gdStr}) | ${s.points}\n`;
        }

        const typeName = t.type === 'single_elimination' ? 'Knockout' :
            t.type === 'double_elimination' ? 'Double Elim' :
            t.legs === 2 ? 'League (2 Legs)' : 'League';

        const fullMsg = `🏆 *${t.name} — STANDINGS* 🏆\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            `📊 ${typeName} | Round ${t.current_round}\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━\n` +
            table;

        waClient.sendMessage(groupJid, fullMsg);
    }

    sendBracket(groupJid: string, tournamentId: number): void {
        const t = tournamentOps.get(tournamentId);
        if (!t) return;

        const allMatches = tournamentOps.getMatches(tournamentId);
        if (allMatches.length === 0) {
            waClient.sendMessage(groupJid, '📊 No matches yet.');
            return;
        }

        let text = `📊 *BRACKET — ${t.name.toUpperCase()}* 📊\n`;
        text += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        if (t.type === 'round_robin') {
            // Group by leg (round_number)
            const legs = t.legs || 1;
            const legMatches: Record<number, any[]> = {};
            for (const m of allMatches) {
                const leg = m.round_number || 1;
                if (!legMatches[leg]) legMatches[leg] = [];
                legMatches[leg].push(m);
            }

            for (let leg = 1; leg <= legs; leg++) {
                const matches = legMatches[leg] || [];
                const legLabel = legs === 2 ? (leg === 1 ? '1st Leg' : '2nd Leg') : 'Matches';
                text += `*${legLabel}*\n`;

                for (const m of matches) {
                    const p1User = userOps.get(m.player1_jid);
                    const p2User = userOps.get(m.player2_jid);
                    const p1Name = p1User?.name || formatJid(m.player1_jid);
                    const p2Name = p2User?.name || formatJid(m.player2_jid);

                    if (m.match_status === 'approved') {
                        text += `  ✅ ${p1Name} ${m.player1_score}-${m.player2_score} ${p2Name}\n`;
                    } else if (m.match_status === 'pending_approval') {
                        text += `  ⏳ ${p1Name} ${m.player1_score}-${m.player2_score} ${p2Name} [#${m.id}]\n`;
                    } else if (m.match_status === 'rejected') {
                        text += `  ❌ ${p1Name} vs ${p2Name} — rejected [#${m.id}]\n`;
                    } else {
                        text += `  ⬜ ${p1Name} vs ${p2Name} [#${m.id}]\n`;
                    }
                }
                text += '\n';
            }
        } else {
            // Knockout — group by round
            const rounds: Record<number, any[]> = {};
            for (const m of allMatches) {
                if (!rounds[m.round_number]) rounds[m.round_number] = [];
                rounds[m.round_number].push(m);
            }

            for (const roundNum in rounds) {
                text += `*Round ${roundNum}*\n`;
                for (const m of rounds[roundNum]) {
                    const p1User = userOps.get(m.player1_jid);
                    const p2User = userOps.get(m.player2_jid);
                    const p1Name = p1User?.name || formatJid(m.player1_jid);
                    const p2Name = p2User?.name || formatJid(m.player2_jid);

                    if (m.match_status === 'approved') {
                        const wUser = userOps.get(m.winner_jid);
                        const wName = wUser?.name || formatJid(m.winner_jid);
                        text += `  ✅ ${p1Name} ${m.player1_score}-${m.player2_score} ${p2Name} → ${wName}\n`;
                    } else if (m.match_status === 'pending_approval') {
                        text += `  ⏳ ${p1Name} ${m.player1_score}-${m.player2_score} ${p2Name} [#${m.id}]\n`;
                    } else if (m.match_status === 'rejected') {
                        text += `  ❌ ${p1Name} vs ${p2Name} — replay [#${m.id}]\n`;
                    } else {
                        text += `  ⬜ ${p1Name} vs ${p2Name} [#${m.id}]\n`;
                    }
                }
                text += '\n';
            }
        }

        waClient.sendMessage(groupJid, text);
    }

    sendPendingApproval(groupJid: string, tournamentId: number): void {
        const t = tournamentOps.get(tournamentId);
        if (!t) return;

        const pending = tournamentOps.getPendingApproval(tournamentId);

        if (pending.length === 0) {
            waClient.sendMessage(groupJid, `📋 No matches pending approval.`);
            return;
        }

        let text = `📋 *PENDING APPROVAL*\n`;
        text += `━━━━━━━━━━━━━━━━━━━━━━━━\n`;

        for (const m of pending) {
            const p1User = userOps.get(m.player1_jid);
            const p2User = userOps.get(m.player2_jid);
            const p1Name = p1User?.name || formatJid(m.player1_jid);
            const p2Name = p2User?.name || formatJid(m.player2_jid);
            const hasProof = m.proof ? '📸' : '❌';

            text += `#${m.id} | ${p1Name} ${m.player1_score}-${m.player2_score} ${p2Name} ${hasProof}\n`;
        }

        text += `\n✅ .tapprove <id>\n❌ .treject <id> <reason>`;

        waClient.sendMessage(groupJid, text);
    }
}

export const tournamentManager = new TournamentManager();
export default tournamentManager;
