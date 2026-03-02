import { savePlayerStats } from '../src/lib/db';
import YAHOO_STATS_DATA from '../yahoo-stats.json';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function migrateStats() {
  console.log('🏈 Migrating player stats to database...\n');
  
  try {
    const players = YAHOO_STATS_DATA.players || [];
    
    if (players.length === 0) {
      console.log('⚠️  No players found in yahoo-stats.json');
      return;
    }
    
    await savePlayerStats(players, 2025);
    
    console.log(`✅ Migrated ${players.length} player stats for 2025 season\n`);
    console.log('🎉 Stats migration complete!');
  } catch (error) {
    console.error('❌ Stats migration failed:', error);
    process.exit(1);
  }
}

migrateStats();
