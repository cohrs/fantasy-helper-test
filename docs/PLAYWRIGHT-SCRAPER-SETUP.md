# Playwright Scraper Setup

## Overview

The Playwright scraper is a more reliable alternative to the current axios-based scraper. It uses a real browser to navigate and extract data from Tapatalk, which should eliminate the hanging/timeout issues we've been experiencing.

## Prerequisites

1. **UV Package Manager** - Required for the Playwright MCP server
   ```bash
   # On macOS with Homebrew
   brew install uv
   
   # Or with pip
   pip install uv
   ```

2. **MCP Configuration** - Already set up in `.kiro/settings/mcp.json`

## Setup Steps

### 1. Restart Kiro
The MCP configuration needs Kiro to restart to connect to the Playwright server.

### 2. Verify MCP Connection
After restart, check that Playwright tools are available:
- Look for Playwright tools in the MCP server view
- Should see tools like `playwright_navigate`, `playwright_get_visible_text`, etc.

### 3. Test the New Scraper
The new scraper endpoint is available at:
```
GET /api/scrape-draft-playwright?leagueId=2
```

## Implementation Details

### Current Status
- **Branch**: `playwright-scraper` (to be created)
- **Endpoint**: `/api/scrape-draft-playwright/route.ts`
- **Status**: Placeholder implementation ready for MCP integration

### Planned Playwright Flow
1. `playwright_navigate()` - Navigate to Tapatalk URL
2. `playwright_get_visible_text()` - Extract clean text content
3. Parse using improved regex logic (same as current scraper)
4. Save to database using optimized batch operations

### Advantages Over Current Scraper
- ✅ **Real browser rendering** - Handles JavaScript and dynamic content
- ✅ **Better error handling** - Can take screenshots of failures
- ✅ **No more hanging** - Proper timeout handling
- ✅ **Cleaner data extraction** - DOM-based instead of raw HTML parsing
- ✅ **Debugging capabilities** - Screenshots and console logs

## Troubleshooting

### MCP Server Not Connected
If Playwright tools aren't available after restart:
1. Check `.kiro/settings/mcp.json` exists
2. Verify `uv` is installed: `uv --version`
3. Check MCP server logs in Kiro
4. Try manually: `uvx mcp-server-playwright`

### Scraper Returns 503 Error
This means the MCP server isn't connected yet. The scraper will return:
```json
{
  "success": false,
  "error": "Playwright MCP server not yet connected. Please restart Kiro to connect the MCP server, then try again."
}
```

## Next Steps

1. **Complete Implementation** - Replace placeholder with actual Playwright MCP calls
2. **Add Screenshot Debugging** - Capture screenshots on failures
3. **Performance Testing** - Compare speed vs current scraper
4. **Gradual Migration** - Test thoroughly before replacing main scraper

## Files Modified

- `.kiro/settings/mcp.json` - MCP server configuration
- `src/app/api/scrape-draft-playwright/route.ts` - New Playwright scraper
- `docs/PLAYWRIGHT-SCRAPER-SETUP.md` - This documentation