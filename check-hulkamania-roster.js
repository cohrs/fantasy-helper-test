import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function checkHulkamaniaRoster() {
  console.log('🔍 Checking Hulkamania roster...\n');
  
  const leagueId = 2; // Baseball league
  
  // Get all picks for Hulkamania
  const picks = await sql`
    SELECT round, pick, player_name, position, team_abbr, is_keeper
    FROM draft_picks
    WHERE league_id = ${leagueId} AND drafted_by = 'Hulkamania'
    ORDER BY pick
  `;
  
  console.log(`Found ${picks.length} picks for Hulkamania:\n`);
  picks.forEach(pick => {
    const keeper = pick.is_keeper ? ' [KEEPER]' : '';
    console.log(`  Round ${pick.round}, Pick ${pick.pick}: ${pick.player_name} (${pick.position}, ${pick.team_abbr})${keeper}`);
  });
  
  // Check for duplicates
  const playerCounts = {};
  picks.forEach(pick => {
    playerCounts[pick.player_name] = (playerCounts[pick.player_name] || 0) + 1;
  });
  
  const duplicates = Object.entries(playerCounts).filter(([name, count]) => count > 1);
  if (duplicates.length > 0) {
    console.log('\n⚠️  Duplicate players found:');
    duplicates.forEach(([name, count]) => {
      console.log(`  ${name}: ${count} times`);
    });
  }
  
  // Check for missing rounds
  const rounds = picks.map(p => p.round).sort((a, b) => a - b);
  const uniqueRounds = [...new Set(rounds)];
  console.log(`\n📊 Rounds with picks: ${uniqueRounds.join(', ')}`);
  
  // Find gaps
  const maxRound = Math.max(...rounds);
  const missingRounds = [];
  for (let i = 1; i <= maxRound; i++) {
    if (!uniqueRounds.includes(i)) {
      missingRounds.push(i);
    }
  }
  
  if (missingRounds.length > 0) {
    console.log(`⚠️  Missing rounds: ${missingRounds.join(', ')}`);
  }
}

checkHulkamaniaRoster()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
