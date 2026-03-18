import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function fixCurrentDraftState() {
  console.log('🔧 Fixing current draft state based on Tapatalk data...\n');
  
  const leagueId = 2; // Baseball league
  
  // Based on Tapatalk, the most recent 8th round picks we can see are:
  // - Luke Weaver (8th Round - Brohams) - around rank 201
  // - Garrett Whitlock (8th Round - K-Bandits) - around rank 138  
  // - Bailey Ober (8th Round - 1st to 3rd) - around rank 225
  // - Orion Kerkering (8th Round - New Jersey Nine) - around rank 209
  // - Colt Keith (8th Round - Hulkamania) - rank 539
  // - Dillon Dingler (8th Round - Dillweed) - rank 960
  // - Moisés Ballesteros (8th Round - Cubs Wins Cubs Win) - rank 981
  // - Kyle Harrison (8th Round - The Papelboners) - rank 507
  // - Chase DeLauter (8th Round - Amazins) - rank 830
  // - Kyle Manzardo (8th Round - Pirates Baseball) - rank 368
  
  // The issue is that the scraper is not properly parsing the round assignments
  // Let's find what the actual current pick should be by looking at the highest ACTUAL pick number
  
  const allPicks = await sql`
    SELECT round, pick, player_name, drafted_by, is_keeper
    FROM draft_picks
    WHERE league_id = ${leagueId} 
      AND pick IS NOT NULL
      AND drafted_by IS NOT NULL
    ORDER BY pick ASC
  `;
  
  console.log(`📊 Current picks in database: ${allPicks.length}`);
  
  // Find the actual last pick that was made
  const lastPick = allPicks[allPicks.length - 1];
  console.log(`🎯 Last pick in database: Pick ${lastPick.pick} - ${lastPick.player_name} (${lastPick.drafted_by})`);
  
  // Based on the pattern, it looks like we're in Round 8
  // Let's see what picks are missing in Round 8
  const round8Picks = allPicks.filter(p => p.round === 8);
  console.log(`\n📋 Round 8 picks in database: ${round8Picks.length}`);
  round8Picks.forEach(pick => {
    console.log(`  Pick ${pick.pick}: ${pick.player_name} (${pick.drafted_by})`);
  });
  
  // Calculate what the current pick should be
  // Round 8 starts at pick 127 (7 * 18 + 1) and goes to pick 144 (8 * 18)
  const round8Start = 127;
  const round8End = 144;
  
  console.log(`\n🔍 Round 8 should be picks ${round8Start}-${round8End}`);
  
  // Find missing picks in Round 8
  const round8PickNumbers = round8Picks.map(p => p.pick);
  const missingInRound8 = [];
  
  for (let i = round8Start; i <= round8End; i++) {
    if (!round8PickNumbers.includes(i)) {
      missingInRound8.push(i);
    }
  }
  
  if (missingInRound8.length > 0) {
    console.log(`❌ Missing picks in Round 8: ${missingInRound8.join(', ')}`);
    
    // The current pick should be the first missing pick in Round 8
    const currentPick = Math.min(...missingInRound8);
    const currentPos = ((currentPick - 1) % 18) + 1;
    
    console.log(`\n🎯 Current pick should be: ${currentPick} (Round 8, Position ${currentPos})`);
    
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
      const nextRoundPick = (8 * 18) + myPosition; // Round 9, position 11
      picksUntilTurn = nextRoundPick - currentPick;
      console.log(`⏳ Picks until your turn: ${picksUntilTurn} (next round at pick ${nextRoundPick})`);
    }
  } else {
    // Round 8 is complete, we're in Round 9
    const round9Start = 145;
    const currentPick = round9Start;
    const currentPos = 1;
    const myPosition = 11;
    const picksUntilTurn = myPosition - currentPos;
    
    console.log(`\n🎯 Round 8 complete. Current pick: ${currentPick} (Round 9, Position ${currentPos})`);
    console.log(`⏳ Picks until your turn: ${picksUntilTurn}`);
  }
}

fixCurrentDraftState()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });