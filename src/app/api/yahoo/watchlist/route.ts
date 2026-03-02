import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

const LEAGUE_KEY = '469.l.4136';

// GET - Fetch Yahoo watchlist
export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !(session as any).accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessToken = (session as any).accessToken;

        // Get user's team ID first
        const teamsUrl = `https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=mlb/teams?format=json`;
        const teamsResponse = await fetch(teamsUrl, {
            headers: { "Authorization": `Bearer ${accessToken}` }
        });

        if (!teamsResponse.ok) {
            return NextResponse.json({ error: 'Failed to fetch teams' }, { status: teamsResponse.status });
        }

        const teamsData = await teamsResponse.json();
        
        // Navigate the nested structure to find the team in our league
        const games = teamsData?.fantasy_content?.users?.[0]?.user?.[1]?.games;
        let teamKey = null;
        
        if (games) {
            for (const key in games) {
                if (key === 'count') continue;
                const game = games[key];
                const teams = game?.game?.[1]?.teams;
                if (teams) {
                    for (const tKey in teams) {
                        if (tKey === 'count') continue;
                        const team = teams[tKey]?.team?.[0];
                        if (team) {
                            // Check if this team is in our league
                            const leagueKey = team.find((t: any) => t.team_key)?.team_key?.split('.t.')[0];
                            if (leagueKey === LEAGUE_KEY) {
                                teamKey = team.find((t: any) => t.team_key)?.team_key;
                                break;
                            }
                        }
                    }
                }
            }
        }

        if (!teamKey) {
            return NextResponse.json({ error: 'Team not found in league' }, { status: 404 });
        }

        // Fetch watchlist for the team
        // Note: Yahoo API doesn't have a direct "watchlist" endpoint
        // This would need to be stored separately or use a different approach
        // For now, return empty array with team info
        return NextResponse.json({
            success: true,
            teamKey,
            message: 'Yahoo API does not expose watchlist directly. Consider using local storage.',
            watchlist: []
        });

    } catch (error) {
        console.error('[Yahoo Watchlist] Error:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            detail: String(error) 
        }, { status: 500 });
    }
}

// POST - Push to Yahoo watchlist (if supported)
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !(session as any).accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { players } = await request.json();

        // Yahoo API doesn't support watchlist management via API
        // This would require browser automation or is not available
        return NextResponse.json({
            success: false,
            message: 'Yahoo Fantasy API does not support watchlist management. Watchlist is web-only feature.'
        });

    } catch (error) {
        console.error('[Yahoo Watchlist POST] Error:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            detail: String(error) 
        }, { status: 500 });
    }
}
