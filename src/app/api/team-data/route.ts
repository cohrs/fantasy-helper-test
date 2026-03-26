import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getTeamRosters, getStandings, getSelectedLeagueKey } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const leagueKeyParam = searchParams.get('leagueKey');
    
    let leagueKey: string | null = null;
    
    if (leagueKeyParam) {
      leagueKey = leagueKeyParam;
    } else {
      // Fallback to session-based league selection
      const session = await getServerSession(authOptions);
      leagueKey = await getSelectedLeagueKey(session);
    }
    
    if (!leagueKey) {
      return NextResponse.json({ error: 'No league selected' }, { status: 400 });
    }

    console.log(`📊 [Team Data] Fetching for league key: ${leagueKey}`);

    const [rosters, standings] = await Promise.all([
      getTeamRosters(leagueKey),
      getStandings(leagueKey)
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
