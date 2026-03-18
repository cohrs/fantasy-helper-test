# Database Management Update - Sport-Specific Data

## Issues Addressed

### 1. Runtime Error: Cannot access 'myTeamName' before initialization
**Problem**: `selectedTeam` state was initialized with `myTeamName` before `myTeamName` was declared.

**Solution**: 
- Moved `myTeamName` and `leagueName` state declarations before they're used
- Changed `selectedTeam` initial value to `"Loading..."` instead of referencing `myTeamName`
- `selectedTeam` is now set to actual team name when data loads

### 2. Database Tables Not Sport-Aware
**Problem**: Tables like `player_stats` didn't distinguish between MLB and NBA data, causing potential conflicts.

**Solution**:
- Added `sport` column to `player_stats` table with default value 'baseball'
- Updated unique constraint to include sport: `UNIQUE(player_name_normalized, sport, season)`
- This allows same player name to exist for different sports (e.g., "Michael Jordan" in baseball and basketball)

## Database Schema Changes

### player_stats Table
```sql
-- Before
UNIQUE(player_name_normalized)

-- After  
sport VARCHAR(50) NOT NULL DEFAULT 'baseball'
UNIQUE(player_name_normalized, sport, season)
```

### Benefits
- MLB and NBA player stats can coexist without conflicts
- Each sport maintains its own player data
- Season-specific data is properly isolated
- Future-proof for adding more sports (hockey, football)

## Updated Functions

### src/lib/db.ts

**getPlayerStats(season?, sport?)**
- Now accepts optional `sport` parameter
- Can filter by season, sport, or both
- Returns sport-specific player stats

**savePlayerStats(players, season, sport = 'baseball')**
- Now requires `sport` parameter (defaults to 'baseball')
- Uses new unique constraint with sport and season
- Prevents cross-sport data conflicts

## Migration Script

Created `scripts/add-sport-to-player-stats.ts` to:
1. Add `sport` column to existing `player_stats` table
2. Drop old unique constraint
3. Add new unique constraint with sport and season
4. Create index on sport column

### To Run Migration
```bash
npx tsx scripts/add-sport-to-player-stats.ts
```

## Data Isolation by League

All league-specific tables already have proper isolation:
- `draft_picks` - isolated by `league_id`
- `watchlist` - isolated by `league_id`
- `player_notes` - isolated by `league_id`
- `chat_history` - isolated by `league_id`
- `standings` - isolated by `league_id`
- `team_rosters` - isolated by `league_id`

Only `player_stats` needed sport-level isolation since it's shared across leagues of the same sport.

## Testing Checklist
- [x] Fixed runtime error with myTeamName initialization
- [x] Added sport column to player_stats schema
- [x] Updated db.ts functions to be sport-aware
- [x] Created migration script
- [ ] Run migration script on production database
- [ ] Test MLB player stats don't conflict with NBA
- [ ] Verify both sports can load their respective player data

## Next Steps
1. Run the migration script to update the database
2. Test loading both MLB and NBA leagues
3. Verify player stats are properly isolated by sport
4. Consider adding sport parameter to API endpoints that fetch player stats
