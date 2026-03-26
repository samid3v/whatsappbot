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
exports.settingsOps = exports.logOps = exports.tournamentOps = exports.statsOps = exports.userOps = void 0;
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
// Helper function to find user by JID or phone number
function findUserByJid(jid) {
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
function getPhoneNumber(jid) {
    return jid.replace('@s.whatsapp.net', '').replace('@lid', '').replace('@g.us', '');
}
// Helper to find any user by their phone number (checks all stored JIDs)
function findUserByPhoneNumber(phoneNumber) {
    if (!phoneNumber)
        return null;
    return db.users.find(u => {
        const userPhone = getPhoneNumber(u.jid);
        return userPhone === phoneNumber;
    });
}
// User operations
exports.userOps = {
    getOrCreate: (jid, name) => {
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
    get: (jid) => {
        return findUserByJid(jid);
    },
    updateRole: (jid, role) => {
        const user = findUserByJid(jid);
        if (user) {
            user.role = role;
            saveDatabase(db);
        }
    },
    addWarning: (jid) => {
        const user = findUserByJid(jid);
        if (user) {
            user.warnings = (user.warnings || 0) + 1;
            saveDatabase(db);
        }
        return user;
    },
    clearWarnings: (jid) => {
        const user = findUserByJid(jid);
        if (user) {
            user.warnings = 0;
            saveDatabase(db);
        }
    },
    mute: (jid, expiresAt) => {
        const user = findUserByJid(jid);
        if (user) {
            user.is_muted = 1;
            user.mute_expires_at = expiresAt;
            saveDatabase(db);
        }
    },
    unmute: (jid) => {
        const user = findUserByJid(jid);
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
        const user = findUserByJid(jid);
        if (user) {
            user.name = name;
            saveDatabase(db);
        }
    },
    // Increment count of messages sent while muted
    incrementMutedMessageCount: (jid) => {
        // First ensure user has the field
        let user = findUserByJid(jid);
        if (!user) {
            // User doesn't exist, create them
            user = exports.userOps.getOrCreate(jid);
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
    getMutedMessageCount: (jid) => {
        const user = findUserByJid(jid);
        return user?.muted_messages_count || 0;
    },
    // Set spam warning flag
    setMutedSpamWarning: (jid, warned) => {
        const user = findUserByJid(jid);
        if (user) {
            user.muted_spam_warning = warned;
            saveDatabase(db);
        }
    },
    // Check if user has spam warning
    hasMutedSpamWarning: (jid) => {
        const user = findUserByJid(jid);
        return !!user?.muted_spam_warning;
    },
    // Clear muted message count and spam warning (when unmuted)
    clearMutedSpamData: (jid) => {
        const user = findUserByJid(jid);
        if (user) {
            user.muted_messages_count = 0;
            user.muted_spam_warning = false;
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
    incrementWin: (userJid) => {
        const stats = db.player_stats.find(s => s.user_jid === userJid);
        if (stats) {
            stats.wins = (stats.wins || 0) + 1;
            stats.updated_at = new Date().toISOString();
            saveDatabase(db);
        }
    },
    incrementLoss: (userJid) => {
        const stats = db.player_stats.find(s => s.user_jid === userJid);
        if (stats) {
            stats.losses = (stats.losses || 0) + 1;
            stats.updated_at = new Date().toISOString();
            saveDatabase(db);
        }
    },
    incrementDraw: (userJid) => {
        const stats = db.player_stats.find(s => s.user_jid === userJid);
        if (stats) {
            stats.draws = (stats.draws || 0) + 1;
            stats.updated_at = new Date().toISOString();
            saveDatabase(db);
        }
    },
    addGoals: (userJid, scored, conceded) => {
        const stats = db.player_stats.find(s => s.user_jid === userJid);
        if (stats) {
            stats.goals_scored = (stats.goals_scored || 0) + scored;
            stats.goals_conceded = (stats.goals_conceded || 0) + conceded;
            stats.updated_at = new Date().toISOString();
            saveDatabase(db);
        }
    },
    recordWin: (userJid, goalsScored, goalsConceded) => {
        exports.statsOps.getOrCreate(userJid);
        exports.statsOps.incrementWin(userJid);
        exports.statsOps.addGoals(userJid, goalsScored, goalsConceded);
    },
    recordLoss: (userJid, goalsScored, goalsConceded) => {
        exports.statsOps.getOrCreate(userJid);
        exports.statsOps.incrementLoss(userJid);
        exports.statsOps.addGoals(userJid, goalsScored, goalsConceded);
    },
    recordDraw: (userJid, goalsScored, goalsConceded) => {
        exports.statsOps.getOrCreate(userJid);
        exports.statsOps.incrementDraw(userJid);
        exports.statsOps.addGoals(userJid, goalsScored, goalsConceded);
    },
    getLeaderboard: (limit = 10) => {
        return db.player_stats
            .sort((a, b) => (b.wins || 0) - (a.wins || 0))
            .slice(0, limit);
    }
};
// Tournament operations
exports.tournamentOps = {
    create: (name, type, maxPlayers, creatorJid) => {
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
    get: (id) => {
        return db.tournaments.find(t => t.id === id);
    },
    getActive: () => {
        return db.tournaments.filter(t => t.status !== 'completed');
    },
    updateStatus: (id, status) => {
        const tournament = db.tournaments.find(t => t.id === id);
        if (tournament) {
            tournament.status = status;
            saveDatabase(db);
        }
    },
    addParticipant: (tournamentId, userJid) => {
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
    removeParticipant: (tournamentId, userJid) => {
        const index = db.tournament_participants.findIndex(p => p.tournament_id === tournamentId && p.user_jid === userJid);
        if (index !== -1) {
            db.tournament_participants.splice(index, 1);
            saveDatabase(db);
        }
    },
    getParticipants: (tournamentId) => {
        return db.tournament_participants.filter(p => p.tournament_id === tournamentId);
    },
    addMatch: (tournamentId, player1Jid, player2Jid, roundNumber) => {
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
    getMatches: (tournamentId) => {
        return db.tournament_matches.filter(m => m.tournament_id === tournamentId);
    },
    updateMatchResult: (matchId, player1Score, player2Score) => {
        const match = db.tournament_matches.find(m => m.id === matchId);
        if (match) {
            match.player1_score = player1Score;
            match.player2_score = player2Score;
            match.status = 'completed';
            saveDatabase(db);
        }
    }
};
exports.default = exports.tournamentOps;
// Log operations
exports.logOps = {
    add: (action, userJid, targetJid, details) => {
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
    getByGroup: (groupJid, limit = 10) => {
        return db.logs
            .filter(l => l.user_jid === groupJid || l.target_jid === groupJid)
            .slice(-limit)
            .reverse();
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
    }
};
//# sourceMappingURL=db.js.map