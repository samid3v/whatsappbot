import { UserRole } from '../types';
export declare class RoleManager {
    private ownerJid;
    setOwner(jid: string): void;
    getOwner(): string;
    checkPermission(jid: string, requiredRole: UserRole): Promise<{
        hasPermission: boolean;
        userRole: UserRole;
        isOwner: boolean;
        isAdmin: boolean;
        isModerator: boolean;
    }>;
    setUserRole(jid: string, role: UserRole): Promise<boolean>;
    getUserRole(jid: string): Promise<UserRole>;
    getUserInfo(jid: string): Promise<{
        name: string | null;
        role: UserRole;
        warnings: number;
        isMuted: boolean;
        muteExpires: string | null;
    } | null>;
    isGroupAdmin(groupJid: string, userJid: string): Promise<boolean>;
    formatRole(role: UserRole): string;
}
export declare const roleManager: RoleManager;
export default roleManager;
//# sourceMappingURL=role-manager.d.ts.map