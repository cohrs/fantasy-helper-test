import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.POSTGRES_URL!);

async function addSportColumn() {
  try {
    console.log('🔧 Adding sport column to player_stats table...');
    
    // Add sport column if it doesn't exist
    await sql`
      ALTER TABLE player_stats 
      ADD COLUMN IF NOT EXISTS sport VARCHAR(50) NOT NULL DEFAULT 'baseball'
    `;
    
    console.log('✅ Added sport column');
    
    // Drop old unique constraint if it exists
    await sql`
      ALTER TABLE player_stats 
      DROP CONSTRAINT IF EXISTS player_stats_player_name_normalized_key
    `;
    
    console.log('✅ Dropped old unique constraint');
    
    // Add new unique constraint with sport
    await sql`
      ALTER TABLE player_stats 
      ADD CONSTRAINT player_stats_player_name_normalized_sport_season_key 
      UNIQUE (player_name_normalized, sport, season)
    `;
    
    console.log('✅ Added new unique constraint with sport and season');
    
    // Create index on sport column
    await sql`
      CREATE INDEX IF NOT EXISTS idx_player_stats_sport ON player_stats(sport)
    `;
    
    console.log('✅ Created index on sport column');
    
    console.log('🎉 Migration complete!');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

addSportColumn();
