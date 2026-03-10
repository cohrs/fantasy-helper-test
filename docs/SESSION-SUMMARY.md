# Session Summary - March 9, 2026

## Completed

### 1. Fixed Scraper Rank vs Pick Issue
- Made `pick` column nullable in database
- Separated player RANK (pre-draft ranking) from PICK NUMBER (sequential draft order)
- Keepers now have `pick = NULL` and are not counted in draft sequence
- Created comprehensive documentation in `docs/TAPATALK-SCRAPER-RULES.md`

### 2. Yahoo Token Refresh
- Added server-side token storage with automatic refresh
- Created `src/lib/yahoo-auth.ts` with `getYahooAccessToken()` function
- Updated endpoints: league-settings, sync-all, player-news
- Tokens stored in database with expiration tracking
- Added fallback for yahoo/yahoo-user session mismatch

### 3. Team Name Normalization
- Fixed "Timber Wolves" vs "Timberwolves" duplicate
- Added normalization for spaces in hyphens ("K- Bandits" → "K-Bandits")

### 4. Yahoo News Caching
- Created `yahoo_player_news` table to cache player news
- News cached for 1 hour to reduce API calls
- Automatically saves when fetched, returns cached version if recent

### 5. Bug Fixes
- Fixed React key error for players with null pick numbers
- Fixed watchlist not saving (getSelectedLeagueId fallback)
- Fixed chat history not saving (league ID issue)
- Restored leagues with correct IDs after accidental deletion

## Data Loss Incident

**What happened**: Deleting duplicate `yahoo` user triggered CASCADE DELETE on leagues, which deleted:
- Watchlist (26 players)
- Draft picks (2335 entries)

**Resolution**:
- Leagues restored with correct IDs (2 and 3)
- Draft picks can be restored by clicking "SYNC LOCAL"
- Watchlist needs manual rebuild

**Lesson**: Be extremely careful with user deletion due to CASCADE constraints

## Current State

### Working
- ✅ Draft scraping from Tapatalk
- ✅ Watchlist save/load
- ✅ AI chat history save/load
- ✅ Yahoo token refresh
- ✅ Yahoo news caching
- ✅ Team name normalization
- ✅ Rank vs pick separation

### Needs Work
- ⏳ Apply expandable card UI to Team view (show AI notes + Yahoo news)
- ⏳ Apply expandable card UI to Player Pool view
- ⏳ Update remaining Yahoo endpoints to use token refresh
- ⏳ Prevent chat panel from closing on page refresh

## Next Steps

1. **Team View Enhancement**
   - Convert table rows to expandable cards
   - Add AI notes section (from player_notes table)
   - Add Yahoo news section (from yahoo_player_news table)
   - Match styling from watchlist cards

2. **Player Pool Enhancement**
   - Add expandable notes to DraftBoardPlayerRow
   - Show player_notes (general AI analysis)
   - Show Yahoo news
   - Add "Ask AI" button

3. **Remaining Yahoo Endpoints**
   - Update roster, all-rosters, standings, stats endpoints
   - Add token refresh to all Yahoo API calls

4. **Chat Persistence**
   - Consider storing chat panel state in localStorage
   - Restore open state after page refresh

## Files Modified

### Core Changes
- `src/app/api/scrape-draft/route.ts` - Rank vs pick separation
- `src/lib/db.ts` - Added fallback for yahoo/yahoo-user
- `src/lib/yahoo-auth.ts` - NEW: Token refresh logic
- `db/schema.sql` - Made pick nullable, added yahoo_player_news table

### Yahoo API Updates
- `src/app/api/yahoo/league-settings/route.ts`
- `src/app/api/yahoo/sync-all/route.ts`
- `src/app/api/yahoo/player-news/route.ts`

### Auth
- `src/app/api/auth/[...nextauth]/route.ts` - Better GUID extraction

### UI
- `src/app/draft-room/page.tsx` - Fixed React key error

### Documentation
- `docs/TAPATALK-SCRAPER-RULES.md` - NEW
- `docs/YAHOO-API-USAGE.md` - NEW
- `docs/PLAYER-CARD-IMPROVEMENTS.md` - NEW

## Git Status

Branch: `feature/multi-league-support`
Last commit: "Fix scraper rank vs pick, add Yahoo token refresh, fix duplicate teams"

Ready to continue with Team view enhancements.
