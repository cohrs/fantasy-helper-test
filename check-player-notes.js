import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function checkPlayerNotes() {
  console.log('🔍 Checking player notes...\n');
  
  const notes = await sql`
    SELECT 
      player_name, 
      player_name_normalized,
      LEFT(notes, 100) as notes_preview,
      league_id,
      updated_at
    FROM player_notes
    ORDER BY updated_at DESC
    LIMIT 10
  `;
  
  console.log(`Found ${notes.length} player notes:\n`);
  notes.forEach(n => {
    console.log(`Player: ${n.player_name}`);
    console.log(`  Normalized: ${n.player_name_normalized}`);
    console.log(`  League: ${n.league_id}`);
    console.log(`  Preview: ${n.notes_preview}...`);
    console.log(`  Updated: ${n.updated_at}\n`);
  });
  
  // Check Pete Alonso specifically
  const pete = await sql`
    SELECT * FROM player_notes
    WHERE player_name ILIKE '%alonso%'
  `;
  
  if (pete.length > 0) {
    console.log('\n📝 Pete Alonso notes found:');
    pete.forEach(p => {
      console.log(`  Name: ${p.player_name}`);
      console.log(`  Normalized: ${p.player_name_normalized}`);
      console.log(`  League: ${p.league_id}`);
      console.log(`  Notes: ${p.notes}\n`);
    });
  } else {
    console.log('\n❌ No notes found for Pete Alonso');
  }
}

checkPlayerNotes()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
