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
export async function getSelectedLeagueId(session?: any) {
  const sql = getDb();
  
  let userGuid = 'default-user'; // Fallback for local development
  
  if (session?.user?.email) {
    userGuid = session.user.email.split('@')[0];
  }
  
  // Handle legacy "yahoo" guid by trying "yahoo-user" as fallback
  let result = await sql`
    SELECT usl.league_id
    FROM user_selected_league usl
    JOIN users u ON u.id = usl.user_id
    WHERE u.yahoo_guid = ${userGuid}
  `;
  
  // If not found and guid is "yahoo", try "yahoo-user"
  if (!result.length && userGuid === 'yahoo') {
    console.log('⚠️  User "yahoo" not found in getSelectedLeagueId, trying "yahoo-user" as fallback');
    userGuid = 'yahoo-user';
    result = await sql`
      SELECT usl.league_id
      FROM user_selected_league usl
      JOIN users u ON u.id = usl.user_id
      WHERE u.yahoo_guid = ${userGuid}
    `;
  }
  
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
  
  // Get existing picks to avoid duplicates
  // For draft picks: match on pick number
  // For keepers/undrafted: match on player name + team
  const existing = await sql`
    SELECT pick, player_name, drafted_by FROM draft_picks 
    WHERE league_id = ${leagueId}
  `;
  
  const existingPickNumbers = new Set(existing.filter((r: any) => r.pick !== null).map((r: any) => r.pick));
  const existingKeepers = new Set(existing.filter((r: any) => r.pick === null).map((r: any) => `${r.player_name}|${r.drafted_by}`));
  
  // Filter to only new picks
  const newPicks = picks.filter(pick => {
    if (pick.pk !== null) {
      // Draft pick: check if pick number exists
      return !existingPickNumbers.has(pick.pk);
    } else {
      // Keeper/undrafted: check if player+team combo exists
      const key = `${pick.name}|${pick.tm}`;
      return !existingKeepers.has(key);
    }
  });
  
  console.log(`📝 Total picks scraped: ${picks.length}, Already in DB: ${existing.length}, New picks to insert: ${newPicks.length}`);
  
  if (newPicks.length === 0) {
    console.log('✅ No new picks to add');
    return 0;
  }
  
  // Insert new picks
  for (const pick of newPicks) {
    await sql`
      INSERT INTO draft_picks (league_id, round, pick, rank, player_name, position, team_abbr, drafted_by, is_keeper)
      VALUES (
        ${leagueId},
        ${pick.rd}, 
        ${pick.pk},
        ${pick.rank}, 
        ${pick.name}, 
        ${pick.pos}, 
        ${pick.playerTeam || null}, 
        ${pick.tm || null}, 
        ${pick.isKeeper || false}
      )
    `;
  }
  
  console.log(`✅ Inserted ${newPicks.length} new picks`);
  return newPicks.length;
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
