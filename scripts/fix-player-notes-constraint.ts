/**
 * Fix player_notes unique constraint to include user_id for multi-user isolation.
 * Old: UNIQUE(league_key, player_name_normalized)
 * New: UNIQUE(league_key, user_id, player_name_normalized)
 * 
 * Run: npx tsx scripts/fix-player-notes-constraint.ts
 */
import { neon } from '@neondatabase/serverless';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.POSTGRES_URL!);

async function main() {
  console.log('🔧 Fixing player_notes unique constraint...');

  // Drop old constraint
  await sql`ALTER TABLE player_notes DROP CONSTRAINT IF EXISTS player_notes_league_key_player_name_normalized_key`;

  // Add new constraint with user_id
  await sql`ALTER TABLE player_notes ADD CONSTRAINT player_notes_league_key_user_id_player_name_normalized_key UNIQUE (league_key, user_id, player_name_normalized)`;

  console.log('✅ Done. New constraint: UNIQUE(league_key, user_id, player_name_normalized)');
}

main().catch(console.error);
