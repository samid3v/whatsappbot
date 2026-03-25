export declare class StatsManager {
    getPlayerStats(userJid: string): Promise<{
        wins: number;
        losses: number;
        draws: number;
        goalsScored: number;
        goalsConceded: number;
        tournamentsWon: number;
        tournamentsPlayed: number;
        challengesCompleted: number;
        winRate: number;
        avgGoals: number;
    } | null>;
    recordMatchResult(winnerJid: string, loserJid: string, winnerGoals: number, loserGoals: number, isDraw?: boolean): Promise<void>;
    getLeaderboard(limit?: number): Promise<any[]>;
    formatLeaderboard(limit?: number): Promise<string>;
    sendLeaderboard(jid: string, limit?: number): Promise<void>;
    sendProfile(jid: string, targetJid: string): Promise<void>;
}
export declare const statsManager: StatsManager;
export default statsManager;
//# sourceMappingURL=stats-manager.d.ts.map