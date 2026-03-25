"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.tournamentOps = exports.logOps = exports.settingsOps = exports.statsOps = exports.userOps = void 0;
// Simple JSON file-based database (no native modules needed)
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const dataPath = path.join(__dirname, '../../data');
const dbPath = path.join(dataPath, 'bot.json');
// Ensure data directory exists
if (!fs.existsSync(dataPath)) {
    fs.mkdirSync(dataPath, { recursive: true });
}
// Load or create database
function loadDatabase() {
    if (fs.existsSync(dbPath)) {
        try {
            const data = fs.readFileSync(dbPath, 'utf-8');
            return JSON.parse(data);
        }
        catch {
            return createEmptyDatabase();
        }
    }
    return createEmptyDatabase();
}
function createEmptyDatabase() {
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
function saveDatabase(data) {
    fs.writeFileSync(dbPath, JSON.stringify(data, null, 2));
}
let db = loadDatabase();
// Auto-save every 30 seconds
setInterval(() => {
    saveDatabase(db);
}, 30000);
// User operations
exports.userOps = {
    getOrCreate: (jid, name) => {
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
    get: (jid) => {
        return db.users.find(u => u.jid === jid);
    },
    updateRole: (jid, role) => {
        const user = db.users.find(u => u.jid === jid);
        if (user) {
            user.role = role;
            saveDatabase(db);
        }
    },
    addWarning: (jid) => {
        const user = db.users.find(u => u.jid === jid);
        if (user) {
            user.warnings = (user.warnings || 0) + 1;
            saveDatabase(db);
        }
        return user;
    },
    clearWarnings: (jid) => {
        const user = db.users.find(u => u.jid === jid);
        if (user) {
            user.warnings = 0;
            saveDatabase(db);
        }
    },
    mute: (jid, expiresAt) => {
        const user = db.users.find(u => u.jid === jid);
        if (user) {
            user.is_muted = 1;
            user.mute_expires_at = expiresAt;
            saveDatabase(db);
        }
    },
    unmute: (jid) => {
        const user = db.users.find(u => u.jid === jid);
        if (user) {
            user.is_muted = 0;
            user.mute_expires_at = null;
            saveDatabase(db);
        }
    },
    getMutedUsers: () => {
        return db.users.filter(u => u.is_muted === 1 && u.mute_expires_at);
    },
    getExpiredMutes: () => {
        const now = new Date().toISOString();
        return db.users.filter(u => u.is_muted === 1 && u.mute_expires_at && u.mute_expires_at <= now);
    },
    updateName: (jid, name) => {
        const user = db.users.find(u => u.jid === jid);
        if (user) {
            user.name = name;
            saveDatabase(db);
        }
    }
};
// Player stats operations
exports.statsOps = {
    getOrCreate: (userJid) => {
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
    recordWin: (userJid, goalsFor, goalsAgainst) => {
        const stats = db.player_stats.find(s => s.user_jid === userJid);
        if (stats) {
            stats.wins = (stats.wins || 0) + 1;
            stats.goals_scored = (stats.goals_scored || 0) + goalsFor;
            stats.goals_conceded = (stats.goals_conceded || 0) + goalsAgainst;
            stats.updated_at = new Date().toISOString();
            saveDatabase(db);
        }
    },
    recordLoss: (userJid, goalsFor, goalsAgainst) => {
        const stats = db.player_stats.find(s => s.user_jid === userJid);
        if (stats) {
            stats.losses = (stats.losses || 0) + 1;
            stats.goals_scored = (stats.goals_scored || 0) + goalsFor;
            stats.goals_conceded = (stats.goals_conceded || 0) + goalsAgainst;
            stats.updated_at = new Date().toISOString();
            saveDatabase(db);
        }
    },
    recordDraw: (userJid, goalsFor, goalsAgainst) => {
        const stats = db.player_stats.find(s => s.user_jid === userJid);
        if (stats) {
            stats.draws = (stats.draws || 0) + 1;
            stats.goals_scored = (stats.goals_scored || 0) + goalsFor;
            stats.goals_conceded = (stats.goals_conceded || 0) + goalsAgainst;
            stats.updated_at = new Date().toISOString();
            saveDatabase(db);
        }
    },
    incrementTournamentsPlayed: (userJid) => {
        const stats = db.player_stats.find(s => s.user_jid === userJid);
        if (stats) {
            stats.tournaments_played = (stats.tournaments_played || 0) + 1;
            stats.updated_at = new Date().toISOString();
            saveDatabase(db);
        }
    },
    incrementTournamentsWon: (userJid) => {
        const stats = db.player_stats.find(s => s.user_jid === userJid);
        if (stats) {
            stats.tournaments_won = (stats.tournaments_won || 0) + 1;
            stats.updated_at = new Date().toISOString();
            saveDatabase(db);
        }
    },
    incrementChallengesCompleted: (userJid) => {
        const stats = db.player_stats.find(s => s.user_jid === userJid);
        if (stats) {
            stats.challenge_completed = (stats.challenge_completed || 0) + 1;
            stats.updated_at = new Date().toISOString();
            saveDatabase(db);
        }
    },
    getLeaderboard: (limit = 10) => {
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
exports.settingsOps = {
    get: (key) => {
        const setting = db.settings.find(s => s.key === key);
        return setting?.value || null;
    },
    set: (key, value) => {
        const setting = db.settings.find(s => s.key === key);
        if (setting) {
            setting.value = value;
        }
        else {
            db.settings.push({ key, value });
        }
        saveDatabase(db);
    },
    delete: (key) => {
        db.settings = db.settings.filter(s => s.key !== key);
        saveDatabase(db);
    }
};
// Log operations
exports.logOps = {
    add: (action, userJid, targetJid, details) => {
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
    getRecent: (limit = 50) => {
        return db.logs.slice(-limit).reverse();
    }
};
// Tournament operations
exports.tournamentOps = {
    create: (name, type, maxPlayers, createdBy) => {
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
    get: (id) => {
        return db.tournaments.find(t => t.id === id);
    },
    getActive: () => {
        return db.tournaments.filter(t => t.status === 'registration' || t.status === 'in_progress');
    },
    start: (id) => {
        const t = db.tournaments.find(t => t.id === id);
        if (t) {
            t.status = 'in_progress';
            t.started_at = new Date().toISOString();
            saveDatabase(db);
        }
    },
    complete: (id, winnerJid) => {
        const t = db.tournaments.find(t => t.id === id);
        if (t) {
            t.status = 'completed';
            t.ended_at = new Date().toISOString();
            exports.statsOps.incrementTournamentsWon(winnerJid);
            saveDatabase(db);
        }
    },
    addParticipant: (tournamentId, userJid, seed) => {
        const exists = db.tournament_participants.find(p => p.tournament_id === tournamentId && p.user_jid === userJid);
        if (!exists) {
            db.tournament_participants.push({
                id: db.tournament_participants.length + 1,
                tournament_id: tournamentId,
                user_jid: userJid,
                status: 'registered',
                seed: seed || null
            });
            exports.statsOps.incrementTournamentsPlayed(userJid);
            saveDatabase(db);
        }
    },
    removeParticipant: (tournamentId, userJid) => {
        db.tournament_participants = db.tournament_participants.filter(p => !(p.tournament_id === tournamentId && p.user_jid === userJid));
        saveDatabase(db);
    },
    getParticipants: (tournamentId) => {
        return db.tournament_participants
            .filter(p => p.tournament_id === tournamentId)
            .map(p => {
            const user = db.users.find(u => u.jid === p.user_jid);
            return { ...p, name: user?.name || p.user_jid.replace('@s.whatsapp.net', '') };
        });
    },
    createMatch: (tournamentId, player1Jid, player2Jid, round, matchNum) => {
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
    updateMatchResult: (matchId, player1Score, player2Score, winnerJid) => {
        const match = db.tournament_matches.find(m => m.id === matchId);
        if (match) {
            match.player1_score = player1Score;
            match.player2_score = player2Score;
            match.winner_jid = winnerJid;
            match.status = 'completed';
            saveDatabase(db);
        }
    },
    getMatches: (tournamentId) => {
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
exports.default = {
    userOps: exports.userOps,
    statsOps: exports.statsOps,
    settingsOps: exports.settingsOps,
    logOps: exports.logOps,
    tournamentOps: exports.tournamentOps
};
//# sourceMappingURL=db.js.map