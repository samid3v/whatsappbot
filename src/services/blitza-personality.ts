import { chatFlowAnalyzer } from './chat-flow-analyzer';
import { formatJid } from '../utils/helpers';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAllCommands, getCommand } from '../handlers/commands';
import { CommandContext } from '../types';

// ==================== BLITZA PERSONALITY SERVICE ====================
// Blitza is a gaming AI personality that:
// - Talks like a gamer, not a robot
// - Executes commands when needed
// - Replies naturally and freely
// - Remembers conversations
// - Has personality and humor
// - Detects gaming keywords and engages naturally

interface KilaContext {
  groupJid: string;
  senderJid: string;
  messageText: string;
  language: 'en' | 'sw' | 'mixed';
  hasImage?: boolean;
}

interface ConversationState {
  intent?: string;
  context?: Record<string, any>;
  awaitingData?: boolean;
  dataNeeded?: string[];
  timestamp: number;
}

const conversationMemory = new Map<string, ConversationState>();
const MEMORY_TIMEOUT = 10 * 60 * 1000; // 10 minutes

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

class BlitzaPersonality {
  private name: string = 'Blitza';
  private creator: string = 'Mido D3V';

  constructor() {
    console.log(`✅ Blitza gaming AI initialized`);
  }

  // Main entry point
  async processMessage(context: KilaContext): Promise<string | null> {
    try {
      // Learn from message
      chatFlowAnalyzer.learnFromMessage(
        context.groupJid,
        context.senderJid,
        context.messageText
      );

      const userMessage = context.messageText.toLowerCase();
      const state = this.getConversationState(context.senderJid);

      // ONLY respond in these specific cases:
      const isMentionedAsBlitza = userMessage.includes('blitza');
      
      // Team/squad review: has image AND mentions squad/team/formation/lineup/analyze/review
      const isTeamReviewWithImage = (userMessage.includes('squad') || userMessage.includes('team') || userMessage.includes('formation') || userMessage.includes('lineup') || userMessage.includes('analyze') || userMessage.includes('review')) && context.hasImage;
      
      // Score review: has image AND (mentions score/result OR just has image with numbers like "3:1")
      const hasScorePattern = /\d+[:\-]\d+/.test(userMessage); // Matches patterns like "3:1" or "2-0"
      const isScoreReviewWithImage = context.hasImage && (userMessage.includes('score') || userMessage.includes('result') || userMessage.includes('review') || userMessage.includes('analyze') || hasScorePattern);
      
      const inConversation = state.awaitingData;

      // Don't respond to: friendly requests, "code", random keywords
      const shouldIgnore = userMessage.includes('friendly') || userMessage.includes('code') || userMessage.includes('anyone') || userMessage.includes('match') || userMessage.includes('play') || userMessage.includes('tournament') || userMessage.includes('request');

      // If it's a friendly/code/match request, don't respond
      if (shouldIgnore && !isMentionedAsBlitza && !isTeamReviewWithImage && !isScoreReviewWithImage) {
        console.log(`[Blitza] Ignoring message (friendly/code/match request)`);
        return null;
      }

      // Only respond if: mentioned as Blitza OR team review with image OR score review with image OR in conversation
      if (!isMentionedAsBlitza && !isTeamReviewWithImage && !isScoreReviewWithImage && !inConversation) {
        console.log(`[Blitza] Not responding (no trigger)`);
        return null;
      }

      // Clean message
      const cleanMessage = userMessage.replace('blitza', '').trim();

      // If waiting for data, process it
      if (state.awaitingData && cleanMessage) {
        return await this.processUserData(context, state, cleanMessage);
      }

      // Otherwise, respond naturally
      return await this.respondNaturally(context, state, cleanMessage);
    } catch (error) {
      console.error('Error processing Blitza message:', error);
      return null;
    }
  }

