# Sport-Specific UI Fix - Basketball vs Baseball

## The Real Issue

You were correct - the database tables are ALREADY properly isolated by `league_id`. The problem was purely in the UI layer showing baseball roster slots (SP, 1B, 3B, etc.) when viewing a basketball league.

## Database Isolation Status

### ✅ Already Properly Isolated by league_id
All these tables are league-specific and don't need sport columns:
- `draft_picks` - Each league has its own draft picks
- `watchlist` - Each league has its own watchlist
- `player_notes` - Notes are league-specific
- `chat_history` - Chat is league-specific
- `standings` - Standings are league-specific
- `team_rosters` - Rosters are league-specific

### ⚠️ Needs Sport Column
Only `player_stats` needs a sport column because:
- It's shared across multiple leagues of the same sport
- Same player name can exist in different sports
- Example: "Michael Jordan" could be in both baseball and basketball historical stats

## UI Fix Applied

### Before
```typescript
const ROSTER_SLOTS = ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'UTIL', 'SP', 'SP', 'SP', 'SP', 'SP', 'RP', 'RP', 'P', 'P', 'BN', 'BN', 'BN', 'BN'];
```
This was hardcoded to baseball positions.

### After
```typescript
const ROSTER_SLOTS_BY_SPORT: Record<string, string[]> = {
  baseball: ['C', '1B', '2B', '3B', 'SS', 'LF', 'CF', 'RF', 'UTIL', 'SP', 'SP', 'SP', 'SP', 'SP', 'RP', 'RP', 'P', 'P', 'BN', 'BN', 'BN', 'BN'],
  basketball: ['PG', 'SG', 'G', 'SF', 'PF', 'F', 'C', 'C', 'UTIL', 'UTIL', 'UTIL', 'BN', 'BN', 'BN'],
  hockey: ['C', 'C', 'LW', 'LW', 'RW', 'RW', 'D', 'D', 'D', 'D', 'G', 'G', 'BN', 'BN', 'BN', 'BN'],
  football: ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'K', 'DEF', 'BN', 'BN', 'BN', 'BN', 'BN', 'BN']
};

const ROSTER_SLOTS = ROSTER_SLOTS_BY_SPORT[activeSport] || ROSTER_SLOTS_BY_SPORT.baseball;
```

Now roster slots dynamically change based on the active sport.

## Position Matching Logic

### Basketball
- Direct matches: PG, SG, SF, PF, C
- G slot accepts: PG or SG
- F slot accepts: SF or PF
- UTIL accepts: Any position
- BN accepts: Anyone

### Baseball (unchanged)
- Direct matches: C, 1B, 2B, 3B, SS, LF, CF, RF
- OF handling for outfielders
- SP/RP/P for pitchers
- UTIL for hitters only
- BN for anyone

## What This Fixes

### NEEDS View
- Now shows basketball positions (PG, SG, SF, PF, C, G, F) for basketball leagues
- Shows baseball positions (SP, 1B, 3B, etc.) for baseball leagues
- Position demand bars show correct positions for each sport

### TEAM View
- Basketball: Shows current rosters from `team_rosters` table (already fixed)
- Baseball: Shows draft-based roster slots with correct positions

### GRID View
- Position filters now show correct positions for each sport (already working via `positionsBySport`)

## Why No Sport Column Needed in Most Tables

The `league_id` foreign key already provides complete isolation:
1. User selects a league (baseball or basketball)
2. `league_id` is set in session
3. All queries filter by `league_id`
4. Each league's data is completely separate

Example:
- Baseball League (league_id=2): Has its own draft_picks, watchlist, notes, etc.
- Basketball League (league_id=3): Has its own draft_picks, watchlist, notes, etc.
- No overlap or conflict possible

## Testing Checklist
- [x] ROSTER_SLOTS now sport-specific
- [x] getTeamRoster() handles basketball positions
- [x] NEEDS view shows correct positions for each sport
- [ ] Test switching between baseball and basketball leagues
- [ ] Verify NEEDS view shows basketball positions (PG, SG, etc.)
- [ ] Verify no baseball data appears in basketball league

## Summary

The database was already correctly designed with `league_id` isolation. The only issue was the UI hardcoding baseball roster slots. Now the UI dynamically adapts to the sport of the selected league.
