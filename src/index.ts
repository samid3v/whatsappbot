import * as cron from 'node-cron';
import { waClient } from './client';
import { messageHandler } from './handlers/message';
import { muteManager } from './services/mute-manager';
import { warnManager } from './services/warn-manager';
import { roleManager } from './services/role-manager';
import { statsOps } from './database/db';

console.log('⚽ Starting eFootball WhatsApp Bot...');
console.log('='.repeat(40));

async function main() {
    try {
        // Connect to WhatsApp
        console.log('📱 Connecting to WhatsApp...');
        await waClient.connect();

        // Initialize message handler
        console.log('🔧 Initializing message handler...');
        await messageHandler.initialize();

        // Schedule tasks
        console.log('⏰ Setting up scheduled tasks...');

        // Check for expired mutes every minute
        cron.schedule('* * * * *', async () => {
            try {
                // This is handled by individual mute timers, but we can check here too
                // The muteManager handles auto-unmute through timers
            } catch (error) {
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

    } catch (error) {
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
