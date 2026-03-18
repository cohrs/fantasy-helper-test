# Basketball In-Season Mode - Complete Update

## Issues Fixed

### 1. Empty Player Pool for Basketball
**Problem**: Player pool was empty because it was showing `draftResults` (draft picks), but basketball is in-season and needs to show available free agents.

**Solution**: 
- Updated `displayPool` to conditionally show Yahoo players for basketball
- Filters out rostered players from `team_rosters` table
- Shows all available free agents with their Yahoo rankings and stats
- Baseball continues to show draft results as before

### 2. Wrong Tab Order for In-Season
**Problem**: Tab order was designed for draft mode (POOL first), but in-season should prioritize team management.

**Solution**:
- **Basketball tabs**: TEAM → STANDINGS → POOL → WATCHLIST
- **Baseball tabs**: POOL → GRID → TEAM → NEEDS → WATCHLIST
- Tabs now dynamically render based on `activeSport`
- Default view is TEAM for basketball, POOL for baseball

### 3. Added STANDINGS View
**Problem**: No way to view league standings for in-season basketball.

**Solution**:
- Created new STANDINGS view showing:
  - Rank, Team Name, Wins, Losses, Ties, Win %
  - User's team highlighted with star
  - Click team to view their roster
  - Synced from Yahoo via `/api/yahoo/sync-all`

### 4. NEEDS View Not Relevant for Basketball
**Problem**: NEEDS view shows roster slots to fill, which doesn't make sense for in-season basketball where all rosters are full.

**Solution**:
- NEEDS tab only shows for baseball
- Basketball gets STANDINGS tab instead
- Keeps the UI focused on relevant information per sport

## Code Changes

### displayPool Logic
```typescript
// Basketball: Show Yahoo free agents
if (activeSport === 'basketball' && yahooPlayers.length > 0) {
  const rosteredPlayers = new Set(teamRosters.map(r => normalizeName(r.player_name)));
  return yahooPlayers
    .filter(p => !rosteredPlayers.has(normalizeName(p.name)))
    .map(p => ({ ...p, takenBy: null }));
}

// Baseball: Show draft results
return draftResults.filter(...).map(...);
```

### Sport-Specific Tabs
```typescript
{activeSport === 'basketball' && (
  <>
    <button>TEAM</button>
    <button>STANDINGS</button>
    <button>POOL</button>
    <button>WATCHLIST</button>
  </>
)}

{activeSport === 'baseball' && (
  <>
    <button>POOL</button>
    <button>GRID</button>
    <button>TEAM</button>
    <button>NEEDS</button>
    <button>WATCHLIST</button>
  </>
)}
```

### STANDINGS View
- Displays data from `standings` table
- Shows rank, wins, losses, ties, win percentage
- Click team to view their roster
- Highlights user's team

## User Experience

### Basketball In-Season Flow
1. User selects basketball league
2. Lands on TEAM view showing their roster
3. Can switch to STANDINGS to see league rankings
4. POOL shows available free agents (not drafted players)
5. WATCHLIST for tracking potential pickups

### Baseball Draft Flow
1. User selects baseball league
2. Lands on POOL view showing all draftable players
3. GRID shows draft board
4. TEAM shows roster slots being filled
5. NEEDS shows which positions teams still need
6. WATCHLIST for tracking targets

## Next Steps

### Immediate
- [ ] Load Yahoo players on page load for basketball
- [ ] Test player pool shows free agents
- [ ] Verify STANDINGS displays correctly
- [ ] Test switching between leagues

### Future Enhancements
- [ ] Add SCHEDULE view (requires Yahoo schedule API)
- [ ] Update AI assistant prompts for in-season (trade analysis, add/drop advice)
- [ ] Store player stats in database for assistant context
- [ ] Add current week matchup view
- [ ] Show stat categories and current standings in each category

## Database Status

All tables properly isolated by `league_id`:
- ✅ `draft_picks` - Draft history
- ✅ `team_rosters` - Current rosters (in-season)
- ✅ `standings` - League standings (in-season)
- ✅ `watchlist` - User's watchlist
- ✅ `player_notes` - AI analysis notes
- ✅ `chat_history` - Assistant conversations

No cross-sport contamination - each league's data is completely separate.
