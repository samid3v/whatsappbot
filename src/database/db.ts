// Simple JSON file-based database (no native modules needed)
import * as fs from 'fs';
import * as path from 'path';

interface DatabaseData {
  users: any[];
  player_stats: any[];
  tournaments: any[];
  tournament_participants: any[];
  tournament_matches: any[];
  scheduled_matches: any[];
  polls: any[];
  daily_challenges: any[];
  challenge_submissions: any[];
  settings: any[];
  logs: any[];
}

const dataPath = path.join(__dirname, '../../data');
const dbPath = path.join(dataPath, 'bot.json');

// Ensure data directory exists
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}

// Load or create database
function loadDatabase(): DatabaseData {
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf-8');
      return JSON.parse(data);
    } catch {
      return createEmptyDatabase();
    }
  }
  return createEmptyDatabase();
}

function createEmptyDatabase(): DatabaseData {
  return {
    users: [],
    player_stats: [],
    tournaments: [],
    tournament_participants: [],
    tournament_matches: [],
    scheduled_matches: [],
    polls: [],
    daily_challenges: [],
    challenge_submissions: [],
    settings: [],
    logs: []
  };
}

function saveDatabase(data: DatabaseData): void {
  fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}

let db: DatabaseData = loadDatabase();

// Auto-save every 30 seconds
setInterval(() => {
  saveDatabase(db);
}, 30000);

// Helper function to find user by JID or phone number
function findUserByJid(jid: string): any {
  // Extract phone number from any JID format (@s.whatsapp.net, @lid, etc.)
  const phoneNumber = jid.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '');
  console.log(`[findUserByJid] Looking up jid=${jid}, phone=${phoneNumber}, total users=${db.users.length}`);

  // First try exact match
  let user = db.users.find(u => u.jid === jid);
  console.log(`[findUserByJid] Exact match result:`, user ? `id=${user.id}, jid=${user.jid}, is_muted=${user.is_muted}` : 'null');

  // If not found or exact match is not muted, try to find by phone number
  if (!user || user.is_muted === 0) {
    const matchingUsers = db.users.filter(u => {
      const userPhone = u.jid.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '');
      return userPhone === phoneNumber;
    });
    console.log(`[findUserByJid] Found ${matchingUsers.length} users with phone ${phoneNumber}:`, matchingUsers.map(u => `id=${u.id}, jid=${u.jid}, is_muted=${u.is_muted}`));

    // Prefer muted user, otherwise return first match
    user = matchingUsers.find(u => u.is_muted === 1) || matchingUsers[0];
    console.log(`[findUserByJid] Using:`, user ? `id=${user.id}, jid=${user.jid}, is_muted=${user.is_muted}` : 'null');
  }

  return user;
}

// Helper to get a normalized phone number from any JID
function getPhoneNumber(jid: string): string {
  return jid.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '');
}

// Helper to find any user by their phone number (checks all stored JIDs)
function findUserByPhoneNumber(phoneNumber: string): any | null {
  if (!phoneNumber) return null;
  return db.users.find(u => {
    const userPhone = getPhoneNumber(u.jid);
    return userPhone === phoneNumber;
  });
}

// User operations
export const userOps = {
  getOrCreate: (jid: string, name?: string): any => {
    let user = findUserByJid(jid);
    if (!user) {
      user = {
        id: db.users.length + 1,
        jid,
        name: name || null,
        role: 'member',
        warnings: 0,
        is_muted: 0,
        mute_expires_at: null,
        muted_messages_count: 0,
        muted_spam_warning: false,
        created_at: new Date().toISOString()
      };
      db.users.push(user);
      saveDatabase(db);
    }
    return user;
  },

  get: (jid: string): any => {
    return findUserByJid(jid);
  },

  updateRole: (jid: string, role: string): void => {
    const user = findUserByJid(jid);
    if (user) {
      user.role = role;
      saveDatabase(db);
    }
  },

  addWarning: (jid: string): any => {
    const user = findUserByJid(jid);
    if (user) {
      user.warnings = (user.warnings || 0) + 1;
      saveDatabase(db);
    }
    return user;
  },

  clearWarnings: (jid: string): void => {
    const user = findUserByJid(jid);
    if (user) {
      user.warnings = 0;
      saveDatabase(db);
    }
  },

  mute: (jid: string, expiresAt: string): void => {
    const user = findUserByJid(jid);
    if (user) {
      user.is_muted = 1;
      user.mute_expires_at = expiresAt;
      saveDatabase(db);
    }
  },

  unmute: (jid: string): void => {
    const user = findUserByJid(jid);
    if (user) {
      user.is_muted = 0;
      user.mute_expires_at = null;
      saveDatabase(db);
    }
  },

  getMutedUsers: (): any[] => {
    return db.users.filter(u => u.is_muted === 1 && u.mute_expires_at);
  },

  getExpiredMutes: (): any[] => {
    const now = new Date().toISOString();
    return db.users.filter(u => u.is_muted === 1 && u.mute_expires_at && u.mute_expires_at <= now);
  },

  updateName: (jid: string, name: string): void => {
    const user = findUserByJid(jid);
    if (user) {
      user.name = name;
      saveDatabase(db);
    }
  },

  // Increment count of messages sent while muted
  incrementMutedMessageCount: (jid: string): number => {
    // First ensure user has the field
    let user = findUserByJid(jid);
    if (!user) {
      // User doesn't exist, create them
      user = userOps.getOrCreate(jid);
    }
    // Ensure fields exist
    if (user.muted_messages_count === undefined) {
      user.muted_messages_count = 0;
    }
    if (user.muted_spam_warning === undefined) {
      user.muted_spam_warning = false;
    }

    user.muted_messages_count = (user.muted_messages_count || 0) + 1;
    saveDatabase(db);
    console.log(`[incrementMutedMessageCount] jid=${jid}, new count=${user.muted_messages_count}`);
    return user.muted_messages_count;
  },

  // Get muted message count
  getMutedMessageCount: (jid: string): number => {
    const user = findUserByJid(jid);
    return user?.muted_messages_count || 0;
  },

  // Set spam warning flag
  setMutedSpamWarning: (jid: string, warned: boolean): void => {
    const user = findUserByJid(jid);
    if (user) {
      user.muted_spam_warning = warned;
      saveDatabase(db);
    }
  },

  // Check if user has spam warning
  hasMutedSpamWarning: (jid: string): boolean => {
    const user = findUserByJid(jid);
    return !!user?.muted_spam_warning;
  },

  // Clear muted message count and spam warning (when unmuted)
  clearMutedSpamData: (jid: string): void => {
    const user = findUserByJid(jid);
    if (user) {
      user.muted_messages_count = 0;
      user.muted_spam_warning = false;
      saveDatabase(db);
    }
  }
};

// Player stats operations
export const statsOps = {
  getOrCreate: (userJid: string): any => {
    let stats = db.player_stats.find(s => s.user_jid === userJid);
    if (!stats) {
      stats = {
        id: db.player_stats.length + 1,
        user_jid: userJid,
        wins: 0,
        losses: 0,
        draws: 0,
        goals_scored: 0,
        goals_conceded: 0,
        tournaments_won: 0,
        tournaments_played: 0,
        challenge_completed: 0,
        updated_at: new Date().toISOString()
      };
      db.player_stats.push(stats);
      saveDatabase(db);
    }
    return stats;
  },

  incrementWin: (userJid: string): void => {
    const stats = db.player_stats.find(s => s.user_jid === userJid);
    if (stats) {
      stats.wins = (stats.wins || 0) + 1;
      stats.updated_at = new Date().toISOString();
      saveDatabase(db);
    }
  },

  incrementLoss: (userJid: string): void => {
    const stats = db.player_stats.find(s => s.user_jid === userJid);
    if (stats) {
      stats.losses = (stats.losses || 0) + 1;
      stats.updated_at = new Date().toISOString();
      saveDatabase(db);
    }
  },

  incrementDraw: (userJid: string): void => {
    const stats = db.player_stats.find(s => s.user_jid === userJid);
    if (stats) {
      stats.draws = (stats.draws || 0) + 1;
      stats.updated_at = new Date().toISOString();
      saveDatabase(db);
    }
  },

  addGoals: (userJid: string, scored: number, conceded: number): void => {
    const stats = db.player_stats.find(s => s.user_jid === userJid);
    if (stats) {
      stats.goals_scored = (stats.goals_scored || 0) + scored;
      stats.goals_conceded = (stats.goals_conceded || 0) + conceded;
      stats.updated_at = new Date().toISOString();
      saveDatabase(db);
    }
  },

  recordWin: (userJid: string, goalsScored: number, goalsConceded: number): void => {
    statsOps.getOrCreate(userJid);
    statsOps.incrementWin(userJid);
    statsOps.addGoals(userJid, goalsScored, goalsConceded);
  },

  recordLoss: (userJid: string, goalsScored: number, goalsConceded: number): void => {
    statsOps.getOrCreate(userJid);
    statsOps.incrementLoss(userJid);
    statsOps.addGoals(userJid, goalsScored, goalsConceded);
  },

  recordDraw: (userJid: string, goalsScored: number, goalsConceded: number): void => {
    statsOps.getOrCreate(userJid);
    statsOps.incrementDraw(userJid);
    statsOps.addGoals(userJid, goalsScored, goalsConceded);
  },

  getLeaderboard: (limit: number = 10): any[] => {
    return db.player_stats
      .sort((a, b) => (b.wins || 0) - (a.wins || 0))
      .slice(0, limit);
  }
};

