import { neon } from '@neondatabase/serverless';

// Get database connection
export function getDb() {
  const databaseUrl = process.env.POSTGRES_URL;
  
  if (!databaseUrl) {
    throw new Error('POSTGRES_URL environment variable is not set');
  }
  
  // For local development, disable SSL verification
  const sql = neon(databaseUrl, {
    fetchOptions: {
      cache: 'no-store',
    }
  });
  
  return sql;
}

// Get current user's selected league ID
export async function getSelectedLeagueId(session?: any, leagueIdFromRequest?: number | null) {
  const sql = getDb();
  
  // If leagueId was passed directly (from request body/params), use it
  if (leagueIdFromRequest) {
    return leagueIdFromRequest;
  }
  
  if (!session?.user?.email) return null;
  
  // Look up user by email to get their real yahoo_guid
  const userResult = await sql`
    SELECT u.id FROM users u WHERE u.email = ${session.user.email} LIMIT 1
  `;
  
  if (!userResult.length) return null;
  const userId = userResult[0].id;
  
  const result = await sql`
    SELECT league_id FROM user_selected_league WHERE user_id = ${userId} LIMIT 1
  `;
  
  return result.length > 0 ? result[0].league_id : null;
}

// Player Notes
export async function getPlayerNotes(leagueId?: number | null) {
  const sql = getDb();
  
  if (!leagueId) {
    return {};
  }
  
  const rows = await sql`
    SELECT player_name_normalized, notes 
    FROM player_notes 
    WHERE league_id = ${leagueId}
  `;
  
  const notes: Record<string, string> = {};
  rows.forEach((row: any) => {
    notes[row.player_name_normalized] = row.notes;
  });
  
  return notes;
}

export async function savePlayerNote(playerName: string, playerNameNormalized: string, note: string, leagueId?: number | null) {
  const sql = getDb();
  
  if (!leagueId) {
    throw new Error('League ID required to save player note');
  }
  
  // Upsert: update if exists, insert if not
  await sql`
    INSERT INTO player_notes (league_id, player_name, player_name_normalized, notes, updated_at)
    VALUES (${leagueId}, ${playerName}, ${playerNameNormalized}, ${note}, CURRENT_TIMESTAMP)
    ON CONFLICT (league_id, player_name_normalized)
    DO UPDATE SET 
      notes = ${note},
      updated_at = CURRENT_TIMESTAMP
  `;
}

// Chat History
export async function saveChatHistory(prompt: string, rawResponse: string, recommendations: any[], leagueId?: number | null) {
  const sql = getDb();
  
  if (!leagueId) {
    throw new Error('League ID required to save chat history');
  }
  
  await sql`
    INSERT INTO chat_history (league_id, prompt, raw_response, recommendations)
    VALUES (${leagueId}, ${prompt}, ${rawResponse}, ${JSON.stringify(recommendations)})
  `;
}

