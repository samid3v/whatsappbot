import { waClient } from '../client';
import { chatFlowAnalyzer } from './chat-flow-analyzer';
import { userOps, tournamentOps } from '../database/db';
import { formatJid } from '../utils/helpers';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getAllCommands, getCommand } from '../handlers/commands';
import { CommandContext } from '../types';

// ==================== KASONGO PERSONALITY SERVICE ====================
// Kasongo is an intelligent AI assistant that:
// - Understands user intent from natural language
// - Executes commands directly
// - Asks for missing data intelligently
// - Learns from conversations
// - Feels natural and creative

interface KilaContext {
  groupJid: string;
  senderJid: string;
  messageText: string;
  language: 'en' | 'sw' | 'mixed';
}

// Conversation memory per user
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

class KilaPersonality {
  private name: string = 'Kasongo';
  private creator: string = 'Mido D3V';

  constructor() {
    console.log(`✅ Kasongo assistant initialized`);
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

      // Check if message mentions Kasongo
      if (!context.messageText.toLowerCase().includes('kasongo')) {
        return null;
      }

      const userMessage = context.messageText.toLowerCase().replace('kasongo', '').trim();
      
      // Get conversation state
      const state = this.getConversationState(context.senderJid);

      // If we're waiting for data and user provided it, process it
      if (state.awaitingData && userMessage) {
        return await this.processUserData(context, state, userMessage);
      }

      // Otherwise, understand user intent and execute
      return await this.understandAndExecute(context, state, userMessage);
    } catch (error) {
      console.error('Error processing Kasongo message:', error);
      return null;
    }
  }

  // Get or create conversation state
  private getConversationState(senderJid: string): ConversationState {
    const existing = conversationMemory.get(senderJid);
    
    // Check if memory expired
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

  // Understand user intent and execute command
  private async understandAndExecute(
    context: KilaContext,
    state: ConversationState,
    userMessage: string
  ): Promise<string | null> {
    try {
      // Get all available commands
      const commands = getAllCommands();
      const commandsList = commands
        .map(cmd => `${cmd.name}: ${cmd.description}`)
        .join('\n');

      // Use AI to understand intent and generate command
      const prompt = `You are Kasongo, an eFootball gaming assistant. Analyze what the user wants and generate the appropriate command to execute.

AVAILABLE COMMANDS:
${commandsList}

USER MESSAGE: "${userMessage}"

TASK:
1. Understand what the user wants
2. Identify the best command to execute
3. Generate the command with proper arguments
4. If you need more info from user, ask naturally

RESPONSE FORMAT:
If you can execute immediately, respond with:
EXECUTE: [command_name] [args]

If you need more info, ask naturally (1-2 sentences max):
ASK: [your question]

Examples:
- User: "show me leaderboard" → EXECUTE: pvplb
- User: "record my match" → ASK: What was the score? (e.g., 3:1)
- User: "create tournament" → ASK: What's the tournament name?
- User: "i want to play" → ASK: Want a friendly match or tournament?

Respond as Kasongo:`;

      const result = await model.generateContent(prompt);
      let response = result.response.text().trim();

      // Parse response
      if (response.startsWith('EXECUTE:')) {
        // Extract command and args
        const commandPart = response.replace('EXECUTE:', '').trim();
        const parts = commandPart.split(/\s+/);
        const cmdName = parts[0];
        const args = parts.slice(1);

        // Get command
        const cmd = getCommand(cmdName);
        if (cmd) {
          // Create command context
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
            // Execute command
            await cmd.execute(args, cmdContext);
            state.timestamp = Date.now();
            return null; // Command sends its own response
          } catch (error) {
            console.error('Error executing command:', error);
            return `Error executing command. Try again!`;
          }
        }
      } else if (response.startsWith('ASK:')) {
        // Extract question
        const question = response.replace('ASK:', '').trim();
        
        // Determine intent from message
        if (userMessage.includes('tournament')) {
          state.intent = 'tournament';
        } else if (userMessage.includes('friendly') || userMessage.includes('match')) {
          state.intent = 'friendly_match';
        } else if (userMessage.includes('leaderboard') || userMessage.includes('rank')) {
          state.intent = 'leaderboard';
        } else if (userMessage.includes('challenge')) {
          state.intent = 'challenge';
        } else if (userMessage.includes('score') || userMessage.includes('result')) {
          state.intent = 'record_score';
        }

        state.awaitingData = true;
        state.context = state.context || {};
        state.timestamp = Date.now();

        return question;
      }

      // Fallback: ask what user wants
      state.timestamp = Date.now();
      return `What would you like to do? I can help with tournaments, friendly matches, leaderboards, challenges, or recording scores!`;
    } catch (error) {
      console.error('Error understanding intent:', error);
      return `What would you like to do? I can help with tournaments, friendly matches, leaderboards, challenges, or recording scores!`;
    }
  }

  // Process user data for ongoing conversation
  private async processUserData(
    context: KilaContext,
    state: ConversationState,
    userInput: string
  ): Promise<string | null> {
    try {
      state.context = state.context || {};

      // Use AI to process the data and determine next step
      const prompt = `You are Kasongo. The user is providing data for their request.

INTENT: ${state.intent}
PREVIOUS DATA: ${JSON.stringify(state.context)}
USER INPUT: "${userInput}"

TASK:
1. Store the user input as data
2. Determine if you have enough info to execute a command
3. If yes, generate the command: EXECUTE: [command] [args]
4. If no, ask for next piece of info: ASK: [question]

Examples:
- Intent: tournament, have name, need players → ASK: How many players?
- Intent: tournament, have name+players+type → EXECUTE: tcr "name" type players
- Intent: record_score, have score → EXECUTE: pvpscores me vs @opponent 3:1

Respond as Kasongo:`;

      const result = await model.generateContent(prompt);
      let response = result.response.text().trim();

      if (response.startsWith('EXECUTE:')) {
        // Extract and execute command
        const commandPart = response.replace('EXECUTE:', '').trim();
        const parts = commandPart.split(/\s+/);
        const cmdName = parts[0];
        const args = parts.slice(1);

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
            state.awaitingData = false;
            state.context = undefined;
            state.intent = undefined;
            state.timestamp = Date.now();
            return null;
          } catch (error) {
            console.error('Error executing command:', error);
            return `Error executing command. Try again!`;
          }
        }
      } else if (response.startsWith('ASK:')) {
        // Store data and ask next question
        state.context[`data_${Object.keys(state.context).length}`] = userInput;
        const question = response.replace('ASK:', '').trim();
        state.timestamp = Date.now();
        return question;
      }

      state.awaitingData = false;
      state.timestamp = Date.now();
      return null;
    } catch (error) {
      console.error('Error processing user data:', error);
      state.awaitingData = false;
      return `Error processing that. Try again!`;
    }
  }

  // Respond to match result with roasting/compliments (for .pvpscores command)
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
      personality: 'assistant',
      creator: this.creator
    };
  }

  // Get battery message (for rate limiting)
  getBatteryMessage(language?: 'en' | 'sw' | 'mixed'): string {
    const messages = [
      '🔋 Kasongo\'s battery is dead! See you tomorrow! 😴',
      '⚡ Oops! Kasongo has a power outage! Come back tomorrow! 🔌',
      '🪫 Kasongo\'s battery is 0%! See you tomorrow buddy! 😅',
      '💤 Kasongo is tired! See you tomorrow! Pole pole! 🛌',
      '🔴 Kasongo has a red light! See you tomorrow! 🚨',
      '⏰ Kasongo is taking a siesta! See you tomorrow! 😴',
      '🌙 Kasongo is sleeping now! See you tomorrow! 🌙',
      '🔋 Kasongo\'s battery is low! See you tomorrow! ⚠️'
    ];
    return messages[Math.floor(Math.random() * messages.length)];
  }
}

export const kasongoPersonality = new KilaPersonality();
export default kasongoPersonality;
