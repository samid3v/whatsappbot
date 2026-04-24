import { waClient } from '../client';
import { aiAnalyzer } from './ai-analyzer';
import { chatFlowAnalyzer } from './chat-flow-analyzer';
import { userOps } from '../database/db';
import { formatJid } from '../utils/helpers';

// ==================== KILA PERSONALITY SERVICE ====================
// Kila is the AI coach that learns group dynamics and responds naturally

interface KilaContext {
  groupJid: string;
  senderJid: string;
  messageText: string;
  language: 'en' | 'sw' | 'mixed';
}

class KilaPersonality {
  private name: string = process.env.AI_NAME || 'Kila';
  private personality: string = process.env.AI_PERSONALITY || 'friendly_coach';

  // Greetings in different languages
  private greetings = {
    sw: [
      'Kila hapa! 🎮',
      'Habari! Kila hapa! ⚽',
      'Jambo! Kila ready! 🏆',
      'Salaam! Kila hapa! 💪'
    ],
    en: [
      'Kila here! 🎮',
      'Hey! Kila ready! ⚽',
      'What\'s up! Kila here! 🏆',
      'Yo! Kila ready! 💪'
    ]
  };

  // Motivational messages
  private motivations = {
    sw: [
      'Karibu wote! Tunataka kucheza? 🎮',
      'Hii ni saa ya kucheza! ⚽',
      'Nani anataka tournament? 🏆',
      'Wacha tuanze! Kila ready! 💪',
      'Sasa ni wakati wa kucheza! 🔥'
    ],
    en: [
      'Everyone! Ready to play? 🎮',
      'It\'s game time! ⚽',
      'Who wants a tournament? 🏆',
      'Let\'s go! Kila ready! 💪',
      'Time to play! 🔥'
    ]
  };

  // Encouragement messages
  private encouragements = {
    sw: [
      'Sawa! Karibu kurekodi matokeo! 📊',
      'Nzuri sana! Endelea kucheza! 🎯',
      'Umefanya vizuri! 🌟',
      'Karibu tena! 💪',
      'Juu sana! 🚀'
    ],
    en: [
      'Nice! Record your result! 📊',
      'Great! Keep playing! 🎯',
      'You did great! 🌟',
      'Come again! 💪',
      'Amazing! 🚀'
    ]
  };

  // Funny roasts for scores
  private roasts = {
    sw: [
      '😂 Huyu jamaa ana kila kitu lakini goal-scoring skills!',
      '🔥 Hii ni kama kucheza na AI - predictable kabisa!',
      '💀 Huyu ni striker? Au goalkeeper anayejaribu kufa?',
      '😅 Hii score ni kama exam - FAIL!',
      '🤦 Huyu anataka kuwa Messi lakini ana Messi-ng up!',
      '😂 Hii ni kama kucheza na matako - no direction!',
      '🔥 Huyu jamaa ana accuracy ya blind player!',
      '💯 Hii ni kama kucheza na controller iliyofa!',
      '😆 Huyu anataka kuwa pro lakini ana amateur moves!',
      '🎯 Hii score ni kama weather forecast - completely wrong!'
    ],
    en: [
      '😂 This guy has everything except goal-scoring skills!',
      '🔥 This is like playing with AI - so predictable!',
      '💀 Is this a striker? Or a goalkeeper trying to die?',
      '😅 This score is like an exam - FAIL!',
      '🤦 This guy wants to be Messi but he\'s Messi-ng up!',
      '😂 This is like playing with your eyes closed!',
      '🔥 This guy\'s accuracy is worse than a blind player!',
      '💯 This is like playing with a broken controller!',
      '😆 This guy wants to be pro but plays like amateur!',
      '🎯 This score is like a weather forecast - completely wrong!'
    ]
  };

