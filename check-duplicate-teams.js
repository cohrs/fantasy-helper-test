import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function checkDuplicates() {
  console.log('🔍 Checking for duplicate teams...\n');
  
  // Get all leagues
  const leagues = await sql`
    SELECT id, league_key, league_name, team_name, sport, season
    FROM user_leagues
    ORDER BY league_name, id
  `;
  
  console.log('All leagues:');
  leagues.forEach(league => {
    console.log(`  [${league.id}] ${league.league_name} - ${league.team_name} (${league.sport} ${league.season})`);
  });
  
  // Find duplicates by league_key
  const duplicateKeys = await sql`
    SELECT league_key, COUNT(*) as count
    FROM user_leagues
    GROUP BY league_key
    HAVING COUNT(*) > 1
  `;
  
  if (duplicateKeys.length > 0) {
    console.log('\n⚠️  Duplicate league_keys found:');
    for (const dup of duplicateKeys) {
      console.log(`\n  League Key: ${dup.league_key} (${dup.count} entries)`);
      const entries = await sql`
        SELECT id, league_name, team_name, created_at
        FROM user_leagues
        WHERE league_key = ${dup.league_key}
        ORDER BY created_at
      `;
      entries.forEach((entry, idx) => {
        console.log(`    ${idx + 1}. [ID ${entry.id}] ${entry.league_name} - ${entry.team_name} (created: ${entry.created_at})`);
      });
    }
  } else {
    console.log('\n✅ No duplicate league_keys found');
  }
  
  // Find duplicates by league_name
  const duplicateNames = await sql`
    SELECT league_name, COUNT(*) as count
    FROM user_leagues
    GROUP BY league_name
    HAVING COUNT(*) > 1
  `;
  
  if (duplicateNames.length > 0) {
    console.log('\n⚠️  Duplicate league_names found:');
    for (const dup of duplicateNames) {
      console.log(`\n  League Name: ${dup.league_name} (${dup.count} entries)`);
      const entries = await sql`
        SELECT id, league_key, team_name, created_at
        FROM user_leagues
        WHERE league_name = ${dup.league_name}
        ORDER BY created_at
      `;
      entries.forEach((entry, idx) => {
        console.log(`    ${idx + 1}. [ID ${entry.id}] Key: ${entry.league_key}, Team: ${entry.team_name} (created: ${entry.created_at})`);
      });
    }
  } else {
    console.log('\n✅ No duplicate league_names found');
  }
}

checkDuplicates()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
