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

// User operations
export const userOps = {
  getOrCreate: (jid: string, name?: string): any => {
    let user = db.users.find(u => u.jid === jid);
    if (!user) {
      user = {
        id: db.users.length + 1,
        jid,
        name: name || null,
        role: 'member',
        warnings: 0,
        is_muted: 0,
        mute_expires_at: null,
        created_at: new Date().toISOString()
      };
      db.users.push(user);
      saveDatabase(db);
    }
    return user;
  },

  get: (jid: string): any => {
    return db.users.find(u => u.jid === jid);
  },

  updateRole: (jid: string, role: string): void => {
    const user = db.users.find(u => u.jid === jid);
    if (user) {
      user.role = role;
      saveDatabase(db);
    }
  },

  addWarning: (jid: string): any => {
    const user = db.users.find(u => u.jid === jid);
    if (user) {
      user.warnings = (user.warnings || 0) + 1;
      saveDatabase(db);
    }
    return user;
  },

  clearWarnings: (jid: string): void => {
    const user = db.users.find(u => u.jid === jid);
    if (user) {
      user.warnings = 0;
      saveDatabase(db);
    }
  },

  mute: (jid: string, expiresAt: string): void => {
    const user = db.users.find(u => u.jid === jid);
    if (user) {
      user.is_muted = 1;
      user.mute_expires_at = expiresAt;
      saveDatabase(db);
    }
  },

  unmute: (jid: string): void => {
    const user = db.users.find(u => u.jid === jid);
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
    const user = db.users.find(u => u.jid === jid);
    if (user) {
      user.name = name;
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

  recordWin: (userJid: string, goalsFor: number, goalsAgainst: number): void => {
    const stats = db.player_stats.find(s => s.user_jid === userJid);
    if (stats) {
      stats.wins = (stats.wins || 0) + 1;
      stats.goals_scored = (stats.goals_scored || 0) + goalsFor;
      stats.goals_conceded = (stats.goals_conceded || 0) + goalsAgainst;
      stats.updated_at = new Date().toISOString();
      saveDatabase(db);
    }
  },

  recordLoss: (userJid: string, goalsFor: number, goalsAgainst: number): void => {
    const stats = db.player_stats.find(s => s.user_jid === userJid);
    if (stats) {
      stats.losses = (stats.losses || 0) + 1;
      stats.goals_scored = (stats.goals_scored || 0) + goalsFor;
      stats.goals_conceded = (stats.goals_conceded || 0) + goalsAgainst;
      stats.updated_at = new Date().toISOString();
      saveDatabase(db);
    }
  },

  recordDraw: (userJid: string, goalsFor: number, goalsAgainst: number): void => {
    const stats = db.player_stats.find(s => s.user_jid === userJid);
    if (stats) {
      stats.draws = (stats.draws || 0) + 1;
      stats.goals_scored = (stats.goals_scored || 0) + goalsFor;
      stats.goals_conceded = (stats.goals_conceded || 0) + goalsAgainst;
      stats.updated_at = new Date().toISOString();
      saveDatabase(db);
    }
  },

  incrementTournamentsPlayed: (userJid: string): void => {
    const stats = db.player_stats.find(s => s.user_jid === userJid);
    if (stats) {
      stats.tournaments_played = (stats.tournaments_played || 0) + 1;
      stats.updated_at = new Date().toISOString();
      saveDatabase(db);
    }
  },

  incrementTournamentsWon: (userJid: string): void => {
    const stats = db.player_stats.find(s => s.user_jid === userJid);
    if (stats) {
      stats.tournaments_won = (stats.tournaments_won || 0) + 1;
      stats.updated_at = new Date().toISOString();
      saveDatabase(db);
    }
  },

  incrementChallengesCompleted: (userJid: string): void => {
    const stats = db.player_stats.find(s => s.user_jid === userJid);
    if (stats) {
      stats.challenge_completed = (stats.challenge_completed || 0) + 1;
      stats.updated_at = new Date().toISOString();
      saveDatabase(db);
    }
  },

  getLeaderboard: (limit: number = 10): any[] => {
    const withPoints = db.player_stats.map(ps => {
      const user = db.users.find(u => u.jid === ps.user_jid);
      return {
        ...ps,
        name: user?.name || ps.user_jid.replace('@s.whatsapp.net', ''),
        points: (ps.wins || 0) * 3 + (ps.draws || 0)
      };
    });

    return withPoints
      .sort((a, b) => b.points - a.points || (b.goals_scored || 0) - (a.goals_scored || 0))
      .slice(0, limit);
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
  },

  delete: (key: string): void => {
    db.settings = db.settings.filter(s => s.key !== key);
    saveDatabase(db);
  }
};

// Log operations
export const logOps = {
  add: (action: string, userJid?: string, targetJid?: string, details?: string): void => {
    db.logs.push({
      id: db.logs.length + 1,
      action,
      user_jid: userJid || null,
      target_jid: targetJid || null,
      details: details || null,
      created_at: new Date().toISOString()
    });
    // Keep only last 1000 logs
    if (db.logs.length > 1000) {
      db.logs = db.logs.slice(-1000);
    }
    saveDatabase(db);
  },

  getRecent: (limit: number = 50): any[] => {
    return db.logs.slice(-limit).reverse();
  }
};

// Tournament operations
export const tournamentOps = {
  create: (name: string, type: string, maxPlayers: number | null, createdBy: string): any => {
    const tournament = {
      id: db.tournaments.length + 1,
      name,
      type,
      status: 'registration',
      max_players: maxPlayers,
      created_by: createdBy,
      created_at: new Date().toISOString(),
      started_at: null,
      ended_at: null
    };
    db.tournaments.push(tournament);
    saveDatabase(db);
    return tournament;
  },

  get: (id: number): any => {
    return db.tournaments.find(t => t.id === id);
  },

  getActive: (): any[] => {
    return db.tournaments.filter(t => t.status === 'registration' || t.status === 'in_progress');
  },

  start: (id: number): void => {
    const t = db.tournaments.find(t => t.id === id);
    if (t) {
      t.status = 'in_progress';
      t.started_at = new Date().toISOString();
      saveDatabase(db);
    }
  },

  complete: (id: number, winnerJid: string): void => {
    const t = db.tournaments.find(t => t.id === id);
    if (t) {
      t.status = 'completed';
      t.ended_at = new Date().toISOString();
      statsOps.incrementTournamentsWon(winnerJid);
      saveDatabase(db);
    }
  },

  addParticipant: (tournamentId: number, userJid: string, seed?: number): void => {
    const exists = db.tournament_participants.find(
      p => p.tournament_id === tournamentId && p.user_jid === userJid
    );
    if (!exists) {
      db.tournament_participants.push({
        id: db.tournament_participants.length + 1,
        tournament_id: tournamentId,
        user_jid: userJid,
        status: 'registered',
        seed: seed || null
      });
      statsOps.incrementTournamentsPlayed(userJid);
      saveDatabase(db);
    }
  },

  removeParticipant: (tournamentId: number, userJid: string): void => {
    db.tournament_participants = db.tournament_participants.filter(
      p => !(p.tournament_id === tournamentId && p.user_jid === userJid)
    );
    saveDatabase(db);
  },

  getParticipants: (tournamentId: number): any[] => {
    return db.tournament_participants
      .filter(p => p.tournament_id === tournamentId)
      .map(p => {
        const user = db.users.find(u => u.jid === p.user_jid);
        return { ...p, name: user?.name || p.user_jid.replace('@s.whatsapp.net', '') };
      });
  },

  createMatch: (tournamentId: number, player1Jid: string, player2Jid: string | null, round: number, matchNum: number): any => {
    const match = {
      id: db.tournament_matches.length + 1,
      tournament_id: tournamentId,
      player1_jid: player1Jid,
      player2_jid: player2Jid,
      player1_score: null,
      player2_score: null,
      winner_jid: null,
      round_number: round,
      match_number: matchNum,
      status: 'pending',
      scheduled_at: null
    };
    db.tournament_matches.push(match);
    saveDatabase(db);
    return match;
  },

  updateMatchResult: (matchId: number, player1Score: number, player2Score: number, winnerJid: string): void => {
    const match = db.tournament_matches.find(m => m.id === matchId);
    if (match) {
      match.player1_score = player1Score;
      match.player2_score = player2Score;
      match.winner_jid = winnerJid;
      match.status = 'completed';
      saveDatabase(db);
    }
  },

  getMatches: (tournamentId: number): any[] => {
    return db.tournament_matches
      .filter(m => m.tournament_id === tournamentId)
      .map(m => {
        const p1 = db.users.find(u => u.jid === m.player1_jid);
        const p2 = db.users.find(u => u.jid === m.player2_jid);
        return {
          ...m,
          player1_name: p1?.name || m.player1_jid.replace('@s.whatsapp.net', ''),
          player2_name: p2?.name || m.player2_jid?.replace('@s.whatsapp.net', '')
        };
      });
  }
};

export default {
  userOps,
  statsOps,
  settingsOps,
  logOps,
  tournamentOps
};
