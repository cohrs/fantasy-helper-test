import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !(session as any).accessToken) {
            return NextResponse.json({ error: 'Unauthorized. Please connect Yahoo first.' }, { status: 401 });
        }

        const accessToken = (session as any).accessToken;
        const leagueId = process.env.YAHOO_LEAGUE_ID;

        if (!leagueId) {
            return NextResponse.json({ error: 'Yahoo League ID not set in environment variables.' }, { status: 500 });
        }

        const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/mlb.l.${leagueId}/teams;format=json`;

        const response = await fetch(yahooUrl, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${accessToken}`,
                "Content-Type": "application/json",
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("Yahoo API Error:", response.status, errorText);
            return NextResponse.json({ error: `Yahoo API returned ${response.status}: ${errorText}` }, { status: response.status });
        }

        const data = await response.json();

        // Quick parse of the deeply nested Yahoo JSON response
        const leagueData = data?.fantasy_content?.league?.[0];
        const teamsData = data?.fantasy_content?.league?.[1]?.teams;

        let parsedTeams: any[] = [];
        if (teamsData) {
            // Yahoo returns teams as an object with numbered keys (0, 1, 2...) plus a "count" key.
            for (let key in teamsData) {
                if (key !== "count") {
                    const teamArr = teamsData[key].team;
                    if (teamArr && teamArr[0]) {
                        const teamInfo = teamArr[0];
                        // Find name and managers
                        const nameObj = teamInfo.find((t: any) => t.name);
                        const managerObj = teamInfo.find((t: any) => t.managers);

                        if (nameObj) {
                            parsedTeams.push({
                                id: teamInfo.find((t: any) => t.team_id)?.team_id,
                                name: nameObj.name,
                                manager: managerObj?.managers?.[0]?.manager?.nickname || 'Unknown'
                            });
                        }
                    }
                }
            }
        }

        return NextResponse.json({
            success: true,
            leagueData: {
                name: leagueData?.name,
                num_teams: leagueData?.num_teams,
                season: leagueData?.season
            },
            teams: parsedTeams,
            raw: data
        });

    } catch (error) {
        console.error("Error fetching Yahoo League Data:", error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
