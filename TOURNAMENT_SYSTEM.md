# Tournament System - Complete Implementation

## Overview
Comprehensive tournament system supporting Single Elimination, Double Elimination, and Round-Robin formats with proper bracket generation, seeding, bye handling, and penalty shootout support.

---

## Tournament Types

### 1. Single Elimination (Knockout)
- **Players Required:** 2, 4, 8, 16, 32, or 64 (power-of-2)
- **Format:** Lose once, you're out
- **Rounds:** log₂(n) rounds
- **Example:** 8 players = 3 rounds (8→4→2→1)
- **Draws:** Not allowed - must use penalty shootout

### 2. Double Elimination
- **Players Required:** 2, 4, 8, 16, 32, or 64 (power-of-2)
- **Format:** Winners bracket + Losers bracket
- **Rounds:** More rounds than single elimination
- **Example:** 8 players = Winners bracket (3 rounds) + Losers bracket (3 rounds) + Grand Final
- **Draws:** Not allowed - must use penalty shootout

### 3. Round-Robin (League)
- **Players Required:** Any number (2+)
- **Format:** Everyone plays everyone
- **Legs:** 1-leg or 2-leg (home/away)
- **Draws:** Allowed (1 point each)
- **Standings:** Based on points (3 for win, 1 for draw, 0 for loss)

---

## Bracket Generation

### Seeding System
Players are seeded based on current standings:
1. Sort by points (descending)
2. Tiebreaker: Goal difference
3. Tiebreaker: Goals scored

**Example:**
```
Standings:
1. Player A - 9 pts (3W)
2. Player B - 6 pts (2W)
3. Player C - 3 pts (1W)
4. Player D - 0 pts (0W)

Bracket (Seeded):
A vs D
B vs C
```

### Bye Handling
If odd number of players in knockout:
- Highest seeded player gets a bye
- Automatically advances to next round
- Marked as "(bye)" in bracket display

**Example (5 players):**
```
Round 1:
#1 Player A (bye) → advances
#2 Player B vs Player E
#3 Player C vs Player D
```

### Bracket Visualization
```
📊 Tournament Name — SINGLE ELIMINATION

Round 1
  #1 | Player A ⚪ vs Player B
  #2 | Player C ⚪ vs Player D
  #3 | Player E (bye)

Round 2
  #4 | Player A ✅ 2-1 Player C
  #5 | Player B ⏳ 1-1 Player E

Round 3
  #6 | Player A ✅ 3-2 Player B
```

**Status Indicators:**
- `⚪ vs` - Not played yet
- `⏳ 2-1` - Pending admin approval
- `✅ 2-1` - Approved
- `🤝 1-1` - Draw (round-robin only)

---

## Match Workflow

### 1. Submit Result
```
.tres <match_id> <score>
Example: .tres 1 2-1
```

**For Knockout Draws:**
```
Match is a draw! In Single Elimination, you must decide via penalty shootout.
Resubmit with the penalty shootout result (e.g., 3:1 after penalties)
```

### 2. Admin Approval
```
.tapprove <match_id>
```

Approves the match and updates standings.

### 3. Advance Round
```
.tnext
```

- Checks all current round matches are approved
- Generates next round with winners
- Automatically detects tournament completion

---

## Commands

### Tournament Management
| Command | Usage | Description |
|---------|-------|-------------|
| `.tcr` | `.tcr [name] [type] [max_players]` | Create tournament |
| `.tstart` | `.tstart` | Start tournament (generates bracket) |
| `.tend` | `.tend` | End tournament early |
| `.ts` | `.ts` | Tournament status |

### Participation
| Command | Usage | Description |
|---------|-------|-------------|
| `.tj` | `.tj` | Join tournament |
| `.tl` | `.tl` | Leave tournament |

### Bracket & Matches
| Command | Usage | Description |
|---------|-------|-------------|
| `.tb` | `.tb` | View bracket |
| `.tres` | `.tres <id> <score>` | Submit match result |
| `.tnext` | `.tnext` | Advance to next round |
| `.tlb` | `.tlb` | View standings |

### Admin Approval
| Command | Usage | Description |
|---------|-------|-------------|
| `.tpending` | `.tpending` | View pending matches |
| `.tapprove` | `.tapprove <id>` | Approve match |
| `.treject` | `.treject <id> <reason>` | Reject match |

---

