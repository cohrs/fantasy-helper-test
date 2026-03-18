import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getDb, getSelectedLeagueId } from '@/lib/db';

const sql = getDb();

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueIdParam = searchParams.get('leagueId');
    
    let leagueId: number | null = null;
    
    if (leagueIdParam) {
      leagueId = parseInt(leagueIdParam);
    } else {
      // Fallback to session-based league selection
      const session = await getServerSession(authOptions);
      leagueId = await getSelectedLeagueId(session);
    }
    
    if (!leagueId) {
      return NextResponse.json({ error: 'No league selected' }, { status: 400 });
    }

    console.log(`⭐ [My Team] Fetching for league ID: ${leagueId}`);

    // Get user's team name for this league
    const result = await sql`
      SELECT team_name, team_key, league_name, sport
      FROM user_leagues
      WHERE id = ${leagueId}
    `;

    if (!result.length) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    let teamName = result[0].team_name;
    let teamKey = result[0].team_key;

    // If team_name is null (not yet synced), try to find it from team_rosters
    // by matching the session user's Yahoo GUID
    if (!teamName) {
      try {
        const session = await getServerSession(authOptions);
        if (session?.user?.email) {
          const userResult = await sql`
            SELECT yahoo_guid FROM users WHERE email = ${session.user.email} LIMIT 1
          `;
          const yahooGuid = userResult[0]?.yahoo_guid;
          
          if (yahooGuid) {
            // Try to find team by team_key stored in user_leagues (may have been set by sync)
            // Or fall back to checking if we can match via standings/rosters
            // For now, check if team_key is set and look up name from rosters
            if (teamKey) {
              const rosterTeam = await sql`
                SELECT DISTINCT team_name FROM team_rosters 
                WHERE league_id = ${leagueId} AND team_key = ${teamKey} LIMIT 1
              `;
              if (rosterTeam.length) teamName = rosterTeam[0].team_name;
            }
          }
        }
      } catch (e) {
        console.error('[My Team] Error looking up team from rosters:', e);
      }
    }

    return NextResponse.json({
      success: true,
      teamName: teamName || null,
      teamKey: teamKey,
      leagueName: result[0].league_name,
      sport: result[0].sport
    });
  } catch (error) {
    console.error('[My Team] Error:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: String(error)
    }, { status: 500 });
  }
}
