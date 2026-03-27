import { getDb } from '../src/lib/db';

const sql = getDb();

async function restoreLeaguesWithCorrectIds() {
  console.log('🔧 Restoring leagues with original IDs...\n');
  
  // Get the yahoo-user id
  const users = await sql`SELECT id, yahoo_guid FROM users WHERE yahoo_guid = 'yahoo-user'`;
  
  if (!users.length) {
    console.error('❌ yahoo-user not found!');
    return;
  }
  
  const userId = users[0].id;
  console.log(`Found user: ${users[0].yahoo_guid} (id: ${userId})\n`);
  
  // Delete the incorrectly created leagues
  await sql`DELETE FROM user_leagues WHERE user_id = ${userId}`;
  console.log('🗑️  Deleted incorrect leagues\n');
  
  // Restore baseball league with ID = 2
  await sql`
    INSERT INTO user_leagues (
      id, user_id, league_key, league_name, sport, season, team_key, team_name
    )
    VALUES (
      2,
      ${userId},
      '469.l.4136',
      'Asshat Baseball 2026',
      'baseball',
      2026,
      '469.l.4136.t.11',
      'New Jersey Nine'
    )
  `;
  
  console.log('✅ Restored baseball league with id=2');
  
  // Restore basketball league with ID = 3
  await sql`
    INSERT INTO user_leagues (
      id, user_id, league_key, league_name, sport, season, team_key, team_name
    )
    VALUES (
      3,
      ${userId},
      '418.l.156057',
      'Asshat Basketball 2025-2026',
      'basketball',
      2025,
      '418.l.156057.t.6',
      'REAL MADRID'
    )
  `;
  
  console.log('✅ Restored basketball league with id=3');
  
  // Reset the sequence so future inserts don't conflict
  await sql`SELECT setval('user_leagues_id_seq', 3, true)`;
  console.log('✅ Reset sequence');
  
  // Verify
  const leagues = await sql`
    SELECT id, league_name, sport 
    FROM user_leagues 
    WHERE user_id = ${userId}
    ORDER BY id
  `;
  
  console.log('\nLeagues in database:');
  leagues.forEach((l: any) => {
    console.log(`  ${l.id}: ${l.league_name} (${l.sport})`);
  });
  
  // Set baseball as selected league
  await sql`
    INSERT INTO user_selected_league (user_id, league_id)
    VALUES (${userId}, 2)
    ON CONFLICT (user_id) DO UPDATE SET league_id = 2
  `;
  console.log(`\n✅ Set league 2 as selected`);
  
  // Verify draft picks
  const picks = await sql`SELECT COUNT(*) as count FROM draft_picks WHERE league_id = 2`;
  console.log(`\n📊 Draft picks for league 2: ${picks[0].count}`);
}

restoreLeaguesWithCorrectIds()
  .then(() => {
    console.log('\n✅ Done! Leagues restored with correct IDs.');
    console.log('⚠️  Watchlist was lost - you\'ll need to rebuild it.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
