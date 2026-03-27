export declare const userOps: {
    getOrCreate: (jid: string, name?: string) => any;
    get: (jid: string) => any;
    updateRole: (jid: string, role: string) => void;
    addWarning: (jid: string) => any;
    clearWarnings: (jid: string) => void;
    mute: (jid: string, expiresAt: string) => void;
    unmute: (jid: string) => void;
    getMutedUsers: () => any[];
    getExpiredMutes: () => any[];
    updateName: (jid: string, name: string) => void;
    incrementMutedMessageCount: (jid: string) => number;
    getMutedMessageCount: (jid: string) => number;
    setMutedSpamWarning: (jid: string, warned: boolean) => void;
    hasMutedSpamWarning: (jid: string) => boolean;
    clearMutedSpamData: (jid: string) => void;
    incrementLinkCount: (jid: string) => number;
    getLinkCount: (jid: string) => number;
    clearLinkSpamData: (jid: string) => void;
};
export declare const statsOps: {
    getOrCreate: (userJid: string) => any;
    incrementWin: (userJid: string) => void;
    incrementLoss: (userJid: string) => void;
    incrementDraw: (userJid: string) => void;
    addGoals: (userJid: string, scored: number, conceded: number) => void;
    recordWin: (userJid: string, goalsScored: number, goalsConceded: number) => void;
    recordLoss: (userJid: string, goalsScored: number, goalsConceded: number) => void;
    recordDraw: (userJid: string, goalsScored: number, goalsConceded: number) => void;
    getLeaderboard: (limit?: number) => any[];
};
export declare const tournamentOps: {
    create: (name: string, type: string, maxPlayers: number | null, creatorJid: string) => any;
    get: (id: number) => any;
    getActive: () => any[];
    updateStatus: (id: number, status: string) => void;
    addParticipant: (tournamentId: number, userJid: string) => void;
    removeParticipant: (tournamentId: number, userJid: string) => void;
    getParticipants: (tournamentId: number) => any[];
    addMatch: (tournamentId: number, player1Jid: string, player2Jid: string, roundNumber: number) => any;
    getMatches: (tournamentId: number) => any[];
    updateMatchResult: (matchId: number, player1Score: number, player2Score: number) => void;
};
export default tournamentOps;
export declare const logOps: {
    add: (action: string, userJid: string, targetJid?: string, details?: string) => void;
    getByGroup: (groupJid: string, limit?: number) => any[];
};
export declare const settingsOps: {
    get: (key: string) => string | null;
    set: (key: string, value: string) => void;
};
export declare const pvpOps: {
    recordMatch: (player1Jid: string, player2Jid: string, player1Score: number, player2Score: number) => any;
    getMatchHistory: (userJid: string, limit?: number) => any[];
    getAllMatches: () => any[];
    getPendingMatches: () => any[];
    getById: (matchId: number) => any;
    approve: (matchId: number, adminJid: string) => void;
    reject: (matchId: number, adminJid: string, reason: string) => void;
    findPending: (player1Jid: string, player2Jid: string, player1Score: number, player2Score: number) => any;
};
export declare const pvpStatsOps: {
    getOrCreate: (userJid: string) => any;
    updateAfterMatch: (userJid: string, goalsFor: number, goalsAgainst: number, result: "win" | "draw" | "loss", points: number) => void;
    getLeaderboard: (limit?: number) => any[];
    get: (userJid: string) => any | null;
    applyMatchStats: (player1Jid: string, player2Jid: string, player1Score: number, player2Score: number) => void;
};
//# sourceMappingURL=db.d.ts.map