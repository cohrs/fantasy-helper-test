import { getDb } from '../src/lib/db';

const sql = getDb();

async function addTokenColumns() {
    try {
        console.log('🔧 Adding token columns to users table...\n');
        
        // Add columns if they don't exist
        await sql`
            ALTER TABLE users 
            ADD COLUMN IF NOT EXISTS access_token TEXT,
            ADD COLUMN IF NOT EXISTS refresh_token TEXT,
            ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMP
        `;
        
        console.log('✅ Successfully added token columns to users table');
        console.log('\nNext steps:');
        console.log('1. Sign out and sign back in to the app');
        console.log('2. Your tokens will be saved to the database');
        console.log('3. You can then run server-side scripts like:');
        console.log('   pnpm tsx scripts/fetch-roster-positions.ts');
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

addTokenColumns();
