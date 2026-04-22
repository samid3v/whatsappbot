import * as cron from 'node-cron';
import { waClient } from './client';
import { messageHandler } from './handlers/message';
import { muteManager } from './services/mute-manager';
import { warnManager } from './services/warn-manager';
import { roleManager } from './services/role-manager';
import { statsOps } from './database/db';
import { seasonManager } from './services/season-manager';
import { matchScheduler } from './services/match-scheduler';
import { challengeManager } from './services/challenge-manager';
import { challengeTracker } from './services/challenge-tracker';
import { friendlyRequestManager } from './services/friendly-request';
import { tournamentScheduler } from './services/tournament-scheduler';
import { startHealthServer } from './health';

const PORT = parseInt(process.env.PORT || '3000', 10);

console.log('⚽ Starting eFootball WhatsApp Bot...');
console.log('='.repeat(40));

startHealthServer(PORT);

async function main() {
    try {
        // Connect to WhatsApp
        console.log('📱 Connecting to WhatsApp...');
        await waClient.connect();

        // Initialize message handler
        console.log('🔧 Initializing message handler...');
        await messageHandler.initialize();

        // Start season manager for weekly resets
        console.log('📊 Starting season manager...');
        seasonManager.startWeeklyReset();

        // Start match scheduler
        console.log('📅 Starting match scheduler...');
        matchScheduler.start();

        // Initialize challenge manager (auto-starts daily reset)
        console.log('🎯 Initializing challenge manager...');

        // Start tournament scheduler
        console.log('📅 Starting tournament scheduler...');
        tournamentScheduler.start();

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

        // Cleanup tasks every hour
        cron.schedule('0 * * * *', async () => {
            console.log('🧹 Running cleanup tasks...');
            matchScheduler.cleanup?.();
            challengeTracker.cleanup?.();
            friendlyRequestManager.cleanup?.();
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
        console.log('');
        console.log('🔄 PVP SEASON SYSTEM (AUTOMATED):');
        console.log('   • Runs: Monday 00:00 → Sunday 23:59 UTC');
        console.log('   • Resets automatically every Sunday at 00:00');
        console.log('   • No manual trigger needed');
        console.log('   • Past seasons archived for history');
        console.log('');
        console.log('📅 MATCH SCHEDULING:');
        console.log('   • .schedule @player [date] [time]');
        console.log('   • .scheduled - View upcoming matches');
        console.log('   • 15-min reminders before matches');
        console.log('');
        console.log('📅 TOURNAMENT SCHEDULING:');
        console.log('   • .tschedule - View tournament schedule');
        console.log('   • .tstage - View current stage info');
        console.log('   • .tstages - View all stages');
        console.log('   • Auto-advance stages on deadline');
        console.log('   • 24-hour deadline reminders');
        console.log('');
        console.log('🎯 DAILY CHALLENGES:');
        console.log('   • .challenges - View daily quests');
        console.log('   • .claimreward [id] - Claim bonus points');
        console.log('   • Resets daily at 00:00 UTC');
        console.log('');
        console.log('📊 CHALLENGE REPORTS:');
        console.log('   • .dailyreport [@player] - Daily challenge stats');
        console.log('   • .weeklyreport [@player] - Weekly challenge stats');
        console.log('   • .weeklysummary - Group weekly summary');
        console.log('');
        console.log('🎮 FRIENDLY REQUESTS:');
        console.log('   • .request - Request a friendly match');
        console.log('   • .accept [id] - Accept request');
        console.log('   • .decline [id] - Decline request');
        console.log('   • .activeplayers - View active players');
        console.log('');
        console.log('⏱️ RATE LIMITING:');
        console.log('   • PVP: 5 submissions/min');
        console.log('   • Friendly Requests: 3 per 5min');
        console.log('   • Tournaments: 2 creates/5min');
        console.log('   • Prevents spam abuse');
        console.log('='.repeat(40));

    } catch (error) {
        console.error('❌ Failed to start bot:', error);
        process.exit(1);
    }
}

// Handle shutdown
process.on('SIGINT', async () => {
    console.log('\n👋 Shutting down bot...');
    seasonManager.stopWeeklyReset();
    matchScheduler.stop();
    tournamentScheduler.stop();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n👋 Shutting down bot...');
    seasonManager.stopWeeklyReset();
    matchScheduler.stop();
    tournamentScheduler.stop();
    process.exit(0);
});

// Start the bot
main();
