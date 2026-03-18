import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getDb } from '@/lib/db';

const sql = getDb();

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !(session as any).accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessToken = (session as any).accessToken;
        const userGuid = session.user?.email?.split('@')[0] || 'unknown';

        // Get selected league
        const leagueResult = await sql`
            SELECT ul.league_key, ul.sport
            FROM user_selected_league usl
            JOIN users u ON u.id = usl.user_id
            JOIN user_leagues ul ON ul.id = usl.league_id
            WHERE u.yahoo_guid = ${userGuid}
        `;

        if (!leagueResult.length) {
            return NextResponse.json({ error: 'No league selected' }, { status: 400 });
        }

        const leagueKey = leagueResult[0].league_key;

        // Fetch all teams in the league
        const teamsUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/teams?format=json`;
        const teamsResponse = await fetch(teamsUrl, {
            headers: { "Authorization": `Bearer ${accessToken}` }
        });

        if (!teamsResponse.ok) {
            return NextResponse.json({ error: 'Failed to fetch teams' }, { status: teamsResponse.status });
        }

        const teamsData = await teamsResponse.json();
        const teamsRaw = teamsData?.fantasy_content?.league?.[1]?.teams;

        if (!teamsRaw) {
            return NextResponse.json({ error: 'No teams found' }, { status: 404 });
        }

        const teams: any[] = [];
        
        // Parse teams
        for (const key in teamsRaw) {
            if (key === 'count') continue;
            const teamArr = teamsRaw[key]?.team;
            if (!teamArr) continue;

            const teamInfo: any = {};
            teamArr[0].forEach((item: any) => {
                if (item.team_key) teamInfo.teamKey = item.team_key;
                if (item.name) teamInfo.name = item.name;
                if (item.team_id) teamInfo.teamId = item.team_id;
            });

            if (teamInfo.teamKey) {
                teams.push(teamInfo);
            }
        }

        // Fetch roster for each team
        const rostersPromises = teams.map(async (team) => {
            try {
                const rosterUrl = `https://fantasysports.yahooapis.com/fantasy/v2/team/${team.teamKey}/roster?format=json`;
                const rosterResponse = await fetch(rosterUrl, {
                    headers: { "Authorization": `Bearer ${accessToken}` }
                });

                if (!rosterResponse.ok) {
                    console.error(`Failed to fetch roster for ${team.name}`);
                    return { ...team, roster: [], error: true };
                }

                const rosterData = await rosterResponse.json();
                const playersRaw = rosterData?.fantasy_content?.team?.[1]?.roster?.['0']?.players;

                const roster: any[] = [];
                if (playersRaw) {
                    for (const pKey in playersRaw) {
                        if (pKey === 'count') continue;
                        const playerObj = playersRaw[pKey];
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

                        roster.push({
                            name: fullName,
                            team: findField('editorial_team_abbr') || 'FA',
                            positions: findField('eligible_positions'),
                            status: findField('status')
                        });
                    }
                }

                return { ...team, roster, playerCount: roster.length };
            } catch (error) {
                console.error(`Error fetching roster for ${team.name}:`, error);
                return { ...team, roster: [], error: true };
            }
        });

        const rostersData = await Promise.all(rostersPromises);

        return NextResponse.json({
            success: true,
            leagueKey,
            teams: rostersData,
            totalTeams: teams.length
        });

    } catch (error) {
        console.error('[Yahoo All Rosters] Error:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            detail: String(error) 
        }, { status: 500 });
    }
}
