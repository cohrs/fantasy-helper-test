import { getDb } from '../src/lib/db';

const sql = getDb();

async function makePickNullable() {
    try {
        console.log('🔧 Making pick column nullable...\n');
        
        await sql`
            ALTER TABLE draft_picks 
            ALTER COLUMN pick DROP NOT NULL
        `;
        
        console.log('✅ Successfully made pick column nullable');
        console.log('\nNow keepers and undrafted players can have NULL pick numbers');
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

makePickNullable();
