import { waClient } from '../client';
import { userOps, pvpOps } from '../database/db';
import { formatJid } from '../utils/helpers';

// ==================== FRIENDLY REQUEST SYSTEM ====================

interface FriendlyRequest {
  id: string;
  requesterJid: string;
  groupJid: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  createdAt: Date;
  expiresAt: Date;
  acceptedBy?: string[];
}

interface PlayerFrequency {
  jid: string;
  matchesThisWeek: number;
  lastMatchDate?: Date;
}

class FriendlyRequestManager {
  private requests: Map<string, FriendlyRequest> = new Map();
  private playerFrequency: Map<string, PlayerFrequency> = new Map();

  // Create a friendly request
  createRequest(requesterJid: string, groupJid: string): string {
    // Use timestamp + random suffix for unique IDs
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    const id = `req_${timestamp}_${random}`;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 30 * 60000); // 30 minutes

    const request: FriendlyRequest = {
      id,
      requesterJid,
      groupJid,
      status: 'pending',
      createdAt: now,
      expiresAt,
      acceptedBy: []
    };

    this.requests.set(id, request);
    return id;
  }

  // Get a request
  getRequest(id: string): FriendlyRequest | undefined {
    return this.requests.get(id);
  }

  // Accept a friendly request
  acceptRequest(requestId: string, playerJid: string): boolean {
    const request = this.requests.get(requestId);
    if (!request || request.status !== 'pending') {
      return false;
    }

    if (!request.acceptedBy) {
      request.acceptedBy = [];
    }

    if (!request.acceptedBy.includes(playerJid)) {
      request.acceptedBy.push(playerJid);
    }

    return true;
  }

  // Decline a request
  declineRequest(requestId: string): void {
    const request = this.requests.get(requestId);
    if (request) {
      request.status = 'declined';
    }
  }

  // Get frequent players (played most matches this week)
  getFrequentPlayers(groupJid: string, limit: number = 5): PlayerFrequency[] {
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Get all matches from this week
    const allMatches = pvpOps.getAllMatches();
    const playerMatches = new Map<string, number>();

    for (const match of allMatches) {
      const matchDate = new Date(match.created_at);
      if (matchDate > weekAgo && match.status === 'approved') {
        playerMatches.set(match.player1_jid, (playerMatches.get(match.player1_jid) || 0) + 1);
        playerMatches.set(match.player2_jid, (playerMatches.get(match.player2_jid) || 0) + 1);
      }
    }

    // Convert to array and sort
    const frequent: PlayerFrequency[] = Array.from(playerMatches.entries())
      .map(([jid, count]) => ({
        jid,
        matchesThisWeek: count
      }))
      .sort((a, b) => b.matchesThisWeek - a.matchesThisWeek)
      .slice(0, limit);

    return frequent;
  }

  // Track a match for frequency
  recordMatch(player1Jid: string, player2Jid: string): void {
    const now = new Date();

    const updateFrequency = (jid: string) => {
      if (!this.playerFrequency.has(jid)) {
        this.playerFrequency.set(jid, {
          jid,
          matchesThisWeek: 0,
          lastMatchDate: now
        });
      }

      const freq = this.playerFrequency.get(jid)!;
      freq.matchesThisWeek++;
      freq.lastMatchDate = now;

      // Reset weekly count if it's been more than 7 days
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      if (freq.lastMatchDate < weekAgo) {
        freq.matchesThisWeek = 1;
      }
    };

    updateFrequency(player1Jid);
    updateFrequency(player2Jid);
  }

  // Format request for display
  formatRequest(request: FriendlyRequest): string {
    const requester = userOps.get(request.requesterJid);
    const requesterName = requester?.name || formatJid(request.requesterJid);

    let text = `🎮 *Friendly Match Request*\n\n`;
    text += `${requesterName} is looking for a friendly match!\n\n`;
    text += `⏱️ Expires in 30 minutes\n\n`;
    text += `React with:\n`;
    text += `  ✅ To accept\n`;
    text += `  ❌ To decline\n`;

    if (request.acceptedBy && request.acceptedBy.length > 0) {
      text += `\n👥 Accepted by:\n`;
      for (const jid of request.acceptedBy) {
        const user = userOps.get(jid);
        const name = user?.name || formatJid(jid);
        text += `  ✅ ${name}\n`;
      }
    }

    return text;
  }

  // Format frequent players for tagging
  formatFrequentPlayersForTag(players: PlayerFrequency[]): string {
    if (players.length === 0) {
      return 'No frequent players this week';
    }

    let text = '👥 Most Active Players This Week:\n\n';
    for (let i = 0; i < players.length; i++) {
      const player = players[i];
      const user = userOps.get(player.jid);
      const name = user?.name || formatJid(player.jid);
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      text += `${medal} ${name} - ${player.matchesThisWeek} matches\n`;
    }

    return text;
  }

  // Clean up expired requests
  cleanup(): void {
    const now = new Date();
    for (const [id, request] of this.requests.entries()) {
      if (now > request.expiresAt && request.status === 'pending') {
        request.status = 'expired';
      }
    }
  }
}

export const friendlyRequestManager = new FriendlyRequestManager();
export default friendlyRequestManager;
