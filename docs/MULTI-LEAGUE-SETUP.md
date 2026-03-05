# Multi-League Support Setup

## What We Built

Added multi-league and multi-sport support to allow:
- Multiple users to use the app
- Each user to manage multiple leagues (baseball, basketball, hockey, football)
- Easy switching between leagues via dropdown
- No hardcoded league IDs

## Database Changes

### New Tables

1. **users** - Stores Yahoo user info
   - yahoo_guid (unique identifier from Yahoo)
   - nickname, email, image_url
   
2. **user_leagues** - Stores all leagues for each user
   - user_id (foreign key to users)
   - league_key (Yahoo's league identifier)
   - league_name, sport, season
   - is_active (whether league is ongoing)
   - team_key, team_name (user's team in that league)

3. **user_selected_league** - Tracks which league is currently active
   - user_id (one per user)
   - league_id (foreign key to user_leagues)

### Updated Tables

All existing tables now have `league_id` column:
- player_notes
- chat_history
- draft_picks
- watchlist

This makes all data league-specific instead of global.

## New API Endpoints

### `/api/yahoo/user-leagues` (GET)
Fetches all Yahoo leagues for authenticated user and stores them in database.

**Response:**
```json
{
  "success": true,
  "leagues": [
    {
      "league_key": "mlb.l.12345",
      "name": "Asshat Roto League",
      "sport": "baseball",
      "season": 2026,
      "is_active": true
    }
  ]
}
```

### `/api/yahoo/select-league` (POST)
Sets the active league for the user.

**Request:**
```json
{
  "leagueKey": "mlb.l.12345"
}
```

### `/api/yahoo/select-league` (GET)
Gets the currently selected league.

**Response:**
```json
{
  "success": true,
  "selectedLeague": {
    "id": 1,
    "league_key": "mlb.l.12345",
    "league_name": "Asshat Roto League",
    "sport": "baseball",
    "season": 2026
  }
}
```

## New Components

### `LeagueSelector.tsx`
React component that:
- Shows current selected league
- Opens modal to switch leagues
- Groups leagues by sport (⚾ Baseball, 🏀 Basketball, etc.)
- Automatically refreshes page after switching

## Migration

Run this to update your database:

```bash
pnpm tsx scripts/migrate-multi-league.ts
```

This will:
1. Create new tables (users, user_leagues, user_selected_league)
2. Add league_id columns to existing tables
3. Migrate existing data to a default league
4. Preserve all your current draft picks, notes, and watchlist

## Testing Locally

1. **Run migration:**
   ```bash
   pnpm tsx scripts/migrate-multi-league.ts
   ```

2. **Start dev server:**
   ```bash
   pnpm dev
   ```

3. **Test flow:**
   - Go to https://localhost:3000/draft-room
   - Click "CONNECT YAHOO"
   - After OAuth, your leagues will be fetched automatically
   - Click the league selector button (shows current league)
   - Select a different league from the modal
   - Page reloads with new league data

## Next Steps

### For Basketball Support

Now that multi-league is working, we can add basketball:

1. **Scrape basketball draft** from Tapatalk URL
2. **Update Yahoo API calls** to work with NBA leagues
3. **Add NBA stat mappings** (points, rebounds, assists, etc.)
4. **Create NBA-specific UI** for roster positions
5. **Update AI prompts** for basketball strategy

### For Other Users

The app is now multi-user ready:
- Remove hardcoded `YAHOO_LEAGUE_ID` from .env
- Each user connects their own Yahoo account
- Each user sees only their leagues
- Data is isolated per league

## Files Changed

- `db/schema.sql` - Added new tables and league_id columns
- `src/app/api/yahoo/user-leagues/route.ts` - NEW: Fetch user leagues
- `src/app/api/yahoo/select-league/route.ts` - NEW: Select/get active league
- `src/components/LeagueSelector.tsx` - NEW: League picker UI
- `src/app/draft-room/page.tsx` - Added LeagueSelector to header
- `scripts/migrate-multi-league.ts` - NEW: Database migration script

## Branch

All changes are on: `feature/multi-league-support` (local only, not pushed)
