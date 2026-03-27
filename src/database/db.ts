import Database from 'better-sqlite3';
import * as path from 'path';
import * as fs from 'fs';

const dataPath = path.join(__dirname, '../../data');
if (!fs.existsSync(dataPath)) {
  fs.mkdirSync(dataPath, { recursive: true });
}

const dbPath = path.join(dataPath, 'bot.db');
const db = new Database(dbPath);

// Enable WAL mode for concurrent reads + fast writes
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

// Create schema
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jid TEXT NOT NULL,
    name TEXT,
    role TEXT NOT NULL DEFAULT 'member',
    warnings INTEGER NOT NULL DEFAULT 0,
    is_muted INTEGER NOT NULL DEFAULT 0,
    mute_expires_at TEXT,
    muted_messages_count INTEGER NOT NULL DEFAULT 0,
    muted_spam_warning INTEGER NOT NULL DEFAULT 0,
    link_spam_count INTEGER NOT NULL DEFAULT 0,
    link_warn_issued INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_users_jid ON users(jid);
  CREATE INDEX IF NOT EXISTS idx_users_muted ON users(is_muted, mute_expires_at);

  CREATE TABLE IF NOT EXISTS player_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_jid TEXT NOT NULL UNIQUE,
    wins INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    goals_scored INTEGER NOT NULL DEFAULT 0,
    goals_conceded INTEGER NOT NULL DEFAULT 0,
    tournaments_won INTEGER NOT NULL DEFAULT 0,
    tournaments_played INTEGER NOT NULL DEFAULT 0,
    challenge_completed INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL,
    max_players INTEGER,
    status TEXT NOT NULL DEFAULT 'registration',
    creator_jid TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS tournament_participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    user_jid TEXT NOT NULL,
    joined_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
  );

  CREATE INDEX IF NOT EXISTS idx_tournament_participants_tid ON tournament_participants(tournament_id);

  CREATE TABLE IF NOT EXISTS tournament_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    player1_jid TEXT NOT NULL,
    player2_jid TEXT NOT NULL,
    player1_score INTEGER,
    player2_score,
    winner_jid TEXT,
    round_number INTEGER NOT NULL,
    match_number INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'pending',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
  );

  CREATE INDEX IF NOT EXISTS idx_tournament_matches_tid ON tournament_matches(tournament_id);

  CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    action TEXT NOT NULL,
    user_jid TEXT NOT NULL,
    target_jid TEXT,
    details TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_logs_user ON logs(user_jid);
  CREATE INDEX IF NOT EXISTS idx_logs_target ON logs(target_jid);

  CREATE TABLE IF NOT EXISTS pvp_matches (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_jid TEXT NOT NULL,
    player2_jid TEXT NOT NULL,
    player1_score INTEGER NOT NULL,
    player2_score INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    approved_by TEXT,
    rejection_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE INDEX IF NOT EXISTS idx_pvp_matches_p1 ON pvp_matches(player1_jid);
  CREATE INDEX IF NOT EXISTS idx_pvp_matches_p2 ON pvp_matches(player2_jid);
  CREATE INDEX IF NOT EXISTS idx_pvp_matches_status ON pvp_matches(status);

  CREATE TABLE IF NOT EXISTS pvp_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_jid TEXT NOT NULL UNIQUE,
    points INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    goals_for INTEGER NOT NULL DEFAULT 0,
    goals_against INTEGER NOT NULL DEFAULT 0,
    matches_played INTEGER NOT NULL DEFAULT 0,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrate existing pvp_matches tables (add columns if missing)
try { db.exec("ALTER TABLE pvp_matches ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'"); } catch {}
try { db.exec("ALTER TABLE pvp_matches ADD COLUMN approved_by TEXT"); } catch {}
try { db.exec("ALTER TABLE pvp_matches ADD COLUMN rejection_reason TEXT"); } catch {}

// ==================== PREPARED STATEMENTS ====================

// User queries
const stmts = {
  // Users
  findUserExact: db.prepare('SELECT * FROM users WHERE jid = ?'),
  findUserByPhone: db.prepare("SELECT * FROM users WHERE REPLACE(REPLACE(REPLACE(jid, '@s.whatsapp.net', ''), '@lid', ''), '@g.us', '') = ?"),
  findUserMutedByPhone: db.prepare("SELECT * FROM users WHERE REPLACE(REPLACE(REPLACE(jid, '@s.whatsapp.net', ''), '@lid', ''), '@g.us', '') = ? AND is_muted = 1"),
  insertUser: db.prepare(`INSERT INTO users (jid, name, role, warnings, is_muted, mute_expires_at, muted_messages_count, muted_spam_warning, link_spam_count, link_warn_issued)
    VALUES (?, ?, 'member', 0, 0, NULL, 0, 0, 0, 0)`),
  updateRole: db.prepare('UPDATE users SET role = ? WHERE jid = ?'),
  addWarning: db.prepare('UPDATE users SET warnings = warnings + 1 WHERE jid = ?'),
  clearWarnings: db.prepare('UPDATE users SET warnings = 0 WHERE jid = ?'),
  muteUser: db.prepare('UPDATE users SET is_muted = 1, mute_expires_at = ? WHERE jid = ?'),
  unmuteUser: db.prepare('UPDATE users SET is_muted = 0, mute_expires_at = NULL, muted_messages_count = 0, muted_spam_warning = 0 WHERE jid = ?'),
  getMutedUsers: db.prepare('SELECT * FROM users WHERE is_muted = 1 AND mute_expires_at IS NOT NULL'),
  getExpiredMutes: db.prepare("SELECT * FROM users WHERE is_muted = 1 AND mute_expires_at IS NOT NULL AND mute_expires_at <= datetime('now')"),
  updateName: db.prepare('UPDATE users SET name = ? WHERE jid = ?'),
  incrementMutedMsgCount: db.prepare('UPDATE users SET muted_messages_count = muted_messages_count + 1 WHERE jid = ?'),
  getMutedMsgCount: db.prepare('SELECT muted_messages_count FROM users WHERE jid = ?'),
  setMutedSpamWarning: db.prepare('UPDATE users SET muted_spam_warning = ? WHERE jid = ?'),
  getMutedSpamWarning: db.prepare('SELECT muted_spam_warning FROM users WHERE jid = ?'),
  clearMutedSpamData: db.prepare('UPDATE users SET muted_messages_count = 0, muted_spam_warning = 0 WHERE jid = ?'),
  incrementLinkCount: db.prepare('UPDATE users SET link_spam_count = link_spam_count + 1 WHERE jid = ?'),
  getLinkCount: db.prepare('SELECT link_spam_count FROM users WHERE jid = ?'),
  clearLinkSpamData: db.prepare('UPDATE users SET link_spam_count = 0, link_warn_issued = 0 WHERE jid = ?'),

  // Player stats
  findStats: db.prepare('SELECT * FROM player_stats WHERE user_jid = ?'),
  insertStats: db.prepare(`INSERT INTO player_stats (user_jid, wins, losses, draws, goals_scored, goals_conceded, tournaments_won, tournaments_played, challenge_completed)
    VALUES (?, 0, 0, 0, 0, 0, 0, 0, 0)`),
  incrementWin: db.prepare("UPDATE player_stats SET wins = wins + 1, updated_at = datetime('now') WHERE user_jid = ?"),
  incrementLoss: db.prepare("UPDATE player_stats SET losses = losses + 1, updated_at = datetime('now') WHERE user_jid = ?"),
  incrementDraw: db.prepare("UPDATE player_stats SET draws = draws + 1, updated_at = datetime('now') WHERE user_jid = ?"),
  addGoals: db.prepare("UPDATE player_stats SET goals_scored = goals_scored + ?, goals_conceded = goals_conceded + ?, updated_at = datetime('now') WHERE user_jid = ?"),
  getLeaderboard: db.prepare('SELECT * FROM player_stats ORDER BY wins DESC LIMIT ?'),

  // Tournaments
  insertTournament: db.prepare(`INSERT INTO tournaments (name, type, max_players, status, creator_jid)
    VALUES (?, ?, ?, 'registration', ?)`),
  getTournament: db.prepare('SELECT * FROM tournaments WHERE id = ?'),
  getActiveTournaments: db.prepare("SELECT * FROM tournaments WHERE status != 'completed'"),
  updateTournamentStatus: db.prepare('UPDATE tournaments SET status = ? WHERE id = ?'),
  insertParticipant: db.prepare('INSERT INTO tournament_participants (tournament_id, user_jid) VALUES (?, ?)'),
  findParticipant: db.prepare('SELECT * FROM tournament_participants WHERE tournament_id = ? AND user_jid = ?'),
  deleteParticipant: db.prepare('DELETE FROM tournament_participants WHERE tournament_id = ? AND user_jid = ?'),
  getParticipants: db.prepare('SELECT * FROM tournament_participants WHERE tournament_id = ?'),
  insertMatch: db.prepare(`INSERT INTO tournament_matches (tournament_id, player1_jid, player2_jid, round_number, status)
    VALUES (?, ?, ?, ?, 'pending')`),
  getTournamentMatches: db.prepare('SELECT * FROM tournament_matches WHERE tournament_id = ?'),
  updateMatchResult: db.prepare("UPDATE tournament_matches SET player1_score = ?, player2_score = ?, status = 'completed' WHERE id = ?"),

  // Logs
  insertLog: db.prepare('INSERT INTO logs (action, user_jid, target_jid, details) VALUES (?, ?, ?, ?)'),
  getLogsByGroup: db.prepare('SELECT * FROM logs WHERE user_jid = ? OR target_jid = ? ORDER BY created_at DESC LIMIT ?'),

  // Settings
  getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
  upsertSetting: db.prepare(`INSERT INTO settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value`),

  // PVP matches
  insertPvpMatch: db.prepare('INSERT INTO pvp_matches (player1_jid, player2_jid, player1_score, player2_score, status) VALUES (?, ?, ?, ?, ?)'),
  getPvpMatchesByPlayer: db.prepare("SELECT * FROM pvp_matches WHERE (player1_jid = ? OR player2_jid = ?) AND status = 'approved' ORDER BY created_at DESC LIMIT ?"),
  getAllPvpMatches: db.prepare("SELECT * FROM pvp_matches WHERE status = 'approved'"),
  getPendingPvpMatches: db.prepare("SELECT * FROM pvp_matches WHERE status = 'pending' ORDER BY created_at ASC"),
  getPvpMatchById: db.prepare('SELECT * FROM pvp_matches WHERE id = ?'),
  approvePvpMatch: db.prepare("UPDATE pvp_matches SET status = 'approved', approved_by = ? WHERE id = ?"),
  rejectPvpMatch: db.prepare("UPDATE pvp_matches SET status = 'rejected', approved_by = ?, rejection_reason = ? WHERE id = ?"),
  findPendingMatch: db.prepare("SELECT * FROM pvp_matches WHERE player1_jid = ? AND player2_jid = ? AND player1_score = ? AND player2_score = ? AND status = 'pending' ORDER BY created_at DESC LIMIT 1"),

  // PVP stats
  findPvpStats: db.prepare('SELECT * FROM pvp_stats WHERE user_jid = ?'),
  insertPvpStats: db.prepare(`INSERT INTO pvp_stats (user_jid, points, wins, draws, losses, goals_for, goals_against, matches_played)
    VALUES (?, 0, 0, 0, 0, 0, 0, 0)`),
  updatePvpStats: db.prepare(`UPDATE pvp_stats SET goals_for = goals_for + ?, goals_against = goals_against + ?,
    points = points + ?, matches_played = matches_played + 1, updated_at = datetime('now') WHERE user_jid = ?`),
  incrementPvpWin: db.prepare('UPDATE pvp_stats SET wins = wins + 1 WHERE user_jid = ?'),
  incrementPvpDraw: db.prepare('UPDATE pvp_stats SET draws = draws + 1 WHERE user_jid = ?'),
  incrementPvpLoss: db.prepare('UPDATE pvp_stats SET losses = losses + 1 WHERE user_jid = ?'),
  getPvpLeaderboard: db.prepare('SELECT * FROM pvp_stats ORDER BY points DESC LIMIT ?'),
};

// ==================== HELPER FUNCTIONS ====================

function getPhoneNumber(jid: string): string {
  return jid.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '');
}

