import Database from 'better-sqlite3';
import * as path from 'path';
import { fileURLToPath } from 'url';

// ES module compatibility
const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dataPath = path.join(__dirname, '../../data');
const dbPath = path.join(dataPath, 'bot.db');
const db = new Database(dbPath);

export function runMigrations(): void {
    console.log('🔄 Running database migrations...');

    try {
        // Create season tables if they don't exist
        db.exec(`
            CREATE TABLE IF NOT EXISTS pvp_seasons (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                season_number INTEGER NOT NULL UNIQUE,
                start_date TEXT NOT NULL,
                end_date TEXT,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );

            CREATE TABLE IF NOT EXISTS pvp_season_stats (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                season_id INTEGER NOT NULL,
                user_jid TEXT NOT NULL,
                points INTEGER NOT NULL DEFAULT 0,
                wins INTEGER NOT NULL DEFAULT 0,
                draws INTEGER NOT NULL DEFAULT 0,
                losses INTEGER NOT NULL DEFAULT 0,
                goals_for INTEGER NOT NULL DEFAULT 0,
                goals_against INTEGER NOT NULL DEFAULT 0,
                matches_played INTEGER NOT NULL DEFAULT 0,
                position INTEGER,
                updated_at TEXT NOT NULL DEFAULT (datetime('now')),
                FOREIGN KEY (season_id) REFERENCES pvp_seasons(id),
                UNIQUE(season_id, user_jid)
            );

            CREATE INDEX IF NOT EXISTS idx_pvp_season_stats_season ON pvp_season_stats(season_id);
            CREATE INDEX IF NOT EXISTS idx_pvp_season_stats_points ON pvp_season_stats(season_id, points DESC);
        `);

        // Check if season 1 exists, if not create it
        const stmt = db.prepare('SELECT COUNT(*) as count FROM pvp_seasons');
        const result = stmt.get() as any;

        if (result.count === 0) {
            console.log('📊 Creating initial season...');
            const insertSeason = db.prepare('INSERT INTO pvp_seasons (season_number, start_date, status) VALUES (?, ?, ?)');
            insertSeason.run(1, new Date().toISOString(), 'active');
            console.log('✅ Season 1 created');
        }

        console.log('✅ Migrations completed');
    } catch (error) {
        console.error('❌ Migration error:', error);
    }
}
