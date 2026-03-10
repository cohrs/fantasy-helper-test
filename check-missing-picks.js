import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function checkMissingPicks() {
  console.log('🔍 Checking for missing picks...\n');
  
  const leagueId = 2; // Baseball league
  
  // Get all draft picks ordered by pick number
  const allPicks = await sql`
    SELECT round, pick, player_name, drafted_by, is_keeper
    FROM draft_picks
    WHERE league_id = ${leagueId} 
      AND pick IS NOT NULL
      AND drafted_by IS NOT NULL
    ORDER BY pick ASC
  `;
  
  console.log(`📊 Total picks in database: ${allPicks.length}`);
  
  // Find gaps in pick sequence
  const pickNumbers = allPicks.map(p => p.pick);
  const maxPick = Math.max(...pickNumbers);
  const minPick = Math.min(...pickNumbers);
  
  console.log(`📍 Pick range: ${minPick} to ${maxPick}`);
  
  const missingPicks = [];
  for (let i = minPick; i <= maxPick; i++) {
    if (!pickNumbers.includes(i)) {
      missingPicks.push(i);
    }
  }
  
  if (missingPicks.length > 0) {
    console.log(`❌ Missing picks: ${missingPicks.join(', ')}`);
    
    // Show context around missing picks
    console.log('\n📋 Picks around the gaps:');
    missingPicks.forEach(missingPick => {
      const before = allPicks.find(p => p.pick === missingPick - 1);
      const after = allPicks.find(p => p.pick === missingPick + 1);
      
      console.log(`  Missing Pick ${missingPick}:`);
      if (before) console.log(`    Before: Pick ${before.pick} - ${before.player_name} (${before.drafted_by})`);
      if (after) console.log(`    After: Pick ${after.pick} - ${after.player_name} (${after.drafted_by})`);
      console.log('');
    });
  } else {
    console.log('✅ No missing picks found');
  }
  
  // Show the actual last few picks
  console.log('📋 Last 10 picks in database:');
  allPicks.slice(-10).forEach(pick => {
    const round = Math.floor((pick.pick - 1) / 18) + 1;
    const pos = ((pick.pick - 1) % 18) + 1;
    console.log(`  Pick ${pick.pick} (R${round}P${pos}): ${pick.player_name} (${pick.drafted_by})`);
  });
  
  // Calculate what the current pick should actually be
  const lastActualPick = Math.max(...pickNumbers);
  const currentPick = lastActualPick + 1;
  const currentRound = Math.floor((currentPick - 1) / 18) + 1;
  const currentPos = ((currentPick - 1) % 18) + 1;
  
  console.log(`\n🎯 Current pick should be: ${currentPick} (Round ${currentRound}, Position ${currentPos})`);
  
  // User is at position 11
  const myPosition = 11;
  let picksUntilTurn = 0;
  
  if (currentPos === myPosition) {
    console.log('🟢 IT IS YOUR TURN!');
  } else if (currentPos < myPosition) {
    picksUntilTurn = myPosition - currentPos;
    console.log(`⏳ Picks until your turn: ${picksUntilTurn} (same round)`);
  } else {
    // Already passed your pick this round, next turn is next round
    const nextRoundPick = (currentRound * 18) + myPosition;
    picksUntilTurn = nextRoundPick - currentPick;
    console.log(`⏳ Picks until your turn: ${picksUntilTurn} (next round at pick ${nextRoundPick})`);
  }
}

checkMissingPicks()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });