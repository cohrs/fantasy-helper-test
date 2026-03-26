/**
 * Migration: Add user_id to personal tables (watchlist, chat_history, player_notes)
 * for multi-user isolation.
 * 
 * Run: npx tsx scripts/add-user-id-to-personal-tables.ts
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

async function migrate() {
  const tables = ['watchlist', 'chat_history', 'player_notes'];

  for (const table of tables) {
    console.log(`\n--- ${table} ---`);

    // Check if user_id column already exists
    const colCheck = await sql`
      SELECT column_name FROM information_schema.columns 
      WHERE table_name = ${table} AND column_name = 'user_id'
    `;

    if (colCheck.length > 0) {
      console.log('  user_id column already exists');
    } else {
      await sql.query(`ALTER TABLE "${table}" ADD COLUMN user_id INT`);
      console.log('  Added user_id column');
    }

    // Set existing rows to user_id from the first user (you — id from users table)
    // We know your email is sdcohrs@yahoo.com
    const userResult = await sql`SELECT id FROM users WHERE email = 'sdcohrs@yahoo.com' LIMIT 1`;
    if (userResult.length > 0) {
      const userId = userResult[0].id;
      await sql.query(`UPDATE "${table}" SET user_id = ${userId} WHERE user_id IS NULL`);
      console.log(`  Set existing rows to user_id=${userId}`);
    }

    // Create index on user_id
    await sql.query(`CREATE INDEX IF NOT EXISTS idx_${table}_user_id ON "${table}" (user_id)`);
    console.log('  Created index');
  }

  // Verify
  for (const table of tables) {
    const counts = await sql.query(`SELECT user_id, COUNT(*) as cnt FROM "${table}" GROUP BY user_id`);
    console.log(`\n${table}:`, counts);
  }

  console.log('\nDone.');
}

migrate().catch(console.error);