  // Get or create conversation state
  private getConversationState(senderJid: string): ConversationState {
    const existing = conversationMemory.get(senderJid);
    
    if (existing && Date.now() - existing.timestamp > MEMORY_TIMEOUT) {
      conversationMemory.delete(senderJid);
      return { timestamp: Date.now() };
    }

    if (existing) {
      return existing;
    }

    const newState: ConversationState = { timestamp: Date.now() };
    conversationMemory.set(senderJid, newState);
    return newState;
  }

  // Respond naturally - the core of Blitza's personality
  private async respondNaturally(
    context: KilaContext,
    state: ConversationState,
    userMessage: string
  ): Promise<string | null> {
    try {
      const commands = getAllCommands();
      const commandsList = commands
        .map(cmd => `${cmd.name}: ${cmd.description}`)
        .join('\n');

      const imageContext = context.hasImage ? '\n\nNOTE: User has attached an image. Analyze the squad/formation or match result shown in the image.' : '';

      const prompt = `You are Blitza, a professional eFootball tactical coach. You only respond when:
1. User mentions "Blitza" (any case)
2. User asks for squad/team/formation analysis WITH an image
3. User sends a match result image (with score like 3:1) or asks for review/analysis WITH an image
4. User asks you a direct question

AVAILABLE COMMANDS:
${commandsList}

USER MESSAGE: "${userMessage}"${imageContext}

CORE RULES - FOLLOW STRICTLY:
- ONLY respond to the specific triggers above
- NEVER respond to friendly requests, "code", "match", "play", "tournament", "anyone"
- Be concise and direct - no spam
- Provide tactical insights when analyzing squads or match results
- Suggest improvements for gaming
- Answer questions when asked
- Keep responses short (2-3 sentences max)

RESPONSE FORMAT:
Choose ONE:

EXECUTE: [command args]
→ Use ONLY if user clearly wants to run a command
→ Example: User says "show leaderboard" → EXECUTE: pvplb

ASK: [question]
→ Use ONLY if you need more info
→ Example: User says "analyze my squad" but no image → ASK: Can you share a screenshot?

REPLY: [natural response]
→ Use for everything else
→ Example: User says "how do I defend?" → REPLY: Focus on positioning and match-up defense.

EXAMPLES:
- User: "Blitza how do I improve?" → REPLY: Work on your positioning and defensive timing. Match-up defense is key.
- User: "analyze my squad" + image → REPLY: Your formation looks solid. Consider adjusting your midfield for better balance.
- User: "3:1" + image → REPLY: Good win! You controlled the match well. Work on your defensive positioning.
- User: "review this" + image → REPLY: Nice performance! Your tactics were solid.
- User: "friendly anyone" → (NO RESPONSE - ignore)
- User: "code" → (NO RESPONSE - ignore)

Respond as Blitza:`;

      const result = await model.generateContent(prompt);
      let response = result.response.text().trim();

      console.log(`[Blitza] Response: ${response.substring(0, 100)}...`);

      // Parse response - support all 3 types
      if (response.includes('EXECUTE:')) {
        return await this.executeCommand(context, state, response);
      } else if (response.includes('ASK:')) {
        return this.askQuestion(state, response);
      } else if (response.includes('REPLY:')) {
        return this.replyNaturally(state, response);
      }

      // Fallback - treat as natural reply
      return this.replyNaturally(state, `REPLY: ${response}`);
    } catch (error) {
      console.error('Error responding naturally:', error);
      return null;
    }
  }

  // Execute a command
  private async executeCommand(
    context: KilaContext,
    state: ConversationState,
    response: string
  ): Promise<string | null> {
    try {
      const executePart = response.split('EXECUTE:')[1].trim();
      const parts = executePart.split(/\s+/);
      const cmdName = parts[0];
      const args = parts.slice(1);

      console.log(`[Blitza] Executing: ${cmdName}`);

      const cmd = getCommand(cmdName);
      if (cmd) {
        const cmdContext: CommandContext = {
          jid: context.groupJid,
          name: context.senderJid.split('@')[0],
          isGroup: true,
          isAdmin: false,
          isOwner: false,
          isModerator: false,
          senderJid: context.senderJid,
          mentionedJids: [],
          hasImage: false
        };

        try {
          await cmd.execute(args, cmdContext);
          state.timestamp = Date.now();
          return null; // Command sends its own response
        } catch (error) {
          console.error('Error executing command:', error);
          return `Oops! Error running that. Try again! 🤖`;
        }
      }

      return null;
    } catch (error) {
      console.error('Error in executeCommand:', error);
      return null;
    }
  }

