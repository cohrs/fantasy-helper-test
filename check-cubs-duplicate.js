import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function checkCubsDuplicate() {
  console.log('🔍 Checking Cubs Win duplicate...\n');
  
  const leagueId = 3; // Basketball league
  
  // Get all unique team names
  const teams = await sql`
    SELECT DISTINCT team_name, COUNT(*) as player_count
    FROM team_rosters
    WHERE league_id = ${leagueId}
    GROUP BY team_name
    ORDER BY team_name
  `;
  
  console.log('All teams in league 3:');
  teams.forEach(team => {
    const bytes = Buffer.from(team.team_name);
    console.log(`  "${team.team_name}" (${team.player_count} players) - bytes: [${bytes.join(', ')}]`);
  });
  
  // Check for Cubs Win variations
  const cubsTeams = teams.filter(t => t.team_name.toLowerCase().includes('cubs'));
  
  if (cubsTeams.length > 1) {
    console.log('\n⚠️  Multiple "Cubs" teams found:');
    cubsTeams.forEach((team, idx) => {
      console.log(`  ${idx + 1}. "${team.team_name}"`);
      console.log(`     Length: ${team.team_name.length}`);
      console.log(`     Trimmed: "${team.team_name.trim()}"`);
      console.log(`     Has leading/trailing spaces: ${team.team_name !== team.team_name.trim()}`);
    });
    
    // Get sample players from each
    for (const team of cubsTeams) {
      const players = await sql`
        SELECT player_name
        FROM team_rosters
        WHERE league_id = ${leagueId} AND team_name = ${team.team_name}
        LIMIT 3
      `;
      console.log(`\n  Players on "${team.team_name}":`);
      players.forEach(p => console.log(`    - ${p.player_name}`));
    }
  }
}

checkCubsDuplicate()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
