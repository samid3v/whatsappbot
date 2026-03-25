export declare class WarnManager {
    private warnThreshold;
    private muteDurationHours;
    warnUser(jid: string, groupJid: string, reason?: string): Promise<{
        success: boolean;
        warning: number;
        message: string;
        shouldMute: boolean;
    }>;
    getWarnings(jid: string): Promise<number>;
    clearWarnings(jid: string, groupJid: string): Promise<boolean>;
    checkUserWarnings(jid: string): Promise<number>;
}
export declare const warnManager: WarnManager;
export default warnManager;
//# sourceMappingURL=warn-manager.d.ts.map