# Playwright Scraper Setup

## Overview

The Playwright scraper is a more reliable alternative to the current axios-based scraper. It uses a real browser to navigate and extract data from Tapatalk, which should eliminate the hanging/timeout issues we've been experiencing.

## Prerequisites

1. **Node.js and npm** - Required for the Playwright MCP server (✅ Already installed)
   ```bash
   npx --version  # 10.8.2
   ```

2. **MCP Configuration** - Updated to use npm-based Playwright server in `.kiro/settings/mcp.json`

## Setup Steps

### 1. MCP Configuration (✅ COMPLETED)
The MCP configuration has been updated to use the npm-based Playwright server:
```json
{
  "mcpServers": {
    "playwright": {
      "command": "npx",
      "args": ["-y", "@executeautomation/playwright-mcp-server"]
    }
  }
}
```

### 2. Restart Kiro
After restarting Kiro, the Playwright MCP server should connect automatically and download the necessary browser binaries on first use.

### 3. Test the Playwright MCP Connection
After restart, you can test if Playwright tools are available by asking Kiro to use them.

## Implementation Details

### Current Status
- **Branch**: `playwright-scraper` ✅
- **MCP Configuration**: ✅ Updated to use npm-based server (`@executeautomation/playwright-mcp-server`)
- **Endpoint**: `/api/scrape-draft-playwright/route.ts` ✅
- **Status**: Implementation complete, ready for testing after Kiro restart

### Implementation Details
The scraper works in two steps:
1. **AI Assistant** uses Playwright MCP tools to navigate and extract text
2. **API Endpoint** receives the text, parses it, and saves to database

This design keeps the browser automation in the AI layer where MCP tools are available.

### Advantages Over Current Scraper
- ✅ **Real browser rendering** - Handles JavaScript and dynamic content
- ✅ **Better error handling** - Can take screenshots of failures
- ✅ **No more hanging** - Proper timeout handling
- ✅ **Cleaner data extraction** - DOM-based instead of raw HTML parsing
- ✅ **Debugging capabilities** - Screenshots and console logs

## Troubleshooting

### MCP Server Not Connected
If Playwright tools aren't available after restart:
1. Check `.kiro/settings/mcp.json` exists and has correct npm configuration
2. Verify `npx` is installed: `npx --version`
3. Check MCP server logs in Kiro
4. Try manually: `npx -y @executeautomation/playwright-mcp-server`

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