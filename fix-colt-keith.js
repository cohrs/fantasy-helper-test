import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function fixColtKeith() {
  console.log('🔧 Fixing Colt Keith assignment to Hulkamania...\n');
  
  const leagueId = 2; // Baseball league
  
  // Update Colt Keith to be drafted by Hulkamania in Round 8
  const updated = await sql`
    UPDATE draft_picks
    SET 
      drafted_by = 'Hulkamania',
      round = 8,
      pick = 144
    WHERE league_id = ${leagueId} 
      AND player_name = 'Colt Keith'
      AND drafted_by IS NULL
    RETURNING player_name, round, pick, drafted_by
  `;
  
  if (updated.length > 0) {
    console.log('✅ Updated Colt Keith:');
    updated.forEach(pick => {
      console.log(`  ${pick.player_name} - Round ${pick.round}, Pick ${pick.pick} - ${pick.drafted_by}`);
    });
  } else {
    console.log('❌ No updates made - Colt Keith not found or already assigned');
  }
  
  // Verify Hulkamania's updated roster
  console.log('\n📊 Hulkamania updated roster:');
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
  
  const rounds = hulkamania.filter(p => p.pick !== null).map(p => p.round);
  const uniqueRounds = [...new Set(rounds)].sort((a, b) => a - b);
  console.log(`\n📊 Rounds with picks: ${uniqueRounds.join(', ')}`);
}

fixColtKeith()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });