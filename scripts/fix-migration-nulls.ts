/**
 * Fix NULL league_key values left from partial migration.
 * These are rows where league_id didn't match any user_leagues row
 * (likely league_id was NULL or pointed to a deleted league).
 * 
 * Run: npx tsx scripts/fix-migration-nulls.ts
 */
import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';

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

const sql = neon(process.env.POSTGRES_URL!);

async function fix() {
  const tables = ['draft_picks', 'watchlist', 'standings', 'team_rosters', 'chat_history', 'player_notes', 'yahoo_player_news', 'matchups'];

  for (const table of tables) {
    try {
      // Check for NULLs
      const hasLeagueKey = await sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = ${table} AND column_name = 'league_key'
      `;
      if (hasLeagueKey.length === 0) continue;

      const hasLeagueId = await sql`
        SELECT column_name FROM information_schema.columns 
        WHERE table_name = ${table} AND column_name = 'league_id'
      `;

      const nullCount = await sql.query(`SELECT COUNT(*) as cnt FROM "${table}" WHERE league_key IS NULL`);
      const cnt = parseInt(nullCount[0].cnt);
      if (cnt === 0) {
        console.log(`✅ ${table}: no NULLs`);
        continue;
      }

      console.log(`⚠️  ${table}: ${cnt} NULL league_key rows`);

      if (hasLeagueId.length > 0) {
        // Check what league_ids these NULL rows have
        const nullRows = await sql.query(`
          SELECT DISTINCT league_id, COUNT(*) as cnt 
          FROM "${table}" 
          WHERE league_key IS NULL 
          GROUP BY league_id
        `);
        for (const r of nullRows) {
          console.log(`   league_id=${r.league_id}: ${r.cnt} rows`);
        }

        // For league_id that maps to a known league_key, update
        // league_id=5 → 469.l.4136 (the duplicate)
        // league_id=NULL → these are orphans, assign to baseball by default
        await sql.query(`
          UPDATE "${table}" SET league_key = '469.l.4136' 
          WHERE league_key IS NULL AND league_id = 5
        `);
        await sql.query(`
          UPDATE "${table}" SET league_key = '469.l.4136' 
          WHERE league_key IS NULL AND league_id IS NULL
        `);
        
        const remaining = await sql.query(`SELECT COUNT(*) as cnt FROM "${table}" WHERE league_key IS NULL`);
        console.log(`   After fix: ${remaining[0].cnt} NULLs remaining`);
      } else {
        // league_id already dropped, just set remaining NULLs to baseball
        await sql.query(`UPDATE "${table}" SET league_key = '469.l.4136' WHERE league_key IS NULL`);
        const remaining = await sql.query(`SELECT COUNT(*) as cnt FROM "${table}" WHERE league_key IS NULL`);
        console.log(`   After fix: ${remaining[0].cnt} NULLs remaining`);
      }
    } catch (e: any) {
      console.log(`⏭️  ${table}: ${e.message.slice(0, 80)}`);
    }
  }

  console.log('\nDone. Now re-run the migration script to continue.');
}

fix().catch(console.error);
