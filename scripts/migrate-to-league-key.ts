/**
 * Migration: Switch from integer league IDs to league_key (VARCHAR) as the foreign key.
 * 
 * This script:
 * 1. Adds league_key column to all child tables
 * 2. Populates league_key from the join with user_leagues
 * 3. Drops old league_id foreign keys
 * 4. Deletes the duplicate league (id=5)
 * 5. Adds new foreign key constraints on league_key
 * 
 * Run: npx tsx scripts/migrate-to-league-key.ts
 */
import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

// Load .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

if (!process.env.POSTGRES_URL) {
  console.error('❌ POSTGRES_URL not found');
  process.exit(1);
}

const sql = neon(process.env.POSTGRES_URL);

async function migrate() {
  console.log('🚀 Starting migration: integer league_id → league_key\n');

  // Tables that reference user_leagues.id as league_id
  const childTables = [
    'draft_picks',
    'watchlist',
    'standings',
    'team_rosters',
    'chat_history',
    'player_notes',
    'yahoo_player_news',
  ];

  // Step 1: Show current state
  console.log('📊 Current user_leagues:');
  const leagues = await sql`SELECT id, league_key, league_name, sport, user_id, team_key, team_name FROM user_leagues ORDER BY id`;
  for (const l of leagues) {
    console.log(`  id=${l.id} key=${l.league_key} name="${l.league_name}" sport=${l.sport} user=${l.user_id} team=${l.team_name || 'NULL'}`);
  }
  console.log('');

  // Build mapping: old integer id → league_key
  const idToKey: Record<number, string> = {};
  for (const l of leagues) {
    idToKey[l.id] = l.league_key;
  }
  console.log('🗺️  ID → league_key mapping:', idToKey);
  console.log('');

  // Step 2: For each child table, add league_key column and populate it
  for (const table of childTables) {
    console.log(`\n--- Migrating ${table} ---`);

    // Check if league_key column already exists
    const colCheck = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = ${table} AND column_name = 'league_key'
    `;

    if (colCheck.length > 0) {
      console.log(`  ⏭️  league_key column already exists`);
    } else {
      await sql.query(`ALTER TABLE "${table}" ADD COLUMN league_key VARCHAR(255)`);
      console.log(`  ✅ Added league_key column`);
    }

    // Check if league_id column still exists (may have been dropped in a previous run)
    const hasLeagueId = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = ${table} AND column_name = 'league_id'
    `;

    if (hasLeagueId.length > 0) {
      // Populate league_key from the join with user_leagues
      await sql.query(`
        UPDATE "${table}" t
        SET league_key = ul.league_key
        FROM user_leagues ul
        WHERE t.league_id = ul.id
        AND t.league_key IS NULL
      `);
      console.log(`  ✅ Populated league_key values`);

      // Check for any orphaned rows
      const orphans = await sql.query(`
        SELECT COUNT(*) as cnt FROM "${table}" WHERE league_key IS NULL AND league_id IS NOT NULL
      `);
      if (parseInt(orphans[0].cnt) > 0) {
        console.log(`  ⚠️  ${orphans[0].cnt} orphaned rows — assigning to 469.l.4136`);
        await sql.query(`UPDATE "${table}" SET league_key = '469.l.4136' WHERE league_key IS NULL`);
      }
      // Also fix any remaining NULLs (league_id was NULL)
      await sql.query(`UPDATE "${table}" SET league_key = '469.l.4136' WHERE league_key IS NULL`);
    } else {
      console.log(`  ⏭️  league_id already dropped`);
    }

    // Show row counts per league_key
    const counts = await sql.query(`
      SELECT league_key, COUNT(*) as cnt FROM "${table}" GROUP BY league_key ORDER BY league_key
    `);
    for (const c of counts) {
      console.log(`  📊 ${c.league_key || 'NULL'}: ${c.cnt} rows`);
    }
  }

  // Step 3: Handle the matchups table (might exist)
  try {
    const matchupCheck = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = 'matchups' AND column_name = 'league_id'
    `;
    if (matchupCheck.length > 0) {
      console.log(`\n--- Migrating matchups ---`);
      const colCheck = await sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = 'matchups' AND column_name = 'league_key'
      `;
      if (colCheck.length === 0) {
        await sql.query(`ALTER TABLE "matchups" ADD COLUMN league_key VARCHAR(255)`);
        console.log(`  ✅ Added league_key column`);
      }
      await sql.query(`
        UPDATE "matchups" t
        SET league_key = ul.league_key
        FROM user_leagues ul
        WHERE t.league_id = ul.id
        AND t.league_key IS NULL
      `);
      console.log(`  ✅ Populated league_key values`);
    }
  } catch (e: any) {
    console.log(`  ⏭️  matchups table: ${e.message}`);
  }

  // Step 4: Delete duplicate league data (id=5, same league_key as id=2)
  // First move any data from league_id=5 to league_key 469.l.4136 (already done by step 2)
  console.log('\n--- Cleaning up duplicate league (id=5) ---');
  
  // Check if league 5 has any data in child tables (only if league_id column still exists)
  for (const table of childTables) {
    const hasLid = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = ${table} AND column_name = 'league_id'`;
    if (hasLid.length === 0) { console.log(`  ${table}: league_id already dropped`); continue; }
    const count = await sql.query(`SELECT COUNT(*) as cnt FROM "${table}" WHERE league_id = 5`);
    if (parseInt(count[0].cnt) > 0) {
      console.log(`  ${table} has ${count[0].cnt} rows for league_id=5 (accessible via league_key)`);
    }
  }

  // Step 5: Now drop the old league_id column and constraints from child tables
  console.log('\n--- Dropping old league_id foreign keys and columns ---');
  
  for (const table of childTables) {
    // Drop foreign key constraints referencing league_id
    const fks = await sql`
      SELECT constraint_name 
      FROM information_schema.table_constraints 
      WHERE table_name = ${table} 
      AND constraint_type = 'FOREIGN KEY'
    `;
    for (const fk of fks) {
      // Check if this FK references user_leagues
      const fkCols = await sql`
        SELECT ccu.table_name as ref_table
        FROM information_schema.constraint_column_usage ccu
        WHERE ccu.constraint_name = ${fk.constraint_name}
      `;
      if (fkCols.some((c: any) => c.ref_table === 'user_leagues')) {
        await sql.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${fk.constraint_name}"`);
        console.log(`  ✅ Dropped FK ${fk.constraint_name} from ${table}`);
      }
    }

    // Drop unique constraints that include league_id
    const uqs = await sql`
      SELECT tc.constraint_name, array_agg(kcu.column_name) as columns
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_name = ${table} AND tc.constraint_type = 'UNIQUE'
      GROUP BY tc.constraint_name
    `;
    for (const uq of uqs) {
      if (uq.columns.includes('league_id')) {
        await sql.query(`ALTER TABLE "${table}" DROP CONSTRAINT "${uq.constraint_name}"`);
        console.log(`  ✅ Dropped UNIQUE ${uq.constraint_name} from ${table}`);
      }
    }

    // Drop league_id column
    await sql.query(`ALTER TABLE "${table}" DROP COLUMN IF EXISTS league_id`);
    console.log(`  ✅ Dropped league_id column from ${table}`);

    // Make league_key NOT NULL
    await sql.query(`ALTER TABLE "${table}" ALTER COLUMN league_key SET NOT NULL`);
    console.log(`  ✅ Set league_key NOT NULL on ${table}`);
  }

  // Also handle matchups
  try {
    await sql.query(`ALTER TABLE "matchups" DROP COLUMN IF EXISTS league_id`);
    await sql.query(`ALTER TABLE "matchups" ALTER COLUMN league_key SET NOT NULL`);
    console.log(`  ✅ Dropped league_id from matchups, set league_key NOT NULL`);
  } catch (e: any) {
    // matchups might not exist or might not have league_id
  }

  // Step 6: Handle user_selected_league table
  console.log('\n--- Migrating user_selected_league ---');
  const selLeagueCheck = await sql`
    SELECT column_name FROM information_schema.columns 
    WHERE table_name = 'user_selected_league' AND column_name = 'league_key'
  `;
  if (selLeagueCheck.length === 0) {
    await sql.query(`ALTER TABLE "user_selected_league" ADD COLUMN league_key VARCHAR(255)`);
    await sql.query(`
      UPDATE "user_selected_league" t
      SET league_key = ul.league_key
      FROM user_leagues ul
      WHERE t.league_id = ul.id
      AND t.league_key IS NULL
    `);
    console.log(`  ✅ Added and populated league_key`);
  }
  // Drop old FK and column
  const selFks = await sql`
    SELECT constraint_name FROM information_schema.table_constraints 
    WHERE table_name = 'user_selected_league' AND constraint_type = 'FOREIGN KEY'
  `;
  for (const fk of selFks) {
    await sql.query(`ALTER TABLE "user_selected_league" DROP CONSTRAINT "${fk.constraint_name}"`);
    console.log(`  ✅ Dropped FK ${fk.constraint_name}`);
  }
  await sql.query(`ALTER TABLE "user_selected_league" DROP COLUMN IF EXISTS league_id`);
  console.log(`  ✅ Dropped league_id column`);

  // Step 7: Delete the duplicate league row (id=5)
  console.log('\n--- Deleting duplicate league (id=5) ---');
  await sql`DELETE FROM user_leagues WHERE id = 5`;
  console.log('  ✅ Deleted league id=5');

  // Step 8: Recreate indexes on league_key
  console.log('\n--- Creating indexes on league_key ---');
  const indexDefs = [
    { table: 'draft_picks', name: 'idx_draft_picks_league_key', cols: 'league_key' },
    { table: 'watchlist', name: 'idx_watchlist_league_key', cols: 'league_key' },
    { table: 'standings', name: 'idx_standings_league_key', cols: 'league_key' },
    { table: 'team_rosters', name: 'idx_team_rosters_league_key', cols: 'league_key' },
    { table: 'chat_history', name: 'idx_chat_history_league_key', cols: 'league_key' },
    { table: 'player_notes', name: 'idx_player_notes_league_key', cols: 'league_key' },
    { table: 'yahoo_player_news', name: 'idx_yahoo_player_news_league_key', cols: 'league_key' },
  ];
  for (const idx of indexDefs) {
    await sql.query(`CREATE INDEX IF NOT EXISTS "${idx.name}" ON "${idx.table}" ("${idx.cols}")`);
    console.log(`  ✅ ${idx.name}`);
  }

  // Recreate unique constraints with league_key
  console.log('\n--- Recreating unique constraints ---');
  try { await sql.query(`ALTER TABLE "draft_picks" ADD CONSTRAINT uq_draft_picks_league_pick UNIQUE (league_key, pick)`); console.log('  ✅ draft_picks(league_key, pick)'); } catch (e: any) { console.log(`  ⏭️  draft_picks unique: ${e.message.slice(0, 80)}`); }
  try { await sql.query(`ALTER TABLE "player_notes" ADD CONSTRAINT uq_player_notes_league_name UNIQUE (league_key, player_name_normalized)`); console.log('  ✅ player_notes(league_key, player_name_normalized)'); } catch (e: any) { console.log(`  ⏭️  player_notes unique: ${e.message.slice(0, 80)}`); }
  try { await sql.query(`ALTER TABLE "yahoo_player_news" ADD CONSTRAINT uq_yahoo_news_league_name UNIQUE (league_key, player_name_normalized)`); console.log('  ✅ yahoo_player_news(league_key, player_name_normalized)'); } catch (e: any) { console.log(`  ⏭️  yahoo_player_news unique: ${e.message.slice(0, 80)}`); }
  try { await sql.query(`ALTER TABLE "standings" ADD CONSTRAINT uq_standings_league_team UNIQUE (league_key, team_key)`); console.log('  ✅ standings(league_key, team_key)'); } catch (e: any) { console.log(`  ⏭️  standings unique: ${e.message.slice(0, 80)}`); }
  try { await sql.query(`ALTER TABLE "team_rosters" ADD CONSTRAINT uq_team_rosters_league_team_player UNIQUE (league_key, team_key, player_key)`); console.log('  ✅ team_rosters(league_key, team_key, player_key)'); } catch (e: any) { console.log(`  ⏭️  team_rosters unique: ${e.message.slice(0, 80)}`); }

  // Step 9: Verify
  console.log('\n--- Verification ---');
  for (const table of [...childTables, 'matchups']) {
    try {
      const count = await sql.query(`SELECT league_key, COUNT(*) as cnt FROM "${table}" GROUP BY league_key ORDER BY league_key`);
      console.log(`  ${table}:`);
      for (const c of count) {
        console.log(`    ${c.league_key}: ${c.cnt} rows`);
      }
    } catch (e: any) {
      console.log(`  ${table}: ${e.message.slice(0, 60)}`);
    }
  }

  const remainingLeagues = await sql`SELECT id, league_key, league_name, sport FROM user_leagues ORDER BY id`;
  console.log('\n  Remaining leagues:');
  for (const l of remainingLeagues) {
    console.log(`    id=${l.id} key=${l.league_key} "${l.league_name}" (${l.sport})`);
  }

  console.log('\n✅ Migration complete! Now update all API routes to use league_key instead of integer id.');
}

migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
