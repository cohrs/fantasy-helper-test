import { NextResponse } from 'next/server';
import { getDb, getUserId } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export const dynamic = 'force-dynamic';

// Get leagues for the current user
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getUserId(session);
    const sql = getDb();

    let result: any[];
    if (userId) {
      // Show only this user's leagues
      result = await sql`
        SELECT id, league_key, league_name, sport, season, is_active, team_name, team_key, created_at
        FROM user_leagues
        WHERE user_id = ${userId}
        ORDER BY is_active DESC, season DESC, sport
      `;
    } else {
      // Not logged in — return empty
      result = [];
    }

    return NextResponse.json({ success: true, leagues: result });
  } catch (error: any) {
    console.error('Error fetching leagues:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Select a league
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    const userId = await getUserId(session);
    const { leagueKey } = await request.json();
    const sql = getDb();

    // Only return leagues belonging to this user
    const result = userId
      ? await sql`SELECT id, league_key, league_name, sport, season, is_active, team_name, team_key FROM user_leagues WHERE league_key = ${leagueKey} AND user_id = ${userId}`
      : await sql`SELECT id, league_key, league_name, sport, season, is_active, team_name, team_key FROM user_leagues WHERE league_key = ${leagueKey}`;

    if (result.length === 0) {
      return NextResponse.json({ success: false, error: 'League not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, league: result[0] });
  } catch (error: any) {
    console.error('Error selecting league:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
