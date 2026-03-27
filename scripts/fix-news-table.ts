import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
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

const sql = postgres((process.env.SUPABASE_POSTGRES_URL || process.env.SUPABASE_URL)!, { ssl: 'require' });

async function main() {
  console.log('Fixing yahoo_player_news table...');
  await sql`DROP TABLE IF EXISTS yahoo_player_news`;
  await sql`CREATE TABLE yahoo_player_news (
    id SERIAL PRIMARY KEY,
    league_key VARCHAR(255) NOT NULL,
    player_name VARCHAR(255),
    player_name_normalized VARCHAR(255),
    status VARCHAR(50),
    status_full TEXT,
    image_url TEXT,
    notes JSONB,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(league_key, player_name_normalized)
  )`;
  console.log('✅ yahoo_player_news recreated with correct schema');
  await sql.end();
}

main().catch(console.error);
