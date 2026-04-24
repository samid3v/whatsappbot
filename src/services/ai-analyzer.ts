import { GoogleGenerativeAI } from '@google/generative-ai';
import { userOps } from '../database/db';
import { formatJid } from '../utils/helpers';

// ==================== AI ANALYZER SERVICE ====================

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-3-flash-preview' });

interface MessageData {
  sender: string;
  text: string;
  timestamp?: Date;
}

class AIAnalyzer {
  // Detect active players from recent messages
  async detectActivePlayers(messages: MessageData[], limit: number = 5): Promise<string[]> {
    try {
      if (messages.length === 0) return [];

      const messageText = messages
        .map(m => `${m.sender}: ${m.text}`)
        .join('\n');

      const prompt = `
Analyze these group chat messages and identify the ${limit} most active/engaged players.
Look for who's talking the most, asking questions, or showing interest in gaming.

Messages:
${messageText}

Return ONLY a JSON array of player names/JIDs, like: ["player1", "player2", "player3"]
Do not include any other text.
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Extract JSON array
      const jsonMatch = responseText.match(/\[.*\]/s);
      if (jsonMatch) {
        const players = JSON.parse(jsonMatch[0]);
        return players.slice(0, limit);
      }
      return [];
    } catch (error) {
      console.error('Error detecting active players:', error);
      return [];
    }
  }

  // Parse tournament description in natural language
  async parseTournamentDescription(description: string): Promise<{
    name: string;
    type: 'se' | 'de' | 'rr' | 'rr2';
    max_players: number | null;
  }> {
    try {
      const prompt = `
Parse this tournament description and extract the details.
Return a JSON object with: name, type (se/de/rr/rr2), max_players

Description: "${description}"

Examples:
- "8 players knockout" → {"name": "Tournament", "type": "se", "max_players": 8}
- "league kwa 6 watu" → {"name": "League", "type": "rr", "max_players": 6}
- "double elim 4" → {"name": "Tournament", "type": "de", "max_players": 4}

Return ONLY valid JSON, no other text.
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text();
      
      // Extract JSON
      const jsonMatch = responseText.match(/\{.*\}/s);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          name: parsed.name || 'Tournament',
          type: parsed.type || 'se',
          max_players: parsed.max_players || null
        };
      }

      return { name: 'Tournament', type: 'se', max_players: null };
    } catch (error) {
      console.error('Error parsing tournament description:', error);
      return { name: 'Tournament', type: 'se', max_players: null };
    }
  }

  // Detect if link is safe (stream/game clip) or spam
  async detectLinkType(url: string, messageContext: string): Promise<'allow' | 'delete'> {
    try {
      const prompt = `
Analyze this link and message context. Determine if it's safe for a gaming group.

ALLOW if:
- YouTube/Twitch stream links
- Game clips or highlights
- Gaming content
- Legitimate gaming resources

DELETE if:
- Spam links
- Phishing attempts
- Suspicious URLs
- Non-gaming content

URL: ${url}
Message context: "${messageContext}"

Reply with ONLY one word: ALLOW or DELETE
      `;

      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim().toUpperCase();
      
      return responseText.includes('ALLOW') ? 'allow' : 'delete';
    } catch (error) {
      console.error('Error detecting link type:', error);
      return 'allow'; // Default to allow on error
    }
  }

  // Generate engagement message in Swahili
  async generateEngagementMessage(groupName: string): Promise<string> {
    try {
      const prompt = `
Generate a short, fun message in Swahili to encourage gaming in the group "${groupName}".
Keep it under 50 words.
Include an emoji.
Make it casual and friendly.

Examples:
- "Karibu wote! Tunataka tournament leo? 🎮"
- "Hii ni saa ya kucheza! Nani anataka friendly match? ⚽"

Generate a unique message:
      `;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Error generating engagement message:', error);
      return '🎮 Karibu wote! Tunataka kucheza?';
    }
  }

  // Analyze player activity level
  async analyzePlayerActivity(playerJid: string, recentMatches: any[]): Promise<string> {
    try {
      if (recentMatches.length === 0) {
        return 'Inactive';
      }

      const matchCount = recentMatches.length;
      const wins = recentMatches.filter(m => m.winner_jid === playerJid).length;
      const winRate = matchCount > 0 ? Math.round((wins / matchCount) * 100) : 0;

      const prompt = `
Analyze this player's activity level based on their stats.
Return one of: Very Active, Active, Moderate, Inactive

Matches played: ${matchCount}
Wins: ${wins}
Win rate: ${winRate}%

Return ONLY the activity level, nothing else.
      `;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Error analyzing player activity:', error);
      return 'Moderate';
    }
  }

  // Generate match prediction
  async predictMatchWinner(player1: string, player1Stats: any, player2: string, player2Stats: any): Promise<string> {
    try {
      const prompt = `
Predict who will win this eFootball match based on their stats.
Be brief and fun.

${player1}:
- Wins: ${player1Stats.wins}
- Losses: ${player1Stats.losses}
- Win rate: ${player1Stats.winRate}%
- Goals for: ${player1Stats.goalsFor}

${player2}:
- Wins: ${player2Stats.wins}
- Losses: ${player2Stats.losses}
- Win rate: ${player2Stats.winRate}%
- Goals for: ${player2Stats.goalsFor}

Predict the winner and give a brief reason (max 30 words).
      `;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Error predicting match:', error);
      return 'Too close to call! 🎮';
    }
  }

  // Suggest tournament bracket type
  async suggestBracketType(playerCount: number, description?: string): Promise<'se' | 'de' | 'rr'> {
    try {
      const prompt = `
Suggest the best tournament bracket type for ${playerCount} players.
${description ? `Context: ${description}` : ''}

Options:
- se (Single Elimination) - Best for 4, 8, 16, 32, 64 players
- de (Double Elimination) - Best for any number, more matches
- rr (Round Robin) - Best for 4-8 players, everyone plays everyone

Return ONLY one: se, de, or rr
      `;

      const result = await model.generateContent(prompt);
      const response = result.response.text().trim().toLowerCase();
      
      if (response.includes('de')) return 'de';
      if (response.includes('rr')) return 'rr';
      return 'se';
    } catch (error) {
      console.error('Error suggesting bracket type:', error);
      return 'se';
    }
  }

  // Generate tournament announcement
  async generateTournamentAnnouncement(tournamentName: string, type: string, maxPlayers: number): Promise<string> {
    try {
      const typeNames: Record<string, string> = {
        se: 'Knockout',
        de: 'Double Elimination',
        rr: 'League',
        rr2: 'League (2 Legs)'
      };

      const prompt = `
Generate an exciting tournament announcement in Swahili.
Keep it under 100 words.
Include emojis.

Tournament: ${tournamentName}
Type: ${typeNames[type] || type}
Max Players: ${maxPlayers}

Make it engaging and encourage people to join!
      `;

      const result = await model.generateContent(prompt);
      return result.response.text().trim();
    } catch (error) {
      console.error('Error generating tournament announcement:', error);
      return `🏆 ${tournamentName} tournament is open! Join now! 🎮`;
    }
  }
}

export const aiAnalyzer = new AIAnalyzer();
export default aiAnalyzer;
