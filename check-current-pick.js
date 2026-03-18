import { config } from 'dotenv';
import { getDb } from './src/lib/db.ts';

config({ path: '.env.local' });

const sql = getDb();

async function checkCurrentPick() {
  const leagueId = 2;
  
  // Get total non-keeper draft picks
  const totalPicks = await sql`
    SELECT COUNT(*) as count
    FROM draft_picks
    WHERE league_id = ${leagueId}
      AND drafted_by IS NOT NULL
      AND is_keeper = false
  `;
  
  const picksMade = parseInt(totalPicks[0].count);
  const currentPick = picksMade + 1;
  
  console.log(`Total draft picks made: ${picksMade}`);
  console.log(`Current pick should be: ${currentPick}`);
  
  // Get last 5 picks
  const recentPicks = await sql`
    SELECT 
      pick,
      round,
      player_name,
      position,
      drafted_by
    FROM draft_picks
    WHERE league_id = ${leagueId}
      AND is_keeper = false
      AND drafted_by IS NOT NULL
    ORDER BY pick DESC
    LIMIT 5
  `;
  
  console.log('\nLast 5 picks:');
  recentPicks.reverse().forEach(p => {
    console.log(`  Pick ${p.pick} (R${p.round}): ${p.player_name} → ${p.drafted_by}`);
  });
  
  // Calculate whose turn it is (18 team league, linear draft)
  const pickInRound = ((currentPick - 1) % 18) + 1;
  const currentRound = Math.floor((currentPick - 1) / 18) + 1;
  
  console.log(`\nCurrent pick ${currentPick} is Round ${currentRound}, Pick ${pickInRound} in round`);
  console.log(`Position 11 (New Jersey Nine) picks at: 11, 29, 47, 65, 83, 101, 119, 137, 155, 173...`);
  
  if (pickInRound === 11) {
    console.log('🟢 IT IS YOUR PICK!');
  } else {
    console.log(`⏳ Not your pick yet (position ${pickInRound} is picking)`);
  }
}

checkCurrentPick()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
