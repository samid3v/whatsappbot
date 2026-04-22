import { waClient } from '../client';
import { tournamentOps, userOps } from '../database/db';
import { formatJid } from '../utils/helpers';

// ==================== TOURNAMENT SCHEDULER ====================

interface TournamentStage {
  stageNumber: number;
  name: string;
  startDate: Date;
  endDate: Date;
  durationDays: number;
  status: 'pending' | 'active' | 'completed';
  matchesCount: number;
  completedMatches: number;
}

interface TournamentSchedule {
  tournamentId: number;
  stages: TournamentStage[];
  currentStage: number;
  totalStages: number;
  remindersSent: Set<number>; // stage numbers that have been reminded
}

class TournamentScheduler {
  private schedules: Map<number, TournamentSchedule> = new Map();
  private stageCheckInterval: NodeJS.Timeout | null = null;

  start(): void {
    // Check stage deadlines every hour
    this.stageCheckInterval = setInterval(() => {
      this.checkStageDeadlines();
    }, 60 * 60 * 1000);
    console.log('✅ Tournament scheduler started');
  }

  stop(): void {
    if (this.stageCheckInterval) {
      clearInterval(this.stageCheckInterval);
      this.stageCheckInterval = null;
      console.log('⏹️ Tournament scheduler stopped');
    }
  }

  // Create tournament schedule
  createSchedule(
    tournamentId: number,
    stagesConfig: Array<{ name: string; durationDays: number }>
  ): TournamentSchedule {
    const stages: TournamentStage[] = [];
    let currentDate = new Date();

    for (let i = 0; i < stagesConfig.length; i++) {
      const config = stagesConfig[i];
      const startDate = new Date(currentDate);
      const endDate = new Date(currentDate);
      endDate.setDate(endDate.getDate() + config.durationDays);

      stages.push({
        stageNumber: i + 1,
        name: config.name,
        startDate,
        endDate,
        durationDays: config.durationDays,
        status: i === 0 ? 'active' : 'pending',
        matchesCount: 0,
        completedMatches: 0
      });

      currentDate = new Date(endDate);
      currentDate.setDate(currentDate.getDate() + 1); // Start next stage next day
    }

    const schedule: TournamentSchedule = {
      tournamentId,
      stages,
      currentStage: 1,
      totalStages: stages.length,
      remindersSent: new Set()
    };

    this.schedules.set(tournamentId, schedule);
    return schedule;
  }

  // Get tournament schedule
  getSchedule(tournamentId: number): TournamentSchedule | undefined {
    return this.schedules.get(tournamentId);
  }

  // Get current stage
  getCurrentStage(tournamentId: number): TournamentStage | undefined {
    const schedule = this.schedules.get(tournamentId);
    if (!schedule) return undefined;
    return schedule.stages[schedule.currentStage - 1];
  }

  // Check if tournament is in a specific stage
  isInStage(tournamentId: number, stageNumber: number): boolean {
    const schedule = this.schedules.get(tournamentId);
    if (!schedule) return false;
    return schedule.currentStage === stageNumber;
  }

  // Get days remaining in current stage
  getDaysRemaining(tournamentId: number): number {
    const currentStage = this.getCurrentStage(tournamentId);
    if (!currentStage) return 0;

    const now = new Date();
    const daysRemaining = Math.ceil(
      (currentStage.endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    );

    return Math.max(0, daysRemaining);
  }

  // Get hours remaining in current stage
  getHoursRemaining(tournamentId: number): number {
    const currentStage = this.getCurrentStage(tournamentId);
    if (!currentStage) return 0;

    const now = new Date();
    const hoursRemaining = Math.ceil(
      (currentStage.endDate.getTime() - now.getTime()) / (1000 * 60 * 60)
    );

    return Math.max(0, hoursRemaining);
  }

  // Update match count for stage
  updateStageMatchCount(tournamentId: number, stageNumber: number, count: number): void {
    const schedule = this.schedules.get(tournamentId);
    if (!schedule) return;

    const stage = schedule.stages[stageNumber - 1];
    if (stage) {
      stage.matchesCount = count;
    }
  }

  // Increment completed matches for stage
  incrementCompletedMatches(tournamentId: number, stageNumber: number): void {
    const schedule = this.schedules.get(tournamentId);
    if (!schedule) return;

    const stage = schedule.stages[stageNumber - 1];
    if (stage) {
      stage.completedMatches++;
    }
  }

  // Get stage progress
  getStageProgress(tournamentId: number, stageNumber: number): string {
    const schedule = this.schedules.get(tournamentId);
    if (!schedule) return 'No schedule found';

    const stage = schedule.stages[stageNumber - 1];
    if (!stage) return 'Stage not found';

    const percent = stage.matchesCount > 0
      ? Math.round((stage.completedMatches / stage.matchesCount) * 100)
      : 0;

    return `${stage.completedMatches}/${stage.matchesCount} (${percent}%)`;
  }

  // Format schedule for display
  formatSchedule(tournamentId: number): string {
    const schedule = this.schedules.get(tournamentId);
    if (!schedule) return '❌ No schedule found';

    let text = `📅 *Tournament Schedule*\n\n`;

    for (const stage of schedule.stages) {
      const icon = stage.status === 'active' ? '🔴' : stage.status === 'completed' ? '✅' : '⏳';
      const startStr = stage.startDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
      const endStr = stage.endDate.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });

      text += `${icon} *Stage ${stage.stageNumber}: ${stage.name}*\n`;
      text += `   📅 ${startStr} → ${endStr}\n`;
      text += `   ⏱️ ${stage.durationDays} days\n`;
      text += `   🎮 Matches: ${this.getStageProgress(tournamentId, stage.stageNumber)}\n\n`;
    }

