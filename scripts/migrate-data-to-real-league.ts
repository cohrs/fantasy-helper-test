import { neon } from '@neondatabase/serverless';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.POSTGRES_URL!);

async function migrate() {
  console.log('🔄 Migrating data from default league to real baseball league...\n');

  try {
    const fromLeagueId = 1; // Default migrated league
    const toLeagueId = 2;   // Asshat Baseball 2026

    // Move draft picks
    const draftResult = await sql`
      UPDATE draft_picks 
      SET league_id = ${toLeagueId} 
      WHERE league_id = ${fromLeagueId}
    `;
    console.log(`✅ Moved ${draftResult.length} draft picks`);

    // Move watchlist
    const watchlistResult = await sql`
      UPDATE watchlist 
      SET league_id = ${toLeagueId} 
      WHERE league_id = ${fromLeagueId}
    `;
    console.log(`✅ Moved ${watchlistResult.length} watchlist items`);

    // Move player notes
    const notesResult = await sql`
      UPDATE player_notes 
      SET league_id = ${toLeagueId} 
      WHERE league_id = ${fromLeagueId}
    `;
    console.log(`✅ Moved ${notesResult.length} player notes`);

    // Move chat history
    const chatResult = await sql`
      UPDATE chat_history 
      SET league_id = ${toLeagueId} 
      WHERE league_id = ${fromLeagueId}
    `;
    console.log(`✅ Moved ${chatResult.length} chat history entries`);

    // Delete the default league
    await sql`DELETE FROM user_selected_league WHERE league_id = ${fromLeagueId}`;
    await sql`DELETE FROM user_leagues WHERE id = ${fromLeagueId}`;
    console.log(`✅ Deleted default league\n`);

    console.log('🎉 Migration complete! All data is now in your real baseball league.');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    throw error;
  }
}

migrate();
