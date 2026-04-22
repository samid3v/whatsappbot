import { waClient } from '../client';
import { userOps } from '../database/db';
import { formatJid, formatDate } from '../utils/helpers';

// ==================== MATCH SCHEDULER ====================

interface ScheduledMatch {
  id: string;
  player1Jid: string;
  player2Jid: string;
  scheduledTime: Date;
  groupJid: string;
  status: 'pending' | 'reminded' | 'completed' | 'cancelled';
  reminderSent: boolean;
  createdAt: Date;
}

class MatchScheduler {
  private matches: Map<string, ScheduledMatch> = new Map();
  private nextId: number = 1;
  private reminderCheckInterval: NodeJS.Timeout | null = null;

  start(): void {
    // Check for reminders every minute
    this.reminderCheckInterval = setInterval(() => {
      this.checkReminders();
    }, 60000);
    console.log('✅ Match scheduler started');
  }

  stop(): void {
    if (this.reminderCheckInterval) {
      clearInterval(this.reminderCheckInterval);
      this.reminderCheckInterval = null;
      console.log('⏹️ Match scheduler stopped');
    }
  }

  // Schedule a match
  schedule(player1Jid: string, player2Jid: string, scheduledTime: Date, groupJid: string): string {
    const id = `match_${this.nextId++}`;
    const match: ScheduledMatch = {
      id,
      player1Jid,
      player2Jid,
      scheduledTime,
      groupJid,
      status: 'pending',
      reminderSent: false,
      createdAt: new Date()
    };

    this.matches.set(id, match);
    return id;
  }

  // Get scheduled match
  get(id: string): ScheduledMatch | undefined {
    return this.matches.get(id);
  }

  // List upcoming matches
  getUpcoming(limit: number = 10): ScheduledMatch[] {
    const now = new Date();
    return Array.from(this.matches.values())
      .filter(m => m.status === 'pending' && m.scheduledTime > now)
      .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime())
      .slice(0, limit);
  }

  // Mark match as completed
  complete(id: string): void {
    const match = this.matches.get(id);
    if (match) {
      match.status = 'completed';
    }
  }

  // Cancel a scheduled match
  cancel(id: string): void {
    const match = this.matches.get(id);
    if (match) {
      match.status = 'cancelled';
    }
  }

  // Check and send reminders
  private async checkReminders(): Promise<void> {
    const now = new Date();
    const fifteenMinutesFromNow = new Date(now.getTime() + 15 * 60000);

    for (const match of this.matches.values()) {
      if (match.status !== 'pending' || match.reminderSent) continue;

      // Send reminder 15 minutes before match
      if (match.scheduledTime <= fifteenMinutesFromNow && match.scheduledTime > now) {
        await this.sendReminder(match);
        match.reminderSent = true;
      }

      // Auto-complete if match time has passed
      if (match.scheduledTime <= now) {
        match.status = 'pending'; // Keep pending until manually marked complete
      }
    }
  }

  // Send reminder message
  private async sendReminder(match: ScheduledMatch): Promise<void> {
    try {
      const p1User = userOps.get(match.player1Jid);
      const p2User = userOps.get(match.player2Jid);
      const p1Name = p1User?.name || formatJid(match.player1Jid);
      const p2Name = p2User?.name || formatJid(match.player2Jid);

      const timeStr = match.scheduledTime.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });

      const message = `⏰ *Match Reminder*\n\n🎮 ${p1Name} vs ${p2Name}\n⏱️ Starting at ${timeStr}\n\nGet ready! 🔥`;

      await waClient.sendMessage(match.groupJid, message);
    } catch (error) {
      console.error('Error sending match reminder:', error);
    }
  }

  // Get all scheduled matches for a group
  getByGroup(groupJid: string): ScheduledMatch[] {
    return Array.from(this.matches.values())
      .filter(m => m.groupJid === groupJid && m.status === 'pending')
      .sort((a, b) => a.scheduledTime.getTime() - b.scheduledTime.getTime());
  }

  // Cleanup old matches
  cleanup(): void {
    const now = new Date();
    for (const [id, match] of this.matches.entries()) {
      // Remove completed/cancelled matches older than 7 days
      if ((match.status === 'completed' || match.status === 'cancelled') &&
          now.getTime() - match.createdAt.getTime() > 7 * 24 * 60 * 60 * 1000) {
        this.matches.delete(id);
      }
    }
  }

  // Format match for display
  formatMatch(match: ScheduledMatch): string {
    const p1User = userOps.get(match.player1Jid);
    const p2User = userOps.get(match.player2Jid);
    const p1Name = p1User?.name || formatJid(match.player1Jid);
    const p2Name = p2User?.name || formatJid(match.player2Jid);

    const timeStr = match.scheduledTime.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    return `${match.id} | ${p1Name} vs ${p2Name} | ${timeStr}`;
  }
}

export const matchScheduler = new MatchScheduler();
export default matchScheduler;