    return text;
  }

  // Format current stage info
  formatCurrentStageInfo(tournamentId: number): string {
    const currentStage = this.getCurrentStage(tournamentId);
    if (!currentStage) return '❌ No active stage';

    const daysRemaining = this.getDaysRemaining(tournamentId);
    const hoursRemaining = this.getHoursRemaining(tournamentId);
    const progress = this.getStageProgress(tournamentId, currentStage.stageNumber);

    let text = `📊 *Current Stage*\n\n`;
    text += `🎯 Stage ${currentStage.stageNumber}: ${currentStage.name}\n`;
    text += `⏱️ Time Remaining: ${daysRemaining} days, ${hoursRemaining % 24} hours\n`;
    text += `🎮 Progress: ${progress}\n`;
    text += `📅 Deadline: ${currentStage.endDate.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })}\n`;

    return text;
  }

  // Check stage deadlines and auto-advance
  private async checkStageDeadlines(): Promise<void> {
    const now = new Date();

    for (const [tournamentId, schedule] of this.schedules.entries()) {
      const currentStage = schedule.stages[schedule.currentStage - 1];
      if (!currentStage) continue;

      // Check if current stage deadline has passed
      if (now > currentStage.endDate && currentStage.status === 'active') {
        // Mark current stage as completed
        currentStage.status = 'completed';

        // Move to next stage if available
        if (schedule.currentStage < schedule.totalStages) {
          schedule.currentStage++;
          const nextStage = schedule.stages[schedule.currentStage - 1];
          if (nextStage) {
            nextStage.status = 'active';
            console.log(`✅ Tournament ${tournamentId} advanced to Stage ${schedule.currentStage}`);
          }
        }

        // Clear reminders for next stage
        schedule.remindersSent.clear();
      }

      // Send reminders 24 hours before deadline
      if (
        currentStage.status === 'active' &&
        !schedule.remindersSent.has(currentStage.stageNumber)
      ) {
        const hoursUntilDeadline = (currentStage.endDate.getTime() - now.getTime()) / (1000 * 60 * 60);

        if (hoursUntilDeadline <= 24 && hoursUntilDeadline > 23) {
          // Send reminder
          const tournament = tournamentOps.get(tournamentId);
          if (tournament) {
            await this.sendStageDeadlineReminder(tournamentId, currentStage);
            schedule.remindersSent.add(currentStage.stageNumber);
          }
        }
      }
    }
  }

  // Send stage deadline reminder
  private async sendStageDeadlineReminder(tournamentId: number, stage: TournamentStage): Promise<void> {
    try {
      const tournament = tournamentOps.get(tournamentId);
      if (!tournament) return;

      const hoursRemaining = this.getHoursRemaining(tournamentId);
      const progress = this.getStageProgress(tournamentId, stage.stageNumber);

      let message = `⏰ *Stage Deadline Reminder*\n\n`;
      message += `🎯 ${tournament.name} - Stage ${stage.stageNumber}: ${stage.name}\n`;
      message += `⏱️ Deadline in ${hoursRemaining} hours\n`;
      message += `🎮 Progress: ${progress}\n\n`;
      message += `📋 Remaining matches must be submitted before deadline!\n`;
      message += `Use .tb to view bracket\n`;
      message += `Use .tres [id] [score] to submit results`;

      // Send to group (would need group JID from tournament context)
      // For now, just log it
      console.log(`📢 Reminder for tournament ${tournamentId}: ${message}`);
    } catch (error) {
      console.error('Error sending stage reminder:', error);
    }
  }

  // Cleanup old schedules
  cleanup(): void {
    const now = new Date();
    for (const [tournamentId, schedule] of this.schedules.entries()) {
      const lastStage = schedule.stages[schedule.stages.length - 1];
      if (lastStage && now > lastStage.endDate && lastStage.status === 'completed') {
        // Keep for 7 days after completion
        const daysSinceCompletion = (now.getTime() - lastStage.endDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceCompletion > 7) {
          this.schedules.delete(tournamentId);
        }
      }
    }
  }
}

export const tournamentScheduler = new TournamentScheduler();
export default tournamentScheduler;
