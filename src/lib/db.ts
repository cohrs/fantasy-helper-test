import { neon } from '@neondatabase/serverless';

// Get database connection
export function getDb() {
  const databaseUrl = process.env.POSTGRES_URL;
  
  if (!databaseUrl) {
    throw new Error('POSTGRES_URL environment variable is not set');
  }
  
  return neon(databaseUrl);
}

// Player Notes
export async function getPlayerNotes() {
  const sql = getDb();
  const rows = await sql`SELECT player_name_normalized, notes FROM player_notes`;
  
  const notes: Record<string, string> = {};
  rows.forEach((row: any) => {
    notes[row.player_name_normalized] = row.notes;
  });
  
  return notes;
}

export async function savePlayerNote(playerName: string, playerNameNormalized: string, note: string) {
  const sql = getDb();
  
  // Upsert: update if exists, insert if not
  await sql`
    INSERT INTO player_notes (player_name, player_name_normalized, notes, updated_at)
    VALUES (${playerName}, ${playerNameNormalized}, ${note}, CURRENT_TIMESTAMP)
    ON CONFLICT (player_name_normalized)
    DO UPDATE SET 
      notes = ${note},
      updated_at = CURRENT_TIMESTAMP
  `;
}

// Chat History
export async function saveChatHistory(prompt: string, rawResponse: string, recommendations: any[]) {
  const sql = getDb();
  
  await sql`
    INSERT INTO chat_history (prompt, raw_response, recommendations)
    VALUES (${prompt}, ${rawResponse}, ${JSON.stringify(recommendations)})
  `;
}

// Draft Picks
export async function getDraftPicks() {
  const sql = getDb();
  return await sql`
    SELECT * FROM draft_picks 
    ORDER BY pick ASC
  `;
}

export async function saveDraftPicks(picks: any[]) {
  const sql = getDb();
  
  if (picks.length === 0) return 0;
  
  // Get existing pick numbers to avoid duplicates
  const existing = await sql`SELECT pick FROM draft_picks`;
  const existingPicks = new Set(existing.map((row: any) => row.pick));
  
  // Filter to only new picks
  const newPicks = picks.filter(pick => !existingPicks.has(pick.pk));
  
  if (newPicks.length === 0) return 0;
  
  // Insert new picks one by one (Neon doesn't support batch UNNEST)
  for (const pick of newPicks) {
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
  
  return newPicks.length;
}

// Watchlist
export async function getWatchlist() {
  const sql = getDb();
  return await sql`
    SELECT * FROM watchlist 
    ORDER BY sort_order ASC
  `;
}

export async function saveWatchlist(players: any[]) {
  const sql = getDb();
  
  // Clear existing watchlist
  await sql`DELETE FROM watchlist`;
  
  if (players.length === 0) return;
  
  // Insert all players one by one
  for (let index = 0; index < players.length; index++) {
    const player = players[index];
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
  }
}


// Player Stats
export async function getPlayerStats(season?: number) {
  const sql = getDb();
  
  const rows = season 
    ? await sql`SELECT * FROM player_stats WHERE season = ${season}`
    : await sql`SELECT * FROM player_stats ORDER BY season DESC`;
  
  const stats: Record<string, Record<string, string>> = {};
  rows.forEach((row: any) => {
    stats[row.player_name_normalized] = row.stats;
  });
  
  return stats;
}

export async function savePlayerStats(players: any[], season: number) {
  const sql = getDb();
  
  for (const player of players) {
    const normalized = player.name
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z\s]/g, '')
      .replace(/\s+(jr|sr|ii|iii)$/, '')
      .trim()
      .replace(/\s+/g, '');
    
    await sql`
      INSERT INTO player_stats (player_name, player_name_normalized, team_abbr, position, stats, season, updated_at)
      VALUES (
        ${player.name}, 
        ${normalized}, 
        ${player.team || null}, 
        ${player.position || null}, 
        ${JSON.stringify(player.stats)}, 
        ${season},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (player_name_normalized)
      DO UPDATE SET 
        stats = ${JSON.stringify(player.stats)},
        team_abbr = ${player.team || null},
        position = ${player.position || null},
        season = ${season},
        updated_at = CURRENT_TIMESTAMP
    `;
  }
}
