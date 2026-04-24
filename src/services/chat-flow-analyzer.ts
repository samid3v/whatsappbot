import { waClient } from '../client';
import { userOps } from '../database/db';
import { formatJid } from '../utils/helpers';

// ==================== CHAT FLOW ANALYZER ====================
// Learns group chat patterns and responds naturally

interface ChatPattern {
  keyword: string;
  response: string;
  language: 'en' | 'sw';
  context: string;
}

interface GroupFlow {
  groupJid: string;
  messageCount: number;
  activeUsers: Set<string>;
  lastActivityTime: Date;
  commonTopics: Map<string, number>;
  peakHours: number[];
  language: 'en' | 'sw' | 'mixed';
}

class ChatFlowAnalyzer {
  private groupFlows: Map<string, GroupFlow> = new Map();
  private chatPatterns: ChatPattern[] = [
    // Swahili patterns
    {
      keyword: 'friendly',
      response: 'Kila hapa! 🎮 Karibu kucheza friendly match? Nitakuunganisha na wachezaji wenye nguvu!',
      language: 'sw',
      context: 'friendly_request'
    },
    {
      keyword: 'tournament',
      response: 'Kila hapa! 🏆 Tunataka tournament? Niambie tu: "Kila tcr 8 players knockout"',
      language: 'sw',
      context: 'tournament_interest'
    },
    {
      keyword: 'match',
      response: 'Kila hapa! ⚽ Nani anataka kucheza? Nitakuunganisha na opponent!',
      language: 'sw',
      context: 'match_interest'
    },
    {
      keyword: 'score',
      response: 'Kila hapa! 📊 Karibu kurekodi matokeo: .pvpscores @player1 vs @player2 3:1',
      language: 'sw',
      context: 'score_submission'
    },
    {
      keyword: 'leaderboard',
      response: 'Kila hapa! 📈 Karibu kuona ranking: .pvplb',
      language: 'sw',
      context: 'stats_interest'
    },
    // English patterns
    {
      keyword: 'friendly',
      response: 'Kila here! 🎮 Want a friendly match? I\'ll connect you with active players!',
      language: 'en',
      context: 'friendly_request'
    },
    {
      keyword: 'tournament',
      response: 'Kila here! 🏆 Want a tournament? Just say: "Kila tcr 8 players knockout"',
      language: 'en',
      context: 'tournament_interest'
    },
    {
      keyword: 'match',
      response: 'Kila here! ⚽ Who wants to play? I\'ll find you an opponent!',
      language: 'en',
      context: 'match_interest'
    },
    {
      keyword: 'score',
      response: 'Kila here! 📊 Record your result: .pvpscores @player1 vs @player2 3:1',
      language: 'en',
      context: 'score_submission'
    },
    {
      keyword: 'leaderboard',
      response: 'Kila here! 📈 Check rankings: .pvplb',
      language: 'en',
      context: 'stats_interest'
    }
  ];

  // Initialize group flow tracking
  initializeGroup(groupJid: string): void {
    if (!this.groupFlows.has(groupJid)) {
      this.groupFlows.set(groupJid, {
        groupJid,
        messageCount: 0,
        activeUsers: new Set(),
        lastActivityTime: new Date(),
        commonTopics: new Map(),
        peakHours: [],
        language: 'mixed'
      });
    }
  }

  // Learn from chat message
  learnFromMessage(groupJid: string, senderJid: string, messageText: string): void {
    this.initializeGroup(groupJid);
    const flow = this.groupFlows.get(groupJid)!;

    // Track active users
    flow.activeUsers.add(senderJid);
    flow.messageCount++;
    flow.lastActivityTime = new Date();

    // Detect language
    if (this.isSwahili(messageText)) {
      flow.language = flow.language === 'en' ? 'mixed' : 'sw';
    } else if (this.isEnglish(messageText)) {
      flow.language = flow.language === 'sw' ? 'mixed' : 'en';
    }

    // Track topics
    const topics = this.extractTopics(messageText);
    for (const topic of topics) {
      flow.commonTopics.set(topic, (flow.commonTopics.get(topic) || 0) + 1);
    }

    // Track peak hours
    const hour = new Date().getHours();
    if (!flow.peakHours.includes(hour)) {
      flow.peakHours.push(hour);
    }
  }

  // Detect if message is Swahili
  private isSwahili(text: string): boolean {
    const swahiliWords = [
      'karibu', 'kila', 'watu', 'kucheza', 'matokeo', 'leo', 'saa',
      'nani', 'anataka', 'tunataka', 'tafadhali', 'asante', 'pole',
      'haraka', 'sawa', 'nzuri', 'mbaya', 'juu', 'chini'
    ];
    const lowerText = text.toLowerCase();
    return swahiliWords.some(word => lowerText.includes(word));
  }

  // Detect if message is English
  private isEnglish(text: string): boolean {
    const englishWords = [
      'match', 'tournament', 'friendly', 'score', 'leaderboard',
      'play', 'game', 'win', 'lose', 'player', 'team', 'bracket',
      'please', 'thanks', 'hello', 'want', 'need', 'help'
    ];
    const lowerText = text.toLowerCase();
    return englishWords.some(word => lowerText.includes(word));
  }

