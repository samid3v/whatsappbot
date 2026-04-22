import { waClient } from '../client';
import { userOps } from '../database/db';
import { formatJid } from '../utils/helpers';

// ==================== CHALLENGE TRACKER ====================

interface DailyChallengeRecord {
  date: string; // YYYY-MM-DD
  userId: string;
  completedChallenges: string[]; // challenge IDs
  totalReward: number;
  matchesPlayed: number;
  wins: number;
  draws: number;
  losses: number;
}

interface WeeklyChallengeReport {
  weekStart: string; // YYYY-MM-DD (Monday)
  weekEnd: string; // YYYY-MM-DD (Sunday)
  userId: string;
  dailyRecords: DailyChallengeRecord[];
  totalChallengesCompleted: number;
  totalRewardEarned: number;
  totalMatchesPlayed: number;
  totalWins: number;
  totalDraws: number;
  totalLosses: number;
  bestDay?: string; // date with most challenges
  bestDayCount?: number;
}

class ChallengeTracker {
  private dailyRecords: Map<string, DailyChallengeRecord[]> = new Map(); // date -> records
  private weeklyReports: Map<string, WeeklyChallengeReport[]> = new Map(); // userId -> reports

  // Record a completed challenge
  recordChallenge(userId: string, challengeId: string, reward: number): void {
    const today = this.getToday();
    const key = today;

    if (!this.dailyRecords.has(key)) {
      this.dailyRecords.set(key, []);
    }

    const records = this.dailyRecords.get(key)!;
    let record = records.find(r => r.userId === userId);

    if (!record) {
      record = {
        date: today,
        userId,
        completedChallenges: [],
        totalReward: 0,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0
      };
      records.push(record);
    }

    if (!record.completedChallenges.includes(challengeId)) {
      record.completedChallenges.push(challengeId);
      record.totalReward += reward;
    }
  }

  // Record match result for daily tracking
  recordMatch(userId: string, result: 'win' | 'draw' | 'loss'): void {
    const today = this.getToday();
    const key = today;

    if (!this.dailyRecords.has(key)) {
      this.dailyRecords.set(key, []);
    }

    const records = this.dailyRecords.get(key)!;
    let record = records.find(r => r.userId === userId);

    if (!record) {
      record = {
        date: today,
        userId,
        completedChallenges: [],
        totalReward: 0,
        matchesPlayed: 0,
        wins: 0,
        draws: 0,
        losses: 0
      };
      records.push(record);
    }

    record.matchesPlayed++;
    if (result === 'win') record.wins++;
    else if (result === 'draw') record.draws++;
    else record.losses++;
  }

  // Get daily report for a user
  getDailyReport(userId: string, date?: string): DailyChallengeRecord | null {
    const targetDate = date || this.getToday();
    const records = this.dailyRecords.get(targetDate) || [];
    return records.find(r => r.userId === userId) || null;
  }

  // Get weekly report for a user
  getWeeklyReport(userId: string, weekStart?: string): WeeklyChallengeReport | null {
    const startDate = weekStart || this.getWeekStart();
    const endDate = this.getWeekEnd(startDate);

    const dailyRecords: DailyChallengeRecord[] = [];
    let totalChallenges = 0;
    let totalReward = 0;
    let totalMatches = 0;
    let totalWins = 0;
    let totalDraws = 0;
    let totalLosses = 0;
    let bestDay = '';
    let bestDayCount = 0;

    // Collect all daily records for this week
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = this.formatDate(date);

      const record = this.getDailyReport(userId, dateStr);
      if (record) {
        dailyRecords.push(record);
        totalChallenges += record.completedChallenges.length;
        totalReward += record.totalReward;
        totalMatches += record.matchesPlayed;
        totalWins += record.wins;
        totalDraws += record.draws;
        totalLosses += record.losses;

        if (record.completedChallenges.length > bestDayCount) {
          bestDayCount = record.completedChallenges.length;
          bestDay = dateStr;
        }
      }
    }

    if (dailyRecords.length === 0) return null;

