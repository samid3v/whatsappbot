import * as cron from 'node-cron';
import { seasonOps } from '../database/db';
import { waClient } from '../client';

export class SeasonManager {
    private cronJob: any = null;

    startWeeklyReset(): void {
        // Run every Sunday at 00:00 (midnight) - Season ends Sunday, new one starts Monday
        // Cron: 0 0 * * 0 = Sunday at 00:00
        this.cronJob = cron.schedule('0 0 * * 0', async () => {
            console.log('🔄 Starting weekly PVP season reset...');
            try {
                await this.resetSeason();
            } catch (error) {
                console.error('Error during season reset:', error);
            }
        });

        console.log('✅ Weekly season reset scheduled (Every Sunday at 00:00 UTC)');
        console.log('   Season runs: Monday 00:00 → Sunday 23:59');
    }

    async resetSeason(): Promise<void> {
        try {
            const currentSeason = seasonOps.getCurrentSeason();
            const newSeason = seasonOps.createNewSeason();
            
            console.log(`✅ Season ${currentSeason?.season_number} ended`);
            console.log(`✅ Season ${newSeason.season_number} started`);

            // Update positions for the new season
            seasonOps.updateSeasonPositions(newSeason.id);

            console.log(`📊 Season ${newSeason.season_number} is now active (Monday-Sunday)`);
            console.log(`📊 All PVP stats have been reset for the new season`);
        } catch (error) {
            console.error('Error resetting season:', error);
        }
    }

    stopWeeklyReset(): void {
        if (this.cronJob) {
            this.cronJob.stop();
            console.log('⏹️ Weekly season reset stopped');
        }
    }

    // Manual reset for testing
    async manualReset(): Promise<void> {
        console.log('🔄 Manual season reset triggered');
        await this.resetSeason();
    }

    // Get current season info
    getCurrentSeasonInfo(): any {
        return seasonOps.getCurrentSeason();
    }

    // Get season duration info
    getSeasonDurationInfo(): string {
        const season = seasonOps.getCurrentSeason();
        if (!season) return 'No active season';

        const startDate = new Date(season.start_date);
        const startDay = startDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
        
        // Calculate end date (next Sunday)
        const endDate = new Date(startDate);
        const daysUntilSunday = (7 - startDate.getDay()) % 7 || 7;
        endDate.setDate(endDate.getDate() + daysUntilSunday - 1);
        const endDay = endDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

        return `Season ${season.season_number}: ${startDay} → ${endDay}`;
    }
}

export const seasonManager = new SeasonManager();
export default seasonManager;
