import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getDb } from '@/lib/db';
import { getYahooAccessToken } from '@/lib/yahoo-auth';

const sql = getDb();

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueKeyParam = searchParams.get('leagueKey');
        
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized. Please connect Yahoo first.' }, { status: 401 });
        }

        // Get Yahoo GUID from database using email (not from email prefix)
        const userResult = await sql`SELECT yahoo_guid FROM users WHERE email = ${session.user.email} LIMIT 1`;
        if (!userResult.length) {
            return NextResponse.json({ error: 'User not found. Please re-login.' }, { status: 401 });
        }
        const yahooGuid = userResult[0].yahoo_guid;
        
        // Get valid access token (will refresh if needed)
        const accessToken = await getYahooAccessToken(yahooGuid);
        
        if (!accessToken) {
            return NextResponse.json({ error: 'Failed to get Yahoo access token. Please re-login.' }, { status: 401 });
        }

        let leagueKey: string;
        let sport: string;

        if (leagueKeyParam) {
            // Use provided league key
            const leagueResult = await sql`
                SELECT league_key, sport
                FROM user_leagues
                WHERE league_key = ${leagueKeyParam}
            `;
            
            if (!leagueResult.length) {
                return NextResponse.json({ error: 'League not found' }, { status: 404 });
            }
            
            leagueKey = leagueResult[0].league_key;
            sport = leagueResult[0].sport;
        } else {
            // Fallback to session-based league selection
            const userGuid = session.user?.email?.split('@')[0] || 'unknown';
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

            leagueKey = leagueResult[0].league_key;
            sport = leagueResult[0].sport;
        }

        // Fetch league settings from Yahoo
        const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/settings?format=json`;

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
            return NextResponse.json({ error: `Yahoo API returned ${response.status}` }, { status: response.status });
        }

        const data = await response.json();
        
        // Parse league settings
        const league = data?.fantasy_content?.league;
        if (!league || !Array.isArray(league)) {
            return NextResponse.json({ error: 'Invalid response from Yahoo' }, { status: 500 });
        }

        const settings: any = {
            sport,
            leagueKey,
            name: '',
            numTeams: 0,
            scoringType: '',
            rosterPositions: [],
            statCategories: {
                batting: [],
                pitching: []
            }
        };

        // Extract settings from nested structure
        league.forEach((item: any) => {
            if (item.name) settings.name = item.name;
            if (item.num_teams) settings.numTeams = item.num_teams;
            if (item.scoring_type) settings.scoringType = item.scoring_type;
            
            if (item.settings) {
                const settingsArray = item.settings[0];
                
                // Roster positions
                if (settingsArray.roster_positions) {
                    const positions = settingsArray.roster_positions;
                    for (const key in positions) {
                        if (key === 'count') continue;
                        const pos = positions[key].roster_position;
                        if (pos) {
                            settings.rosterPositions.push({
                                position: pos.position,
                                positionType: pos.position_type || pos.position,
                                count: parseInt(pos.count || '1'),
                                abbreviation: pos.abbreviation || pos.position
                            });
                        }
                    }
                }

                // Stat categories
                if (settingsArray.stat_categories) {
                    const statCats = settingsArray.stat_categories;
                    if (statCats.stats) {
                        const stats = statCats.stats;
                        for (const key in stats) {
                            if (key === 'count') continue;
                            const stat = stats[key].stat;
                            if (stat) {
                                const statInfo = {
                                    statId: stat.stat_id,
                                    name: stat.name,
                                    displayName: stat.display_name,
                                    sortOrder: stat.sort_order,
                                    positionType: stat.position_type
                                };
                                
                                if (sport === 'baseball') {
                                    if (stat.position_type === 'B') {
                                        settings.statCategories.batting.push(statInfo);
                                    } else if (stat.position_type === 'P') {
                                        settings.statCategories.pitching.push(statInfo);
                                    }
                                } else {
                                    // For basketball/other sports, just add to a general array
                                    if (!settings.statCategories.stats) {
                                        settings.statCategories.stats = [];
                                    }
                                    settings.statCategories.stats.push(statInfo);
                                }
                            }
                        }
                    }
                }
            }
        });

        return NextResponse.json({
            success: true,
            settings
        });

    } catch (error) {
        console.error("Error fetching league settings:", error);
        return NextResponse.json({ 
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
