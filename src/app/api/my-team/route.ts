import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getDb, getSelectedLeagueId } from '@/lib/db';

const sql = getDb();

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const leagueId = await getSelectedLeagueId(session);
    
    if (!leagueId) {
      return NextResponse.json({ error: 'No league selected' }, { status: 400 });
    }

    // Get user's team name for this league
    const result = await sql`
      SELECT team_name, team_key, league_name, sport
      FROM user_leagues
      WHERE id = ${leagueId}
    `;

    if (!result.length) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      teamName: result[0].team_name,
      teamKey: result[0].team_key,
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
