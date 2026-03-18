// Fix team names with correct values
require('dotenv').config({ path: '.env.local' });
const { neon } = require('@neondatabase/serverless');

const sql = neon(process.env.POSTGRES_URL);

async function fixTeamNames() {
  try {
    // Baseball (league_id = 2) - New Jersey Nine
    await sql`
      UPDATE user_leagues 
      SET team_name = 'New Jersey Nine'
      WHERE id = 2
    `;
    
    // Basketball (league_id = 3) - REAL MADRID (already correct)
    await sql`
      UPDATE user_leagues 
      SET team_name = 'REAL MADRID',
          team_key = '466.l.8873.t.10'
      WHERE id = 3
    `;
    
    console.log('✅ Updated team names');
    
    // Verify
    const leagues = await sql`SELECT id, league_name, sport, team_name FROM user_leagues WHERE id IN (2, 3)`;
    console.log('\nUpdated leagues:');
    console.table(leagues);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixTeamNames();
