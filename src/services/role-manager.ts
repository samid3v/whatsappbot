import { UserRole } from '../types';
import { userOps } from '../database/db';
import { waClient } from '../client';
import { hasPermission, formatJid } from '../utils/helpers';

export class RoleManager {
    private ownerJid: string = '';

    setOwner(jid: string): void {
        this.ownerJid = jid;
        // Ensure owner exists in database
        const { user } = userOps.getOrCreate(jid, 'Bot Owner');
        userOps.updateRole(jid, 'owner');
    }

    getOwner(): string {
        return this.ownerJid;
    }

    async checkPermission(jid: string, requiredRole: UserRole): Promise<{
        hasPermission: boolean;
        userRole: UserRole;
        isOwner: boolean;
        isAdmin: boolean;
        isModerator: boolean;
    }> {
        const user = userOps.get(jid);
        const userRole: UserRole = (user?.role as UserRole) || 'member';
        const isOwner = jid === this.ownerJid;
        const isAdmin = userRole === 'admin' || isOwner;
        const isModerator = userRole === 'moderator' || isAdmin;

        return {
            hasPermission: isOwner || hasPermission(userRole, requiredRole),
            userRole,
            isOwner,
            isAdmin,
            isModerator,
        };
    }

    async setUserRole(jid: string, role: UserRole): Promise<boolean> {
        userOps.updateRole(jid, role);
        return true;
    }

    async getUserRole(jid: string): Promise<UserRole> {
        const user = userOps.get(jid);
        return (user?.role as UserRole) || 'member';
    }

    async getUserInfo(jid: string): Promise<{
        name: string | null;
        role: UserRole;
        warnings: number;
        isMuted: boolean;
        muteExpires: string | null;
    } | null> {
        const user = userOps.get(jid);
        if (!user) return null;

        return {
            name: user.name,
            role: (user.role as UserRole) || 'member',
            warnings: user.warnings || 0,
            isMuted: !!user.is_muted,
            muteExpires: user.mute_expires_at,
        };
    }

    async isGroupAdmin(groupJid: string, userJid: string): Promise<boolean> {
        const admins = await waClient.getGroupAdmins(groupJid);
        return admins.includes(userJid);
    }

    formatRole(role: UserRole): string {
        const roleEmoji: Record<UserRole, string> = {
            owner: '👑 Owner',
            admin: '⚡ Admin',
            moderator: '🛡️ Moderator',
            member: '👤 Member',
        };
        return roleEmoji[role] || role;
    }
}

export const roleManager = new RoleManager();
export default roleManager;
