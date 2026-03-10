import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function checkCurrentPick() {
  console.log('🔍 Checking current pick status...\n');
  
  const leagueId = 2; // Baseball league
  
  // Get all draft picks (non-keepers) ordered by pick number
  const draftPicks = await sql`
    SELECT round, pick, player_name, drafted_by, is_keeper
    FROM draft_picks
    WHERE league_id = ${leagueId} 
      AND pick IS NOT NULL
      AND drafted_by IS NOT NULL
    ORDER BY pick ASC
  `;
  
  console.log(`📊 Total draft picks made: ${draftPicks.length}`);
  
  // Find the highest pick number that has been made
  const lastPick = draftPicks[draftPicks.length - 1];
  console.log(`🎯 Last pick made: Pick ${lastPick.pick} - ${lastPick.player_name} (${lastPick.drafted_by})`);
  
  // Current pick should be the next sequential pick
  const currentPick = lastPick.pick + 1;
  console.log(`⏭️  Current pick should be: ${currentPick}`);
  
  // Calculate what round and position this is
  const totalTeams = 18;
  const myDraftPosition = 11;
  
  const currentRound = Math.floor((currentPick - 1) / totalTeams) + 1;
  const pickInRound = ((currentPick - 1) % totalTeams) + 1;
  
  console.log(`📍 Current pick ${currentPick} = Round ${currentRound}, Position ${pickInRound}`);
  
  // Calculate picks until user's turn
  let waitPicks = 0;
  if (pickInRound === myDraftPosition) {
    waitPicks = 0;
    console.log('🟢 IT IS YOUR TURN!');
  } else {
    // Find next pick where user is at position 11
    let nextRound = currentRound;
    if (pickInRound > myDraftPosition) {
      nextRound = currentRound + 1; // Already passed your pick this round
    }
    
    const nextPick = ((nextRound - 1) * totalTeams) + myDraftPosition;
    waitPicks = nextPick - currentPick;
    console.log(`⏳ Picks until your turn: ${waitPicks} (your next pick will be ${nextPick})`);
  }
  
  // Show recent picks for context
  console.log('\n📋 Last 5 picks:');
  draftPicks.slice(-5).forEach(pick => {
    console.log(`  Pick ${pick.pick}: ${pick.player_name} (${pick.drafted_by})`);
  });
}

checkCurrentPick()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });