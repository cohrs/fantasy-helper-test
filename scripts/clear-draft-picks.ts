import { getDb } from '../src/lib/db';

const sql = getDb();

async function clearDraftPicks() {
    try {
        console.log('🗑️  Clearing all draft picks for league 2...\n');
        
        const result = await sql`
            DELETE FROM draft_picks
            WHERE league_id = 2
        `;
        
        console.log('✅ Cleared draft picks');
        console.log('\nNext step: Click "SYNC LOCAL" in the app to re-scrape the draft');
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

clearDraftPicks();
