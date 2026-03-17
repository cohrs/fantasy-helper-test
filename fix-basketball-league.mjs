import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL);

async function fixBasketballLeague() {
  try {
    console.log('Checking current leagues...');
    
    // Get all leagues with their data counts
    const leagues = await sql`
      SELECT 
        ul.id, 
        ul.league_key, 
        ul.league_name, 
        ul.sport, 
        ul.team_name,
        (SELECT COUNT(*) FROM draft_picks WHERE league_id = ul.id) as pick_count,
        (SELECT COUNT(*) FROM watchlist WHERE league_id = ul.id) as watchlist_count,
        (SELECT COUNT(*) FROM team_rosters WHERE league_id = ul.id) as roster_count
      FROM user_leagues ul 
      ORDER BY ul.id
    `;
    
    console.log('Current leagues:');
    leagues.forEach(l => {
      console.log(`  ID ${l.id}: ${l.league_name} (${l.sport})`);
      console.log(`    Key: ${l.league_key}`);
      console.log(`    Team: ${l.team_name}`);
      console.log(`    Data: ${l.pick_count} picks, ${l.watchlist_count} watchlist, ${l.roster_count} rosters`);
    });
    
    // Find the fake basketball league
    const fakeBasketball = leagues.find(l => l.league_key === 'nba-2026');
    const realBaseball = leagues.find(l => l.league_key === '469.l.4136');
    
    if (!realBaseball) {
      console.error('\n❌ ERROR: Real baseball league not found! Aborting.');
      return;
    }
    
    console.log(`\n✅ Real baseball league found (ID ${realBaseball.id}): ${realBaseball.league_name}`);
    console.log(`   Data: ${realBaseball.pick_count} picks, ${realBaseball.watchlist_count} watchlist`);
    
    if (fakeBasketball) {
      console.log(`\n⚠️  Found fake basketball league (ID ${fakeBasketball.id}): ${fakeBasketball.league_name}`);
      console.log(`   Data: ${fakeBasketball.pick_count} picks, ${fakeBasketball.watchlist_count} watchlist, ${fakeBasketball.roster_count} rosters`);
      
      if (fakeBasketball.pick_count === 0 && fakeBasketball.watchlist_count === 0 && fakeBasketball.roster_count === 0) {
        console.log('\n✅ Fake basketball league is empty. Safe to delete.');
        console.log('Deleting fake basketball league...');
        
        // Delete the fake league
        await sql`DELETE FROM user_leagues WHERE id = ${fakeBasketball.id}`;
        
        console.log('✅ Deleted fake basketball league');
        console.log('\nNow when you refresh the app and click "CHANGE LEAGUE", the real basketball league from Yahoo should appear.');
      } else {
        console.log('\n❌ Fake basketball league has data! Not deleting to be safe.');
      }
    } else {
      console.log('\n⚠️  No fake basketball league found.');
    }
    
    // Show remaining leagues
    const remaining = await sql`
      SELECT id, league_key, league_name, sport, team_name FROM user_leagues ORDER BY id
    `;
    
    console.log('\nRemaining leagues:');
    remaining.forEach(l => {
      console.log(`  ID ${l.id}: ${l.league_name} (${l.sport}) - Key: ${l.league_key} - Team: ${l.team_name}`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

fixBasketballLeague();
