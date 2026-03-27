# Fantasy League System - Critical Context

## Leagues Overview
| League Key | Name | Sport | Your Team | Status |
|-----------|------|-------|-----------|--------|
| 469.l.4136 | Asshat Baseball 2026 | baseball | New Jersey Nine (469.l.4136.t.13) | In-season (Week 1, started 2026-03-25) |
| 466.l.8873 | Asshat Basketball 2025-2026 | basketball | REAL MADRID (466.l.8873.t.10) | Season ending soon, offline draft upcoming |

- User's Yahoo GUID: UIXKGRGJKTS7A6TYUVFIZRKJ3A (sdcohrs@yahoo.com)
- User's DB user_id: 119

---

## Database Architecture (as of 2026-03-25)

### Key Design Decisions
- **All league-scoped tables use `league_key VARCHAR(255)`** (e.g., `469.l.4136`) — NOT integer IDs
- **Personal data tables** (`watchlist`, `chat_history`, `player_notes`) also have `user_id INT` for multi-user isolation
- **Shared league data** (`draft_picks`, `standings`, `team_rosters`, `matchups`) is shared across all users in the same league
- **API query param convention**: all endpoints use `?leagueKey=469.l.4136` (string)
- **Frontend**: league selection stored in `localStorage` as full league object; code reads `selectedLeague.league_key`

### Tables
| Table | Scope | Notes |
|-------|-------|-------|
| `users` | Global | Yahoo GUID, tokens, email |
| `user_leagues` | Per user | Still has auto-increment `id` but NOT used as FK |
| `draft_picks` | Per league (shared) | Tapatalk data for baseball — DO NOT overwrite |
| `team_rosters` | Per league (shared) | Yahoo in-season rosters |
| `standings` | Per league (shared) | Yahoo standings, has `stats_json` JSONB |
| `matchups` | Per league (shared) | Yahoo weekly scoreboard |
| `watchlist` | Per user + league | `league_key` + `user_id` |
| `chat_history` | Per user + league | `league_key` + `user_id` |
| `player_notes` | Per user + league | `league_key` + `user_id` |
| `yahoo_player_news` | Per league (cache) | 1-hour TTL |
| `player_stats` | Global by season/sport | Not league-specific |

---

## Baseball — In-Season (469.l.4136)

### Data Sources
- **Draft data**: Tapatalk (historical, preserved in DB — DO NOT overwrite with Yahoo sync)
- **In-season data**: Yahoo is the source of truth (rosters, standings, scoreboard)
- The `sync-all` API endpoint deletes draft picks before re-inserting — **never run full sync on 469.l.4136** or it will wipe Tapatalk draft history
- Use the targeted season sync script (`_scratch/yahoo-sync-season.mjs`) which only syncs rosters + standings

### Draft (COMPLETED)
- 18-team league, LINEAR draft (same order every round, NOT snake)
- 10 keepers per team (round 0, is_keeper=true), then R1-R14+ draft rounds
- Draft data: ~4,500 picks in DB from Tapatalk scraper (includes duplicates from migration merge)
- Draft strip is hidden in UI when in-season (team_rosters loaded = draft over)

### NJN Roster (as of 2026-03-25)
- 25 players total (10 keepers + 15 drafted)
- **IL60**: Corbin Burnes (AZ, SP) — needs replacement pickup
- **DTD**: Gleyber Torres (DET, 2B), A.J. Minter (NYM, RP), Orion Kerkering (PHI, RP)

---

## Basketball — In-Season (466.l.8873)

### Current Status
- Season is winding down, 14 teams
- Yahoo is source of truth for current season data
- Your team: REAL MADRID (466.l.8873.t.10) — resolved via Yahoo GUID matching
- `/api/my-team` auto-resolves team_key/team_name via Yahoo API when null

### Upcoming: Offline Draft (2026-2027 season)
- Will follow the same pattern as baseball: offline draft via Tapatalk forum
- Reuse the Tapatalk scraper infrastructure built for baseball
- Key differences from baseball TBD: number of keepers, roster size, positions, number of rounds

---

## Yahoo Auth
- Tokens expire every ~1 hour, auto-refresh via `src/lib/yahoo-auth.ts`
- Refresh tokens are long-lived but need periodic re-login if they expire
- Token refresh script: `_scratch/check-yahoo-tokens.mjs`

## Scraper Behavior (Tapatalk — draft only)
- Default: UPSERT mode — inserts new, updates existing, preserves manual additions
- `?fullReplace=true` for full delete + re-insert (only if duplicates detected)
- UPSERT matches on player_name + position within the league

## Deployment
- Git: `main` = production, `dev` = working branch
- Vercel project: `fantasy-helper-test` (linked via `.vercel/`)
- Production URL: https://fantasy-helper-test.vercel.app
- Production branch: `main` (set in Vercel dashboard → Settings → Environments → Production)
- DB: Neon PostgreSQL (`POSTGRES_URL` in `.env.local`)
- Auth: Yahoo OAuth via NextAuth
- AI: Google Gemini 2.5 Pro (`GEMINI_API_KEY`)

## Multi-User Support
- Each user gets their own `users` row on Yahoo sign-in
- Leagues are per-user (`user_leagues.user_id`)
- Personal data (watchlist, chat, notes) scoped by `user_id`
- Shared data (draft picks, rosters, standings) shared across users in same league
- `/api/leagues` GET filters by logged-in user
