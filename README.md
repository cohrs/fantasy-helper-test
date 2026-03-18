# Multi-Sport Fantasy Assistant

A Next.js application for managing fantasy sports leagues with AI-powered player analysis, real-time draft tracking, and Yahoo Fantasy integration. Supports both baseball and basketball leagues.

## Features

### Multi-League Support
- **League Selector** - Switch between multiple fantasy leagues
- **Sport Detection** - Automatic baseball/basketball mode switching
- **Isolated Data** - Each league's data stored separately

### Baseball (Draft Mode)
- **Live Draft Tracking** - Scrapes draft picks from Tapatalk forum threads
- **Draft Board** - Filterable player pool with Yahoo ranks and stats
- **Position Tracking** - Visual roster builder showing open slots

### Basketball (In-Season Mode)
- **Yahoo Sync** - Import draft results, standings, and rosters
- **Team Rosters** - View all teams and their players
- **Standings** - League rankings and records

### Shared Features
- **AI Player Analysis** - Gemini-powered insights and recommendations
- **Yahoo Integration** - Player rankings, stats, and injury news
- **Watchlist Management** - Drag-and-drop priority ranking with AI rationales
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

Create a `.env.local` file (see `.env.example` for template):

```env
# Local dev (HTTPS enforced automatically via middleware)
NEXTAUTH_URL=https://localhost:3000
NEXTAUTH_SECRET=your_secret_here

# Yahoo Fantasy API
YAHOO_CLIENT_ID=your_yahoo_client_id
YAHOO_CLIENT_SECRET=your_yahoo_client_secret
YAHOO_LEAGUE_ID=your_default_league_id

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key

# Neon Postgres
POSTGRES_URL=postgresql://user:pass@host/db?sslmode=require
```

#### Getting API Credentials

1. **Yahoo Fantasy API**
   - Create app at https://developer.yahoo.com/apps/
   - Set redirect URIs:
     - `https://localhost:3000/api/auth/callback/yahoo`
     - `https://your-app.vercel.app/api/auth/callback/yahoo`
   - Enable Fantasy Sports API permissions

2. **Google Gemini**
   - Get API key from https://aistudio.google.com/app/apikey

3. **Neon Postgres**
   - Create database at https://neon.tech
   - Copy connection string from dashboard

4. **NextAuth Secret**
   - Generate with: `openssl rand -base64 32`

### Development

```bash
# Start dev server (HTTPS enforced automatically)
pnpm dev

# Run database migrations
pnpm tsx scripts/migrate-to-db.ts
pnpm tsx scripts/migrate-stats-to-db.ts

# Build for production
pnpm build

# Start production server
pnpm start
```

The app will automatically redirect HTTP to HTTPS in development mode.

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

### Core Tables
- `leagues` - User's fantasy leagues with sport type
- `player_notes` - AI-generated player analysis
- `chat_history` - AI conversation logs
- `draft_picks` - All draft selections
- `watchlist` - User's target players
- `player_stats` - Yahoo player statistics

### Basketball-Specific
- `standings` - Team rankings and records
- `team_rosters` - Current roster for each team

## League Configuration

### Baseball League
- **Teams**: 18
- **Categories**: 7x7 (R, H, HR, RBI, SB, AVG, OPS × W, SV, K, HLD, ERA, WHIP, QS)
- **Keepers**: 10 per team (180 total)
- **Draft Format**: Linear (not snake)
- **Roster**: C, 1B, 2B, 3B, SS, LF, CF, RF, Util, SP×4, RP×3, P×2, BN×7

### Basketball League
- **Teams**: 14
- **Categories**: 9-cat H2H
- **Roster**: PG, SG, SF, PF, C, G, F, UTIL, BN

## Deployment

Deployed on Vercel with:
- Automatic deployments from GitHub
- Neon Postgres integration
- Environment variables synced from Vercel dashboard

### Vercel Environment Variables

Remove `NEXTAUTH_URL` in production (auto-detected). Keep all others.

## Setup for New Users

1. Clone the repository
2. Install dependencies: `pnpm install`
3. Copy `.env.example` to `.env.local` and fill in your credentials
4. Run database migrations: `pnpm tsx scripts/migrate-to-db.ts`
5. Start dev server: `pnpm dev`
6. Visit https://localhost:3000 (will auto-redirect from http)
7. Sign in with Yahoo to select your leagues

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
git config user.email "your-email@example.com"
```

## Roadmap

- [x] Database migration (Neon Postgres)
- [x] Yahoo OAuth integration
- [x] AI player analysis with Google Gemini
- [x] Draft scraping from Tapatalk
- [x] Multi-league support (baseball + basketball)
- [x] League selector with sport detection
- [x] Basketball in-season management
- [ ] Standings view UI
- [ ] Schedule/matchups view
- [ ] Tapatalk API integration for auto-posting picks
- [ ] Cron job for automatic draft syncing
- [ ] Auto-draft feature with AI
- [ ] Trade analyzer
- [ ] Waiver wire assistant
- [ ] MCP server for AI assistant tools

## License

Private project
