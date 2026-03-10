import { getDb } from './src/lib/db.ts';

const sql = getDb();

async function fixColtKeithDuplicate() {
  console.log('🔧 Fixing Colt Keith duplicate entries...\n');
  
  const leagueId = 2; // Baseball league
  
  // Find all Colt Keith entries
  const coltKeithEntries = await sql`
    SELECT id, round, pick, player_name, position, team_abbr, drafted_by, is_keeper
    FROM draft_picks
    WHERE league_id = ${leagueId} 
      AND (player_name ILIKE '%colt%keith%' OR player_name ILIKE '%keith%colt%')
    ORDER BY pick
  `;
  
  console.log('Current Colt Keith entries:');
  coltKeithEntries.forEach(entry => {
    console.log(`  ID ${entry.id}: Round ${entry.round}, Pick ${entry.pick} - ${entry.player_name} (${entry.drafted_by})`);
  });
  
  if (coltKeithEntries.length > 1) {
    // According to Tapatalk: rank 539, 8th round, Hulkamania
    // We need to keep one entry and remove the duplicate
    
    // Keep the entry with pick 144 (which should be correct for 8th round)
    // Remove the entry with pick 115
    
    const entryToKeep = coltKeithEntries.find(e => e.pick === 144);
    const entryToRemove = coltKeithEntries.find(e => e.pick === 115);
    
    if (entryToKeep && entryToRemove) {
      console.log(`\n📝 Keeping: ID ${entryToKeep.id} (Pick ${entryToKeep.pick})`);
      console.log(`🗑️  Removing: ID ${entryToRemove.id} (Pick ${entryToRemove.pick})`);
      
      // Delete the duplicate
      await sql`
        DELETE FROM draft_picks 
        WHERE id = ${entryToRemove.id}
      `;
      
      console.log('✅ Duplicate removed');
    } else {
      console.log('❌ Could not identify which entry to keep/remove');
    }
  } else {
    console.log('\n✅ No duplicates found');
  }
  
  // Verify final state
  const final = await sql`
    SELECT round, pick, player_name, position, drafted_by
    FROM draft_picks
    WHERE league_id = ${leagueId} 
      AND (player_name ILIKE '%colt%keith%' OR player_name ILIKE '%keith%colt%')
    ORDER BY pick
  `;
  
  console.log('\n✅ Final result:');
  final.forEach(entry => {
    console.log(`  Round ${entry.round}, Pick ${entry.pick}: ${entry.player_name} (${entry.drafted_by})`);
  });
}

fixColtKeithDuplicate()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });