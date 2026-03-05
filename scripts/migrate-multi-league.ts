import { neon } from '@neondatabase/serverless';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.POSTGRES_URL!);

async function migrate() {
  console.log('🚀 Starting multi-league migration...\n');

  try {
    console.log('📋 Creating new tables...');
    
    // Create tables one by one using tagged templates
    // Users table
    await sql`
      CREATE TABLE IF NOT EXISTS users (
        id SERIAL PRIMARY KEY,
        yahoo_guid VARCHAR(255) NOT NULL UNIQUE,
        nickname VARCHAR(255),
        email VARCHAR(255),
        image_url TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // User leagues table
    await sql`
      CREATE TABLE IF NOT EXISTS user_leagues (
        id SERIAL PRIMARY KEY,
        user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        league_key VARCHAR(255) NOT NULL,
        league_name VARCHAR(255) NOT NULL,
        sport VARCHAR(50) NOT NULL,
        season INT NOT NULL,
        is_active BOOLEAN DEFAULT TRUE,
        team_key VARCHAR(255),
        team_name VARCHAR(255),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, league_key)
      )
    `;

    // User selected league table
    await sql`
      CREATE TABLE IF NOT EXISTS user_selected_league (
        user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
        league_id INT NOT NULL REFERENCES user_leagues(id) ON DELETE CASCADE,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `;

    // Add league_id to existing tables if not exists
    await sql`ALTER TABLE player_notes ADD COLUMN IF NOT EXISTS league_id INT REFERENCES user_leagues(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE chat_history ADD COLUMN IF NOT EXISTS league_id INT REFERENCES user_leagues(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE draft_picks ADD COLUMN IF NOT EXISTS league_id INT REFERENCES user_leagues(id) ON DELETE CASCADE`;
    await sql`ALTER TABLE watchlist ADD COLUMN IF NOT EXISTS league_id INT REFERENCES user_leagues(id) ON DELETE CASCADE`;

    // Create indexes
    await sql`CREATE INDEX IF NOT EXISTS idx_users_yahoo_guid ON users(yahoo_guid)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_leagues_user_id ON user_leagues(user_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_user_leagues_sport ON user_leagues(sport)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_player_notes_league ON player_notes(league_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_chat_history_league ON chat_history(league_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_draft_picks_league ON draft_picks(league_id)`;
    await sql`CREATE INDEX IF NOT EXISTS idx_watchlist_league ON watchlist(league_id)`;
    
    console.log('✅ New tables created successfully\n');

    // Check if we have existing data that needs migration
    const existingNotes = await sql`SELECT COUNT(*) as count FROM player_notes WHERE league_id IS NULL`;
    const existingDraft = await sql`SELECT COUNT(*) as count FROM draft_picks WHERE league_id IS NULL`;
    const existingWatchlist = await sql`SELECT COUNT(*) as count FROM watchlist WHERE league_id IS NULL`;
    const existingChat = await sql`SELECT COUNT(*) as count FROM chat_history WHERE league_id IS NULL`;

    const hasExistingData = 
      Number(existingNotes[0]?.count || 0) > 0 ||
      Number(existingDraft[0]?.count || 0) > 0 ||
      Number(existingWatchlist[0]?.count || 0) > 0 ||
      Number(existingChat[0]?.count || 0) > 0;

    if (hasExistingData) {
      console.log('📦 Found existing data without league_id. Creating default league...\n');

      // Create a default user for existing data
      const defaultUser = await sql`
        INSERT INTO users (yahoo_guid, nickname, email)
        VALUES ('default-user', 'Default User', 'default@local.dev')
        ON CONFLICT (yahoo_guid) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;
      const userId = defaultUser[0].id;

      // Create a default baseball league
      const defaultLeague = await sql`
        INSERT INTO user_leagues (
          user_id, league_key, league_name, sport, season, is_active
        )
        VALUES (
          ${userId}, 'mlb.l.default', 'Asshat Roto League (Migrated)', 'baseball', 2026, true
        )
        ON CONFLICT (user_id, league_key) DO UPDATE SET updated_at = CURRENT_TIMESTAMP
        RETURNING id
      `;
      const leagueId = defaultLeague[0].id;

      // Set as selected league
      await sql`
        INSERT INTO user_selected_league (user_id, league_id)
        VALUES (${userId}, ${leagueId})
        ON CONFLICT (user_id) DO UPDATE SET league_id = ${leagueId}
      `;

      console.log(`✅ Created default league (ID: ${leagueId})\n`);

      // Migrate existing data to the default league
      console.log('🔄 Migrating existing data to default league...');

      if (Number(existingNotes[0]?.count || 0) > 0) {
        await sql`UPDATE player_notes SET league_id = ${leagueId} WHERE league_id IS NULL`;
        console.log(`  ✓ Migrated ${existingNotes[0].count} player notes`);
      }

      if (Number(existingDraft[0]?.count || 0) > 0) {
        await sql`UPDATE draft_picks SET league_id = ${leagueId} WHERE league_id IS NULL`;
        console.log(`  ✓ Migrated ${existingDraft[0].count} draft picks`);
      }

      if (Number(existingWatchlist[0]?.count || 0) > 0) {
        await sql`UPDATE watchlist SET league_id = ${leagueId} WHERE league_id IS NULL`;
        console.log(`  ✓ Migrated ${existingWatchlist[0].count} watchlist items`);
      }

      if (Number(existingChat[0]?.count || 0) > 0) {
        await sql`UPDATE chat_history SET league_id = ${leagueId} WHERE league_id IS NULL`;
        console.log(`  ✓ Migrated ${existingChat[0].count} chat history entries`);
      }

      console.log('\n✅ Data migration complete!');
    } else {
      console.log('ℹ️  No existing data to migrate.');
    }

    console.log('\n🎉 Multi-league migration completed successfully!');
    console.log('\nNext steps:');
    console.log('1. Connect to Yahoo in the app');
    console.log('2. Your leagues will be fetched automatically');
    console.log('3. Select a league from the dropdown');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrate();
