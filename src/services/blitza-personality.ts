import { waClient } from '../client';
import { chatFlowAnalyzer } from './chat-flow-analyzer';
import { userOps, tournamentOps } from '../database/db';
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

interface KilaContext {
  groupJid: string;
  senderJid: string;
  messageText: string;
  language: 'en' | 'sw' | 'mixed';
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

      // Check if Blitza is mentioned OR user is in active conversation
      const isMentioned = userMessage.includes('blitza');
      const inConversation = state.awaitingData;

      if (!isMentioned && !inConversation) {
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

      const prompt = `You are Blitza, a smart, fun eFootball gaming assistant. You're like a gamer friend who helps with tournaments, matches, and stats.

AVAILABLE COMMANDS:
${commandsList}

USER MESSAGE: "${userMessage}"

PERSONALITY:
- Talk like a gamer (casual, confident, slight humor)
- Sometimes roast players lightly (but friendly)
- Be short and natural, not robotic
- Can mix casual English with a bit of Swahili if needed
- Think like a gaming buddy, not a bot

RESPONSE FORMAT:
Choose ONE:

EXECUTE: [command args]
→ Use when user clearly wants to run a command
→ Example: User says "show leaderboard" → EXECUTE: pvplb

ASK: [question]
→ Use when you need more info to help
→ Example: User says "create tournament" → ASK: What's the tournament name?

REPLY: [natural response]
→ Use for everything else - advice, jokes, guidance, questions
→ Example: User says "how do I defend?" → REPLY: 😂 You're probably rushing tackles. Try holding position instead.

EXAMPLES:
- User: "how do I stop losing" → REPLY: 😂 You're probably rushing everything. Slow down, defend first. Try match-up instead of spamming tackles. Want some tactics?
- User: "I want tournament" → ASK: Nice 🔥 What's the tournament name?
- User: "show me rankings" → EXECUTE: pvplb
- User: "record my match" → ASK: What was the score? (e.g., 3:1)
- User: "friendly match" → EXECUTE: request
- User: "how's the group doing" → REPLY: Let me check... (then give insights)

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
  respondToMatchResultWithRoast(player1: string, player2: string, score: string, language?: 'en' | 'sw' | 'mixed'): string {
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
  async engageQuietGroup(groupJid: string): Promise<string> {
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

  // Get personality info
  getInfo(): { name: string; personality: string; creator: string } {
    return {
      name: this.name,
      personality: 'gaming_ai',
      creator: this.creator
    };
  }

  // Get battery message (for rate limiting)
  getBatteryMessage(language?: 'en' | 'sw' | 'mixed'): string {
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

  // Welcome new user to group
  async welcomeNewUser(groupJid: string, newUserJid: string, newUserName: string): Promise<string | null> {
    try {
      // Get frequent gamers from chat flow
      const flow = chatFlowAnalyzer.getAllFlows().get(groupJid);
      if (!flow || flow.activeUsers.size === 0) {
        return null;
      }

      // Get top 5 active players (excluding the new user)
      const activePlayersList = Array.from(flow.activeUsers)
        .filter(jid => jid !== newUserJid)
        .slice(0, 5);

      if (activePlayersList.length === 0) {
        return null;
      }

      const playerMentions = activePlayersList.map(jid => `@${formatJid(jid)}`).join(' ');

      // Use AI to generate creative welcome message
      const prompt = `You are Blitza, a fun gaming AI. A new player just joined the group!

NEW PLAYER: ${newUserName}
ACTIVE GAMERS TO TAG: ${playerMentions}

Create a fun, engaging welcome message that:
- Welcomes the newbie in a fun way (can roast them lightly, joke about them being new)
- Tags the active gamers to play friendly matches with them
- Makes it exciting and engaging
- Be creative and funny - don't be robotic
- Keep it short (2-3 sentences max)
- Can use emojis

Examples of tone:
- "Fresh meat! 🔥 ${playerMentions} - we got a newbie to cook! Let's show them what real eFootball looks like 😂"
- "Yo! New player alert! 🎮 ${playerMentions} - time to test this newbie's skills. Friendly matches incoming! 💪"
- "Welcome to the arena! 🏆 ${playerMentions} - let's give our newbie a proper welcome... with some friendly roasting 😂"

Respond as Blitza (just the message, no formatting):`;

      const result = await model.generateContent(prompt);
      let message = result.response.text().trim();

      // Replace placeholder with actual mentions
      message = message.replace(/\$\{playerMentions\}/g, playerMentions);

      console.log(`[Blitza] Welcoming new user: ${newUserName}`);
      return message;
    } catch (error) {
      console.error('Error welcoming new user:', error);
      return null;
    }
  }
}

export const blitzaPersonality = new BlitzaPersonality();
export default blitzaPersonality;