  // Ask a question
  private askQuestion(state: ConversationState, response: string): string {
    const askPart = response.split('ASK:')[1].trim();
    const question = askPart.split('\n')[0];

    state.awaitingData = true;
    state.context = state.context || {};
    state.timestamp = Date.now();

    console.log(`[Blitza] Asking: ${question}`);
    return question;
  }

  // Reply naturally
  private replyNaturally(state: ConversationState, response: string): string {
    const replyPart = response.split('REPLY:')[1].trim();
    state.timestamp = Date.now();

    console.log(`[Blitza] Replying: ${replyPart.substring(0, 100)}...`);
    return replyPart;
  }

  // Process user data for ongoing conversation
  private async processUserData(
    context: KilaContext,
    state: ConversationState,
    userInput: string
  ): Promise<string | null> {
    try {
      state.context = state.context || {};

      const commands = getAllCommands();
      const commandsList = commands
        .map(cmd => `${cmd.name}: ${cmd.description}`)
        .join('\n');

      const prompt = `You are Blitza. The user is providing data for their request.

AVAILABLE COMMANDS:
${commandsList}

PREVIOUS INTENT: ${state.intent}
PREVIOUS DATA: ${JSON.stringify(state.context)}
USER INPUT: "${userInput}"

RESPONSE FORMAT:
EXECUTE: [command args]
ASK: [next question]
REPLY: [natural response]

Think like a gamer buddy. Be natural and helpful.

Respond as Blitza:`;

      const result = await model.generateContent(prompt);
      let response = result.response.text().trim();

      if (response.includes('EXECUTE:')) {
        return await this.executeCommand(context, state, response);
      } else if (response.includes('ASK:')) {
        return this.askQuestion(state, response);
      } else if (response.includes('REPLY:')) {
        return this.replyNaturally(state, response);
      }

      state.awaitingData = false;
      state.timestamp = Date.now();
      return null;
    } catch (error) {
      console.error('Error processing user data:', error);
      state.awaitingData = false;
      return `Error processing that. Try again! 🤖`;
    }
  }

  // Respond to match result with roasting/compliments
  respondToMatchResultWithRoast(player1: string, player2: string, score: string): string {
    const scoreMatch = score.match(/(\d+)[:\-](\d+)/);
    if (!scoreMatch) {
      return `Match recorded: ${player1} vs ${player2} - ${score}`;
    }

    const player1Score = parseInt(scoreMatch[1], 10);
    const player2Score = parseInt(scoreMatch[2], 10);
    const scoreDiff = Math.abs(player1Score - player2Score);

    let response = `⚽ ${player1} vs ${player2}: ${score}\n\n`;

    if (scoreDiff >= 2) {
      if (player1Score > player2Score) {
        response += `🔥 ${player1} played like a legend! Unstoppable! 👑`;
      } else {
        response += `😂 ${player2} dominated! ${player1} needs practice! 💀`;
      }
    } else if (scoreDiff === 1) {
      response += `🔥 Close match! Both teams played well!`;
    } else {
      response += `🤝 Draw! Balanced match! Respect! 👏`;
    }

    response += `\n\n📊 Result recorded!`;
    return response;
  }

  // Check if room is quiet
  isRoomQuiet(groupJid: string): boolean {
    const flow = chatFlowAnalyzer.getAllFlows().get(groupJid);
    if (!flow) return true;
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return flow.lastActivityTime < oneHourAgo;
  }

  // Engage quiet group
  async engageQuietGroup(): Promise<string> {
    const silenceComments = [
      '🤐 This silence is like a graveyard! Let\'s play!',
      '😴 Is everyone dead? We want a match!',
      '🦗 Did everyone die? Let\'s play!',
      '🔇 This silence is suspicious! Who wants a tournament?',
      '😂 This group is like a cemetery! Let\'s wake up!'
    ];

    const comment = silenceComments[Math.floor(Math.random() * silenceComments.length)];
    return `${comment}\n\nReady to play? Use .request for friendly or .tcr to create tournament!`;
  }

