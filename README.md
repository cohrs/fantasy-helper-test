# Fantasy Baseball Draft Assistant

A Next.js application for managing an 18-team fantasy baseball draft with AI-powered player analysis and real-time draft tracking.

## Features

- **Live Draft Tracking** - Scrapes draft picks from Tapatalk forum threads
- **AI Player Analysis** - Gemini-powered insights for draft decisions
- **Yahoo Integration** - Fetches player rankings, stats, and news
- **Watchlist Management** - Drag-and-drop priority ranking of target players
- **Draft Board** - Filterable player pool with stats and availability
- **Position Tracking** - Visual roster builder showing open slots

## Tech Stack

- Next.js 15 (App Router)
- TypeScript
- Tailwind CSS
- NextAuth.js (Yahoo OAuth)
- Google Gemini API
- Axios for web scraping

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm

### Installation

```bash
pnpm install
```

### Environment Variables

Create a `.env.local` file with:

```env
NEXTAUTH_URL=https://localhost:3000
NEXTAUTH_SECRET=your_secret_here
YAHOO_CLIENT_ID=your_yahoo_client_id
YAHOO_CLIENT_SECRET=your_yahoo_client_secret
YAHOO_LEAGUE_ID=your_league_id
GEMINI_API_KEY=your_gemini_api_key
```

### Development

```bash
pnpm dev
```

Open [https://localhost:3000](https://localhost:3000) (uses HTTPS for Yahoo OAuth)

## Project Structure

- `/src/app/api/assistant` - Gemini AI integration
- `/src/app/api/yahoo` - Yahoo Fantasy Sports API
- `/src/app/api/scrape-draft` - Tapatalk draft thread scraper
- `/src/app/draft-room` - Main draft interface
- `*.json` - Local data storage (draft results, watchlist, AI notes)

## League Configuration

- 18 teams
- 7x7 categories (R, H, HR, RBI, SB, AVG, OPS × W, SV, K, HLD, ERA, WHIP, QS)
- 10 keepers per team
- Linear draft (not snake)
- Draft position: 11

## Roadmap

- [ ] Migrate to database (Vercel Postgres/Supabase)
- [ ] Multi-user support
- [ ] Real-time draft updates
- [ ] Trade analyzer
- [ ] Waiver wire assistant

## License

Private project