## Examples

### Single Elimination Tournament (8 Players)

**Create:**
```
.tcr "eFootball Cup" single_elimination 8
```

**Join (8 players):**
```
.tj (repeated 8 times by different players)
```

**Start:**
```
.tstart
```

**Output:**
```
🏆 eFootball Cup — Single Elimination STARTED!
━━━━━━━━━━━━━━━━━━━━━━━━
👥 8 players
📋 4 matches in Round 1
📸 Screenshot proof required!
Use .tb to view the bracket!
```

**View Bracket:**
```
.tb
```

**Submit Result:**
```
.tres 1 2-1
```

**Admin Approves:**
```
.tapprove 1
```

**Advance Round:**
```
.tnext
```

**Tournament Completes:**
```
🏆 eFootball Cup — COMPLETED! 🏆
━━━━━━━━━━━━━━━━━━━━━━━━
🥇 Winner: Player A
📊 3W 0D 0L | 9 pts
Use .tlb to see full standings!
```

### Round-Robin Tournament (4 Players, 2-Leg)

**Create:**
```
.tcr "League 2024" round_robin 4
```

**Start:**
```
.tstart
```

**Bracket Generated:**
```
Round 1 (1st Leg):
  #1 | Player A ⚪ vs Player B
  #2 | Player A ⚪ vs Player C
  #3 | Player A ⚪ vs Player D
  #4 | Player B ⚪ vs Player C
  #5 | Player B ⚪ vs Player D
  #6 | Player C ⚪ vs Player D

Round 2 (2nd Leg - Reversed):
  #7 | Player B ⚪ vs Player A
  #8 | Player C ⚪ vs Player A
  ... (all matches reversed)
```

---

## Validation & Constraints

### Player Count Validation
```
Single Elimination:
  ✅ 2, 4, 8, 16, 32, 64 players
  ❌ 3, 5, 6, 7, 9, 10... players
  Error: "Knockout requires a power-of-2 bracket: 2, 4, 8, 16, 32, 64"

Double Elimination:
  ✅ 2, 4, 8, 16, 32, 64 players
  ❌ 3, 5, 6, 7, 9, 10... players

Round-Robin:
  ✅ Any number (2+)
```

### Match Validation
```
Knockout Draws:
  ❌ Not allowed
  ⚠️ Must resubmit with penalty shootout result

Round-Robin Draws:
  ✅ Allowed (1 point each)

Bye Matches:
  ✅ Automatically approved
  ✅ Player advances without playing
```

---

## Standings Calculation

### Points System
- **Win:** 3 points
- **Draw:** 1 point (round-robin only)
- **Loss:** 0 points

### Tiebreakers (in order)
1. Points (descending)
2. Goal difference (descending)
3. Goals scored (descending)

### Example
```
Player A: 3W 0D 0L = 9 pts, GD +5
Player B: 2W 1D 0L = 7 pts, GD +3
Player C: 1W 1D 1L = 4 pts, GD -2
Player D: 0W 0D 3L = 0 pts, GD -6

Final Standings:
1. Player A (9 pts)
2. Player B (7 pts)
3. Player C (4 pts)
4. Player D (0 pts)
```

---

## Features

✅ **Proper Bracket Generation** - Seeded, with bye handling  
✅ **Single Elimination** - Classic knockout format  
✅ **Double Elimination** - Winners + Losers bracket  
✅ **Round-Robin** - League format with 1 or 2 legs  
✅ **Penalty Shootout** - For knockout draws  
✅ **Admin Approval** - Match verification workflow  
✅ **Automatic Round Advancement** - Next round generated automatically  
✅ **Standings Tracking** - Per-tournament isolated standings  
✅ **Bracket Visualization** - ASCII bracket display  
✅ **Bye Handling** - Odd player count support  

---

## Technical Details

### Database Tables
- `tournaments` - Tournament metadata
- `tournament_participants` - Players in tournament
- `tournament_matches` - Individual matches
- `tournament_standings` - Per-tournament standings

### Match Statuses
- `pending` - Not played yet
- `pending_approval` - Result submitted, awaiting admin
- `approved` - Result verified, counts toward standings
- `rejected` - Result rejected, can resubmit

### Tournament Statuses
- `registration` - Accepting players
- `in_progress` - Bracket generated, matches ongoing
- `completed` - Tournament finished, winner determined
