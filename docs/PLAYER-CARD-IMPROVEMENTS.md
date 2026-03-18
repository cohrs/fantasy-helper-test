# Player Card UI Improvements

## Current State

The watchlist view has a nice player card design with:
- Compact player info (rank, name, position, team, stats)
- Expandable AI rationale section
- Expandable Yahoo news section
- Clean styling with proper spacing and colors

## Issues to Address

### 1. Yahoo News Not Showing
**Problem**: API returns `hasNotes: true` but `notes: []` (empty array)

**Possible causes**:
- Token expiration (FIXED - now using token refresh)
- Yahoo API structure changed
- Player notes might be in a different field
- Need to debug the actual Yahoo API response

**Next steps**:
- Test with refreshed token
- Log the raw Yahoo API response to see actual structure
- May need to adjust parsing logic in `/api/yahoo/player-news/route.ts`

### 2. Apply Styling to Other Views

The watchlist card styling should be applied to:

**Player Pool View** (`DraftBoardPlayerRow` component):
- Currently has basic styling
- Should match watchlist card design
- Already has some similar features (stats, badges)
- Needs expandable notes section

**Team View**:
- Shows drafted players per team
- Could benefit from same card design
- Would make it consistent across all views

**Grid View**:
- More compact, might need adjusted version
- Could still use similar color scheme and badges

## AI Notes vs Watchlist Rationale

Two types of notes in the system:

### Player Notes (`player_notes` table)
- General AI analysis about a player
- League-specific
- Can be viewed anywhere the player appears
- Stored by `player_name_normalized`

### Watchlist Rationale (`watchlist.rationale` column)
- Specific reason why player is on YOUR watchlist
- Only visible in watchlist view
- Generated when you ask AI about a watchlist player

**Current behavior**: Watchlist shows `rationale` field. Other views don't show any AI notes yet.

**Desired behavior**: 
- Watchlist: Show rationale (specific to watchlist)
- Player pool: Show player_notes (general analysis)
- Both should be expandable with same UI pattern

## Implementation Plan

1. Fix Yahoo news token issue (DONE - added token refresh)
2. Debug Yahoo news response format
3. Create reusable PlayerCard component with:
   - Compact mode (for grid)
   - Full mode (for list views)
   - Expandable notes section
   - Expandable Yahoo news section
4. Update DraftBoardPlayerRow to use new component
5. Add player_notes display to player pool view
6. Ensure AI assistant can save to player_notes table

## Token Refresh Status

Updated endpoints to use `getYahooAccessToken()`:
- ✅ `/api/yahoo/league-settings`
- ✅ `/api/yahoo/sync-all`
- ✅ `/api/yahoo/player-news`

Still need updating:
- `/api/yahoo/roster`
- `/api/yahoo/all-rosters`
- `/api/yahoo/standings`
- `/api/yahoo/stats`
- Other Yahoo endpoints
