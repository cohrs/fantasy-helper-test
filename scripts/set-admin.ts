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
  // Pre-insert admin user so role is set before first login
  await sql`
    INSERT INTO users (yahoo_guid, email, nickname, role)
    VALUES ('UIXKGRGJKTS7A6TYUVFIZRKJ3A', 'sdcohrs@yahoo.com', 'sdcohrs', 'admin')
    ON CONFLICT (yahoo_guid) DO UPDATE SET role = 'admin'
  `;
  console.log('✅ Admin user set: sdcohrs@yahoo.com');
  
  const users = await sql`SELECT id, email, role, is_blocked FROM users ORDER BY id`;
  console.table(users);
  await sql.end();
}

main().catch(console.error);
