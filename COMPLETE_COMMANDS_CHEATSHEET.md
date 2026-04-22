# Complete Commands Cheatsheet - All Commands with Examples

## 🏆 Tournaments (Simplified IDs)

### Create Tournament
```
.tcr league1 se 8               # Create knockout tournament
.tcr "league 1" se 8            # With spaces in name
.tcr cup rr 6                   # Round robin
.tcr "Spring Cup" de 4          # Double elimination
```
**Response shows:** Tournament ID (e.g., `#1`, `#2`, `#3`)

### Join Tournament
```
.tj 1 Man United                # Join tournament #1 with squad
.tj 2 "Liverpool FC"            # With quotes
.tj 3 Chelsea                   # Simple squad name
```
**If you forget the ID:** `.tj` shows all active tournaments

### View Tournament Status
```
.ts 1                           # Check tournament #1
.ts 2                           # Check tournament #2
```
**If you forget the ID:** `.ts` lists all active tournaments with player counts

### Leave Tournament
```
.tl 1                           # Leave tournament #1
.tl 2                           # Leave tournament #2
```
**If you forget the ID:** `.tl` lists all active tournaments

---

## 🎮 Friendly Requests (Simple IDs)

### Request Match
```
.request                        # Creates request with ID (e.g., `1`, `2`, `3`)
```
**Auto-tags**: Top 5 active players from the week
**Response shows:** Request ID and expiry time

### Accept/Decline Request
```
.accept 1                       # Accept request #1
.decline 2                      # Decline request #2
```
**Aliases**: `.yes`, `.ok` (accept), `.no`, `.deny` (decline)

### View Active Players
```
.activeplayers                  # Top 10 active
.activeplayers 5                # Top 5 active
.activeplayers 15               # Top 15 active
```
**Aliases**: `.active`, `.frequent`

---

## 📊 Challenge Reports

### Daily Report
```
.dailyreport                    # Your daily stats
.dailyreport @Ahmed             # Ahmed's daily stats
.dailyreport @Ahmed 2025-04-22  # Specific date
```
**Aliases**: `.dreport`, `.dchallenge`
**Shows**: Challenges completed, rewards, matches played, win rate

### Weekly Report
```
.weeklyreport                   # Your weekly stats
.weeklyreport @Ahmed            # Ahmed's weekly stats
.weeklyreport @Ahmed 2025-04-21 # Specific week
```
**Aliases**: `.wreport`, `.wchallenge`
**Shows**: Weekly summary, best day, total rewards

### Group Summary
```
.weeklysummary                  # Current week
.weeklysummary 2025-04-21       # Specific week
```
**Aliases**: `.wsummary`, `.groupweekly`
**Shows**: Top 5 performers, group statistics

---

## 🎯 Daily Challenges

### View Challenges
```
.challenges                     # View your challenges
```
**Aliases**: `.ch`, `.daily`, `.quest`
**Shows**: In-progress and completed challenges with progress

### Claim Reward
```
.claimreward win_1              # Claim bonus points
.claimreward score_3            # Claim goal scorer reward
```
**Aliases**: `.claim`, `.reward`

---

## 📅 Match Scheduling

### Schedule Match
```
.schedule @Ahmed 2025-04-25 18:00
.schedule @Mohamed 2025-04-26 19:30
```
**Aliases**: `.sched`, `.book`
**Format**: `.schedule @player [date] [time]`
**Reminder**: 15 minutes before match

### View Scheduled Matches
```
.scheduled                      # View upcoming matches
```
---

## 🏆 Tournaments (Simplified IDs)

### Create Tournament
```
.tcr league1 se 8               # Create knockout tournament
.tcr "league 1" se 8            # With spaces in name
.tcr cup rr 6                   # Round robin
.tcr "Spring Cup" de 4          # Double elimination
```
**Aliases**: `.tc`, `.tourneycreate`
**Types**: 
- `se` = Single Elimination (Knockout)
- `de` = Double Elimination
- `rr` = Round Robin (1 leg)
- `rr2` = Round Robin (2 legs)
**Response shows:** Tournament ID (e.g., `#1`, `#2`, `#3`)

### Join Tournament
```
.tj 1 Man United                # Join tournament #1 with squad
.tj 2 "Liverpool FC"            # With quotes
.tj 3 Chelsea                   # Simple squad name
```
**Aliases**: `.tourneyjoin`
**If you forget the ID:** `.tj` shows all active tournaments
**Shows**: Tournament ID, squad name, player count, "FULL" if max reached

### Leave Tournament
```
.tl 1                           # Leave tournament #1
.tl 2                           # Leave tournament #2
```
**Aliases**: `.tourneyleave`
**If you forget the ID:** `.tl` lists all active tournaments
**Note**: Can only leave during registration phase

### View Tournament Status
```
.ts 1                           # Check tournament #1
.ts 2                           # Check tournament #2
```
**Aliases**: `.tourneystatus`
**If you forget the ID:** `.ts` lists all active tournaments
**Shows**: All registered players with squad names, status, round

