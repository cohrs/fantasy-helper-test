import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function checkActualCurrentPick() {
  console.log('🔍 Checking ACTUAL current pick (using correct logic)...\n');
  
  const leagueId = 2; // Baseball league
  
  // Count ONLY non-keeper draft picks (as per the docs)
  const draftPicksMade = await sql`
    SELECT COUNT(*) as count
    FROM draft_picks 
    WHERE league_id = ${leagueId}
      AND drafted_by IS NOT NULL 
      AND is_keeper = false
  `;
  
  const picksCount = parseInt(draftPicksMade[0].count);
  const currentPick = picksCount + 1;
  
  console.log(`📊 Non-keeper draft picks made: ${picksCount}`);
  console.log(`🎯 Current pick should be: ${currentPick}`);
  
  // Calculate round and position
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
  
  // Show recent draft picks (not keepers)
  console.log('\n📋 Last 10 draft picks (non-keepers):');
  const recentPicks = await sql`
    SELECT player_name, drafted_by, round, rank
    FROM draft_picks
    WHERE league_id = ${leagueId} 
      AND drafted_by IS NOT NULL 
      AND is_keeper = false
    ORDER BY id DESC
    LIMIT 10
  `;
  
  recentPicks.reverse().forEach((pick, index) => {
    const pickNum = picksCount - recentPicks.length + index + 1;
    console.log(`  Pick ${pickNum}: ${pick.player_name} (Rank #${pick.rank}) - ${pick.drafted_by}`);
  });
  
  // Show keepers separately
  console.log('\n👑 Keepers (don\'t count as draft picks):');
  const keepers = await sql`
    SELECT player_name, drafted_by, rank
    FROM draft_picks
    WHERE league_id = ${leagueId} 
      AND drafted_by IS NOT NULL 
      AND is_keeper = true
    ORDER BY drafted_by, player_name
    LIMIT 10
  `;
  
  keepers.forEach(keeper => {
    console.log(`  KEEPER: ${keeper.player_name} (Rank #${keeper.rank}) - ${keeper.drafted_by}`);
  });
}

checkActualCurrentPick()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });