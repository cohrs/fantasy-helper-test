import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function checkColtKeith() {
  console.log('🔍 Checking for Colt Keith...\n');
  
  const leagueId = 2; // Baseball league
  
  // Search for Colt Keith
  const coltKeith = await sql`
    SELECT round, pick, player_name, position, team_abbr, drafted_by, is_keeper
    FROM draft_picks
    WHERE league_id = ${leagueId} 
      AND (player_name ILIKE '%colt%keith%' OR player_name ILIKE '%keith%colt%')
    ORDER BY pick
  `;
  
  if (coltKeith.length > 0) {
    console.log('✅ Found Colt Keith:');
    coltKeith.forEach(pick => {
      const keeper = pick.is_keeper ? ' [KEEPER]' : '';
      console.log(`  Round ${pick.round}, Pick ${pick.pick}: ${pick.player_name} (${pick.position}, ${pick.team_abbr}) - ${pick.drafted_by}${keeper}`);
    });
  } else {
    console.log('❌ Colt Keith not found in database');
    
    // Check if there are any similar names
    const similar = await sql`
      SELECT player_name, drafted_by, pick
      FROM draft_picks
      WHERE league_id = ${leagueId} 
        AND (player_name ILIKE '%keith%' OR player_name ILIKE '%colt%')
      ORDER BY pick
    `;
    
    if (similar.length > 0) {
      console.log('\n🔍 Similar names found:');
      similar.forEach(pick => {
        console.log(`  Pick ${pick.pick}: ${pick.player_name} - ${pick.drafted_by}`);
      });
    }
  }
  
  // Check Hulkamania's current roster
  console.log('\n📊 Hulkamania current roster:');
  const hulkamania = await sql`
    SELECT round, pick, player_name, position, is_keeper
    FROM draft_picks
    WHERE league_id = ${leagueId} AND drafted_by = 'Hulkamania'
    ORDER BY COALESCE(pick, 0)
  `;
  
  hulkamania.forEach(pick => {
    const keeper = pick.is_keeper ? ' [KEEPER]' : '';
    console.log(`  Round ${pick.round}, Pick ${pick.pick || 'N/A'}: ${pick.player_name}${keeper}`);
  });
}

checkColtKeith()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });