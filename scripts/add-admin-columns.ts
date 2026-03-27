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

const sql = neon(process.env.POSTGRES_URL!);

async function main() {
  console.log('Adding role and is_blocked columns to users table...');
  
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) DEFAULT 'user'`;
  await sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS is_blocked BOOLEAN DEFAULT false`;
  
  // Set your account as admin
  await sql`UPDATE users SET role = 'admin' WHERE id = 119`;
  
  console.log('✅ Done. User 119 is now admin.');
  
  const users = await sql`SELECT id, email, nickname, role, is_blocked FROM users ORDER BY id`;
  console.table(users);
}

main().catch(console.error);
