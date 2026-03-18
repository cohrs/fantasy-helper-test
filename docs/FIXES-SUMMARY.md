# Fixes Applied - Basketball In-Season Issues

## ✅ Fixed Issues

### 1. User's Team Not Listed First
**Problem**: Team list wasn't sorting user's team to the top for basketball.

**Solution**: Added same sorting logic for basketball as baseball - user's team (with ★) appears first.

### 2. Yahoo Players Auto-Load for Basketball
**Problem**: Player pool was empty because Yahoo players weren't loading automatically.

**Solution**: Added auto-load of Yahoo players when basketball league is selected:
```typescript
if (activeSport === 'basketball') {
  loadYahooPlayers();
}
```

## ⚠️ Issues Requiring Investigation

### 1. Standings Showing All 0-0-0
**Current State**: Standings table displays but all teams show 0 wins, 0 losses, 0 ties.

**Possible Causes**:
- Data not syncing from Yahoo properly
- Yahoo API not returning W-L-T data for basketball
- Basketball uses different standings format (category-based, not W-L-T)

**Next Steps**:
- Check console logs during "SYNC FROM YAHOO" 
- Verify what data Yahoo API returns for basketball standings
- Basketball might need different standings display (category wins, not matchup wins)

### 2. Pool Still Shows Nothing
**Current State**: Even with auto-load, player pool may be empty.

**Possible Causes**:
- Yahoo players API might be sport-specific (MLB vs NBA)
- API endpoint `/api/yahoo/players` might need sport parameter
- Basketball player data might use different API endpoint

**Next Steps**:
- Check browser console for errors when loading Yahoo players
- Verify `/api/yahoo/players` works for basketball
- May need separate endpoint for NBA players

### 3. YAHOO Button - What It Does
**Purpose**: Loads Yahoo player rankings and projections (500 players)
- Fetches from `/api/yahoo/players` in batches of 50
- Provides player rankings, status, positions
- Used to populate the player pool

**For Basketball**: Should auto-load on page load (now implemented)

### 4. STATS Button - What It Does
**Purpose**: Loads historical player stats from database
- Number shown (e.g., "1992") = count of players with stats in DB
- Fetches from `/api/player-stats?season=2025`
- Used for sorting players by stats (HR, RBI, etc.)

**For Basketball**: Would need NBA stats (PTS, REB, AST, etc.)

## ❌ Not Possible

### Yahoo Watchlist Sync
**Problem**: Can we pull Yahoo's watchlist?

**Answer**: No - Yahoo Fantasy API does not expose watchlist data. It's a web-only feature that cannot be accessed via API.

**Alternative**: Use our own database watchlist (already implemented) which is league-specific and works great.

## 🔍 Debugging Steps

### To Fix Empty Player Pool:
1. Open browser console (F12)
2. Click "YAHOO" button or reload page
3. Look for errors in console
4. Check Network tab for `/api/yahoo/players` requests
5. Verify response data structure

### To Fix Standings Data:
1. Click "SYNC FROM YAHOO" button
2. Check console for sync results
3. Look at what data is returned for standings
4. Basketball might use category-based standings instead of W-L-T

### To Verify Team Sorting:
1. Reload page
2. Go to TEAM tab
3. Check if your team (REAL MADRID) appears first with ★
4. Should now be working with the fix applied

## 📋 Next Actions

1. **Test Yahoo player loading** - Check if `/api/yahoo/players` works for basketball
2. **Investigate standings format** - Basketball might need different display
3. **Check sync results** - Verify what data comes back from Yahoo for basketball
4. **Consider NBA-specific endpoints** - May need different API calls for basketball

## 🎯 Basketball vs Baseball Differences

### Baseball (Draft Mode)
- Player pool: Draft results from Tapatalk
- Stats: Historical MLB stats
- Standings: Not applicable (draft mode)
- Focus: Draft strategy, ADP, projections

### Basketball (In-Season)
- Player pool: Yahoo free agents (available players)
- Stats: Current season NBA stats
- Standings: Category-based or H2H record
- Focus: Add/drop, trades, weekly matchups

The app was originally built for baseball draft mode, so basketball in-season needs different data sources and display logic.
