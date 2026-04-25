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

// Gaming keywords that trigger Blitza
const GAMING_KEYWORDS = [
  'friendly', 'match', 'play', 'tournament', 'code', 'anyone', 'challenge',
  'kucheza', 'mchezo', 'tournament', 'request', 'accept', 'decline',
  'leaderboard', 'stats', 'score', 'win', 'lose', 'game',
  'squad', 'team', 'formation', 'tactics', 'analyze', 'review', 'lineup'
];

// Response frequency control
const RESPONSE_COOLDOWN = 30000; // 30 seconds between responses per user
const KEYWORD_RESPONSE_CHANCE = 0.4; // 40% chance to respond to keywords (not mentioned)
const userLastResponseTime = new Map<string, number>();

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

      // Check if Blitza is mentioned OR user is in active conversation OR message has gaming keywords
      const isMentioned = userMessage.includes('blitza');
      const inConversation = state.awaitingData;
      const hasGamingKeyword = GAMING_KEYWORDS.some(keyword => userMessage.includes(keyword));

      // If not mentioned and not in conversation, apply frequency limiting
      if (!isMentioned && !inConversation && hasGamingKeyword) {
        // Check if we've responded recently to this user
        const lastResponse = userLastResponseTime.get(context.senderJid) || 0;
        const timeSinceLastResponse = Date.now() - lastResponse;

        // Only respond if enough time has passed AND random chance succeeds
        if (timeSinceLastResponse < RESPONSE_COOLDOWN || Math.random() > KEYWORD_RESPONSE_CHANCE) {
          console.log(`[Blitza] Skipping response (cooldown or chance failed)`);
          return null;
        }

        // Update last response time
        userLastResponseTime.set(context.senderJid, Date.now());
      }

      if (!isMentioned && !inConversation && !hasGamingKeyword) {
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

      const imageContext = context.hasImage ? '\n\nNOTE: User has attached an image. If they ask about squad analysis, formation, or lineup review, acknowledge the image and provide tactical insights.' : '';

      const prompt = `You are Blitza, a professional eFootball gaming assistant and tactical coach. Your role is to help players improve and have fun.

AVAILABLE COMMANDS:
${commandsList}

USER MESSAGE: "${userMessage}"${imageContext}

CORE RULES - FOLLOW STRICTLY:
- NEVER roast or mock players - be encouraging instead
- NEVER make fun of new players - welcome them warmly
- Be professional, helpful, and supportive
- Provide tactical insights and coaching advice
- Use casual, friendly language but stay constructive
- Think like a mentor/coach, not a comedian
- Keep responses short and focused

RESPONSE FORMAT:
Choose ONE:

EXECUTE: [command args]
→ Use when user clearly wants to run a command
→ Example: User says "show leaderboard" → EXECUTE: pvplb

ASK: [question]
→ Use when you need more info to help
→ Example: User says "analyze my squad" → ASK: Can you share a screenshot of your squad?

REPLY: [natural response]
→ Use for everything else - advice, guidance, questions
→ Example: User says "how do I defend?" → REPLY: Focus on positioning and match-up defense. Hold your line and let the AI handle tackles.

EXAMPLES:
- User: "anyone?" → REPLY: Let's go! Use .request to find an opponent or drop your code and I'll tag active players
- User: "new player joined" → REPLY: Welcome to the squad! 🎮 Check out .help to see what you can do
- User: "analyze my squad" → ASK: Can you share a screenshot of your squad? I'll give you tactical insights
- User: "a2me code" → REPLY: Drop your code and I'll tag some active players to join!
- User: "tournament" → ASK: What's the tournament name?
- User: "show me rankings" → EXECUTE: pvplb

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