export async function getChatHistory(leagueId?: number | null, limit: number = 20) {
  const sql = getDb();
  
  if (!leagueId) {
    return [];
  }
  
  const results = await sql`
    SELECT prompt, raw_response, recommendations, created_at
    FROM chat_history
    WHERE league_id = ${leagueId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;
  
  return results.reverse(); // Return oldest first for chat display
}

// Draft Picks
export async function getDraftPicks(leagueId?: number | null) {
  const sql = getDb();
  
  if (!leagueId) {
    return [];
  }
  
  return await sql`
    SELECT * FROM draft_picks 
    WHERE league_id = ${leagueId}
    ORDER BY pick ASC
  `;
}

export async function saveDraftPicks(picks: any[], leagueId?: number | null) {
  const sql = getDb();
  
  if (!leagueId) {
    throw new Error('League ID required to save draft picks');
  }
  
  if (picks.length === 0) return 0;
  
  console.log(`📝 Processing ${picks.length} picks for league ${leagueId}...`);
  
  let insertedCount = 0;
  let skippedCount = 0;
  
  // Only insert new picks - don't delete existing ones
  for (const pick of picks) {
    // Skip keepers and undrafted (no pick number)
    if (pick.pk === null) {
      // For keepers/undrafted, check by player name + team + round
      const existing = await sql`
        SELECT id FROM draft_picks 
        WHERE league_id = ${leagueId} 
          AND player_name = ${pick.name}
          AND round = ${pick.rd}
          AND drafted_by IS NOT DISTINCT FROM ${pick.tm}
      `;
      
      if (existing.length > 0) {
        skippedCount++;
        continue;
      }
    } else {
      // For draft picks, check by pick number
      const existing = await sql`
        SELECT id FROM draft_picks 
        WHERE league_id = ${leagueId} AND pick = ${pick.pk}
      `;
      
      if (existing.length > 0) {
        skippedCount++;
        continue;
      }
    }
    
    // Insert only if it's new
    await sql`
      INSERT INTO draft_picks (league_id, round, pick, rank, player_name, position, team_abbr, drafted_by, is_keeper)
      VALUES (
        ${leagueId},
        ${pick.rd || 0},
        ${pick.pk},
        ${pick.rank},
        ${pick.name},
        ${pick.pos},
        ${pick.playerTeam || null},
        ${pick.tm || null},
        ${pick.isKeeper || false}
      )
    `;
    insertedCount++;
  }
  
  console.log(`✅ Inserted ${insertedCount} new picks, skipped ${skippedCount} existing`);
  return insertedCount;
}

// Watchlist
export async function getWatchlist(leagueId?: number | null) {
  const sql = getDb();
  
  if (!leagueId) {
    return [];
  }
  
  return await sql`
    SELECT * FROM watchlist 
    WHERE league_id = ${leagueId}
    ORDER BY sort_order ASC
  `;
}

export async function saveWatchlist(players: any[], leagueId?: number | null) {
  const sql = getDb();
  
  if (!leagueId) {
    throw new Error('League ID required to save watchlist');
  }
  
  // Clear existing watchlist for this league
  await sql`DELETE FROM watchlist WHERE league_id = ${leagueId}`;
  
  if (players.length === 0) return;
  
  // Insert all players one by one
  for (let index = 0; index < players.length; index++) {
    const player = players[index];
    await sql`
      INSERT INTO watchlist (league_id, player_name, position, team_abbr, adp, rationale, sort_order)
      VALUES (
        ${leagueId},
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
export async function getPlayerStats(season?: number, sport?: string) {
  const sql = getDb();
  
  if (season && sport) {
    return await sql`SELECT * FROM player_stats WHERE season = ${season} AND sport = ${sport}`;
  } else if (season) {
    return await sql`SELECT * FROM player_stats WHERE season = ${season}`;
  } else if (sport) {
    return await sql`SELECT * FROM player_stats WHERE sport = ${sport} ORDER BY season DESC`;
  } else {
    return await sql`SELECT * FROM player_stats ORDER BY season DESC`;
  }
}

export async function savePlayerStats(players: any[], season: number, sport: string = 'baseball') {
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
      INSERT INTO player_stats (player_name, player_name_normalized, team_abbr, position, stats, season, sport, updated_at)
      VALUES (
        ${player.name}, 
        ${normalized}, 
        ${player.team || null}, 
        ${player.position || null}, 
        ${JSON.stringify(player.stats)}, 
        ${season},
        ${sport},
        CURRENT_TIMESTAMP
      )
      ON CONFLICT (player_name_normalized, sport, season)
      DO UPDATE SET 
        stats = ${JSON.stringify(player.stats)},
        team_abbr = ${player.team || null},
        position = ${player.position || null},
        updated_at = CURRENT_TIMESTAMP
    `;
  }
}

// Team Rosters (in-season)
export async function getTeamRosters(leagueId?: number | null) {
  const sql = getDb();
  
  if (!leagueId) {
    return [];
  }
  
  return await sql`
    SELECT * FROM team_rosters 
    WHERE league_id = ${leagueId}
    ORDER BY team_name, player_name
  `;
}

// Standings
export async function getStandings(leagueId?: number | null) {
  const sql = getDb();
  
  if (!leagueId) {
    return [];
  }
  
  return await sql`
    SELECT * FROM standings 
    WHERE league_id = ${leagueId}
    ORDER BY rank ASC
  `;
}
