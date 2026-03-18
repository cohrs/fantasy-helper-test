# Draft System - Critical Context

## Draft Order (18-team league)
1. Amazins
2. Brohams
3. Timberwolves
4. Cubs Win Cubs Win
5. Dillweed
6. Hulkamania
7. 1st to 3rd
8. Pirates Baseball
9. K-Bandits
10. The Papelboners
**11. New Jersey Nine** ← USER'S TEAM
12. Jack McKeon
13. Jungle Town Piranhas
14. JP
15. No Talent Ass Clowns
16. The Joshua Trees
17. Mountain Diehards
18. Mdub321

## Key Facts
- **User is position 11** - always picks 11th in each round (unless they trade picks)
- **User has NOT traded any picks** - always position 11
- **User picks once per round** - one pick per round only
- **Picks CAN be traded** - some teams may have 0, 1, or multiple picks in a round if they traded
- **Draft order changes with trades** - the pick order within a round is NOT always 1-18 if picks were traded
- **Detect trades by:** If same team appears multiple times in same round, they have multiple picks
- **Current pick calculation:** Find the maximum pick number in database, add 1 (accounts for missing/traded picks)

## Draft Format
**LINEAR DRAFT - NOT SNAKE** - Same order every round (1-18)
- **ABSOLUTELY NOT A SNAKE DRAFT**
- Every round: Picks go 1-18 in the SAME order (1, 2, 3... 18)
- Order NEVER reverses
- Your position 11 picks at: 11, 29, 47, 65, 83, 101, 119, 137, 155, 173...
- This is ALWAYS the same every single round

## Your Expected Pick Numbers (Position 11)
- R1: Pick **11**
- R2: Pick **29**
- R3: Pick **47**
- R4: Pick **65**
- R5: Pick **83**
- R6: Pick **101**
- R7: Pick **119**
- R8: Pick **137**
- R9: Pick **155**
- R10: Pick **173**

**NOTE:** Actual picks may differ from expected if trades have occurred

## Data Source
- **Tapatalk** is the source of truth for draft data (not Yahoo)
- Each player line shows: Rank, Player Name, Position, Team, Round, and which team drafted them
- Keepers are NOT draft picks - they're associated with teams but have no pick number
- **CRITICAL: Tapatalk list order is STATIC and does NOT change**
  - Keepers appear in the list but are not picks
  - Later round picks appear AFTER keepers in the list, even though they're picked later
  - Must extract ROUND number from each entry and sort by round to get correct pick order
  - Within each round, picks are numbered sequentially (1-18, 19-36, 37-54, etc.)

## Round Structure — CRITICAL
- **Keepers = round 0** (10 keepers per team, 18 teams = 180 total, is_keeper=true)
- **Draft rounds = R1, R2, R3...** (Tapatalk round number used directly, NO offset)
- The scraper uses Tapatalk round numbers as-is
- Every completed draft round has 18 picks (some teams may have 0 or 2 picks due to trades)
- Scraper does FULL REPLACE on each run (delete all + re-insert) to avoid duplicates
- **Player list may be missing picks** — cross-reference with individual round threads if counts are short

## Database
- `draft_picks` table stores all picks
- `pick` field = sequential pick number (1, 2, 3...) - UNIMPORTANT, just for ordering
- `round` field = round number (1, 2, 3...) for draft picks, 0 for keepers - CRITICAL for display
- `rank` field = player's pre-draft ranking (UNCHANGING value, NOT pick number) - Shows ADP/pre-draft ranking
- `drafted_by` field = team name that made the pick
- `is_keeper` field = true for keepers (no pick number)
- Scraper does FULL REPLACE on each run (delete all + re-insert) to avoid duplicates

## CRITICAL: Rank vs Pick
- **RANK** = Pre-draft ranking (e.g., rank 1, rank 50, rank 500) - UNCHANGING, shows where player was valued before draft
- **PICK** = Sequential pick number in draft (1, 2, 3...) - Only used for ordering, NOT for display
- Huge gaps in rank numbers are NORMAL (e.g., rank 1 to rank 50 to rank 200) because many players go undrafted
- **What matters for display**: ROUND and how many picks until your next pick

## Current Status
- League 2 = real baseball league (preserve data)
- League 3 = testing only
- User's team: New Jersey Nine
- Draft format: LINEAR (same order every round)
- Keepers: 10 per team (round 0)
- Draft rounds completed: R1-R13 (18 picks each)
- R14 in progress — 1 pick made so far
- NJN has 13 draft picks (R1-R13) + 10 keepers = 23 total

## Known Manual Fixes (NOT in Tapatalk player list)
These picks exist in the individual round threads but NOT in the main player list.
The scraper will NOT find them — they must be preserved in the DB.
- **R4: Max Meyer** (SP, MIA) — drafted by Amazins (position 1 in round)
- **R6: Colton Cowser** (OF, BAL) — drafted by The Joshua Trees (position 16 in round)

## Known Trades
- Mountain Diehards traded R2 and R4 picks (has extra picks in R10, R11)
- No Talent Ass Clowns has extra picks in R4 and R5 (from trades)

## Scraper Behavior
- Default: UPSERT mode — inserts new players, updates existing, preserves manual additions
- Pass `?fullReplace=true` to do a full delete + re-insert (use only if duplicates detected)
- UPSERT matches on player_name + position within the league
