import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function checkWatchlist() {
  console.log('📋 Checking watchlist data...\n');
  
  // Check all watchlist entries
  const watchlist = await sql`SELECT * FROM watchlist ORDER BY league_id, sort_order`;
  console.log(`Total watchlist entries: ${watchlist.length}`);
  
  if (watchlist.length > 0) {
    console.log('\nWatchlist by league:');
    const byLeague = {};
    watchlist.forEach(w => {
      if (!byLeague[w.league_id]) byLeague[w.league_id] = [];
      byLeague[w.league_id].push(w);
    });
    
    for (const [leagueId, entries] of Object.entries(byLeague)) {
      console.log(`\nLeague ${leagueId}: ${entries.length} players`);
      entries.slice(0, 5).forEach(e => {
        console.log(`  - ${e.player_name} (${e.position})`);
      });
      if (entries.length > 5) {
        console.log(`  ... and ${entries.length - 5} more`);
      }
    }
  }
  
  // Check leagues
  console.log('\n📊 Available leagues:');
  const leagues = await sql`SELECT id, league_name, sport, team_name FROM user_leagues ORDER BY id`;
  leagues.forEach(l => {
    console.log(`  ${l.id}: ${l.league_name} (${l.sport}) - Team: ${l.team_name || 'N/A'}`);
  });
}

checkWatchlist()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
