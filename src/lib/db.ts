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
  
  // Clear existing picks and insert new ones
  await sql`DELETE FROM draft_picks`;
  
  for (const pick of picks) {
    await sql`
      INSERT INTO draft_picks (round, pick, player_name, position, team_abbr, drafted_by, is_keeper)
      VALUES (
        ${pick.rd}, 
        ${pick.pk}, 
        ${pick.name}, 
        ${pick.pos}, 
        ${pick.playerTeam}, 
        ${pick.tm}, 
        ${pick.isKeeper}
      )
    `;
  }
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
  
  // Clear existing watchlist and insert new ones
  await sql`DELETE FROM watchlist`;
  
  players.forEach(async (player, index) => {
    await sql`
      INSERT INTO watchlist (player_name, position, team_abbr, adp, rationale, sort_order)
      VALUES (
        ${player.name}, 
        ${player.pos}, 
        ${player.team}, 
        ${player.adp}, 
        ${player.rationale || null}, 
        ${index}
      )
    `;
  });
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