    return {
      weekStart: startDate,
      weekEnd: endDate,
      userId,
      dailyRecords,
      totalChallengesCompleted: totalChallenges,
      totalRewardEarned: totalReward,
      totalMatchesPlayed: totalMatches,
      totalWins,
      totalDraws,
      totalLosses,
      bestDay: bestDayCount > 0 ? bestDay : undefined,
      bestDayCount: bestDayCount > 0 ? bestDayCount : undefined
    };
  }

  // Format daily report for display
  formatDailyReport(userId: string, date?: string): string {
    const record = this.getDailyReport(userId, date);
    if (!record) {
      return '📭 No challenges completed today';
    }

    const user = userOps.get(userId);
    const name = user?.name || formatJid(userId);

    let text = `📊 *Daily Challenge Report - ${record.date}*\n`;
    text += `👤 ${name}\n\n`;

    text += `🎯 Challenges Completed: ${record.completedChallenges.length}\n`;
    text += `💰 Total Reward: +${record.totalReward} pts\n\n`;

    text += `🎮 Match Stats:\n`;
    text += `  Played: ${record.matchesPlayed}\n`;
    text += `  ✅ Wins: ${record.wins}\n`;
    text += `  🤝 Draws: ${record.draws}\n`;
    text += `  ❌ Losses: ${record.losses}\n`;

    if (record.matchesPlayed > 0) {
      const winRate = Math.round((record.wins / record.matchesPlayed) * 100);
      text += `  📈 Win Rate: ${winRate}%\n`;
    }

    return text;
  }

  // Format weekly report for display
  formatWeeklyReport(userId: string, weekStart?: string): string {
    const report = this.getWeeklyReport(userId, weekStart);
    if (!report) {
      return '📭 No challenges completed this week';
    }

    const user = userOps.get(userId);
    const name = user?.name || formatJid(userId);

    let text = `📈 *Weekly Challenge Report*\n`;
    text += `👤 ${name}\n`;
    text += `📅 ${report.weekStart} → ${report.weekEnd}\n\n`;

    text += `🎯 Total Challenges: ${report.totalChallengesCompleted}\n`;
    text += `💰 Total Reward: +${report.totalRewardEarned} pts\n\n`;

    text += `🎮 Weekly Stats:\n`;
    text += `  Played: ${report.totalMatchesPlayed}\n`;
    text += `  ✅ Wins: ${report.totalWins}\n`;
    text += `  🤝 Draws: ${report.totalDraws}\n`;
    text += `  ❌ Losses: ${report.totalLosses}\n`;

    if (report.totalMatchesPlayed > 0) {
      const winRate = Math.round((report.totalWins / report.totalMatchesPlayed) * 100);
      text += `  📈 Win Rate: ${winRate}%\n`;
    }

    if (report.bestDay && report.bestDayCount) {
      text += `\n🏆 Best Day: ${report.bestDay} (${report.bestDayCount} challenges)\n`;
    }

    text += `\n📋 Daily Breakdown:\n`;
    for (const daily of report.dailyRecords) {
      text += `  ${daily.date}: ${daily.completedChallenges.length} challenges, +${daily.totalReward} pts\n`;
    }

    return text;
  }

  // Get all users' weekly reports for group summary
  getGroupWeeklyReports(weekStart?: string): WeeklyChallengeReport[] {
    const startDate = weekStart || this.getWeekStart();
    const reports: WeeklyChallengeReport[] = [];
    const userIds = new Set<string>();

    // Collect all user IDs from daily records this week
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      const dateStr = this.formatDate(date);

      const records = this.dailyRecords.get(dateStr) || [];
      records.forEach(r => userIds.add(r.userId));
    }

    // Generate reports for each user
    for (const userId of userIds) {
      const report = this.getWeeklyReport(userId, startDate);
      if (report) {
        reports.push(report);
      }
    }

    // Sort by total reward (descending)
    return reports.sort((a, b) => b.totalRewardEarned - a.totalRewardEarned);
  }

  // Format group weekly summary
  formatGroupWeeklySummary(weekStart?: string): string {
    const reports = this.getGroupWeeklyReports(weekStart);
    if (reports.length === 0) {
      return '📭 No challenge data this week';
    }

    const startDate = weekStart || this.getWeekStart();
    let text = `📊 *Weekly Challenge Summary*\n`;
    text += `📅 ${startDate} → ${this.getWeekEnd(startDate)}\n\n`;

    text += `🏆 Top Performers:\n`;
    for (let i = 0; i < Math.min(5, reports.length); i++) {
      const report = reports[i];
      const user = userOps.get(report.userId);
      const name = user?.name || formatJid(report.userId);
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      text += `${medal} ${name}: ${report.totalChallengesCompleted} challenges, +${report.totalRewardEarned} pts\n`;
    }

    text += `\n📈 Group Stats:\n`;
    const totalChallenges = reports.reduce((sum, r) => sum + r.totalChallengesCompleted, 0);
    const totalReward = reports.reduce((sum, r) => sum + r.totalRewardEarned, 0);
    const totalMatches = reports.reduce((sum, r) => sum + r.totalMatchesPlayed, 0);
    text += `  Total Challenges: ${totalChallenges}\n`;
    text += `  Total Reward: +${totalReward} pts\n`;
    text += `  Total Matches: ${totalMatches}\n`;
    text += `  Active Players: ${reports.length}\n`;

    return text;
  }

  // Helper functions
  private getToday(): string {
    return this.formatDate(new Date());
  }

  private getWeekStart(date?: string): string {
    const d = date ? new Date(date) : new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
    const monday = new Date(d.setDate(diff));
    return this.formatDate(monday);
  }

  private getWeekEnd(weekStart: string): string {
    const start = new Date(weekStart);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    return this.formatDate(end);
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  // Clear old records (keep last 30 days)
  cleanup(): void {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const cutoffDate = this.formatDate(thirtyDaysAgo);

    for (const [date] of this.dailyRecords.entries()) {
      if (date < cutoffDate) {
        this.dailyRecords.delete(date);
      }
    }
  }
}

export const challengeTracker = new ChallengeTracker();
export default challengeTracker;
