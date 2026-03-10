import { getDb } from '../src/lib/db';

const sql = getDb();

async function fixWatchlistLeague() {
  console.log('🔧 Fixing watchlist league_id...');
  
  // Update all NULL league_id entries to league 2 (baseball)
  const result = await sql`
    UPDATE watchlist 
    SET league_id = 2
    WHERE league_id IS NULL
  `;
  
  console.log(`✅ Updated ${result.count} watchlist entries to league_id = 2`);
  
  // Verify
  const check = await sql`
    SELECT league_id, COUNT(*) as count 
    FROM watchlist 
    GROUP BY league_id
  `;
  
  console.log('\nWatchlist by league:');
  check.forEach((row: any) => {
    console.log(`  League ${row.league_id}: ${row.count} players`);
  });
}

fixWatchlistLeague()
  .then(() => {
    console.log('\n✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
