"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.roleManager = exports.RoleManager = void 0;
const db_1 = require("../database/db");
const client_1 = require("../client");
const helpers_1 = require("../utils/helpers");
class RoleManager {
    ownerJid = '';
    setOwner(jid) {
        this.ownerJid = jid;
        // Ensure owner exists in database
        db_1.userOps.getOrCreate(jid, 'Bot Owner');
        db_1.userOps.updateRole(jid, 'owner');
    }
    getOwner() {
        return this.ownerJid;
    }
    async checkPermission(jid, requiredRole) {
        const user = db_1.userOps.get(jid);
        const userRole = user?.role || 'member';
        const isOwner = jid === this.ownerJid;
        const isAdmin = userRole === 'admin' || isOwner;
        const isModerator = userRole === 'moderator' || isAdmin;
        return {
            hasPermission: isOwner || (0, helpers_1.hasPermission)(userRole, requiredRole),
            userRole,
            isOwner,
            isAdmin,
            isModerator,
        };
    }
    async setUserRole(jid, role) {
        db_1.userOps.updateRole(jid, role);
        return true;
    }
    async getUserRole(jid) {
        const user = db_1.userOps.get(jid);
        return user?.role || 'member';
    }
    async getUserInfo(jid) {
        const user = db_1.userOps.get(jid);
        if (!user)
            return null;
        return {
            name: user.name,
            role: user.role || 'member',
            warnings: user.warnings || 0,
            isMuted: !!user.is_muted,
            muteExpires: user.mute_expires_at,
        };
    }
    async isGroupAdmin(groupJid, userJid) {
        const admins = await client_1.waClient.getGroupAdmins(groupJid);
        return admins.includes(userJid);
    }
    formatRole(role) {
        const roleEmoji = {
            owner: '👑 Owner',
            admin: '⚡ Admin',
            moderator: '🛡️ Moderator',
            member: '👤 Member',
        };
        return roleEmoji[role] || role;
    }
}
exports.RoleManager = RoleManager;
exports.roleManager = new RoleManager();
exports.default = exports.roleManager;
//# sourceMappingURL=role-manager.js.map