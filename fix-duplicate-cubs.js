import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function fixDuplicateCubs() {
  console.log('🔧 Fixing duplicate Cubs Win teams...\n');
  
  const leagueId = 3; // Basketball league
  
  // Find all Cubs teams
  const cubsTeams = await sql`
    SELECT DISTINCT team_name, COUNT(*) as player_count
    FROM team_rosters
    WHERE league_id = ${leagueId} AND team_name ILIKE '%cubs%'
    GROUP BY team_name
  `;
  
  console.log('Cubs teams found:');
  cubsTeams.forEach(team => {
    console.log(`  "${team.team_name}" (${team.player_count} players)`);
  });
  
  if (cubsTeams.length > 1) {
    // Keep the first one, merge others into it
    const keepTeam = cubsTeams[0].team_name;
    const duplicateTeams = cubsTeams.slice(1).map(t => t.team_name);
    
    console.log(`\n📝 Keeping: "${keepTeam}"`);
    console.log(`🗑️  Removing: ${duplicateTeams.map(t => `"${t}"`).join(', ')}`);
    
    // Update all duplicate team names to the kept one
    for (const dupTeam of duplicateTeams) {
      const updated = await sql`
        UPDATE team_rosters
        SET team_name = ${keepTeam}
        WHERE league_id = ${leagueId} AND team_name = ${dupTeam}
        RETURNING player_name
      `;
      
      console.log(`   ✅ Updated ${updated.length} players from "${dupTeam}" to "${keepTeam}"`);
    }
    
    // Verify
    const final = await sql`
      SELECT DISTINCT team_name, COUNT(*) as player_count
      FROM team_rosters
      WHERE league_id = ${leagueId} AND team_name ILIKE '%cubs%'
      GROUP BY team_name
    `;
    
    console.log('\n✅ Final result:');
    final.forEach(team => {
      console.log(`  "${team.team_name}" (${team.player_count} players)`);
    });
  } else {
    console.log('\n✅ No duplicates found');
  }
}

fixDuplicateCubs()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });