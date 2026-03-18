// Check database state
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.POSTGRES_URL);

async function checkDb() {
  try {
    console.log('Checking database...\n');
    
    const leagues = await sql`
      SELECT id, league_name, sport, team_name, team_key
      FROM user_leagues 
      WHERE id IN (2, 3)
      ORDER BY id
    `;
    
    console.log('Leagues in database:');
    console.table(leagues);
    
    if (leagues[0]?.team_name === 'REAL MADRID') {
      console.log('\n❌ PROBLEM: Baseball league (id=2) still has team_name="REAL MADRID"');
      console.log('The UPDATE query did not work. Trying again...\n');
      
      await sql`UPDATE user_leagues SET team_name = 'New Jersey Nine' WHERE id = 2`;
      
      const verify = await sql`SELECT id, team_name FROM user_leagues WHERE id = 2`;
      console.log('After update:');
      console.table(verify);
    } else {
      console.log('\n✅ Database looks correct!');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkDb();
