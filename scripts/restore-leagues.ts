import { getDb } from '../src/lib/db';

const sql = getDb();

async function restoreLeagues() {
  console.log('🔧 Restoring leagues...\n');
  
  // Get the yahoo-user id
  const users = await sql`SELECT id, yahoo_guid FROM users WHERE yahoo_guid = 'yahoo-user'`;
  
  if (!users.length) {
    console.error('❌ yahoo-user not found!');
    return;
  }
  
  const userId = users[0].id;
  console.log(`Found user: ${users[0].yahoo_guid} (id: ${userId})\n`);
  
  // Restore baseball league
  await sql`
    INSERT INTO user_leagues (
      user_id, league_key, league_name, sport, season, team_key, team_name
    )
    VALUES (
      ${userId},
      '469.l.4136',
      'Asshat Baseball 2026',
      'baseball',
      2026,
      '469.l.4136.t.11',
      'New Jersey Nine'
    )
    ON CONFLICT (user_id, league_key) DO UPDATE SET
      league_name = 'Asshat Baseball 2026',
      team_name = 'New Jersey Nine'
  `;
  
  console.log('✅ Restored baseball league');
  
  // Restore basketball league  
  await sql`
    INSERT INTO user_leagues (
      user_id, league_key, league_name, sport, season, team_key, team_name
    )
    VALUES (
      ${userId},
      '418.l.156057',
      'Asshat Basketball 2025-2026',
      'basketball',
      2025,
      '418.l.156057.t.6',
      'REAL MADRID'
    )
    ON CONFLICT (user_id, league_key) DO UPDATE SET
      league_name = 'Asshat Basketball 2025-2026',
      team_name = 'REAL MADRID'
  `;
  
  console.log('✅ Restored basketball league');
  
  // Get league IDs
  const leagues = await sql`
    SELECT id, league_name, sport 
    FROM user_leagues 
    WHERE user_id = ${userId}
    ORDER BY id
  `;
  
  console.log('\nLeagues in database:');
  leagues.forEach(l => {
    console.log(`  ${l.id}: ${l.league_name} (${l.sport})`);
  });
  
  // Set baseball as selected league
  const baseballLeague = leagues.find(l => l.sport === 'baseball');
  if (baseballLeague) {
    await sql`
      INSERT INTO user_selected_league (user_id, league_id)
      VALUES (${userId}, ${baseballLeague.id})
      ON CONFLICT (user_id) DO UPDATE SET league_id = ${baseballLeague.id}
    `;
    console.log(`\n✅ Set league ${baseballLeague.id} as selected`);
  }
  
  // Update draft_picks to use correct league_id
  if (baseballLeague) {
    await sql`
      UPDATE draft_picks 
      SET league_id = ${baseballLeague.id}
      WHERE league_id != ${baseballLeague.id} OR league_id IS NULL
    `;
    console.log(`✅ Updated draft_picks to use league_id ${baseballLeague.id}`);
  }
}

restoreLeagues()
  .then(() => {
    console.log('\n✅ Done! Refresh the page.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
