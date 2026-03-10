import { getDb } from '../src/lib/db';

const sql = getDb();

async function fixTimberwolves() {
    try {
        console.log('🔧 Merging Timberwolves team names...\n');
        
        // Merge "Timberwolves" into "Timber Wolves"
        await sql`
            UPDATE draft_picks
            SET drafted_by = 'Timber Wolves'
            WHERE league_id = 2 AND drafted_by = 'Timberwolves'
        `;
        
        console.log('✅ Merged "Timberwolves" → "Timber Wolves"');
        
        // Check final counts
        const counts = await sql`
            SELECT drafted_by, COUNT(*) as picks
            FROM draft_picks
            WHERE league_id = 2 AND (drafted_by = 'Timber Wolves' OR drafted_by = 'Timberwolves')
            GROUP BY drafted_by
        `;
        
        console.log('\nFinal counts:');
        counts.forEach((row: any) => {
            console.log(`  ${row.drafted_by}: ${row.picks} picks`);
        });
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fixTimberwolves();
