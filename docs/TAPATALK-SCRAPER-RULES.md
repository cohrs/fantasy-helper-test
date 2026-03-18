# Tapatalk Scraper Rules

## CRITICAL: Rank vs Pick Number

**THE NUMBER IN TAPATALK IS THE PLAYER'S PRE-DRAFT RANK, NOT THE PICK NUMBER**

Example line from Tapatalk:
```
· 585. Isaac Paredes HOU - 3B - 5th Round - Cubs Win Cubs Win
```

- **585** = Player's pre-draft RANK (this never changes)
- **5th Round** = The round they were drafted in
- **Pick number** = Sequential counter (1, 2, 3, 4...) based on draft order

## CRITICAL RULES

1. **Rank and pick number are COMPLETELY SEPARATE** - Never merge or confuse them
2. **List order has NOTHING to do with draft order** - A player ranked #1500 can be picked before #100
3. **Keepers are NOT draft picks** - They say "Keeper" next to them and don't count in draft sequence
4. **Only players with team names have been picked** - If no team name, they're still available

## Database Schema

```sql
CREATE TABLE draft_picks (
  pick INT,        -- Sequential draft pick (1, 2, 3...) OR NULL for undrafted
  rank INT,        -- Player's pre-draft rank (585, 936, etc.) - ALWAYS present
  round INT,       -- Round number (1, 2, 3...) or 0 for keepers/undrafted
  player_name,
  position,
  drafted_by,      -- Team name or NULL if undrafted
  is_keeper BOOLEAN
)
```

## Pick Number Calculation

**For Keepers:**
- `pick` = NULL (keepers don't have draft pick numbers)
- `rank` = The number from Tapatalk
- `round` = 0
- `is_keeper` = true
- `drafted_by` = Team name

**For Draft Picks:**
- `pick` = Sequential counter (1, 2, 3, 4...) - count only non-keeper picks with teams
- `rank` = The number from Tapatalk  
- `round` = Extracted from "Xth Round" text (or calculated if missing)
- `is_keeper` = false
- `drafted_by` = Team name

**For Undrafted Players:**
- `pick` = NULL (not drafted yet)
- `rank` = The number from Tapatalk
- `round` = 0
- `drafted_by` = NULL
- `is_keeper` = false

## Current Pick Calculation

To determine whose turn it is:

```typescript
// Count ONLY non-keeper draft picks
const draftPicksMade = await sql`
  SELECT COUNT(*) 
  FROM draft_picks 
  WHERE drafted_by IS NOT NULL AND is_keeper = false
`;

const currentPick = draftPicksMade + 1;

// Linear draft (not snake)
const currentRound = Math.floor((currentPick - 1) / 18) + 1;
const pickInRound = ((currentPick - 1) % 18) + 1;

// User is at position 11
if (pickInRound === 11) {
  // It's your pick!
}
```

## Scraper Implementations

### Current Scraper (axios-based)
- **Endpoint**: `/api/scrape-draft`
- **Method**: Raw HTML parsing with regex
- **Issues**: Hangs on large datasets, timeout problems
- **Status**: Working but unreliable

### Playwright Scraper (NEW)
- **Endpoint**: `/api/scrape-draft-playwright`
- **Method**: Real browser automation via MCP
- **Advantages**: More reliable, better error handling, no hanging
- **Status**: In development on `playwright-scraper` branch
- **Setup**: See `docs/PLAYWRIGHT-SCRAPER-SETUP.md`

## Logging Requirements

**All scraper logs should be stored in the database** so they can be queried programmatically:

```sql
CREATE TABLE scraper_logs (
  id SERIAL PRIMARY KEY,
  league_id INT,
  timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  total_scraped INT,
  new_picks INT,
  failed_lines TEXT[],
  team_counts JSONB,
  validation_warnings TEXT[]
);
```

This allows checking scraper status without copy/pasting from terminal.

## UI Display

**Player Pool:**
- Sort by rank (ascending) for undrafted players
- Show rank badge next to player name: `#585`

**Team Roster:**
- Show players in order they were drafted (by pick number)
- Display rank badge: `#585`
- Display pick number: `Pick 23 (R2)` for draft picks
- Display "KEEPER" for keepers (no pick number)

**Draft Board:**
- Show sequential pick numbers (1, 2, 3...)
- Show rank badges next to names
- Keepers show as "KEEPER" instead of pick number

## Common Mistakes to Avoid

❌ **WRONG**: Using rank as pick number
❌ **WRONG**: Counting keepers in the draft pick sequence
❌ **WRONG**: Thinking the number in Tapatalk is the pick number
❌ **WRONG**: Thinking list order = draft order
❌ **WRONG**: Requiring terminal logs for debugging

✅ **CORRECT**: Rank is for player identification and sorting
✅ **CORRECT**: Pick number is sequential based on draft order
✅ **CORRECT**: Only count non-keeper picks for "current pick"
✅ **CORRECT**: List order is irrelevant to draft order
✅ **CORRECT**: Store logs in database for programmatic access

## Example Data

```
Rank  Pick  Round  Player              Team           Keeper
----  ----  -----  ------------------  -------------  ------
585   NULL  0      Isaac Paredes       NULL           false   (undrafted)
936   NULL  0      Samuel Basallo      No Talent...   true    (keeper)
285   23    2      Chad Patrick        Papelboners    false   (draft pick)
147   24    2      Michael Harris II   New Jersey...  false   (draft pick)
1500  25    2      Low Ranked Guy      Brohams        false   (picked despite low rank!)
```

Current pick = 26 (because 25 non-keeper picks have been made)
