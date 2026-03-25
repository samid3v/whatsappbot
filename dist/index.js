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
const cron = __importStar(require("node-cron"));
const client_1 = require("./client");
const message_1 = require("./handlers/message");
console.log('⚽ Starting eFootball WhatsApp Bot...');
console.log('='.repeat(40));
async function main() {
    try {
        // Connect to WhatsApp
        console.log('📱 Connecting to WhatsApp...');
        await client_1.waClient.connect();
        // Initialize message handler
        console.log('🔧 Initializing message handler...');
        await message_1.messageHandler.initialize();
        // Schedule tasks
        console.log('⏰ Setting up scheduled tasks...');
        // Check for expired mutes every minute
        cron.schedule('* * * * *', async () => {
            try {
                // This is handled by individual mute timers, but we can check here too
                // The muteManager handles auto-unmute through timers
            }
            catch (error) {
                console.error('Error in mute check:', error);
            }
        });
        // Daily stats reset (optional)
        cron.schedule('0 0 * * *', async () => {
            console.log('🌟 Running daily tasks...');
            // Could reset daily challenges or post daily stats
        });
        console.log('='.repeat(40));
        console.log('✅ Bot is ready!');
        console.log('');
        console.log('Commands available:');
        console.log('  !help - Show help menu');
        console.log('  !warn @user - Warn a user');
        console.log('  !mute @user - Mute a user');
        console.log('  !kick @user - Remove user');
        console.log('  !promote @user - Promote to moderator');
        console.log('  !setadmin @user - Set as admin');
        console.log('');
        console.log('Link detection is enabled - 3 warnings = 2hr mute');
        console.log('='.repeat(40));
    }
    catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}
// Handle shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down bot...');
    process.exit(0);
});
process.on('SIGTERM', async () => {
    console.log('\n👋 Shutting down bot...');
    process.exit(0);
});
// Start the bot
main();
//# sourceMappingURL=index.js.map