function findUserByJid(jid: string): any {
  const phoneNumber = getPhoneNumber(jid);

  // Try exact match first
  const exact = stmts.findUserExact.get(jid) as any;
  if (exact && exact.is_muted === 1) return exact;
  if (exact) {
    // Check if there's a muted version with same phone
    const muted = stmts.findUserMutedByPhone.get(phoneNumber) as any;
    if (muted) return muted;
    return exact;
  }

  // Try phone number match
  const muted = stmts.findUserMutedByPhone.get(phoneNumber) as any;
  if (muted) return muted;

  const any = stmts.findUserByPhone.get(phoneNumber) as any;
  return any || null;
}

// ==================== USER OPERATIONS ====================

export const userOps = {
  getOrCreate: (jid: string, name?: string): any => {
    let user = findUserByJid(jid);
    if (!user) {
      stmts.insertUser.run(jid, name || null);
      user = stmts.findUserExact.get(jid);
    }
    return user;
  },

  get: (jid: string): any => {
    return findUserByJid(jid);
  },

  updateRole: (jid: string, role: string): void => {
    stmts.updateRole.run(role, jid);
  },

  addWarning: (jid: string): any => {
    stmts.addWarning.run(jid);
    return findUserByJid(jid);
  },

  clearWarnings: (jid: string): void => {
    stmts.clearWarnings.run(jid);
  },

  mute: (jid: string, expiresAt: string): void => {
    stmts.muteUser.run(expiresAt, jid);
  },

  unmute: (jid: string): void => {
    stmts.unmuteUser.run(jid);
  },

  getMutedUsers: (): any[] => {
    return stmts.getMutedUsers.all();
  },

  getExpiredMutes: (): any[] => {
    return stmts.getExpiredMutes.all();
  },

  updateName: (jid: string, name: string): void => {
    stmts.updateName.run(name, jid);
  },

  incrementMutedMessageCount: (jid: string): number => {
    userOps.getOrCreate(jid);
    stmts.incrementMutedMsgCount.run(jid);
    const row = stmts.getMutedMsgCount.get(jid) as any;
    return row?.muted_messages_count || 0;
  },

  getMutedMessageCount: (jid: string): number => {
    const row = stmts.getMutedMsgCount.get(jid) as any;
    return row?.muted_messages_count || 0;
  },

  setMutedSpamWarning: (jid: string, warned: boolean): void => {
    stmts.setMutedSpamWarning.run(warned ? 1 : 0, jid);
  },

  hasMutedSpamWarning: (jid: string): boolean => {
    const row = stmts.getMutedSpamWarning.get(jid) as any;
    return row?.muted_spam_warning === 1;
  },

  clearMutedSpamData: (jid: string): void => {
    stmts.clearMutedSpamData.run(jid);
  },

  incrementLinkCount: (jid: string): number => {
    stmts.incrementLinkCount.run(jid);
    const row = stmts.getLinkCount.get(jid) as any;
    return row?.link_spam_count || 0;
  },

  getLinkCount: (jid: string): number => {
    const row = stmts.getLinkCount.get(jid) as any;
    return row?.link_spam_count || 0;
  },

  clearLinkSpamData: (jid: string): void => {
    stmts.clearLinkSpamData.run(jid);
  }
};

