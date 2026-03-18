import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function checkSelectedLeague() {
  console.log('🔍 Checking selected league...\n');
  
  const users = await sql`SELECT id, yahoo_guid FROM users`;
  console.log('Users:');
  users.forEach(u => console.log(`  ${u.id}: ${u.yahoo_guid}`));
  
  const selected = await sql`SELECT * FROM user_selected_league`;
  console.log('\nSelected leagues:');
  selected.forEach(s => console.log(`  User ${s.user_id} -> League ${s.league_id}`));
  
  const leagues = await sql`SELECT id, league_name FROM user_leagues`;
  console.log('\nLeagues:');
  leagues.forEach(l => console.log(`  ${l.id}: ${l.league_name}`));
}

checkSelectedLeague()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