### Start Tournament
```
.tstart                         # Generate bracket and start
```
**Aliases**: `.tourneystart`
**Admin only**

### View Bracket
```
.tb                             # View bracket with match IDs
```
**Aliases**: `.tourneybracket`

### Submit Match Result
```
.tres 1 3:1                     # Match #1, score 3-1 (with screenshot)
.tres 2 1-1p5-4                 # With penalty shootout (1-1, penalties 5-4)
.tres 3 2:2                     # Draw
```
**Aliases**: `.tourneyresult`
**Note**: Attach screenshot proof with command

### View Pending Matches
```
.tpending                       # View matches awaiting approval
```
**Aliases**: `.tpend`, `.tp`
**Admin only**

### Approve/Reject Match (Admin)
```
.tapprove 1                     # Approve match #1
.treject 1 Invalid score        # Reject match #1 with reason
```
**Aliases**: `.tok`, `.tyes` (approve), `.tno`, `.tdeny` (reject)

### View Standings
```
.tlb                            # View tournament standings
```
**Aliases**: `.tourneystandings`, `.tstandings`

### Advance Round
```
.tnext                          # Advance to next round (knockout)
```
**Aliases**: `.tnextround`, `.tnr`
**Admin only**

### Complete Tournament
```
.tend                           # Complete tournament
```
**Aliases**: `.tourneyend`, `.tcomplete`
**Admin only**

### Tournament Scheduling
```
.tschedule                      # View full tournament schedule
.tstage                         # View current stage info
.tstages                        # View all stages with details
```
**Aliases**: 
- `.tsched`, `.tschedules` (schedule)
- `.tcurrentstage`, `.tstageinfo` (stage)
- `.tallstages`, `.tstagedetails` (stages)

### Tournament Help
```
.tourneyhelp                    # Show all tournament commands
```
**Aliases**: `.th`, `.tournamenthelp`, `.tourneycmds`

---

## 🏅 PVP System

### Record Match
```
.pvpscores me vs @Ahmed 3:1     # Your match (with screenshot)
.pvpscores @Ahmed vs @Mohamed 2:0
.vs @opponent 3:1               # Shortcut format
```
**Aliases**: `.pvp`, `.pvpresult`, `.pvpscore`
**Note**: Attach screenshot proof

### Approve/Reject Match (Admin)
```
.pvpapprove 1                   # Approve match #1
.pvpreject 1 Invalid score      # Reject match #1
```
**Aliases**: `.pvpok`, `.pvpyes` (approve), `.pvpno`, `.pvpdeny` (reject)

### View Pending Matches
```
.pvppending                     # View pending matches
```
**Aliases**: `.pvpqueue`, `.pvpq`

### View Leaderboard
```
.pvplb                          # Top 10 players
.pvplb 20                       # Top 20 players
```
**Aliases**: `.pvlb`, `.pvpLB`, `.pvprank`, `.pvpranking`

### View Player Stats
```
.pvpstats                       # Your stats
.pvpstats @Ahmed                # Ahmed's stats
```
**Aliases**: `.pvpp`, `.pvprofile`, `.pvps`

### PVP Help
```
.pvphelp                        # Show all PVP commands
```
**Aliases**: `.ph`, `.pvpcmds`

### Clear/Reset PVP (Admin)
```
.pvpclear confirm               # Clear all PVP records
.pvpreset confirm               # Reinitialize PVP system
.pvpweek confirm                # Manually trigger weekly reset
```
**Aliases**: `.clearpvp`, `.resetpvp`, `.weekreset`, `.newweek`

---

## 📈 Leaderboards & Stats

### All-Time Leaderboard
```
.lb                             # Top 10 all-time
.lb 20                          # Top 20 all-time
```
**Aliases**: `.leaderboard`, `.rank`, `.ranking`

### Player Profile
```
.profile                        # Your profile
.profile @Ahmed                 # Ahmed's profile
```
**Aliases**: `.p`, `.stats`

---

## 🔧 Moderation

### Warn User
```
.warn @Ahmed                    # Warn user
.warn @Ahmed Spam               # With reason
```
**Aliases**: `.w`

### Check Warnings
```
.warnings @Ahmed                # Check warnings
```
**Aliases**: `.ws`

### Mute User
```
.mute @Ahmed                    # Mute 2 hours (default)
.mute @Ahmed 4                  # Mute 4 hours
.mute @Ahmed 1 Spam             # With reason
```
**Aliases**: `.m`

### Unmute User
```
.unmute @Ahmed                  # Unmute user
```
**Aliases**: `.um`

### Mute Info
```
.muteinfo @Ahmed                # Check mute status
```
**Aliases**: `.mi`

### Adjust Mute Time
```
.mutetime @Ahmed 2              # Add 2 hours
.mutetime @Ahmed -1             # Subtract 1 hour
```
**Aliases**: `.mt`