// ==================== PLAYER STATS OPERATIONS ====================

export const statsOps = {
  getOrCreate: (userJid: string): any => {
    let stats = stmts.findStats.get(userJid) as any;
    if (!stats) {
      stmts.insertStats.run(userJid);
      stats = stmts.findStats.get(userJid);
    }
    return stats;
  },

  incrementWin: (userJid: string): void => {
    stmts.incrementWin.run(userJid);
  },

  incrementLoss: (userJid: string): void => {
    stmts.incrementLoss.run(userJid);
  },

  incrementDraw: (userJid: string): void => {
    stmts.incrementDraw.run(userJid);
  },

  addGoals: (userJid: string, scored: number, conceded: number): void => {
    stmts.addGoals.run(scored, conceded, userJid);
  },

  recordWin: (userJid: string, goalsScored: number, goalsConceded: number): void => {
    statsOps.getOrCreate(userJid);
    stmts.incrementWin.run(userJid);
    stmts.addGoals.run(goalsScored, goalsConceded, userJid);
  },

  recordLoss: (userJid: string, goalsScored: number, goalsConceded: number): void => {
    statsOps.getOrCreate(userJid);
    stmts.incrementLoss.run(userJid);
    stmts.addGoals.run(goalsScored, goalsConceded, userJid);
  },

  recordDraw: (userJid: string, goalsScored: number, goalsConceded: number): void => {
    statsOps.getOrCreate(userJid);
    stmts.incrementDraw.run(userJid);
    stmts.addGoals.run(goalsScored, goalsConceded, userJid);
  },

  getLeaderboard: (limit: number = 10): any[] => {
    return stmts.getLeaderboard.all(limit);
  }
};

