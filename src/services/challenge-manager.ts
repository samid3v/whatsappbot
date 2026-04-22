import { waClient } from '../client';
import { userOps, pvpOps } from '../database/db';
import { formatJid } from '../utils/helpers';

// ==================== CHALLENGE MANAGER ====================

export type ChallengeType = 'win_streak' | 'score_goals' | 'win_matches' | 'no_losses' | 'draw_match';

interface Challenge {
  id: string;
  type: ChallengeType;
  title: string;
  description: string;
  target: number;
  reward: number; // bonus points
  difficulty: 'easy' | 'medium' | 'hard';
}

interface UserChallenge {
  userId: string;
  challengeId: string;
  progress: number;
  completed: boolean;
  completedAt?: Date;
  rewardClaimed: boolean;
}

class ChallengeManager {
  private challenges: Map<string, Challenge> = new Map();
  private userChallenges: Map<string, UserChallenge[]> = new Map();
  private dailyResetTime: number = 0; // 00:00 UTC

  constructor() {
    this.initializeChallenges();
    this.startDailyReset();
  }

  private initializeChallenges(): void {
    // Easy challenges
    this.challenges.set('win_1', {
      id: 'win_1',
      type: 'win_matches',
      title: '🎯 First Win',
      description: 'Win 1 match today',
      target: 1,
      reward: 5,
      difficulty: 'easy'
    });

    this.challenges.set('score_3', {
      id: 'score_3',
      type: 'score_goals',
      title: '⚽ Goal Scorer',
      description: 'Score 3 goals in a match',
      target: 3,
      reward: 10,
      difficulty: 'easy'
    });

    // Medium challenges
    this.challenges.set('win_3', {
      id: 'win_3',
      type: 'win_matches',
      title: '🔥 Hot Streak',
      description: 'Win 3 matches today',
      target: 3,
      reward: 20,
      difficulty: 'medium'
    });

    this.challenges.set('draw_1', {
      id: 'draw_1',
      type: 'draw_match',
      title: '🤝 Balanced Game',
      description: 'Draw a match',
      target: 1,
      reward: 8,
      difficulty: 'medium'
    });

    // Hard challenges
    this.challenges.set('win_streak_5', {
      id: 'win_streak_5',
      type: 'win_streak',
      title: '🏆 Unstoppable',
      description: 'Win 5 matches in a row',
      target: 5,
      reward: 50,
      difficulty: 'hard'
    });

    this.challenges.set('no_losses', {
      id: 'no_losses',
      type: 'no_losses',
      title: '💎 Perfect Day',
      description: 'Play 5 matches without losing',
      target: 5,
      reward: 40,
      difficulty: 'hard'
    });
  }

  private startDailyReset(): void {
    // Reset challenges daily at 00:00 UTC
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    tomorrow.setUTCHours(0, 0, 0, 0);

    const timeUntilReset = tomorrow.getTime() - now.getTime();

    setTimeout(() => {
      this.resetDailyChallenges();
      // Then repeat every 24 hours
      setInterval(() => this.resetDailyChallenges(), 24 * 60 * 60 * 1000);
    }, timeUntilReset);

    console.log('✅ Daily challenge reset scheduled');
  }

  private resetDailyChallenges(): void {
    this.userChallenges.clear();
    console.log('🔄 Daily challenges reset');
  }

  // Get or create user challenges
  getUserChallenges(userId: string): UserChallenge[] {
    if (!this.userChallenges.has(userId)) {
      const challenges: UserChallenge[] = [];
      for (const challenge of this.challenges.values()) {
        challenges.push({
          userId,
          challengeId: challenge.id,
          progress: 0,
          completed: false,
          rewardClaimed: false
        });
      }
      this.userChallenges.set(userId, challenges);
    }
    return this.userChallenges.get(userId) || [];
  }

  // Update challenge progress after a match
  updateProgress(userId: string, matchResult: 'win' | 'draw' | 'loss', goalsScored: number, goalsAgainst: number): void {
    const { challengeTracker } = require('./challenge-tracker');
    
    const userChallenges = this.getUserChallenges(userId);

    for (const uc of userChallenges) {
      if (uc.completed) continue;

      const challenge = this.challenges.get(uc.challengeId);
      if (!challenge) continue;

      switch (challenge.type) {
        case 'win_matches':
          if (matchResult === 'win') uc.progress++;
          break;
        case 'score_goals':
          if (goalsScored >= challenge.target) uc.progress = challenge.target;
          break;
        case 'draw_match':
          if (matchResult === 'draw') uc.progress++;
          break;
        case 'no_losses':
          if (matchResult !== 'loss') uc.progress++;
          else uc.progress = 0; // Reset on loss
          break;
        case 'win_streak':
          if (matchResult === 'win') uc.progress++;
          else uc.progress = 0; // Reset on non-win
          break;
      }

      // Check if completed
      if (uc.progress >= challenge.target && !uc.completed) {
        uc.completed = true;
        uc.completedAt = new Date();
        
        // Record in tracker
        challengeTracker.recordChallenge(userId, uc.challengeId, challenge.reward);
      }
    }

    // Record match in tracker
    challengeTracker.recordMatch(userId, matchResult);
  }

  // Get completed challenges
  getCompleted(userId: string): UserChallenge[] {
    return this.getUserChallenges(userId).filter(uc => uc.completed && !uc.rewardClaimed);
  }

  // Claim reward
  claimReward(userId: string, challengeId: string): number {
    const userChallenges = this.getUserChallenges(userId);
    const uc = userChallenges.find(c => c.challengeId === challengeId);

    if (!uc || !uc.completed || uc.rewardClaimed) {
      return 0;
    }

    const challenge = this.challenges.get(challengeId);
    if (!challenge) return 0;

    uc.rewardClaimed = true;
    return challenge.reward;
  }

  // Get challenge info
  getChallenge(id: string): Challenge | undefined {
    return this.challenges.get(id);
  }

  // Get all challenges
  getAllChallenges(): Challenge[] {
    return Array.from(this.challenges.values());
  }

  // Format challenges for display
  formatChallenges(userId: string): string {
    const userChallenges = this.getUserChallenges(userId);
    let text = '📋 *Daily Challenges*\n\n';

    const completed = userChallenges.filter(uc => uc.completed);
    const inProgress = userChallenges.filter(uc => !uc.completed);

    if (inProgress.length > 0) {
      text += '*In Progress:*\n';
      for (const uc of inProgress) {
        const challenge = this.challenges.get(uc.challengeId);
        if (!challenge) continue;
        const percent = Math.min(100, Math.round((uc.progress / challenge.target) * 100));
        text += `${challenge.title}\n${uc.progress}/${challenge.target} (${percent}%)\n`;
      }
    }

    if (completed.length > 0) {
      text += '\n*Completed:*\n';
      for (const uc of completed) {
        const challenge = this.challenges.get(uc.challengeId);
        if (!challenge) continue;
        const claimed = uc.rewardClaimed ? '✅' : '🎁';
        text += `${claimed} ${challenge.title} (+${challenge.reward} pts)\n`;
      }
    }

    return text;
  }
}

export const challengeManager = new ChallengeManager();
export default challengeManager;
