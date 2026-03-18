# Yahoo API Usage by Sport

## Baseball

For baseball leagues, Yahoo API is **NOT used for draft tracking**. The draft is managed entirely through Tapatalk scraping.

### What Yahoo provides for Baseball:
- League settings (roster positions, stat categories)
- In-season standings
- In-season rosters (current team compositions)
- Player stats during the season

### What Tapatalk provides for Baseball:
- Complete draft results (picks, keepers, undrafted players)
- Player rankings
- Draft order and rounds

## Basketball

For basketball leagues, Yahoo API is used more extensively.

### What Yahoo provides for Basketball:
- League settings
- Draft results
- Standings
- Rosters
- Player stats
- Player news

## Token Management

All Yahoo API endpoints now use server-side token storage with automatic refresh:
- Tokens are stored in the database (users table)
- Access tokens are automatically refreshed when expired
- No need to re-login unless refresh token expires (typically 1 year)

## Endpoints Updated

The following endpoints now use `getYahooAccessToken()` for automatic token refresh:
- `/api/yahoo/league-settings` ✅
- `/api/yahoo/sync-all` ✅

Still need updating:
- `/api/yahoo/roster`
- `/api/yahoo/all-rosters`
- `/api/yahoo/standings`
- `/api/yahoo/stats`
- `/api/yahoo/player-news`
- `/api/yahoo/watchlist`
- Other Yahoo endpoints

## For Baseball Users

If you see Yahoo 401 errors during baseball draft:
1. These are expected - baseball doesn't need Yahoo for draft tracking
2. Use "SYNC LOCAL" button to scrape from Tapatalk
3. Yahoo is only needed for in-season features (standings, stats)
