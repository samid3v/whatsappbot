// ==================== RATE LIMITER ====================

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number; // milliseconds
}

interface UserRateLimit {
  attempts: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, UserRateLimit> = new Map();
  private config: Map<string, RateLimitConfig> = new Map();

  // Set rate limit for a command
  setLimit(commandName: string, maxAttempts: number, windowMs: number): void {
    this.config.set(commandName, { maxAttempts, windowMs });
  }

  // Check if user has exceeded rate limit
  isLimited(userId: string, commandName: string): boolean {
    const config = this.config.get(commandName);
    if (!config) return false; // No limit set

    const key = `${userId}:${commandName}`;
    const now = Date.now();
    let userLimit = this.limits.get(key);

    // Reset if window expired
    if (!userLimit || now > userLimit.resetTime) {
      userLimit = {
        attempts: 0,
        resetTime: now + config.windowMs
      };
      this.limits.set(key, userLimit);
    }

    userLimit.attempts++;
    return userLimit.attempts > config.maxAttempts;
  }

  // Get remaining attempts
  getRemaining(userId: string, commandName: string): number {
    const config = this.config.get(commandName);
    if (!config) return -1;

    const key = `${userId}:${commandName}`;
    const userLimit = this.limits.get(key);
    
    if (!userLimit || Date.now() > userLimit.resetTime) {
      return config.maxAttempts;
    }

    return Math.max(0, config.maxAttempts - userLimit.attempts);
  }

  // Get reset time in seconds
  getResetTime(userId: string, commandName: string): number {
    const key = `${userId}:${commandName}`;
    const userLimit = this.limits.get(key);
    
    if (!userLimit) return 0;

    const remaining = Math.max(0, userLimit.resetTime - Date.now());
    return Math.ceil(remaining / 1000);
  }

  // Clear a user's limit
  clear(userId: string, commandName?: string): void {
    if (commandName) {
      this.limits.delete(`${userId}:${commandName}`);
    } else {
      // Clear all limits for user
      for (const key of this.limits.keys()) {
        if (key.startsWith(userId)) {
          this.limits.delete(key);
        }
      }
    }
  }

  // Cleanup old entries (run periodically)
  cleanup(): void {
    const now = Date.now();
    for (const [key, limit] of this.limits.entries()) {
      if (now > limit.resetTime + 60000) { // Keep for 1 min after expiry
        this.limits.delete(key);
      }
    }
  }

  // Get funny rate limit message
  getFunnyMessage(resetSeconds: number): string {
    const messages = [
      `⏱️ Whoa there! Easy on me, I'm just a bot! Try again in ${resetSeconds}s 🤖`,
      `🚀 Slow down, speed racer! I can't keep up. Retry in ${resetSeconds}s ⏳`,
      `😅 You're too fast! Give me ${resetSeconds}s to catch my breath 💨`,
      `🔥 Chill! You're spamming faster than a striker on goal. Wait ${resetSeconds}s ⚽`,
      `⚡ Pump the brakes! I need ${resetSeconds}s to recover 🛑`,
      `🎮 Bro, you're speedrunning this! Wait ${resetSeconds}s please 😂`,
      `🏃 Slow down! Even Messi takes breaks. Retry in ${resetSeconds}s ⏰`,
      `💪 You're too strong for me! Give me ${resetSeconds}s to rest 😴`,
      `🌪️ Tornado mode activated? Chill for ${resetSeconds}s 🌀`,
      `🎯 Accuracy over speed! Wait ${resetSeconds}s and try again 🎪`,
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
}

export const rateLimiter = new RateLimiter();

// Default rate limits
rateLimiter.setLimit('pvpscores', 5, 60000); // 5 per minute
rateLimiter.setLimit('pvpapprove', 10, 60000); // 10 per minute
rateLimiter.setLimit('pvpreject', 10, 60000); // 10 per minute
rateLimiter.setLimit('tcr', 2, 300000); // 2 per 5 minutes
rateLimiter.setLimit('tres', 5, 60000); // 5 per minute
rateLimiter.setLimit('warn', 10, 60000); // 10 per minute
rateLimiter.setLimit('mute', 10, 60000); // 10 per minute
rateLimiter.setLimit('kick', 5, 60000); // 5 per minute
rateLimiter.setLimit('request', 3, 300000); // 3 per 5 minutes (friendly requests)
rateLimiter.setLimit('schedule', 5, 60000); // 5 per minute

// Cleanup every 5 minutes
setInterval(() => rateLimiter.cleanup(), 300000);

export default rateLimiter;
