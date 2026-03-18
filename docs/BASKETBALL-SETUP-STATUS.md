# Basketball Setup Status

## Branch: `feature/multi-league-support` (local only)

## ✅ Completed

### Multi-League Infrastructure
- Database schema updated with league-specific tables
- All data (draft picks, watchlist, notes, chat) now isolated per league
- League selector UI with sport emoji indicators
- Automatic sport switching based on selected league
- HTTP → HTTPS redirect for local dev

### API Endpoints Created
- `/api/yahoo/user-leagues` - Fetches all Yahoo leagues for user
- `/api/yahoo/select-league` - Select/get active league (GET/POST)
- `/api/yahoo/league-settings` - Fetches roster positions & stat categories from Yahoo

### Database Fixes
- Fixed unique constraints for multi-league support
- Migrated existing baseball data to default league
- Added fallback to default-user for local development

### UI Updates
- Removed redundant MLB/NBA toggle
- Sport auto-switches with league selection
- Basketball notice: "🏀 Basketball features coming soon!"
- League selector shows current league with emoji

## 🔧 Current Issues

### Baseball Data
- **Status**: Broken (no team data showing)
- **Cause**: League-specific queries + constraint issues
- **Fix Applied**: 
  - Fixed database constraints
  - Added fallback to default-user league
  - Restarted dev server
- **Next**: Need to verify it's working

## 📋 Next Steps for Basketball

### 1. Verify League Settings (NOW)
```bash
# Open browser console at https://localhost:3000/draft-room
# Should see:
# 📋 League Settings: {...}
# 🏀 Roster Positions: [...]
# 📊 Stat Categories: {...}
```

### 2. Scrape Basketball Draft
- URL: https://www.tapatalk.com/groups/asshatrotoleagues/2025-2026-player-list-t611.html
- Create new scraper endpoint for basketball
- Parse completed draft data
- Store in database with basketball league_id

### 3. Yahoo Integration
- Fetch current rosters from Yahoo
- Get player stats (2024-25 season)
- Get injury news
- Get waiver wire available players

### 4. Basketball UI
- Roster positions from Yahoo (G, F, C, UTIL, etc.)
- Stat categories (PTS, REB, AST, STL, BLK, FG%, FT%, 3PM, TO)
- Mid-season features:
  - Lineup optimizer (start/sit recommendations)
  - Waiver wire suggestions
  - Trade analyzer
  - Streaming recommendations

### 5. AI Assistant Updates
- Basketball-specific prompts
- Category analysis (punt strategies)
- Waiver wire recommendations
- Trade evaluation

## 🧪 Testing Checklist

- [ ] Baseball league loads with data
- [ ] Basketball league shows "coming soon" notice
- [ ] League selector shows all Yahoo leagues
- [ ] Switching leagues reloads with correct data
- [ ] HTTP redirects to HTTPS
- [ ] League settings API returns roster positions
- [ ] Draft scraper works for basketball URL

## 📁 Files Changed

### New Files
- `src/app/api/yahoo/user-leagues/route.ts`
- `src/app/api/yahoo/select-league/route.ts`
- `src/app/api/yahoo/league-settings/route.ts`
- `src/components/LeagueSelector.tsx`
- `src/proxy.ts` (HTTP → HTTPS redirect)
- `scripts/migrate-multi-league.ts`
- `scripts/fix-constraints.ts`

### Modified Files
- `db/schema.sql` - Added league tables & foreign keys
- `src/lib/db.ts` - All functions now league-aware
- `src/app/api/draft-data/route.ts` - League-specific queries
- `src/app/api/assistant/notes/route.ts` - League-specific notes
- `src/app/api/scrape-draft/route.ts` - League-specific draft saves
- `src/app/draft-room/page.tsx` - League selector integration

## 🚀 Dev Server

Running at: https://localhost:3000
HTTP (http://localhost:3000) auto-redirects to HTTPS

## 💾 Database State

- 2 users: `default-user` (baseball), `yahoo` (your account)
- 2 leagues: Baseball (migrated data), Basketball (empty)
- Baseball data: 2335 draft picks, 16 notes, 20 watchlist items
- Basketball data: Empty (ready for scraping)
