# Fantasy Baseball Draft Assistant

A Next.js application for managing an 18-team fantasy baseball draft with AI-powered player analysis, real-time draft tracking, and Yahoo Fantasy integration.

## Features

- **Live Draft Tracking** - Scrapes draft picks from Tapatalk forum threads
- **AI Player Analysis** - Gemini-powered insights and recommendations
- **Yahoo Integration** - Player rankings, stats, and injury news
- **Watchlist Management** - Drag-and-drop priority ranking with AI rationales
- **Draft Board** - Filterable player pool with Yahoo ranks and stats
- **Position Tracking** - Visual roster builder showing open slots
- **Database Storage** - Neon Postgres for persistent data

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS 4
- **Database**: Neon Postgres (serverless)
- **Auth**: NextAuth.js (Yahoo OAuth)
- **AI**: Google Gemini 2.5 Pro
- **Package Manager**: pnpm 10.28.0

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 10+

### Installation

```bash
pnpm install
```

### Environment Variables

Create a `.env.local` file:

```env
# Local dev (uses HTTPS for Yahoo OAuth)
NEXTAUTH_URL=https://localhost:3000
NEXTAUTH_SECRET=your_secret_here

# Yahoo Fantasy API
YAHOO_CLIENT_ID=your_yahoo_client_id
YAHOO_CLIENT_SECRET=your_yahoo_client_secret
YAHOO_LEAGUE_ID=your_league_id

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Neon Postgres
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require
```

### Development

```bash
# Start dev server (HTTPS on localhost:3000)
pnpm dev

# Run database migrations
pnpm tsx scripts/migrate-to-db.ts
pnpm tsx scripts/migrate-stats-to-db.ts

# Build for production
pnpm build
```

## Project Structure

```
src/
├── app/
│   ├── api/
│   │   ├── assistant/          # Gemini AI integration
│   │   │   ├── route.ts        # AI recommendations
│   │   │   └── notes/          # Player notes API
│   │   ├── draft-data/         # Draft picks & watchlist
│   │   ├── player-stats/       # Yahoo stats from DB
│   │   ├── scrape-draft/       # Tapatalk scraper
│   │   └── yahoo/              # Yahoo API endpoints
│   ├── draft-room/             # Main draft interface
│   └── page.tsx                # Home page
├── components/                 # React components
└── lib/
    └── db.ts                   # Database utilities

db/
└── schema.sql                  # Postgres schema

scripts/
├── migrate-to-db.ts           # Migrate JSON to DB
└── migrate-stats-to-db.ts     # Migrate player stats
```

## Database Schema

- `player_notes` - AI-generated player analysis
- `chat_history` - AI conversation logs
- `draft_picks` - All draft selections
- `watchlist` - User's target players
- `player_stats` - Yahoo player statistics (2025 season)

## League Configuration

- **Teams**: 18
- **Categories**: 7x7 (R, H, HR, RBI, SB, AVG, OPS × W, SV, K, HLD, ERA, WHIP, QS)
- **Keepers**: 10 per team (180 total)
- **Draft Format**: Linear (not snake)
- **Draft Position**: 11
- **Team Name**: New Jersey Nine
- **Roster**: C, 1B, 2B, 3B, SS, LF, CF, RF, Util, SP×4, RP×2, P×2, BN×4

## Deployment

Deployed on Vercel with:
- Automatic deployments from GitHub
- Neon Postgres integration
- Environment variables synced from Vercel dashboard

### Vercel Environment Variables

Remove `NEXTAUTH_URL` in production (auto-detected). Keep all others.

## Development Notes

### Running Migrations

```bash
# Migrate draft data, watchlist, notes, and chat history
pnpm tsx scripts/migrate-to-db.ts

# Migrate player stats (2025 season)
pnpm tsx scripts/migrate-stats-to-db.ts
```

### Git Configuration

This repo uses personal git credentials:
```bash
git config user.email "sdcohrs@yahoo.com"
```

### Yahoo OAuth Setup

1. Create Yahoo app at https://developer.yahoo.com/apps/
2. Set redirect URIs:
   - `https://localhost:3000/api/auth/callback/yahoo`
   - `https://your-app.vercel.app/api/auth/callback/yahoo`
3. Enable Fantasy Sports API permissions

## Roadmap

- [x] Database migration (Neon Postgres)
- [x] Yahoo OAuth integration
- [x] AI player analysis with Google Gemini
- [x] Draft scraping from Tapatalk
- [ ] Tapatalk API integration for auto-posting picks
- [ ] Cron job for automatic draft syncing
- [ ] Auto-draft feature with AI
- [ ] NBA support (multi-sport)
- [ ] Trade analyzer
- [ ] Waiver wire assistant

## License

Private project
