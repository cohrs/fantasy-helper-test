# Development Guide

## Current State (March 2026)

### What's Working
- ✅ Yahoo OAuth authentication
- ✅ Player stats from database (2025 season)
- ✅ AI recommendations via Gemini 2.5 Pro
- ✅ Draft scraping from Tapatalk forum
- ✅ Watchlist with drag-and-drop sorting
- ✅ Player notes with AI rationales
- ✅ Database storage (Neon Postgres)

### Known Issues
- ⚠️ Multiple AI notes per player not displaying correctly (migration issue)
- ⚠️ Stats may not show on Vercel (check normalization)

## Architecture

### Data Flow

```
Tapatalk Forum → Scraper API → Database → Frontend
Yahoo API → Stats API → Database → Frontend
User Input → AI API → Gemini → Database → Frontend
```

### Key Functions

#### Player Name Normalization
All player lookups use this normalization to handle accents, special characters, and suffixes:

```typescript
function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // Remove accents
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')          // Remove special chars
    .replace(/\s+(jr|sr|ii|iii)$/, '') // Remove suffixes
    .trim()
    .replace(/\s+/g, '');              // Remove spaces
}
```

**Critical**: Always use `normalizeName()` for player lookups, never `toLowerCase()` alone.

#### Draft Pick Calculation
```typescript
// Current pick = non-keeper picks made + 1
const nonKeeperPicks = draftResults.filter(p => p.tm && !p.isKeeper).length;
const currentPick = nonKeeperPicks + 1;

// Picks until your turn (position 11, linear draft)
const picksUntilTurn = (currentPick % 18 === 11) ? 0 : 
  (11 - (currentPick % 18) + 18) % 18;
```

**Note**: This is a LINEAR draft, not snake. Position 11 every round.

### Database Operations

#### Connection
```typescript
import { neon } from '@neondatabase/serverless';
const sql = neon(process.env.POSTGRES_URL!);
```

#### Common Queries
```typescript
// Get player notes
const notes = await sql`SELECT * FROM player_notes`;

// Save player note (upsert)
await sql`
  INSERT INTO player_notes (player_name, player_name_normalized, notes)
  VALUES (${name}, ${normalized}, ${note})
  ON CONFLICT (player_name_normalized) 
  DO UPDATE SET notes = ${note}
`;

// Get draft picks
const picks = await sql`SELECT * FROM draft_picks ORDER BY pick ASC`;

// Get player stats
const stats = await sql`SELECT * FROM player_stats WHERE season = 2025`;
```

## API Routes

### `/api/assistant` (POST)
AI recommendations using Gemini with Google Search grounding.

**Request**:
```json
{
  "myTeam": [...],
  "openSlots": {...},
  "availablePool": [...],
  "picksUntilTurn": 5,
  "customPrompt": "Find me a closer",
  "chatHistory": [...],
  "allDrafted": [...]
}
```

**Response**:
```json
{
  "recommendations": [
    {
      "name": "Player Name",
      "pos": "Position",
      "rank": "123",
      "team": "NYY",
      "rationale": "Why pick them..."
    }
  ],
  "assistantMessage": "Full AI response text"
}
```

### `/api/draft-data` (GET/POST)
Get or update draft picks and watchlist.

**GET Response**:
```json
{
  "draft": [...],
  "roster": [...]
}
```

**POST Request**:
```json
{
  "action": "SYNC_ROSTER",
  "rosterData": [...]
}
```

### `/api/player-stats` (GET)
Get player stats from database.

**Query Params**: `?season=2025`

**Response**: `{ "playernormalized": { "stat_id": "value", ... } }`

### `/api/scrape-draft` (GET)
Scrape latest picks from Tapatalk forum.

**Response**:
```json
{
  "success": true,
  "picks": [...],
  "message": "Scraped X picks"
}
```

## AI System Prompt

