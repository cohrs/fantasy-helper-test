import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const sql = neon(process.env.POSTGRES_URL!);

// Normalize player name (same logic as frontend)
function normalizeName(name: string) {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, '')
    .replace(/\s+(jr|sr|ii|iii)$/, '')
    .trim()
    .replace(/\s+/g, '');
}

async function migrate() {
  console.log('🚀 Starting migration...\n');

  try {
    // 1. Migrate AI Notes
    console.log('📝 Migrating AI notes...');
    const notesPath = path.join(process.cwd(), 'ai-notes.json');
    if (fs.existsSync(notesPath)) {
      const notes = JSON.parse(fs.readFileSync(notesPath, 'utf-8'));
      
      for (const [playerName, noteText] of Object.entries(notes)) {
        const normalized = normalizeName(playerName);
        await sql`
          INSERT INTO player_notes (player_name, player_name_normalized, notes)
          VALUES (${playerName}, ${normalized}, ${noteText})
          ON CONFLICT (player_name_normalized) DO UPDATE SET notes = ${noteText}
        `;
      }
      console.log(`✅ Migrated ${Object.keys(notes).length} player notes\n`);
    }

    // 2. Migrate Chat History
    console.log('💬 Migrating chat history...');
    const chatPath = path.join(process.cwd(), 'ai-chat-log.json');
    if (fs.existsSync(chatPath)) {
      const chatLogs = JSON.parse(fs.readFileSync(chatPath, 'utf-8'));
      
      for (const log of chatLogs) {
        await sql`
          INSERT INTO chat_history (prompt, raw_response, recommendations, created_at)
          VALUES (
            ${log.prompt || null}, 
            ${log.rawResponse}, 
            ${JSON.stringify(log.recommendations || [])},
            ${log.timestamp || new Date().toISOString()}
          )
        `;
      }
      console.log(`✅ Migrated ${chatLogs.length} chat history entries\n`);
    }

    // 3. Migrate Draft Results
    console.log('🏈 Migrating draft picks...');
    const draftPath = path.join(process.cwd(), 'draft-results.json');
    if (fs.existsSync(draftPath)) {
      const picks = JSON.parse(fs.readFileSync(draftPath, 'utf-8'));
      
      // Clear existing picks
      await sql`DELETE FROM draft_picks`;
      
      for (const pick of picks) {
        await sql`
          INSERT INTO draft_picks (round, pick, player_name, position, team_abbr, drafted_by, is_keeper)
          VALUES (
            ${pick.rd}, 
            ${pick.pk}, 
            ${pick.name}, 
            ${pick.pos}, 
            ${pick.playerTeam || null}, 
            ${pick.tm || null}, 
            ${pick.isKeeper || false}
          )
        `;
      }
      console.log(`✅ Migrated ${picks.length} draft picks\n`);
    }

    // 4. Migrate Watchlist
    console.log('👀 Migrating watchlist...');
    const rosterPath = path.join(process.cwd(), 'my-roster.json');
    if (fs.existsSync(rosterPath)) {
      const roster = JSON.parse(fs.readFileSync(rosterPath, 'utf-8'));
      
      // Clear existing watchlist
      await sql`DELETE FROM watchlist`;
      
      roster.forEach(async (player: any, index: number) => {
        await sql`
          INSERT INTO watchlist (player_name, position, team_abbr, adp, rationale, sort_order)
          VALUES (
            ${player.name}, 
            ${player.pos}, 
            ${player.team || null}, 
            ${player.adp || null}, 
            ${player.rationale || null}, 
            ${index}
          )
        `;
      });
      console.log(`✅ Migrated ${roster.length} watchlist players\n`);
    }

    console.log('🎉 Migration complete!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  }
}

migrate();
