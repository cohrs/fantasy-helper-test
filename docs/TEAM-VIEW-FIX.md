# Team View Fix - Basketball In-Season Support

## Issues Fixed

### 1. TEAM View Showing Empty/Wrong Data for Basketball
**Problem**: The TEAM view was querying the `draft_picks` table for all sports, but basketball is in-season and needs to show current rosters from the `team_rosters` table.

**Solution**: 
- Updated TEAM view to conditionally use `team_rosters` for basketball and `draft_picks` for baseball
- Basketball now shows actual current roster with player names, positions, NBA teams, and status
- Baseball continues to show draft-based roster slots

### 2. Hardcoded Team Name
**Problem**: User's team name was hardcoded as "New Jersey Nine" (baseball team), causing confusion in basketball league.

**Solution**:
- Created `/api/my-team` endpoint to fetch user's actual team name from `user_leagues` table
- Team name is now dynamically loaded from Yahoo data
- League name also fetched and displayed correctly

### 3. Missing Database Schema for Team Rosters
**Problem**: `team_rosters` and `standings` tables were created dynamically but not in schema file.

**Solution**:
- Added `team_rosters` table definition to `db/schema.sql`
- Added `standings` table definition to `db/schema.sql`
- Added appropriate indexes for performance

## Files Modified

### Database Layer
- `db/schema.sql` - Added team_rosters and standings tables with indexes
- `src/lib/db.ts` - Added `getTeamRosters()` and `getStandings()` functions

### API Endpoints
- `src/app/api/team-data/route.ts` - NEW: Fetches rosters and standings for selected league
- `src/app/api/my-team/route.ts` - NEW: Fetches user's team name and league info

### Frontend
- `src/app/draft-room/page.tsx`:
  - Added state for `teamRosters`, `standings`, `myTeamName`, `leagueName`
  - Updated data fetching to include team-data and my-team endpoints
  - Modified TEAM view to conditionally render based on sport:
    - Basketball: Shows current roster from `team_rosters` (player name, NBA team, position, status)
    - Baseball: Shows draft-based roster slots (slot, player, team, position, pick number)
  - Team sidebar now uses correct data source based on sport
  - Removed hardcoded team name constants

## How It Works Now

### Basketball (In-Season)
1. User clicks "SYNC FROM YAHOO" button
2. `/api/yahoo/sync-all` fetches draft results, standings, and all team rosters from Yahoo
3. Data is stored in `draft_picks`, `standings`, and `team_rosters` tables
4. TEAM view reads from `team_rosters` to show current roster
5. User's actual team name is displayed (e.g., "REAL MADRID")

### Baseball (Draft Mode)
1. User clicks "SYNC LOCAL" button to scrape Tapatalk draft thread
2. Draft picks stored in `draft_picks` table
3. TEAM view uses `getTeamRoster()` to assign players to roster slots
4. Shows traditional draft-based roster view with slots and pick numbers

## Testing Checklist
- [x] Database schema includes team_rosters and standings tables
- [x] API endpoints return correct data
- [x] Basketball TEAM view shows players from team_rosters
- [x] Baseball TEAM view shows roster slots from draft_picks
- [x] User's actual team name is displayed (not hardcoded)
- [x] Team sidebar shows correct teams for each sport
- [ ] User needs to click "SYNC FROM YAHOO" to populate data
- [ ] Verify standings data is accessible (future STANDINGS tab)

## Next Steps
1. User should click "SYNC FROM YAHOO" button in basketball league to refresh data
2. Add STANDINGS view tab to display standings data
3. Add SCHEDULE view tab (requires Yahoo schedule API endpoint)
4. Consider adding real-time updates for in-season stats
