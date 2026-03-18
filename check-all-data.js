import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function checkAllData() {
  console.log('🔍 Checking all data...\n');
  
  const tables = [
    'users',
    'user_leagues', 
    'user_selected_league',
    'draft_picks',
    'watchlist',
    'player_notes'
  ];
  
  for (const table of tables) {
    try {
      const query = `SELECT COUNT(*) as count FROM ${table}`;
      const result = await sql([query]);
      console.log(`${table}: ${result[0].count} rows`);
    } catch (e) {
      console.log(`${table}: ERROR - ${e.message}`);
    }
  }
}

checkAllData()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