// Tournament operations
export const tournamentOps = {
  create: (name: string, type: string, maxPlayers: number | null, creatorJid: string): any => {
    const tournament = {
      id: db.tournaments.length + 1,
      name,
      type,
      max_players: maxPlayers,
      status: 'registration',
      creator_jid: creatorJid,
      created_at: new Date().toISOString()
    };
    db.tournaments.push(tournament);
    saveDatabase(db);
    return tournament;
  },

  get: (id: number): any => {
    return db.tournaments.find(t => t.id === id);
  },

  getActive: (): any[] => {
    return db.tournaments.filter(t => t.status !== 'completed');
  },

  updateStatus: (id: number, status: string): void => {
    const tournament = db.tournaments.find(t => t.id === id);
    if (tournament) {
      tournament.status = status;
      saveDatabase(db);
    }
  },

  addParticipant: (tournamentId: number, userJid: string): void => {
    const existing = db.tournament_participants.find(p => p.tournament_id === tournamentId && p.user_jid === userJid);
    if (!existing) {
      db.tournament_participants.push({
        id: db.tournament_participants.length + 1,
        tournament_id: tournamentId,
        user_jid: userJid,
        joined_at: new Date().toISOString()
      });
      saveDatabase(db);
    }
  },

  removeParticipant: (tournamentId: number, userJid: string): void => {
    const index = db.tournament_participants.findIndex(p => p.tournament_id === tournamentId && p.user_jid === userJid);
    if (index !== -1) {
      db.tournament_participants.splice(index, 1);
      saveDatabase(db);
    }
  },

  getParticipants: (tournamentId: number): any[] => {
    return db.tournament_participants.filter(p => p.tournament_id === tournamentId);
  },

  addMatch: (tournamentId: number, player1Jid: string, player2Jid: string, roundNumber: number): any => {
    const match = {
      id: db.tournament_matches.length + 1,
      tournament_id: tournamentId,
      player1_jid: player1Jid,
      player2_jid: player2Jid,
      round_number: roundNumber,
      status: 'pending',
      created_at: new Date().toISOString()
    };
    db.tournament_matches.push(match);
    saveDatabase(db);
    return match;
  },

  getMatches: (tournamentId: number): any[] => {
    return db.tournament_matches.filter(m => m.tournament_id === tournamentId);
  },

  updateMatchResult: (matchId: number, player1Score: number, player2Score: number): void => {
    const match = db.tournament_matches.find(m => m.id === matchId);
    if (match) {
      match.player1_score = player1Score;
      match.player2_score = player2Score;
      match.status = 'completed';
      saveDatabase(db);
    }
  }
};

export default tournamentOps;

// Log operations
export const logOps = {
  add: (action: string, userJid: string, targetJid?: string, details?: string): void => {
    db.logs.push({
      id: db.logs.length + 1,
      action,
      user_jid: userJid,
      target_jid: targetJid || null,
      details: details || null,
      created_at: new Date().toISOString()
    });
    saveDatabase(db);
  },

  getByGroup: (groupJid: string, limit: number = 10): any[] => {
    return db.logs
      .filter(l => l.user_jid === groupJid || l.target_jid === groupJid)
      .slice(-limit)
      .reverse();
  }
};

// Settings operations
export const settingsOps = {
  get: (key: string): string | null => {
    const setting = db.settings.find(s => s.key === key);
    return setting?.value || null;
  },

  set: (key: string, value: string): void => {
    const setting = db.settings.find(s => s.key === key);
    if (setting) {
      setting.value = value;
    } else {
      db.settings.push({ key, value });
    }
    saveDatabase(db);
  }
}; 
