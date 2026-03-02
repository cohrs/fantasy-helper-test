import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

const LEAGUE_KEY = '469.l.4136';

// GET - Fetch your roster
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !(session as any).accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessToken = (session as any).accessToken;
        const { searchParams } = new URL(request.url);
        const week = searchParams.get('week') || 'current';

        // Get user's team key
        const teamsUrl = `https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=mlb/teams?format=json`;
        const teamsResponse = await fetch(teamsUrl, {
            headers: { "Authorization": `Bearer ${accessToken}` }
        });

        if (!teamsResponse.ok) {
            return NextResponse.json({ error: 'Failed to fetch teams' }, { status: teamsResponse.status });
        }

        const teamsData = await teamsResponse.json();
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

        // Fetch roster
        const rosterUrl = week === 'current' 
            ? `https://fantasysports.yahooapis.com/fantasy/v2/team/${teamKey}/roster?format=json`
            : `https://fantasysports.yahooapis.com/fantasy/v2/team/${teamKey}/roster;week=${week}?format=json`;

        const rosterResponse = await fetch(rosterUrl, {
            headers: { "Authorization": `Bearer ${accessToken}` }
        });

        if (!rosterResponse.ok) {
            const errorText = await rosterResponse.text();
            return NextResponse.json({ 
                error: `Yahoo API returned ${rosterResponse.status}`,
                detail: errorText.substring(0, 500)
            }, { status: rosterResponse.status });
        }

        const rosterData = await rosterResponse.json();
        const playersRaw = rosterData?.fantasy_content?.team?.[1]?.roster?.['0']?.players;

        if (!playersRaw) {
            return NextResponse.json({ error: 'No roster data found' }, { status: 404 });
        }

        const roster: any[] = [];
        for (const key in playersRaw) {
            if (key === 'count') continue;
            const playerObj = playersRaw[key];
            if (!playerObj?.player) continue;

            const info = playerObj.player[0];
            const findField = (fieldKey: string) => {
                for (const item of info) {
                    if (typeof item === 'object' && item !== null && fieldKey in item) return item[fieldKey];
                }
                return null;
            };

            const nameObj = findField('name');
            const fullName = (typeof nameObj === 'object' && nameObj?.full)
                ? nameObj.full
                : (nameObj?.first && nameObj?.last ? `${nameObj.first} ${nameObj.last}` : 'Unknown');

            const selectedPosition = findField('selected_position');
            const position = selectedPosition?.[1]?.position || 'BN';

            roster.push({
                name: fullName,
                team: findField('editorial_team_abbr') || 'FA',
                eligiblePositions: findField('eligible_positions'),
                selectedPosition: position,
                status: findField('status'),
                playerKey: findField('player_key')
            });
        }

        return NextResponse.json({
            success: true,
            teamKey,
            roster
        });

    } catch (error) {
        console.error('[Yahoo Roster] Error:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            detail: String(error) 
        }, { status: 500 });
    }
}

// POST - Update lineup (move players between active/bench)
export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !(session as any).accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { teamKey, playerKey, newPosition } = await request.json();

        if (!teamKey || !playerKey || !newPosition) {
            return NextResponse.json({ 
                error: 'Missing required fields: teamKey, playerKey, newPosition' 
            }, { status: 400 });
        }

        // Yahoo API requires XML for roster updates
        const xml = `<?xml version="1.0"?>
<fantasy_content>
  <roster>
    <coverage_type>week</coverage_type>
    <players>
      <player>
        <player_key>${playerKey}</player_key>
        <position>${newPosition}</position>
      </player>
    </players>
  </roster>
</fantasy_content>`;

        const accessToken = (session as any).accessToken;
        const updateUrl = `https://fantasysports.yahooapis.com/fantasy/v2/team/${teamKey}/roster`;

        const response = await fetch(updateUrl, {
            method: 'PUT',
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/xml"
            },
            body: xml
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({ 
                error: `Failed to update lineup: ${response.status}`,
                detail: errorText.substring(0, 500)
            }, { status: response.status });
        }

        return NextResponse.json({
            success: true,
            message: 'Lineup updated successfully'
        });

    } catch (error) {
        console.error('[Yahoo Roster POST] Error:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            detail: String(error) 
        }, { status: 500 });
    }
}
