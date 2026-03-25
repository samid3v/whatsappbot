export declare class MuteManager {
    private muteTimers;
    muteUser(jid: string, groupJid: string, durationMinutes: number, reason?: string): Promise<{
        success: boolean;
        expiresAt: string;
        message: string;
    }>;
    unmuteUser(jid: string, groupJid: string): Promise<{
        success: boolean;
        message: string;
    }>;
    isMuted(jid: string): Promise<boolean>;
    checkExpiredMutes(): Promise<void>;
    getMuteExpiry(jid: string): string | null;
}
export declare const muteManager: MuteManager;
export default muteManager;
//# sourceMappingURL=mute-manager.d.ts.map