### Kick User
```
.kick @Ahmed                    # Remove from group
```
**Aliases**: `.k`

### Mute Help
```
.mutehelp                       # Show all mute commands
```
**Aliases**: `.mh`, `.mutecommands`, `.mc`

---

## 👥 Role Management

### Promote/Demote
```
.promote @Ahmed                 # Promote to moderator
.demote @Ahmed                  # Demote to member
.setadmin @Ahmed                # Set as admin
```
**Aliases**: `.prom`, `.dem`, `.sa`

---

## 📢 Tagging

### Tag All
```
.tagall                         # Tag everyone
.tagall Let's play!             # With message
```
**Aliases**: `.ta`, `.all`

### Tag Admins
```
.tagadmin                       # Tag all admins
.tagadmin Need help!            # With message
```
**Aliases**: `.tagad`

---

## ℹ️ Help & Info

### Help Menu
```
.help                           # Show all commands
.help pvpscores                 # Help for specific command
```
**Aliases**: `.h`, `.cmd`, `.commands`

### Group Info
```
.groupinfo                      # View group settings
.settings                       # View bot settings
```
**Aliases**: `.gi`, `.ginfo`, `.set`

---

## 📋 Challenge IDs

```
win_1           # First Win (Easy) - +5 pts
score_3         # Goal Scorer (Easy) - +10 pts
win_3           # Hot Streak (Medium) - +20 pts
draw_1          # Balanced Game (Medium) - +8 pts
win_streak_5    # Unstoppable (Hard) - +50 pts
no_losses       # Perfect Day (Hard) - +40 pts
```

---

## ⏱️ Rate Limits

```
PVP Scores:     5 per minute
Friendly Req:   3 per 5 minutes
Tournaments:    2 per 5 minutes
Approvals:      10 per minute
Warn/Mute:      10 per minute
Kick:           5 per minute
```

---

## 🔄 Resets

```
Daily Challenges:   00:00 UTC
Weekly Rankings:    Sunday 00:00 UTC
Friendly Requests:  30 minutes (auto-expire)
Rate Limits:        Per time window
Tournament Stages:  Auto-advance on deadline
```

---

## 📊 Data Formats

### Date Format
```
YYYY-MM-DD
Example: 2025-04-22
```

### Time Format
```
HH:MM (24-hour)
Example: 18:00 (6 PM)
```

### Score Format
```
X:Y or X-Y
Example: 3:1 or 3-1
```

### Penalty Shootout Format
```
X-Yp[A-B]
Example: 1-1p5-4 (1-1 after 90 mins, 5-4 on penalties)
```

---

## 🎯 Quick Command Reference

### Most Used
```
.pvpscores      # Record match
.pvplb          # View leaderboard
.challenges     # View challenges
.request        # Request match
.dailyreport    # Check stats
.tstart         # Start tournament
.tres           # Submit tournament result
```

### Admin Only
```
.pvpapprove     # Approve match
.warn           # Warn user
.mute           # Mute user
.kick           # Remove user
.promote        # Change role
.tapprove       # Approve tournament match
```

### Group Info
```
.help           # Show help
.groupinfo      # Group settings
.activeplayers  # Active players
.weeklysummary  # Group summary
```

---

## 💡 Pro Tips

### Find Opponents
```
1. .activeplayers           # See who's active
2. .request                 # Request friendly
3. .accept req_1            # Accept request
```

### Track Progress
```
1. .dailyreport             # Check daily stats
2. .weeklyreport            # Check weekly stats
3. .weeklysummary           # See group ranking
```

### Climb Rankings
```
1. .pvpscores               # Record match
2. .challenges              # View challenges
3. .claimreward             # Claim bonus
4. .pvplb                   # Check ranking
```

### Organize Tournament
```
1. .tcr "Name" se 8         # Create
2. .tstart                  # Start
3. .tb                      # View bracket
4. .tres [id] [score]       # Submit result
5. .tapprove [id]           # Approve
6. .tnext                   # Advance
7. .tend                    # Complete
```

---

## 🚀 Getting Started

### New Player
```
1. .help                    # Learn commands
2. .challenges              # View challenges
3. .activeplayers           # Find opponents
4. .request                 # Request match
5. .pvpscores               # Record match
```

### Regular Player
```
1. .dailyreport             # Check daily stats
2. .activeplayers           # Find opponents
3. .request                 # Request match
4. .pvpscores               # Record match
5. .claimreward             # Claim bonus
```

### Weekly Review
```
1. .weeklyreport            # Your weekly stats
2. .weeklysummary           # Group ranking
3. .activeplayers           # Top players
4. .pvplb                   # Final leaderboard
```

---

**Last Updated**: April 22, 2026
**Version**: 2.0
**Status**: ✅ Complete
**Total Commands**: 50+
**Total Aliases**: 100+
