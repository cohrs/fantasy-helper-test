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

const sql = postgres(process.env.SUPABASE_POSTGRES_URL || process.env.SUPABASE_URL!, { ssl: 'require' });

async function main() {
  const result = await sql`SELECT COUNT(*) as cnt FROM users`;
  console.log('Users:', result[0].cnt);
  await sql.end();
}

main().catch(e => { console.error(e); process.exit(1); });