  // Extract topics from message
  private extractTopics(text: string): string[] {
    const topics: string[] = [];
    const lowerText = text.toLowerCase();

    if (lowerText.includes('friendly') || lowerText.includes('kucheza')) topics.push('friendly');
    if (lowerText.includes('tournament') || lowerText.includes('tournament')) topics.push('tournament');
    if (lowerText.includes('match') || lowerText.includes('mchezo')) topics.push('match');
    if (lowerText.includes('score') || lowerText.includes('matokeo')) topics.push('score');
    if (lowerText.includes('leaderboard') || lowerText.includes('ranking')) topics.push('leaderboard');
    if (lowerText.includes('challenge') || lowerText.includes('changamoto')) topics.push('challenge');
    if (lowerText.includes('stats') || lowerText.includes('takwimu')) topics.push('stats');

    return topics;
  }

  // Get group language preference
  getGroupLanguage(groupJid: string): 'en' | 'sw' | 'mixed' {
    this.initializeGroup(groupJid);
    return this.groupFlows.get(groupJid)?.language || 'mixed';
  }

  // Get most common topics
  getCommonTopics(groupJid: string, limit: number = 5): string[] {
    this.initializeGroup(groupJid);
    const flow = this.groupFlows.get(groupJid)!;
    
    return Array.from(flow.commonTopics.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([topic]) => topic);
  }

  // Get peak activity hours
  getPeakHours(groupJid: string): number[] {
    this.initializeGroup(groupJid);
    return this.groupFlows.get(groupJid)?.peakHours || [];
  }

  // Get active user count
  getActiveUserCount(groupJid: string): number {
    this.initializeGroup(groupJid);
    return this.groupFlows.get(groupJid)?.activeUsers.size || 0;
  }

  // Respond to message naturally
  async respondToMessage(groupJid: string, messageText: string): Promise<string | null> {
    this.initializeGroup(groupJid);
    const language = this.getGroupLanguage(groupJid);

    // Find matching pattern
    for (const pattern of this.chatPatterns) {
      if (messageText.toLowerCase().includes(pattern.keyword)) {
        // Match language preference
        if (language === 'mixed' || pattern.language === language) {
          return pattern.response;
        }
      }
    }

    return null;
  }

  // Get group activity summary
  getGroupSummary(groupJid: string): string {
    this.initializeGroup(groupJid);
    const flow = this.groupFlows.get(groupJid)!;

    const topics = this.getCommonTopics(groupJid, 3);
    const language = flow.language;
    const activeUsers = flow.activeUsers.size;
    const messageCount = flow.messageCount;

    let summary = `📊 *Group Activity Summary*\n\n`;
    summary += `👥 Active users: ${activeUsers}\n`;
    summary += `💬 Messages: ${messageCount}\n`;
    summary += `🗣️ Language: ${language}\n`;
    summary += `🎯 Top topics: ${topics.join(', ')}\n`;
    summary += `⏰ Peak hours: ${flow.peakHours.join(', ')}:00\n`;

    return summary;
  }

  // Suggest action based on flow
  suggestAction(groupJid: string): string {
    this.initializeGroup(groupJid);
    const topics = this.getCommonTopics(groupJid, 1);
    const language = this.getGroupLanguage(groupJid);

    if (topics.includes('friendly')) {
      return language === 'sw' 
        ? 'Kila hapa! 🎮 Karibu kuomba friendly match: .request'
        : 'Kila here! 🎮 Request a friendly match: .request';
    }

    if (topics.includes('tournament')) {
      return language === 'sw'
        ? 'Kila hapa! 🏆 Tunataka tournament? .tcr "jina" se 8'
        : 'Kila here! 🏆 Want a tournament? .tcr "name" se 8';
    }

    if (topics.includes('score')) {
      return language === 'sw'
        ? 'Kila hapa! 📊 Rekodi matokeo: .pvpscores @player1 vs @player2 3:1'
        : 'Kila here! 📊 Record score: .pvpscores @player1 vs @player2 3:1';
    }

    if (topics.includes('leaderboard')) {
      return language === 'sw'
        ? 'Kila hapa! 📈 Tazama ranking: .pvplb'
        : 'Kila here! 📈 Check ranking: .pvplb';
    }

    return language === 'sw'
      ? 'Kila hapa! ⚽ Karibu kucheza! Nini unataka?'
      : 'Kila here! ⚽ Ready to play! What do you want?';
  }

  // Reset group flow (for testing)
  resetGroup(groupJid: string): void {
    this.groupFlows.delete(groupJid);
  }

  // Get all group flows (for debugging)
  getAllFlows(): Map<string, GroupFlow> {
    return this.groupFlows;
  }
}

export const chatFlowAnalyzer = new ChatFlowAnalyzer();
export default chatFlowAnalyzer;
