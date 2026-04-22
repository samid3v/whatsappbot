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
    legs INTEGER NOT NULL DEFAULT 1,
    max_players INTEGER,
    current_round INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'registration',
    creator_jid TEXT NOT NULL,
    winner_jid TEXT,
    started_at TEXT,
    ended_at TEXT,
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
    player2_score INTEGER,
    winner_jid TEXT,
    round_number INTEGER NOT NULL,
    match_number INTEGER NOT NULL DEFAULT 0,
    match_status TEXT NOT NULL DEFAULT 'pending',
    proof TEXT,
    approved_by TEXT,
    rejection_reason TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id)
  );

  CREATE INDEX IF NOT EXISTS idx_tournament_matches_tid ON tournament_matches(tournament_id);

  CREATE TABLE IF NOT EXISTS tournament_standings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    user_jid TEXT NOT NULL,
    position INTEGER,
    played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    goals_for INTEGER NOT NULL DEFAULT 0,
    goals_against INTEGER NOT NULL DEFAULT 0,
    points INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (tournament_id) REFERENCES tournaments(id),
    UNIQUE(tournament_id, user_jid)
  );

  CREATE INDEX IF NOT EXISTS idx_tournament_standings_tid ON tournament_standings(tournament_id);
  CREATE INDEX IF NOT EXISTS idx_tournament_standings_points ON tournament_standings(tournament_id, points DESC);

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

  CREATE TABLE IF NOT EXISTS pvp_seasons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_number INTEGER NOT NULL UNIQUE,
    start_date TEXT NOT NULL,
    end_date TEXT,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS pvp_season_stats (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    season_id INTEGER NOT NULL,
    user_jid TEXT NOT NULL,
    points INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    goals_for INTEGER NOT NULL DEFAULT 0,
    goals_against INTEGER NOT NULL DEFAULT 0,
    matches_played INTEGER NOT NULL DEFAULT 0,
    position INTEGER,
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (season_id) REFERENCES pvp_seasons(id),
    UNIQUE(season_id, user_jid)
  );

  CREATE INDEX IF NOT EXISTS idx_pvp_season_stats_season ON pvp_season_stats(season_id);
  CREATE INDEX IF NOT EXISTS idx_pvp_season_stats_points ON pvp_season_stats(season_id, points DESC);

  CREATE TABLE IF NOT EXISTS challenge_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_jid TEXT NOT NULL,
    record_date TEXT NOT NULL,
    completed_challenges TEXT NOT NULL DEFAULT '[]',
    total_reward INTEGER NOT NULL DEFAULT 0,
    matches_played INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(user_jid, record_date)
  );

  CREATE INDEX IF NOT EXISTS idx_challenge_records_user ON challenge_records(user_jid);
  CREATE INDEX IF NOT EXISTS idx_challenge_records_date ON challenge_records(record_date);
  CREATE INDEX IF NOT EXISTS idx_challenge_records_user_date ON challenge_records(user_jid, record_date);