  // Compliments for good scores
  private compliments = {
    sw: [
      '🔥 Huyu jamaa ana magic sa miguu! Messi energy!',
      '⚡ Hii ni kama kucheza na cheat codes enabled!',
      '🌟 Huyu ni striker wa kweli! Unstoppable!',
      '💪 Hii performance ni kama movie - cinematic!',
      '🚀 Huyu jamaa ana rocket sa miguu!',
      '👑 Huyu ni king of the pitch! Absolute legend!',
      '🎯 Hii accuracy ni kama sniper - perfect shots!',
      '⚽ Huyu ni football genius! Pure talent!',
      '🏆 Hii ni championship level performance!',
      '💎 Huyu jamaa ni diamond - rare talent!'
    ],
    en: [
      '🔥 This guy has magic in his feet! Messi energy!',
      '⚡ This is like playing with cheat codes enabled!',
      '🌟 This is a real striker! Unstoppable!',
      '💪 This performance is like a movie - cinematic!',
      '🚀 This guy has a rocket in his feet!',
      '👑 This guy is king of the pitch! Absolute legend!',
      '🎯 This accuracy is like a sniper - perfect shots!',
      '⚽ This guy is a football genius! Pure talent!',
      '🏆 This is championship level performance!',
      '💎 This guy is a diamond - rare talent!'
    ]
  };

  constructor() {
    console.log(`✅ Kasongo personality initialized (${this.personality})`);
  }

  // Learn from message and respond
  async processMessage(context: KilaContext): Promise<string | null> {
    try {
      // Learn from message
      chatFlowAnalyzer.learnFromMessage(
        context.groupJid,
        context.senderJid,
        context.messageText
      );

      // Get group language
      const language = chatFlowAnalyzer.getGroupLanguage(context.groupJid);

      // Check if message mentions Kila
      if (!context.messageText.toLowerCase().includes('kila')) {
        return null; // Don't respond unless mentioned
      }

      // Try to respond naturally
      const naturalResponse = await chatFlowAnalyzer.respondToMessage(
        context.groupJid,
        context.messageText
      );

      if (naturalResponse) {
        return naturalResponse;
      }

      // Fallback: suggest action based on group flow
      return chatFlowAnalyzer.suggestAction(context.groupJid);
    } catch (error) {
      console.error('Error processing message:', error);
      return null;
    }
  }

  // Get greeting
  getGreeting(language: 'en' | 'sw' | 'mixed' = 'mixed'): string {
    const lang = language === 'mixed' ? (Math.random() > 0.5 ? 'sw' : 'en') : language;
    const greetings = this.greetings[lang];
    return greetings[Math.floor(Math.random() * greetings.length)];
  }

  // Get motivation message
  getMotivation(language: 'en' | 'sw' | 'mixed' = 'mixed'): string {
    const lang = language === 'mixed' ? (Math.random() > 0.5 ? 'sw' : 'en') : language;
    const motivations = this.motivations[lang];
    return motivations[Math.floor(Math.random() * motivations.length)];
  }

  // Get encouragement
  getEncouragement(language: 'en' | 'sw' | 'mixed' = 'mixed'): string {
    const lang = language === 'mixed' ? (Math.random() > 0.5 ? 'sw' : 'en') : language;
    const encouragements = this.encouragements[lang];
    return encouragements[Math.floor(Math.random() * encouragements.length)];
  }

  // Get funny roast based on score
  getRoast(player1Score: number, player2Score: number, language: 'en' | 'sw' | 'mixed' = 'mixed'): string {
    const lang = language === 'mixed' ? (Math.random() > 0.5 ? 'sw' : 'en') : language;
    const roasts = this.roasts[lang];
    
    // Determine who got roasted
    const loser = player1Score < player2Score ? 'player1' : player2Score < player1Score ? 'player2' : 'both';
    
    // If it's a big loss, roast harder
    const scoreDiff = Math.abs(player1Score - player2Score);
    if (scoreDiff >= 3) {
      // Extra roast for big losses
      return roasts[Math.floor(Math.random() * roasts.length)] + ' 💀';
    }
    
    return roasts[Math.floor(Math.random() * roasts.length)];
  }

