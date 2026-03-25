# Fantasy League System - Critical Context

## Leagues Overview
| ID | League Key | Name | Sport | Status |
|----|-----------|------|-------|--------|
| 2 | 469.l.4136 | Asshat Baseball 2026 | baseball | In-season (Week 1, started 2026-03-25) |
| 5 | 469.l.4136 | Asshat Baseball 2026 | baseball | Duplicate Yahoo entry — use league 2 |
| 6 | 466.l.8873 | Asshat Basketball 2025-2026 | basketball | Season ending soon, offline draft upcoming |

- User's team: **New Jersey Nine** (team key: 469.l.4136.t.13)
- User's Yahoo GUID: UIXKGRGJKTS7A6TYUVFIZRKJ3A (sdcohrs@yahoo.com)

---

## Baseball — In-Season (League 2)

### Data Sources
- **Draft data**: Tapatalk (historical, preserved in DB — DO NOT overwrite with Yahoo sync)
- **In-season data**: Yahoo is now the source of truth (rosters, standings, scoreboard)
- The `sync-all` API endpoint deletes draft picks before re-inserting — **never run full sync on league 2** or it will wipe Tapatalk draft history
- Use the targeted season sync script (`_scratch/yahoo-sync-season.mjs`) which only syncs rosters + standings

### Draft (COMPLETED)
- 18-team league, LINEAR draft (same order every round, NOT snake)
- 10 keepers per team (round 0, is_keeper=true), then R1-R14+ draft rounds
- Draft data: 2,335 picks in DB from Tapatalk scraper
- Draft order: Amazins(1), Brohams(2), Timberwolves(3), Cubs Win Cubs Win(4), Dillweed(5), Hulkamania(6), 1st to 3rd(7), Pirates Baseball(8), K-Bandits(9), The Papelboners(10), **New Jersey Nine(11)**, Jack McKeon(12), Jungle Town Piranhas(13), JP(14), No Talent Ass Clowns(15), The Joshua Trees(16), Mountain Diehards(17), Mdub321(18)

### Known Manual Fixes (preserved in DB, not in Tapatalk player list)
- R4: Max Meyer (SP, MIA) — drafted by Amazins
- R6: Colton Cowser (OF, BAL) — drafted by The Joshua Trees

### Known Trades
- Mountain Diehards traded R2 and R4 picks (has extra picks in R10, R11)
- No Talent Ass Clowns has extra picks in R4 and R5 (from trades)

### NJN Roster (as of 2026-03-25)
- 25 players total (10 keepers + 15 drafted)
- **IL60**: Corbin Burnes (AZ, SP) — needs replacement pickup
- **DTD**: Gleyber Torres (DET, 2B), A.J. Minter (NYM, RP), Orion Kerkering (PHI, RP)

### Database Tables
- `draft_picks` — Tapatalk draft history (league 2). DO NOT delete/overwrite.
- `team_rosters` — Yahoo in-season rosters (synced from Yahoo)
- `standings` — Yahoo standings (synced from Yahoo)
- `matchups` — Yahoo weekly matchups/scoreboard
- `watchlist` — User's personal watchlist
- `player_notes` — User's notes on players
- `chat_history` — AI assistant chat history

### Database Fields (draft_picks)
- `pick` = sequential pick number (ordering only)
- `round` = round number (0 for keepers, 1+ for draft rounds)
- `rank` = pre-draft ranking (UNCHANGING, not pick number)
- `drafted_by` = team name
- `is_keeper` = true for keepers

---

## Basketball — Season Ending, Offline Draft Next (League 6)

### Current Status
- League 6 (466.l.8873) — Asshat Basketball 2025-2026
- Season is winding down
- Yahoo is source of truth for current season data

### Upcoming: Offline Draft (2026-2027 season)
- Will follow the same pattern as baseball: offline draft via Tapatalk forum
- Same league members, similar draft format (LINEAR, keepers + draft rounds)
- **Plan**: Reuse the Tapatalk scraper infrastructure built for baseball
- The scraper, draft room UI, and pick tracking all apply to basketball with sport-specific adjustments
- Key differences from baseball TBD: number of keepers, roster size, positions, number of rounds

### TODO for Basketball Draft
1. Confirm draft format details (keepers count, rounds, positions)
2. Set up basketball league entry in DB (league 6 already exists)
3. Adapt Tapatalk scraper for basketball draft thread format
4. Reuse draft room UI with basketball positions
5. After draft completes, switch to Yahoo as source of truth for in-season

---

## Yahoo Auth
- Tokens expire every ~1 hour, auto-refresh via `src/lib/yahoo-auth.ts`
- Refresh tokens are long-lived but need periodic re-login if they expire
- Token refresh script: `_scratch/check-yahoo-tokens.mjs`

## Scraper Behavior (Tapatalk — draft only)
- Default: UPSERT mode — inserts new, updates existing, preserves manual additions
- `?fullReplace=true` for full delete + re-insert (only if duplicates detected)
- UPSERT matches on player_name + position within the league
- Tapatalk list order is STATIC — must extract ROUND number and sort by round
