import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.POSTGRES_URL!);

async function fixConstraints() {
  console.log('🔧 Fixing database constraints...\n');

  try {
    // Drop old unique constraint on pick (without league_id)
    console.log('Dropping old unique constraint on draft_picks.pick...');
    await sql`ALTER TABLE draft_picks DROP CONSTRAINT IF EXISTS draft_picks_pick_key`;
    console.log('✅ Old constraint dropped\n');

    // Drop old unique constraint on player_notes (without league_id)
    console.log('Dropping old unique constraint on player_notes.player_name_normalized...');
    await sql`ALTER TABLE player_notes DROP CONSTRAINT IF EXISTS player_notes_player_name_normalized_key`;
    console.log('✅ Old constraint dropped\n');

    // Ensure new constraints exist
    console.log('Adding new unique constraints...');
    await sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'draft_picks_league_pick_key'
        ) THEN
          ALTER TABLE draft_picks ADD CONSTRAINT draft_picks_league_pick_key UNIQUE (league_id, pick);
        END IF;
      END $$;
    `;
    console.log('✅ draft_picks(league_id, pick) constraint ensured\n');

    await sql`
      DO $$ 
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint 
          WHERE conname = 'player_notes_league_player_key'
        ) THEN
          ALTER TABLE player_notes ADD CONSTRAINT player_notes_league_player_key UNIQUE (league_id, player_name_normalized);
        END IF;
      END $$;
    `;
    console.log('✅ player_notes(league_id, player_name_normalized) constraint ensured\n');

    console.log('🎉 Constraints fixed successfully!');

  } catch (error) {
    console.error('❌ Error fixing constraints:', error);
    throw error;
  }
}

fixConstraints();
