"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.warnManager = exports.WarnManager = void 0;
const db_1 = require("../database/db");
const client_1 = require("../client");
const config_1 = __importDefault(require("../utils/config"));
const helpers_1 = require("../utils/helpers");
const mute_manager_js_1 = require("../services/mute-manager.js");
class WarnManager {
    warnThreshold = config_1.default.warnThreshold;
    muteDurationHours = config_1.default.muteDurationHours;
    async warnUser(jid, groupJid, reason = 'Link detected') {
        // Get user and increment warning
        const user = db_1.userOps.addWarning(jid);
        const warnings = user.warnings;
        // Log the warning
        db_1.logOps.add('warn', groupJid, jid, reason);
        // Get user name for message
        const userName = user.name || (0, helpers_1.formatJid)(jid);
        let message = `⚠️ *Warning Issued*\n\n`;
        message += `👤 User: ${userName}\n`;
        message += `📌 Reason: ${reason}\n`;
        message += `❗ Warnings: ${warnings}/${this.warnThreshold}`;
        if (warnings >= this.warnThreshold) {
            message += `\n\n🚫 *Auto-muting for ${this.muteDurationHours} hours*`;
        }
        // Send warning message to group
        await client_1.waClient.sendMessage(groupJid, message);
        // Check if should mute
        if (warnings >= this.warnThreshold) {
            await mute_manager_js_1.muteManager.muteUser(jid, groupJid, this.muteDurationHours * 60, 'Automatic mute due to excessive warnings');
            return {
                success: true,
                warning: warnings,
                message,
                shouldMute: true,
            };
        }
        return {
            success: true,
            warning: warnings,
            message,
            shouldMute: false,
        };
    }
    async getWarnings(jid) {
        const user = db_1.userOps.get(jid);
        return user?.warnings || 0;
    }
    async clearWarnings(jid, groupJid) {
        db_1.userOps.clearWarnings(jid);
        db_1.logOps.add('clear_warnings', groupJid, jid);
        return true;
    }
    async checkUserWarnings(jid) {
        const user = db_1.userOps.get(jid);
        return user?.warnings || 0;
    }
}
exports.WarnManager = WarnManager;
exports.warnManager = new WarnManager();
exports.default = exports.warnManager;
//# sourceMappingURL=warn-manager.js.map