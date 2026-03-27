declare class PvpManager {
    recordMatch(player1Jid: string, player2Jid: string, player1Score: number, player2Score: number, groupJid: string): Promise<string>;
    approveMatch(matchId: number, adminJid: string): Promise<string>;
    rejectMatch(matchId: number, adminJid: string, reason: string): Promise<string>;
    sendPendingMatches(groupJid: string): Promise<void>;
    sendLeaderboard(groupJid: string, limit?: number): Promise<void>;
    sendProfile(groupJid: string, targetJid: string): Promise<void>;
}
export declare const pvpManager: PvpManager;
export default pvpManager;
//# sourceMappingURL=pvp-manager.d.ts.map