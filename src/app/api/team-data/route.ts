import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getTeamRosters, getStandings, getSelectedLeagueId } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    const leagueId = await getSelectedLeagueId(session);
    
    if (!leagueId) {
      return NextResponse.json({ error: 'No league selected' }, { status: 400 });
    }

    const [rosters, standings] = await Promise.all([
      getTeamRosters(leagueId),
      getStandings(leagueId)
    ]);

    return NextResponse.json({
      success: true,
      rosters,
      standings
    });
  } catch (error) {
    console.error('[Team Data] Error:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: String(error)
    }, { status: 500 });
  }
}
