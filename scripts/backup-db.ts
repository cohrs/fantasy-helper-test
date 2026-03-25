/**
 * Backup all database tables to JSON files before league_key migration.
 * Run: npx tsx scripts/backup-db.ts
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
  console.error('❌ POSTGRES_URL not found in .env.local');
  process.exit(1);
}

const sql = neon(process.env.POSTGRES_URL);

async function backup() {
  const backupDir = path.join(process.cwd(), '_scratch', 'db-backup-' + new Date().toISOString().replace(/[:.]/g, '-'));
  fs.mkdirSync(backupDir, { recursive: true });

  const tables = [
    'users',
    'user_leagues',
    'user_selected_league',
    'player_notes',
    'yahoo_player_news',
    'chat_history',
    'draft_picks',
    'watchlist',
    'player_stats',
    'standings',
    'team_rosters',
  ];

  for (const table of tables) {
    try {
      const rows = await sql.query(`SELECT * FROM "${table}"`);
      const filePath = path.join(backupDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
      console.log(`✅ ${table}: ${rows.length} rows → ${filePath}`);
    } catch (e: any) {
      console.log(`⚠️  ${table}: ${e.message}`);
    }
  }

  // Also dump the current schema
  try {
    const schemaInfo = await sql`
      SELECT table_name, column_name, data_type, is_nullable, column_default
      FROM information_schema.columns
      WHERE table_schema = 'public'
      ORDER BY table_name, ordinal_position
    `;
    fs.writeFileSync(path.join(backupDir, '_schema_info.json'), JSON.stringify(schemaInfo, null, 2));
    console.log(`✅ Schema info saved`);
  } catch (e: any) {
    console.log(`⚠️  Schema info: ${e.message}`);
  }

  console.log(`\n📁 Backup saved to: ${backupDir}`);
}

backup().catch(console.error);
