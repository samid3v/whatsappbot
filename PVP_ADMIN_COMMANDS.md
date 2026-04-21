# PVP Admin Commands

## Overview
Three new admin-only commands for managing the PVP system.

---

## 1. Clear All PVP Records
**Command:** `.pvpclear confirm`  
**Aliases:** `clearpvp`  
**Required Role:** Admin only  
**Description:** Deletes ALL PVP records permanently

### What it deletes:
- All matches from `pvp_matches` table
- All current stats from `pvp_stats` table
- All season stats from `pvp_season_stats` table
- All seasons from `pvp_seasons` table

### Usage:
```
.pvpclear confirm
```

### Safety:
- Requires `confirm` parameter to prevent accidental deletion
- Shows warning message first if you just type `.pvpclear`

### Example:
```
User: .pvpclear
Bot: ⚠️ This will delete ALL PVP records!
     To confirm, use: .pvpclear confirm
     This action cannot be undone.

User: .pvpclear confirm
Bot: ✅ All PVP records cleared!
     • All matches deleted
     • All stats deleted
     • All seasons deleted
     Use .pvpreset to reinitialize the system.
```

---

## 2. Reinitialize PVP System
**Command:** `.pvpreset confirm`  
**Aliases:** `resetpvp`  
**Required Role:** Admin only  
**Description:** Clears all PVP records and creates a fresh Season 1

### What it does:
1. Clears all PVP records (same as `.pvpclear`)
2. Creates Season 1 (fresh start)
3. Resets all stats to 0

### Usage:
```
.pvpreset confirm
```

### Safety:
- Requires `confirm` parameter
- Shows warning message first if you just type `.pvpreset`

### Example:
```
User: .pvpreset
Bot: ⚠️ This will reinitialize the PVP system!
     To confirm, use: .pvpreset confirm
     This will:
     • Clear all PVP records
     • Create Season 1
     • Reset all stats

User: .pvpreset confirm
Bot: ✅ PVP system reinitialized!
     📊 Season 1 created
     🔄 All stats reset
     ✅ Ready to go!
```

---

## 3. Manually Trigger Weekly Reset
**Command:** `.pvpweek confirm`  
**Aliases:** `weekreset`, `newweek`  
**Required Role:** Admin only  
**Description:** Manually trigger the weekly season reset (if automation failed)

### What it does:
1. Closes current season (marks as inactive)
2. Creates new season (increments season number)
3. Resets all stats to 0
4. Preserves old season stats in history

### Usage:
```
.pvpweek confirm
```

### When to use:
- Automation failed and week didn't reset
- You want to manually start a new week
- Testing purposes

### Safety:
- Requires `confirm` parameter
- Shows warning message first if you just type `.pvpweek`

### Example:
```
User: .pvpweek
Bot: ⚠️ This will manually trigger the weekly reset!
     To confirm, use: .pvpweek confirm
     This will:
     • Close current season
     • Create new season
     • Reset all stats

User: .pvpweek confirm
Bot: ✅ Weekly reset completed!
     📊 Season 2 is now active
     🔄 All stats reset
     📅 New week started (Monday-Sunday)
```

---

## Command Comparison

| Command | Action | Data Loss | Use Case |
|---------|--------|-----------|----------|
| `.pvpclear confirm` | Delete all records | ✅ Complete loss | Start completely fresh |
| `.pvpreset confirm` | Clear + create Season 1 | ✅ Complete loss | Full system reset |
| `.pvpweek confirm` | Close season + create new | ❌ Preserves history | Weekly automation failed |

---

## Important Notes

1. **All commands require `confirm` parameter** - prevents accidental execution
2. **Admin only** - only users with admin role can execute
3. **No undo** - these actions cannot be reversed
4. **Backup first** - consider backing up database before using these
5. **`.pvpweek` is safe** - it preserves all past season data in history

---

## Database Impact

### `.pvpclear confirm`
```sql
DELETE FROM pvp_matches;
DELETE FROM pvp_stats;
DELETE FROM pvp_season_stats;
DELETE FROM pvp_seasons;
```

### `.pvpreset confirm`
```sql
-- Same as above, then:
INSERT INTO pvp_seasons (season_number, start_date, status) 
VALUES (1, NOW(), 'active');
```

### `.pvpweek confirm`
```sql
-- Close current season
UPDATE pvp_seasons SET status = 'closed', end_date = NOW() 
WHERE status = 'active';

-- Create new season
INSERT INTO pvp_seasons (season_number, start_date, status) 
VALUES (next_number, NOW(), 'active');

-- Reset current stats
UPDATE pvp_stats SET points = 0, wins = 0, draws = 0, losses = 0, 
                     goals_for = 0, goals_against = 0, matches_played = 0;
```

---

## Troubleshooting

**Q: I accidentally cleared all records, can I recover?**  
A: No, the action cannot be undone. You'll need to restore from a database backup.

**Q: The weekly reset didn't happen automatically, what do I do?**  
A: Use `.pvpweek confirm` to manually trigger it. Check bot logs to see why automation failed.

**Q: Can I use these commands if I'm not admin?**  
A: No, these commands are admin-only. Only users with admin role can execute them.

**Q: What happens to past season data when I use `.pvpweek`?**  
A: It's preserved in the `pvp_season_stats` table. You can view historical data anytime.