`);

// Migrate existing pvp_matches tables (add columns if missing)
try { db.exec("ALTER TABLE pvp_matches ADD COLUMN status TEXT NOT NULL DEFAULT 'pending'"); } catch {}
try { db.exec("ALTER TABLE pvp_matches ADD COLUMN approved_by TEXT"); } catch {}
try { db.exec("ALTER TABLE pvp_matches ADD COLUMN rejection_reason TEXT"); } catch {}

// Migrate existing tournaments table (add columns if missing)
try { db.exec("ALTER TABLE tournaments ADD COLUMN current_round INTEGER NOT NULL DEFAULT 0"); } catch {}
try { db.exec("ALTER TABLE tournaments ADD COLUMN winner_jid TEXT"); } catch {}
try { db.exec("ALTER TABLE tournaments ADD COLUMN started_at TEXT"); } catch {}
try { db.exec("ALTER TABLE tournaments ADD COLUMN ended_at TEXT"); } catch {}
try { db.exec("ALTER TABLE tournaments ADD COLUMN legs INTEGER NOT NULL DEFAULT 1"); } catch {}

// Migrate existing tournament_matches tables (add columns if missing)
try { db.exec("ALTER TABLE tournament_matches ADD COLUMN match_status TEXT NOT NULL DEFAULT 'pending'"); } catch {}
try { db.exec("ALTER TABLE tournament_matches ADD COLUMN proof TEXT"); } catch {}
try { db.exec("ALTER TABLE tournament_matches ADD COLUMN approved_by TEXT"); } catch {}
try { db.exec("ALTER TABLE tournament_matches ADD COLUMN rejection_reason TEXT"); } catch {}

// Migrate tournament_participants to add squad_name
try { db.exec("ALTER TABLE tournament_participants ADD COLUMN squad_name TEXT"); } catch {}

// Run migrations for season tables
try {
  db.exec(`
    CREATE TABLE IF NOT EXISTS pvp_seasons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_number INTEGER NOT NULL UNIQUE,
      start_date TEXT NOT NULL,
      end_date TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS pvp_season_stats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      season_id INTEGER NOT NULL,
      user_jid TEXT NOT NULL,
      points INTEGER NOT NULL DEFAULT 0,
      wins INTEGER NOT NULL DEFAULT 0,
      draws INTEGER NOT NULL DEFAULT 0,
      losses INTEGER NOT NULL DEFAULT 0,
      goals_for INTEGER NOT NULL DEFAULT 0,
      goals_against INTEGER NOT NULL DEFAULT 0,
      matches_played INTEGER NOT NULL DEFAULT 0,
      position INTEGER,
      updated_at TEXT NOT NULL DEFAULT (datetime('now')),
      FOREIGN KEY (season_id) REFERENCES pvp_seasons(id),
      UNIQUE(season_id, user_jid)
    );

    CREATE INDEX IF NOT EXISTS idx_pvp_season_stats_season ON pvp_season_stats(season_id);
    CREATE INDEX IF NOT EXISTS idx_pvp_season_stats_points ON pvp_season_stats(season_id, points DESC);
  `);

  // Ensure season 1 exists
  const checkSeason = db.prepare('SELECT COUNT(*) as count FROM pvp_seasons');
  const result = checkSeason.get() as any;
  if (result.count === 0) {
    const insertSeason = db.prepare('INSERT INTO pvp_seasons (season_number, start_date, status) VALUES (?, ?, ?)');
    insertSeason.run(1, new Date().toISOString(), 'active');
  }
} catch (e) {
  console.log('Season tables already exist or migration skipped');
}

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
  insertTournament: db.prepare(`INSERT INTO tournaments (name, type, legs, max_players, status, creator_jid)
    VALUES (?, ?, ?, ?, 'registration', ?)`),
  getTournament: db.prepare('SELECT * FROM tournaments WHERE id = ?'),
  getActiveTournaments: db.prepare("SELECT * FROM tournaments WHERE status != 'completed'"),
  insertParticipant: db.prepare('INSERT INTO tournament_participants (tournament_id, user_jid, squad_name) VALUES (?, ?, ?)'),
  findParticipant: db.prepare('SELECT * FROM tournament_participants WHERE tournament_id = ? AND user_jid = ?'),
  deleteParticipant: db.prepare('DELETE FROM tournament_participants WHERE tournament_id = ? AND user_jid = ?'),
  getParticipants: db.prepare('SELECT * FROM tournament_participants WHERE tournament_id = ?'),
  insertMatch: db.prepare(`INSERT INTO tournament_matches (tournament_id, player1_jid, player2_jid, round_number, match_status)
    VALUES (?, ?, ?, ?, 'pending')`),
  getTournamentMatches: db.prepare('SELECT * FROM tournament_matches WHERE tournament_id = ?'),
  updateMatchResult: db.prepare("UPDATE tournament_matches SET player1_score = ?, player2_score = ?, winner_jid = ?, match_status = 'pending_approval' WHERE id = ?"),
  approveTournamentMatch: db.prepare("UPDATE tournament_matches SET match_status = 'approved', approved_by = ? WHERE id = ?"),
  rejectTournamentMatch: db.prepare("UPDATE tournament_matches SET match_status = 'rejected', approved_by = ?, rejection_reason = ? WHERE id = ?"),
  updateMatchStatus: db.prepare("UPDATE tournament_matches SET match_status = ? WHERE id = ?"),
  getMatchById: db.prepare('SELECT * FROM tournament_matches WHERE id = ?'),
  getTournamentPendingApproval: db.prepare("SELECT * FROM tournament_matches WHERE tournament_id = ? AND match_status = 'pending_approval'"),
  getTournamentApproved: db.prepare("SELECT * FROM tournament_matches WHERE tournament_id = ? AND match_status = 'approved'"),
  getTournamentCompleted: db.prepare("SELECT * FROM tournament_matches WHERE tournament_id = ? AND (match_status = 'approved' OR match_status = 'completed')"),
  updateTournamentRound: db.prepare('UPDATE tournaments SET current_round = ? WHERE id = ?'),
  updateTournamentStatus: db.prepare("UPDATE tournaments SET status = ?, started_at = CASE WHEN ? = 'in_progress' AND started_at IS NULL THEN datetime('now') ELSE started_at END, ended_at = CASE WHEN ? = 'completed' THEN datetime('now') ELSE ended_at END, winner_jid = CASE WHEN ? = 'completed' THEN ? ELSE winner_jid END WHERE id = ?"),

  // Tournament standings
  findStanding: db.prepare('SELECT * FROM tournament_standings WHERE tournament_id = ? AND user_jid = ?'),
  insertStanding: db.prepare(`INSERT INTO tournament_standings (tournament_id, user_jid, played, wins, draws, losses, goals_for, goals_against, points, status)
    VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0, 'active')`),
  getStandings: db.prepare('SELECT * FROM tournament_standings WHERE tournament_id = ? ORDER BY points DESC, (goals_for - goals_against) DESC, goals_for DESC'),
  getStandingByPosition: db.prepare('SELECT * FROM tournament_standings WHERE tournament_id = ? AND position = ?'),
  updateStandingPosition: db.prepare('UPDATE tournament_standings SET position = ? WHERE id = ?'),
  updateStandingStats: db.prepare(`UPDATE tournament_standings SET played = played + 1, wins = wins + ?, draws = draws + ?, losses = losses + ?,
    goals_for = goals_for + ?, goals_against = goals_against + ?, points = points + ?, updated_at = datetime('now') WHERE tournament_id = ? AND user_jid = ?`),
  deleteStandings: db.prepare('DELETE FROM tournament_standings WHERE tournament_id = ?'),

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
  getSeasonStatsSum: db.prepare(`
    SELECT 
      SUM(points) as total_points,
      SUM(wins) as total_wins,
      SUM(draws) as total_draws,
      SUM(losses) as total_losses,
      SUM(goals_for) as total_goals_for,
      SUM(goals_against) as total_goals_against,
      SUM(matches_played) as total_matches_played
    FROM pvp_season_stats
    WHERE user_jid = ?
  `),

  // PVP Seasons
  createSeason: db.prepare('INSERT INTO pvp_seasons (season_number, start_date, status) VALUES (?, ?, ?)'),
  getCurrentSeason: db.prepare("SELECT * FROM pvp_seasons WHERE status = 'active' ORDER BY season_number DESC LIMIT 1"),
  getSeasonById: db.prepare('SELECT * FROM pvp_seasons WHERE id = ?'),
  closeSeason: db.prepare("UPDATE pvp_seasons SET status = 'closed', end_date = datetime('now') WHERE id = ?"),
  getAllSeasons: db.prepare('SELECT * FROM pvp_seasons ORDER BY season_number DESC'),

  // PVP Season Stats
  findSeasonStats: db.prepare('SELECT * FROM pvp_season_stats WHERE season_id = ? AND user_jid = ?'),
  insertSeasonStats: db.prepare(`INSERT INTO pvp_season_stats (season_id, user_jid, points, wins, draws, losses, goals_for, goals_against, matches_played)
    VALUES (?, ?, 0, 0, 0, 0, 0, 0, 0)`),
  updateSeasonStats: db.prepare(`UPDATE pvp_season_stats SET goals_for = goals_for + ?, goals_against = goals_against + ?,
    points = points + ?, wins = wins + ?, draws = draws + ?, losses = losses + ?, matches_played = matches_played + 1, updated_at = datetime('now')
    WHERE season_id = ? AND user_jid = ?`),
  getSeasonLeaderboard: db.prepare('SELECT * FROM pvp_season_stats WHERE season_id = ? ORDER BY points DESC, (goals_for - goals_against) DESC LIMIT ?'),
  getSeasonStats: db.prepare('SELECT * FROM pvp_season_stats WHERE season_id = ? AND user_jid = ?'),
  updateSeasonPositions: db.prepare('UPDATE pvp_season_stats SET position = ? WHERE id = ?'),
  archiveCurrentStats: db.prepare(`
    INSERT INTO pvp_season_stats (season_id, user_jid, points, wins, draws, losses, goals_for, goals_against, matches_played)
    SELECT ?, user_jid, points, wins, draws, losses, goals_for, goals_against, matches_played FROM pvp_stats
  `),
  resetCurrentStats: db.prepare('UPDATE pvp_stats SET points = 0, wins = 0, draws = 0, losses = 0, goals_for = 0, goals_against = 0, matches_played = 0'),

  // PVP Clear operations
  clearAllPvpMatches: db.prepare('DELETE FROM pvp_matches'),
  clearAllPvpStats: db.prepare('DELETE FROM pvp_stats'),
  clearAllPvpSeasonStats: db.prepare('DELETE FROM pvp_season_stats'),
  clearAllPvpSeasons: db.prepare('DELETE FROM pvp_seasons'),

  // Challenge Records
  insertChallengeRecord: db.prepare(`
    INSERT INTO challenge_records (user_jid, record_date, completed_challenges, total_reward, matches_played, wins, draws, losses)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(user_jid, record_date) DO UPDATE SET
      completed_challenges = excluded.completed_challenges,
      total_reward = excluded.total_reward,
      matches_played = excluded.matches_played,
      wins = excluded.wins,
      draws = excluded.draws,
      losses = excluded.losses,
      updated_at = datetime('now')
  `),
  getChallengeRecord: db.prepare('SELECT * FROM challenge_records WHERE user_jid = ? AND record_date = ?'),
  getChallengeRecordsByDateRange: db.prepare(`
    SELECT * FROM challenge_records 
    WHERE user_jid = ? AND record_date >= ? AND record_date <= ?
    ORDER BY record_date DESC
  `),
  getChallengeRecordsByUser: db.prepare(`
    SELECT * FROM challenge_records 
    WHERE user_jid = ? 
    ORDER BY record_date DESC 
    LIMIT ?
  `),
  getAllChallengeRecords: db.prepare(`
    SELECT * FROM challenge_records 
    WHERE record_date >= ? AND record_date <= ?
    ORDER BY record_date DESC, total_reward DESC
  `),
  deleteChallengeRecordsOlderThan: db.prepare('DELETE FROM challenge_records WHERE record_date < ?'),
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
  create: (name: string, type: string, legs: number, maxPlayers: number | null, creatorJid: string): any => {
    const result = stmts.insertTournament.run(name, type, legs, maxPlayers, creatorJid);
    return stmts.getTournament.get(result.lastInsertRowid);
  },

  get: (id: number): any => {
    return stmts.getTournament.get(id);
  },

  getActive: (): any[] => {
    return stmts.getActiveTournaments.all();
  },

  updateStatus: (id: number, status: string, winnerJid?: string): void => {
    stmts.updateTournamentStatus.run(status, status, status, status, winnerJid || null, id);
  },

  addParticipant: (tournamentId: number, userJid: string, squadName?: string): void => {
    const existing = stmts.findParticipant.get(tournamentId, userJid);
    if (!existing) {
      stmts.insertParticipant.run(tournamentId, userJid, squadName || 'No Squad');
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
    return stmts.getMatchById.get(result.lastInsertRowid);
  },

  getMatches: (tournamentId: number): any[] => {
    return stmts.getTournamentMatches.all(tournamentId);
  },

  getMatchById: (matchId: number): any => {
    return stmts.getMatchById.get(matchId);
  },

  // ===== MATCH RESULT SUBMISSION (with approval) =====

  submitResult: (matchId: number, player1Score: number, player2Score: number, winnerJid: string): void => {
    stmts.updateMatchResult.run(player1Score, player2Score, winnerJid, matchId);
  },

  approveMatch: (matchId: number, adminJid: string): void => {
    stmts.approveTournamentMatch.run(adminJid, matchId);
  },

  rejectMatch: (matchId: number, adminJid: string, reason: string): void => {
    stmts.rejectTournamentMatch.run(adminJid, reason, matchId);
  },

  getPendingApproval: (tournamentId: number): any[] => {
    return stmts.getTournamentPendingApproval.all(tournamentId);
  },

  getApprovedMatches: (tournamentId: number): any[] => {
    return stmts.getTournamentApproved.all(tournamentId);
  },

  getCompletedMatches: (tournamentId: number): any[] => {
    return stmts.getTournamentCompleted.all(tournamentId);
  },

  updateMatchStatus: (matchId: number, status: string): void => {
    stmts.updateMatchStatus.run(status, matchId);
  },

  updateRound: (tournamentId: number, round: number): void => {
    stmts.updateTournamentRound.run(round, tournamentId);
  },

  // ===== TOURNAMENT STANDINGS (isolated per tournament) =====

  getOrCreateStanding: (tournamentId: number, userJid: string): any => {
    let standing = stmts.findStanding.get(tournamentId, userJid);
    if (!standing) {
      stmts.insertStanding.run(tournamentId, userJid);
      standing = stmts.findStanding.get(tournamentId, userJid);
    }
    return standing;
  },

  getStandings: (tournamentId: number): any[] => {
    return stmts.getStandings.all(tournamentId);
  },

  updateStandingAfterMatch: (tournamentId: number, userJid: string, goalsFor: number, goalsAgainst: number, result: 'win' | 'draw' | 'loss'): void => {
    tournamentOps.getOrCreateStanding(tournamentId, userJid);

    let wins = 0, draws = 0, losses = 0, points = 0;
    if (result === 'win') { wins = 1; points = 3; }
    else if (result === 'draw') { draws = 1; points = 1; }
    else { losses = 1; }

    stmts.updateStandingStats.run(wins, draws, losses, goalsFor, goalsAgainst, points, tournamentId, userJid);
  },

  applyMatchToStandings: (tournamentId: number, player1Jid: string, player2Jid: string, player1Score: number, player2Score: number): void => {
    let result1: 'win' | 'draw' | 'loss';
    let result2: 'win' | 'draw' | 'loss';

    if (player1Score > player2Score) {
      result1 = 'win'; result2 = 'loss';
    } else if (player1Score < player2Score) {
      result1 = 'loss'; result2 = 'win';
    } else {
      result1 = 'draw'; result2 = 'draw';
    }

    tournamentOps.updateStandingAfterMatch(tournamentId, player1Jid, player1Score, player2Score, result1);
    tournamentOps.updateStandingAfterMatch(tournamentId, player2Jid, player2Score, player1Score, result2);
  },

  recalculatePositions: (tournamentId: number): void => {
    const standings = stmts.getStandings.all(tournamentId) as any[];
    standings.forEach((s, i) => {
      stmts.updateStandingPosition.run(i + 1, s.id);
    });
  },

  clearStandings: (tournamentId: number): void => {
    stmts.deleteStandings.run(tournamentId);
  },
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

  getLeaderboard: (limit: number = 10): any[] => {
    return stmts.getPvpLeaderboard.all(limit);
  },

  get: (userJid: string): any | null => {
    return stmts.findPvpStats.get(userJid) || null;
  },

  // Get all-time stats (sum of all seasons + current)
  getAllTimeStats: (userJid: string): any => {
    try {
      const currentStats = stmts.findPvpStats.get(userJid) as any;
      const seasonStats = stmts.getSeasonStatsSum.get(userJid) as any;

      // Combine current season + all past seasons
      return {
        points: (currentStats?.points || 0) + (seasonStats?.total_points || 0),
        wins: (currentStats?.wins || 0) + (seasonStats?.total_wins || 0),
        draws: (currentStats?.draws || 0) + (seasonStats?.total_draws || 0),
        losses: (currentStats?.losses || 0) + (seasonStats?.total_losses || 0),
        goals_for: (currentStats?.goals_for || 0) + (seasonStats?.total_goals_for || 0),
        goals_against: (currentStats?.goals_against || 0) + (seasonStats?.total_goals_against || 0),
        matches_played: (currentStats?.matches_played || 0) + (seasonStats?.total_matches_played || 0),
      };
    } catch (error) {
      console.error('Error getting all-time stats:', error);
      return null;
    }
  },

  applyMatchStats: (player1Jid: string, player2Jid: string, player1Score: number, player2Score: number): void => {
    // Ensure both players exist
    pvpStatsOps.getOrCreate(player1Jid);
    pvpStatsOps.getOrCreate(player2Jid);

    // Determine results
    let result1: 'win' | 'draw' | 'loss';
    let result2: 'win' | 'draw' | 'loss';
    let points1: number;
    let points2: number;
    let wins1: number, draws1: number, losses1: number;
    let wins2: number, draws2: number, losses2: number;

    if (player1Score > player2Score) {
      result1 = 'win'; result2 = 'loss';
      points1 = 3; points2 = 0;
      wins1 = 1; draws1 = 0; losses1 = 0;
      wins2 = 0; draws2 = 0; losses2 = 1;
    } else if (player1Score < player2Score) {
      result1 = 'loss'; result2 = 'win';
      points1 = 0; points2 = 3;
      wins1 = 0; draws1 = 0; losses1 = 1;
      wins2 = 1; draws2 = 0; losses2 = 0;
    } else {
      result1 = 'draw'; result2 = 'draw';
      points1 = 1; points2 = 1;
      wins1 = 0; draws1 = 1; losses1 = 0;
      wins2 = 0; draws2 = 1; losses2 = 0;
    }

    // Get current active season
    const seasonId = seasonOps.getCurrentSeasonId();

    // Use transaction for atomic updates
    const updatePlayer1 = db.transaction(() => {
      stmts.updateSeasonStats.run(
        player1Score, player2Score, points1, wins1, draws1, losses1,
        seasonId, player1Jid
      );
    });

    const updatePlayer2 = db.transaction(() => {
      stmts.updateSeasonStats.run(
        player2Score, player1Score, points2, wins2, draws2, losses2,
        seasonId, player2Jid
      );
    });

    // Update season stats (current active season)
    try {
      updatePlayer1();
      updatePlayer2();
    } catch (e) {
      console.error('Error updating season stats:', e);
    }

    // Update global stats (for all-time leaderboard)
    const updateGlobalPlayer1 = db.transaction(() => {
      stmts.updatePvpStats.run(player1Score, player2Score, points1, player1Jid);
      if (wins1) stmts.incrementPvpWin.run(player1Jid);
      if (draws1) stmts.incrementPvpDraw.run(player1Jid);
      if (losses1) stmts.incrementPvpLoss.run(player1Jid);
    });

    const updateGlobalPlayer2 = db.transaction(() => {
      stmts.updatePvpStats.run(player2Score, player1Score, points2, player2Jid);
      if (wins2) stmts.incrementPvpWin.run(player2Jid);
      if (draws2) stmts.incrementPvpDraw.run(player2Jid);
      if (losses2) stmts.incrementPvpLoss.run(player2Jid);
    });

    try {
      updateGlobalPlayer1();
      updateGlobalPlayer2();
    } catch (e) {
      console.error('Error updating global stats:', e);
    }
  }
};

// ==================== PVP SEASON OPERATIONS ====================

export const seasonOps = {
  getCurrentSeasonId: (): number => {
    const season = stmts.getCurrentSeason.get() as any;
    if (!season) {
      // Create first season if none exists
      const result = stmts.createSeason.run(1, new Date().toISOString(), 'active');
      return result.lastInsertRowid as number;
    }
    return season.id;
  },

  getCurrentSeason: (): any => {
    return stmts.getCurrentSeason.get();
  },

  createNewSeason: (): any => {
    // Close current season (mark as inactive)
    const currentSeason = stmts.getCurrentSeason.get() as any;
    if (currentSeason) {
      stmts.closeSeason.run(currentSeason.id);
      console.log(`📊 Season ${currentSeason.season_number} closed (inactive)`);
    }

    // Create new season (mark as active)
    const nextSeasonNumber = (currentSeason?.season_number || 0) + 1;
    const result = stmts.createSeason.run(nextSeasonNumber, new Date().toISOString(), 'active');
    
    // Reset all current stats for new season
    stmts.resetCurrentStats.run();

    return stmts.getSeasonById.get(result.lastInsertRowid);
  },

  getSeasonLeaderboard: (seasonId: number, limit: number = 10): any[] => {
    return stmts.getSeasonLeaderboard.all(seasonId, limit);
  },

  getCurrentSeasonLeaderboard: (limit: number = 10): any[] => {
    const seasonId = seasonOps.getCurrentSeasonId();
    return stmts.getSeasonLeaderboard.all(seasonId, limit);
  },

  getSeasonStats: (seasonId: number, userJid: string): any => {
    return stmts.getSeasonStats.get(seasonId, userJid);
  },

  getAllSeasons: (): any[] => {
    return stmts.getAllSeasons.all();
  },

  updateSeasonPositions: (seasonId: number): void => {
    const leaderboard = stmts.getSeasonLeaderboard.all(seasonId, 10000) as any[];
    leaderboard.forEach((stat, index) => {
      stmts.updateSeasonPositions.run(index + 1, stat.id);
    });
  },

  // Clear all PVP records (admin only)
  clearAllPvpRecords: (): void => {
    try {
      stmts.clearAllPvpMatches.run();
      stmts.clearAllPvpStats.run();
      stmts.clearAllPvpSeasonStats.run();
      stmts.clearAllPvpSeasons.run();
      console.log('✅ All PVP records cleared');
    } catch (error) {
      console.error('Error clearing PVP records:', error);
      throw error;
    }
  },

  // Reinitialize PVP system (create Season 1)
  reinitializePvp: (): any => {
    try {
      // Clear everything first
      seasonOps.clearAllPvpRecords();
      
      // Create Season 1
      const result = stmts.createSeason.run(1, new Date().toISOString(), 'active');
      const season = stmts.getSeasonById.get(result.lastInsertRowid);
      console.log('✅ PVP system reinitialized - Season 1 created');
      return season;
    } catch (error) {
      console.error('Error reinitializing PVP:', error);
      throw error;
    }
  }
};