The AI assistant uses a comprehensive system prompt that includes:
- League format (18-team, 7x7 categories)
- Roster construction (C, 1B, 2B, 3B, SS, OF×3, Util, SP×4, RP×2, P×2, BN×4)
- Current roster state
- Open position needs
- Available player pool (top 150 by rank)
- Recent draft trends (last 20 picks with reach/fall analysis)
- Past prediction feedback (players previously recommended who were drafted)

**Key Features**:
- Google Search tool for real-time 2026 spring training news
- Conversational mode for player-specific questions
- JSON mode for draft recommendations
- Saves all recommendations to player notes

## Common Tasks

### Add a New API Route
1. Create file in `src/app/api/your-route/route.ts`
2. Export `GET`, `POST`, etc. functions
3. Use `NextResponse.json()` for responses
4. Add `export const dynamic = 'force-dynamic'` if needed

### Update Database Schema
1. Modify `db/schema.sql`
2. Run migration manually or create new migration script
3. Update `src/lib/db.ts` with new functions
4. Update TypeScript types

### Add New Player Stat
1. Ensure stat is in `player_stats.stats` JSONB column
2. Update frontend to display it
3. Add to `YAHOO_STAT_LABELS` mapping if needed

## Debugging

### Check Database Connection
```bash
# Test connection
pnpm tsx -e "import { neon } from '@neondatabase/serverless'; const sql = neon(process.env.POSTGRES_URL); sql\`SELECT 1\`.then(console.log)"
```

### View Database Contents
```bash
# Connect to Neon via psql
psql $POSTGRES_URL

# Or use Neon dashboard
```

### Check API Responses
```bash
# Test draft data API
curl http://localhost:3000/api/draft-data

# Test player stats API
curl http://localhost:3000/api/player-stats?season=2025
```

### Common Errors

**"Invalid URL" on Vercel**:
- Check `NEXTAUTH_URL` is removed from Vercel env vars
- NextAuth auto-detects production URL

**Stats not showing**:
- Verify `normalizeName()` is used for lookups
- Check database has stats: `SELECT COUNT(*) FROM player_stats`
- Verify API returns data: `/api/player-stats?season=2025`

**Yahoo OAuth fails**:
- Check redirect URIs in Yahoo app match exactly
- Verify `YAHOO_CLIENT_ID` and `YAHOO_CLIENT_SECRET` are correct
- Ensure Yahoo app has Fantasy Sports permissions enabled

## Future Features

### Tapatalk Auto-Pick
1. Create `/api/tapatalk/post-pick` route
2. Use XML-RPC to post to forum at `/mobiquo/tapatalk.php`
3. Authenticate with forum session cookie
4. Post format: "Pick #X: Player Name - Position - Team"

### Cron Job for Draft Sync
1. Create `vercel.json` with cron config
2. Create `/api/cron/sync-draft` route
3. Run every 5 minutes during draft
4. Check if it's your turn → trigger auto-pick if enabled

### NBA Support
1. Add `sport` column to all tables
2. Update stats structure for NBA categories
3. Create sport-specific UI components
4. Add sport toggle in header

## Testing

### Local Testing
```bash
# Start dev server
pnpm dev

# Test in browser
open https://localhost:3000

# Accept self-signed certificate warning
```

### Production Testing
```bash
# Build locally
pnpm build

# Start production server
pnpm start
```

## Deployment Checklist

- [ ] All env vars set in Vercel
- [ ] `NEXTAUTH_URL` removed from Vercel
- [ ] Yahoo redirect URIs include production URL
- [ ] Database migrations run
- [ ] Player stats migrated to database
- [ ] Build succeeds locally
- [ ] Test Yahoo OAuth on production
- [ ] Test AI recommendations
- [ ] Test draft scraping

## Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Neon Postgres](https://neon.tech/docs)
- [NextAuth.js](https://next-auth.js.org)
- [Google Gemini API](https://ai.google.dev/docs)
- [Yahoo Fantasy API](https://developer.yahoo.com/fantasysports/guide/)
- [Tapatalk API Research](https://gist.github.com/drdaxxy/b7731fb4217a56604956bcaa45641648)
