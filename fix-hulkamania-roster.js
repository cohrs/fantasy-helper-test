import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function fixHulkamaniaRoster() {
  console.log('🔧 Fixing Hulkamania roster issues...\n');
  
  const leagueId = 2; // Baseball league
  
  // 1. Remove duplicate José Caballero entries (keep only pick 120)
  console.log('1. Removing duplicate José Caballero entries...');
  
  const duplicates = await sql`
    DELETE FROM draft_picks
    WHERE league_id = ${leagueId} 
      AND drafted_by = 'Hulkamania'
      AND player_name = 'José Caballero'
      AND pick IN (123, 127)
    RETURNING pick, player_name
  `;
  
  console.log(`   ✅ Removed ${duplicates.length} duplicate entries`);
  
  // 2. Check what's left
  const remaining = await sql`
    SELECT round, pick, player_name, position
    FROM draft_picks
    WHERE league_id = ${leagueId} AND drafted_by = 'Hulkamania'
    ORDER BY COALESCE(pick, 0)
  `;
  
  console.log(`\n✅ Hulkamania now has ${remaining.length} picks:`);
  remaining.forEach(pick => {
    const keeper = pick.pick === null ? ' [KEEPER]' : '';
    console.log(`   Round ${pick.round}, Pick ${pick.pick || 'N/A'}: ${pick.player_name}${keeper}`);
  });
  
  // 3. Check for missing Round 8
  const rounds = remaining.filter(p => p.pick !== null).map(p => p.round);
  const uniqueRounds = [...new Set(rounds)].sort((a, b) => a - b);
  console.log(`\n📊 Rounds with picks: ${uniqueRounds.join(', ')}`);
  
  if (!uniqueRounds.includes(8)) {
    console.log('\n⚠️  Round 8 pick is still missing - needs to be scraped from Tapatalk');
  }
}

fixHulkamaniaRoster()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });