import { getDb } from '../src/lib/db';

const sql = getDb();

async function fixTimberWolves() {
  console.log('🔧 Fixing Timber Wolves duplicate...');
  
  // Update all "Timber Wolves" to "Timberwolves"
  const result = await sql`
    UPDATE draft_picks 
    SET drafted_by = 'Timberwolves'
    WHERE drafted_by = 'Timber Wolves'
  `;
  
  console.log(`✅ Updated ${result.length} picks from "Timber Wolves" to "Timberwolves"`);
}

fixTimberWolves()
  .then(() => {
    console.log('✅ Done!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