// ==================== TOURNAMENT OPERATIONS ====================

export const tournamentOps = {
  create: (name: string, type: string, maxPlayers: number | null, creatorJid: string): any => {
    const result = stmts.insertTournament.run(name, type, maxPlayers, creatorJid);
    return stmts.getTournament.get(result.lastInsertRowid);
  },

  get: (id: number): any => {
    return stmts.getTournament.get(id);
  },

  getActive: (): any[] => {
    return stmts.getActiveTournaments.all();
  },

  updateStatus: (id: number, status: string): void => {
    stmts.updateTournamentStatus.run(status, id);
  },

  addParticipant: (tournamentId: number, userJid: string): void => {
    const existing = stmts.findParticipant.get(tournamentId, userJid);
    if (!existing) {
      stmts.insertParticipant.run(tournamentId, userJid);
    }
  },

  removeParticipant: (tournamentId: number, userJid: string): void => {
    stmts.deleteParticipant.run(tournamentId, userJid);
  },

  getParticipants: (tournamentId: number): any[] => {
    return stmts.getParticipants.all(tournamentId);
  },

  addMatch: (tournamentId: number, player1Jid: string, player2Jid: string, roundNumber: number): any => {
    const result = stmts.insertMatch.run(tournamentId, player1Jid, player2Jid, roundNumber);
    return stmts.getTournament.get(result.lastInsertRowid);
  },

  getMatches: (tournamentId: number): any[] => {
    return stmts.getTournamentMatches.all(tournamentId);
  },

  updateMatchResult: (matchId: number, player1Score: number, player2Score: number): void => {
    stmts.updateMatchResult.run(player1Score, player2Score, matchId);
  }
};