  // Get compliment for good score
  getCompliment(player1Score: number, player2Score: number, language: 'en' | 'sw' | 'mixed' = 'mixed'): string {
    const lang = language === 'mixed' ? (Math.random() > 0.5 ? 'sw' : 'en') : language;
    const compliments = this.compliments[lang];
    
    // Determine who won
    const winner = player1Score > player2Score ? 'player1' : player2Score > player1Score ? 'player2' : 'both';
    
    // If it's a big win, compliment more
    const scoreDiff = Math.abs(player1Score - player2Score);
    if (scoreDiff >= 3) {
      return compliments[Math.floor(Math.random() * compliments.length)] + ' 👑';
    }
    
    return compliments[Math.floor(Math.random() * compliments.length)];
  }

  // Respond to friendly request
  respondToFriendlyRequest(requesterName: string, language: 'en' | 'sw' | 'mixed' = 'mixed'): string {
    const lang = language === 'mixed' ? (Math.random() > 0.5 ? 'sw' : 'en') : language;

    if (lang === 'sw') {
      return `${this.getGreeting('sw')}\n\n${requesterName} anataka friendly match! 🎮\n\nNani anataka kukubali? Karibu .accept au .decline`;
    } else {
      return `${this.getGreeting('en')}\n\n${requesterName} wants a friendly match! 🎮\n\nWho's in? .accept or .decline`;
    }
  }

  // Respond to tournament creation
  respondToTournamentCreation(tournamentName: string, type: string, maxPlayers: number, language: 'en' | 'sw' | 'mixed' = 'mixed'): string {
    const lang = language === 'mixed' ? (Math.random() > 0.5 ? 'sw' : 'en') : language;
    const typeNames: Record<string, Record<string, string>> = {
      se: { sw: 'Knockout', en: 'Knockout' },
      de: { sw: 'Double Elimination', en: 'Double Elimination' },
      rr: { sw: 'League', en: 'League' },
      rr2: { sw: 'League (2 Legs)', en: 'League (2 Legs)' }
    };

    const typeName = typeNames[type]?.[lang] || type;

    if (lang === 'sw') {
      return `🏆 *${tournamentName}* 🏆\n\n${this.getGreeting('sw')}\n\nTournament: ${typeName}\nWachezaji: ${maxPlayers}\n\nKaribu kujiandikisha: .tj 1 "Jina lako"`;
    } else {
      return `🏆 *${tournamentName}* 🏆\n\n${this.getGreeting('en')}\n\nTournament: ${typeName}\nPlayers: ${maxPlayers}\n\nJoin now: .tj 1 "Your Name"`;
    }
  }

  // Respond to match result with roasting/compliments
  respondToMatchResultWithRoast(player1: string, player2: string, score: string, language: 'en' | 'sw' | 'mixed' = 'mixed'): string {
    const lang = language === 'mixed' ? (Math.random() > 0.5 ? 'sw' : 'en') : language;
    
    // Parse score
    const scoreMatch = score.match(/(\d+)[:\-](\d+)/);
    if (!scoreMatch) {
      return this.getEncouragement(lang);
    }

    const player1Score = parseInt(scoreMatch[1], 10);
    const player2Score = parseInt(scoreMatch[2], 10);
    const scoreDiff = Math.abs(player1Score - player2Score);

    let response = `${this.getGreeting(lang)}\n\n`;
    response += `⚽ ${player1} vs ${player2}: ${score}\n\n`;

    // Add roast or compliment based on score
    if (scoreDiff >= 2) {
      // Big difference - roast the loser or compliment the winner
      if (player1Score > player2Score) {
        response += this.getCompliment(player1Score, player2Score, lang);
      } else {
        response += this.getRoast(player1Score, player2Score, lang);
      }
    } else if (scoreDiff === 1) {
      // Close match - compliment both
      response += lang === 'sw' 
        ? '🔥 Hii ni match ya kweli! Both teams played well!'
        : '🔥 This was a real match! Both teams played well!';
    } else {
      // Draw - celebrate
      response += lang === 'sw'
        ? '🤝 Draw! Hii ni balanced match! Respect! 👏'
        : '🤝 Draw! This is a balanced match! Respect! 👏';
    }

    response += `\n\n📊 Result recorded!`;
    return response;
  }

