import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL);

async function checkLeagues() {
  try {
    // Get all leagues
    const leagues = await sql`
      SELECT id, league_key, league_name, sport, team_name FROM user_leagues ORDER BY id
    `;
    
    console.log('Leagues in database:');
    leagues.forEach(l => {
      console.log(`  ID ${l.id}: ${l.league_name} (${l.sport}) - Key: ${l.league_key} - Team: ${l.team_name}`);
    });
    
    // Get user tokens
    const users = await sql`
      SELECT yahoo_guid, nickname, email FROM users
    `;
    
    console.log('\nUsers in database:');
    users.forEach(u => {
      console.log(`  ${u.yahoo_guid}: ${u.nickname} (${u.email})`);
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await sql.end();
  }
}

checkLeagues();