export default tournamentOps;

// ==================== LOG OPERATIONS ====================

export const logOps = {
  add: (action: string, userJid: string, targetJid?: string, details?: string): void => {
    stmts.insertLog.run(action, userJid, targetJid || null, details || null);
  },

  getByGroup: (groupJid: string, limit: number = 10): any[] => {
    return stmts.getLogsByGroup.all(groupJid, groupJid, limit);
  }
};

// ==================== SETTINGS OPERATIONS ====================

export const settingsOps = {
  get: (key: string): string | null => {
    const row = stmts.getSetting.get(key) as any;
    return row?.value || null;
  },

  set: (key: string, value: string): void => {
    stmts.upsertSetting.run(key, value);
  }
};

// ==================== PVP OPERATIONS ====================

export const pvpOps = {
  recordMatch: (player1Jid: string, player2Jid: string, player1Score: number, player2Score: number): any => {
    const result = stmts.insertPvpMatch.run(player1Jid, player2Jid, player1Score, player2Score, 'pending');
    return { id: result.lastInsertRowid, player1_jid: player1Jid, player2_jid: player2Jid, player1_score: player1Score, player2_score: player2Score, status: 'pending' };
  },

  getMatchHistory: (userJid: string, limit: number = 10): any[] => {
    return stmts.getPvpMatchesByPlayer.all(userJid, userJid, limit);
  },

  getAllMatches: (): any[] => {
    return stmts.getAllPvpMatches.all();
  },

  getPendingMatches: (): any[] => {
    return stmts.getPendingPvpMatches.all();
  },

  getById: (matchId: number): any => {
    return stmts.getPvpMatchById.get(matchId);
  },

  approve: (matchId: number, adminJid: string): void => {
    stmts.approvePvpMatch.run(adminJid, matchId);
  },

  reject: (matchId: number, adminJid: string, reason: string): void => {
    stmts.rejectPvpMatch.run(adminJid, reason, matchId);
  },

  findPending: (player1Jid: string, player2Jid: string, player1Score: number, player2Score: number): any => {
    return stmts.findPendingMatch.get(player1Jid, player2Jid, player1Score, player2Score);
  }
};

// ==================== PVP STATS OPERATIONS ====================

export const pvpStatsOps = {
  getOrCreate: (userJid: string): any => {
    let stats = stmts.findPvpStats.get(userJid) as any;
    if (!stats) {
      stmts.insertPvpStats.run(userJid);
      stats = stmts.findPvpStats.get(userJid);
    }
    return stats;
  },

  updateAfterMatch: (userJid: string, goalsFor: number, goalsAgainst: number, result: 'win' | 'draw' | 'loss', points: number): void => {
    stmts.updatePvpStats.run(goalsFor, goalsAgainst, points, userJid);
    if (result === 'win') {
      stmts.incrementPvpWin.run(userJid);
    } else if (result === 'draw') {
      stmts.incrementPvpDraw.run(userJid);
    } else {
      stmts.incrementPvpLoss.run(userJid);
    }
  },

  getLeaderboard: (limit: number = 10): any[] => {
    return stmts.getPvpLeaderboard.all(limit);
  },

  get: (userJid: string): any | null => {
    return stmts.findPvpStats.get(userJid) || null;
  },

  applyMatchStats: (player1Jid: string, player2Jid: string, player1Score: number, player2Score: number): void => {
    pvpStatsOps.getOrCreate(player1Jid);
    pvpStatsOps.getOrCreate(player2Jid);

    let result1: 'win' | 'draw' | 'loss';
    let result2: 'win' | 'draw' | 'loss';
    let points1: number;
    let points2: number;

    if (player1Score > player2Score) {
      result1 = 'win'; result2 = 'loss'; points1 = 3; points2 = 0;
    } else if (player1Score < player2Score) {
      result1 = 'loss'; result2 = 'win'; points1 = 0; points2 = 3;
    } else {
      result1 = 'draw'; result2 = 'draw'; points1 = 1; points2 = 1;
    }

    pvpStatsOps.updateAfterMatch(player1Jid, player1Score, player2Score, result1, points1);
    pvpStatsOps.updateAfterMatch(player2Jid, player2Score, player1Score, result2, points2);
  }
};