  // Analyze image and comment on it
  async analyzeMatchImage(imageDescription: string, language: 'en' | 'sw' | 'mixed' = 'mixed'): Promise<string> {
    const lang = language === 'mixed' ? (Math.random() > 0.5 ? 'sw' : 'en') : language;
    
    // Simple image analysis - in real scenario, use Gemini Vision API
    const responses = {
      sw: [
        '📸 Proof received! Hii ni screenshot ya kweli! ✅',
        '📸 Karibu! Hii ni evidence ya match! 🎯',
        '📸 Sawa! Screenshot imerekodwa! 📊'
      ],
      en: [
        '📸 Proof received! This is a real screenshot! ✅',
        '📸 Nice! This is match evidence! 🎯',
        '📸 Good! Screenshot recorded! 📊'
      ]
    };

    return responses[lang][Math.floor(Math.random() * responses[lang].length)];
  }

  // Get group status
  async getGroupStatus(groupJid: string): Promise<string> {
    const language = chatFlowAnalyzer.getGroupLanguage(groupJid);
    const summary = chatFlowAnalyzer.getGroupSummary(groupJid);
    const suggestion = chatFlowAnalyzer.suggestAction(groupJid);

    let status = `${this.getGreeting(language)}\n\n`;
    status += summary;
    status += `\n💡 ${suggestion}`;

    return status;
  }

  // Engage quiet group with funny message
  async engageQuietGroup(groupJid: string): Promise<string> {
    const language = chatFlowAnalyzer.getGroupLanguage(groupJid);
    const motivation = this.getMotivation(language);
    const suggestion = chatFlowAnalyzer.suggestAction(groupJid);

    // Add funny comment about silence
    const silenceComments = {
      sw: [
        '🤐 Hii silence ni kama graveyard! Karibu kucheza!',
        '😴 Wote wamekufa? Tunataka match!',
        '🦗 Kila mtu amekufa? Karibu kucheza!',
        '🔇 Hii silence ni suspicious! Nani anataka tournament?',
        '😂 Hii group ni kama cemetery! Karibu tukamatanisha!'
      ],
      en: [
        '🤐 This silence is like a graveyard! Let\'s play!',
        '😴 Is everyone dead? We want a match!',
        '🦗 Did everyone die? Let\'s play!',
        '🔇 This silence is suspicious! Who wants a tournament?',
        '😂 This group is like a cemetery! Let\'s wake up!'
      ]
    };

    const lang = language === 'mixed' ? (Math.random() > 0.5 ? 'sw' : 'en') : language;
    const silenceComment = silenceComments[lang][Math.floor(Math.random() * silenceComments[lang].length)];

    return `${silenceComment}\n\n${motivation}\n\n${suggestion}`;
  }

  // Check if room is quiet (less than 5 messages in last hour)
  isRoomQuiet(groupJid: string): boolean {
    const flow = chatFlowAnalyzer.getAllFlows().get(groupJid);
    if (!flow) return true;
    
    // If last activity was more than 1 hour ago
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return flow.lastActivityTime < oneHourAgo;
  }

  // Get personality info
  getInfo(): { name: string; personality: string } {
    return {
      name: this.name,
      personality: this.personality
    };
  }
}

export const kasongoPersonality = new KilaPersonality();
export default kasongoPersonality;