  // Welcome new user to group with proper tagging
  async welcomeNewUser(groupJid: string, newUserJid: string, newUserName: string): Promise<{ message: string; mentionedJids: string[] } | null> {
    try {
      console.log(`[Blitza] Welcoming new user: ${newUserName} (${newUserJid})`);

      // Get frequent gamers from chat flow
      const flow = chatFlowAnalyzer.getAllFlows().get(groupJid);
      console.log(`[Blitza] Chat flow exists: ${!!flow}, active users: ${flow?.activeUsers.size || 0}`);

      // Get top 5 active players (excluding the new user)
      let activePlayersList: string[] = [];
      if (flow && flow.activeUsers.size > 0) {
        activePlayersList = Array.from(flow.activeUsers)
          .filter(jid => jid !== newUserJid)
          .slice(0, 5);
      }

      console.log(`[Blitza] Active players to tag: ${activePlayersList.length}`);

      let playerMentions = '';
      if (activePlayersList.length > 0) {
        playerMentions = activePlayersList.map(jid => `@${formatJid(jid)}`).join(' ');
        console.log(`[Blitza] Player mentions: ${playerMentions}`);
      }

      // Use AI to generate creative welcome message
      const prompt = `You are Blitza, a professional gaming coach. A new player just joined the group!

NEW PLAYER: ${newUserName}
${playerMentions ? `ACTIVE GAMERS TO TAG: ${playerMentions}` : 'NO ACTIVE GAMERS YET'}

Create a warm, welcoming message that:
- Welcomes the newbie in a friendly, encouraging way
${playerMentions ? `- Tags the active gamers: ${playerMentions} to play friendly matches with them` : '- Encourage them to start playing and making friends'}
- Makes it exciting and engaging
- Be supportive and helpful - no roasting or mocking
- Keep it short (2-3 sentences max)
- Can use emojis

Examples of tone:
${playerMentions ? `- "Welcome to the squad! 🎮 ${playerMentions} - let's get some friendly matches going and show them the ropes!"` : `- "Welcome to the squad! � Let's get you into some games and show you what we're about!"`}

Respond as Blitza (just the message, no formatting):`;

      console.log(`[Blitza] Generating welcome message...`);
      const result = await model.generateContent(prompt);
      let message = result.response.text().trim();

      console.log(`[Blitza] Generated message: ${message}`);

      // Replace placeholder with actual mentions if any
      if (playerMentions) {
        message = message.replace(/\$\{playerMentions\}/g, playerMentions);
      }

      console.log(`[Blitza] Final welcome message: ${message}`);
      
      return {
        message,
        mentionedJids: activePlayersList
      };
    } catch (error) {
      console.error('[Blitza] Error welcoming new user:', error);
      return null;
    }
  }

  // Get personality info
  getInfo(): { name: string; personality: string; creator: string } {
    return {
      name: this.name,
      personality: 'gaming_ai',
      creator: this.creator
    };
  }

  // Get battery message (for rate limiting)
  getBatteryMessage(): string {
    const messages = [
      '🔋 Blitza\'s battery is dead! See you tomorrow! 😴',
      '⚡ Oops! Blitza has a power outage! Come back tomorrow! 🔌',
      '🪫 Blitza\'s battery is 0%! See you tomorrow buddy! 😅',
      '💤 Blitza is tired! See you tomorrow! Pole pole! 🛌',
      '🔴 Blitza has a red light! See you tomorrow! 🚨',
      '⏰ Blitza is taking a siesta! See you tomorrow! 😴',
      '🌙 Blitza is sleeping now! See you tomorrow! 🌙',
      '🔋 Blitza\'s battery is low! See you tomorrow! ⚠️'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
}

export const blitzaPersonality = new BlitzaPersonality();
export default blitzaPersonality;
