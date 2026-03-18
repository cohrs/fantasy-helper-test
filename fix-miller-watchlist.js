import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function fixMillerWatchlist() {
  console.log('🔧 Fixing Erik Miller -> Bobby Miller in watchlist...\n');
  
  const leagueId = 2;
  
  // First, check what we have
  const current = await sql`
    SELECT id, player_name, position, team_abbr, rationale
    FROM watchlist
    WHERE player_name LIKE '%Miller%' AND league_id = ${leagueId}
  `;
  
  console.log('Current Miller entries:');
  current.forEach(row => {
    console.log(`  - ${row.player_name} (${row.position}, ${row.team_abbr})`);
    console.log(`    Rationale preview: ${row.rationale?.substring(0, 100)}...`);
  });
  
  // Update Erik Miller to Bobby Miller
  const erikEntry = current.find(r => r.player_name === 'Erik Miller');
  
  if (erikEntry) {
    console.log('\n✏️  Updating Erik Miller -> Bobby Miller...');
    
    await sql`
      UPDATE watchlist
      SET 
        player_name = 'Bobby Miller',
        team_abbr = 'LAD'
      WHERE id = ${erikEntry.id} AND league_id = ${leagueId}
    `;
    
    console.log('✅ Updated successfully');
    
    // Verify
    const verify = await sql`
      SELECT player_name, position, team_abbr, LEFT(rationale, 100) as rationale_preview
      FROM watchlist
      WHERE id = ${erikEntry.id} AND league_id = ${leagueId}
    `;
    
    console.log('\n✅ Verified:');
    console.log(`   Player: ${verify[0].player_name}`);
    console.log(`   Team: ${verify[0].team_abbr}`);
    console.log(`   Position: ${verify[0].position}`);
    console.log(`   Rationale: ${verify[0].rationale_preview}...`);
  } else {
    console.log('\n⚠️  Erik Miller not found in watchlist');
  }
}

fixMillerWatchlist()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
