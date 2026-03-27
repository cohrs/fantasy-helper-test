---
inclusion: auto
---

# Session Handoff — 2026-03-26

## What Was Done This Session

### Mobile Responsive (pushed to main, deployed)
- Tighter padding on mobile (`p-2 sm:p-4 md:p-8`), `h-dvh` viewport fix
- Header nav buttons: icon-only on mobile, text on desktop (`hidden sm:inline`)
- Tab bars: horizontally scrollable with `scrollbar-hide`
- Team selector: native `<select>` dropdown on mobile, sidebar on desktop (`sm:hidden` / `hidden sm:flex`)
- Inline assistant bar hidden on mobile (Chat page is the single AI entry point)
- Main content card: `rounded-2xl sm:rounded-[2.5rem]`, `p-3 sm:p-8`
- Chat page: responsive header, tighter padding

### URL Rename
- `/draft-room` → `/league` (file moved to `src/app/league/page.tsx`)
- All internal links updated (page.tsx, chat/page.tsx, select-league/page.tsx)

### Sync Improvements
- New `/api/yahoo/sync-season` endpoint — SAFE in-season sync (rosters + standings + matchups). NEVER touches draft_picks.
- Both baseball and basketball use the same "Sync Yahoo" button calling sync-season
- Old "Sync Local" (Tapatalk scraper) button removed from header UI
- Sync endpoint now stores `selected_position` (Yahoo roster slot like C, LF, SP, BN, IL) and `eligible_positions` (what the player can play) separately

### DB Changes (already applied to production Neon DB)
- `team_rosters` table: added `selected_position VARCHAR(20)` and `eligible_positions VARCHAR(255)` columns
- Added unique constraint `(league_key, team_key, player_key)` on `team_rosters`
- Cleaned ~450 duplicate rows from `team_rosters`

### Roster Display
- In-season roster groups by section: Batters → Starters → Relievers → Pitchers → Bench → Injured
- Uses `selected_position` for slot badge and section grouping
- Uses `eligible_positions` for showing what positions a player can play
- Team list comes from `teamRosters` when in-season (not `draftResults`)

### Navigation
- Baseball in-season tabs: Team / Standings / Matchup / Watchlist
- Baseball draft tabs (fallback when no teamRosters): Pool / Draft / Team / Needs / Watchlist
- Basketball tabs unchanged: Team / Standings / Matchup / Pool / Watchlist
- Title shows "League Manager" when in-season, "Draft Board" during draft
- Grid view duplicate key error fixed (was using `p.pk` which has duplicates)
- Chat suggestions made generic (not hardcoded to specific players)

## CRITICAL: What Still Needs Fixing

### 1. selected_position is NULL for all players
The `selected_position` column was added but the data hasn't been re-synced yet. User needs to hit "Sync Yahoo" button on production to populate it. Until then, ALL players show in "Bench" section because the grouping logic falls back to eligible positions which don't match section categories.

### 2. Roster display still shows eligible positions as slot badge
The `position` field in `team_rosters` still has eligible positions (like `SP,P,IL` or `LF,CF,RF,Util`). After a sync, `selected_position` will have the correct slot (`SP`, `LF`, `BN`, etc.) and the display code already uses it — it just needs the data.

### 3. Stats showing last season (2025)
The `player_stats` table has 2025 season data. Need to either:
- Fetch current season stats from Yahoo during sync
- Or add a stat_id-to-label mapping so the raw Yahoo stat IDs (26, 27, 28, etc.) display as ERA, WHIP, W, etc.

### 4. Production URL / NEXTAUTH_URL
The `NEXTAUTH_URL` env var in `.env.local` is `https://localhost:3000`. On Vercel production, this should be set to `https://fantasy-helper-test.vercel.app` in the Vercel dashboard env vars. If auth is broken on production, this is likely why.

## What To Build Next

### Roster Editing (not built yet)
The app is read-only. Yahoo API supports write operations:
- Position swaps: PUT to `https://fantasysports.yahooapis.com/fantasy/v2/team/{team_key}/roster`
- Add/drop players: POST transactions
- Need UI for tap-to-swap positions, add/drop flow

### Current Season Stats
- Yahoo roster API can include player stats with subresource
- Need to fetch and display 2026 stats instead of 2025

## Git/Deploy Rules
- NEVER run git commit, push, merge, or any vercel CLI command without explicit user approval
- Deployments happen through Git integration only (push to main → Vercel auto-deploys)
- NEVER run `npx vercel` or `vercel deploy` — the CLI is scoped to wrong team context
- Production branch: `main`, working branch: `dev`
- Commit to dev first, then merge to main and push
