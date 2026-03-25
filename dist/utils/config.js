"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.config = void 0;
exports.isGroupAllowed = isGroupAllowed;
const dotenv = __importStar(require("dotenv"));
const path = __importStar(require("path"));
dotenv.config();
// Parse allowed groups from env variable (comma-separated group JIDs)
const allowedGroupsEnv = process.env.ALLOWED_GROUPS || '';
const allowedGroups = allowedGroupsEnv
    .split(',')
    .map(g => g.trim())
    .filter(g => g.length > 0);
exports.config = {
    commandPrefix: process.env.COMMAND_PREFIX || '!',
    warnThreshold: parseInt(process.env.WARN_THRESHOLD || '3', 10),
    muteDurationHours: parseInt(process.env.MUTE_DURATION_HOURS || '2', 10),
    sessionPath: path.join(__dirname, '../../sessions'),
    dataPath: path.join(__dirname, '../../data'),
    allowedGroups: allowedGroups,
};
// Helper function to check if a group is allowed
function isGroupAllowed(jid) {
    // If no allowed groups are configured, allow all groups
    if (exports.config.allowedGroups.length === 0) {
        return true;
    }
    return exports.config.allowedGroups.includes(jid);
}
exports.default = exports.config;
//# sourceMappingURL=config.js.map