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
};
export declare const statsOps: {
    getOrCreate: (userJid: string) => any;
    recordWin: (userJid: string, goalsFor: number, goalsAgainst: number) => void;
    recordLoss: (userJid: string, goalsFor: number, goalsAgainst: number) => void;
    recordDraw: (userJid: string, goalsFor: number, goalsAgainst: number) => void;
    incrementTournamentsPlayed: (userJid: string) => void;
    incrementTournamentsWon: (userJid: string) => void;
    incrementChallengesCompleted: (userJid: string) => void;
    getLeaderboard: (limit?: number) => any[];
};
export declare const settingsOps: {
    get: (key: string) => string | null;
    set: (key: string, value: string) => void;
    delete: (key: string) => void;
};
export declare const logOps: {
    add: (action: string, userJid?: string, targetJid?: string, details?: string) => void;
    getRecent: (limit?: number) => any[];
};
export declare const tournamentOps: {
    create: (name: string, type: string, maxPlayers: number | null, createdBy: string) => any;
    get: (id: number) => any;
    getActive: () => any[];
    start: (id: number) => void;
    complete: (id: number, winnerJid: string) => void;
    addParticipant: (tournamentId: number, userJid: string, seed?: number) => void;
    removeParticipant: (tournamentId: number, userJid: string) => void;
    getParticipants: (tournamentId: number) => any[];
    createMatch: (tournamentId: number, player1Jid: string, player2Jid: string | null, round: number, matchNum: number) => any;
    updateMatchResult: (matchId: number, player1Score: number, player2Score: number, winnerJid: string) => void;
    getMatches: (tournamentId: number) => any[];
};
declare const _default: {
    userOps: {
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
    };
    statsOps: {
        getOrCreate: (userJid: string) => any;
        recordWin: (userJid: string, goalsFor: number, goalsAgainst: number) => void;
        recordLoss: (userJid: string, goalsFor: number, goalsAgainst: number) => void;
        recordDraw: (userJid: string, goalsFor: number, goalsAgainst: number) => void;
        incrementTournamentsPlayed: (userJid: string) => void;
        incrementTournamentsWon: (userJid: string) => void;
        incrementChallengesCompleted: (userJid: string) => void;
        getLeaderboard: (limit?: number) => any[];
    };
    settingsOps: {
        get: (key: string) => string | null;
        set: (key: string, value: string) => void;
        delete: (key: string) => void;
    };
    logOps: {
        add: (action: string, userJid?: string, targetJid?: string, details?: string) => void;
        getRecent: (limit?: number) => any[];
    };
    tournamentOps: {
        create: (name: string, type: string, maxPlayers: number | null, createdBy: string) => any;
        get: (id: number) => any;
        getActive: () => any[];
        start: (id: number) => void;
        complete: (id: number, winnerJid: string) => void;
        addParticipant: (tournamentId: number, userJid: string, seed?: number) => void;
        removeParticipant: (tournamentId: number, userJid: string) => void;
        getParticipants: (tournamentId: number) => any[];
        createMatch: (tournamentId: number, player1Jid: string, player2Jid: string | null, round: number, matchNum: number) => any;
        updateMatchResult: (matchId: number, player1Score: number, player2Score: number, winnerJid: string) => void;
        getMatches: (tournamentId: number) => any[];
    };
};
export default _default;
//# sourceMappingURL=db.d.ts.map