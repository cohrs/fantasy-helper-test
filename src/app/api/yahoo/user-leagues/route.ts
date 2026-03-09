import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.POSTGRES_URL!);

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !(session as any).accessToken) {
            return NextResponse.json({ error: 'Unauthorized. Please connect Yahoo first.' }, { status: 401 });
        }

        const accessToken = (session as any).accessToken;
        
        // Get user's GUID from session
        const userGuid = session.user?.email?.split('@')[0] || 'unknown';

        // Fetch user's leagues from Yahoo
        const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/users;use_login=1/games;game_keys=mlb,nba,nhl,nfl/leagues?format=json`;

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
        
        // Parse Yahoo's nested structure
        const users = data?.fantasy_content?.users;
        const leagues: Array<{
            league_key: string;
            name: string;
            sport: string;
            season: number;
            is_active: boolean;
            current_week?: number;
            team_key?: string;
            team_name?: string;
        }> = [];

        if (users) {
            for (const userKey in users) {
                if (userKey === 'count') continue;
                
                const user = users[userKey]?.user;
                if (!user) continue;

                const games = user[1]?.games;
                if (!games) continue;

                for (const gameKey in games) {
                    if (gameKey === 'count') continue;
                    
                    const game = games[gameKey]?.game;
                    if (!game) continue;

                    const gameLeagues = game[1]?.leagues;
                    if (!gameLeagues) continue;

                    for (const leagueKey in gameLeagues) {
                        if (leagueKey === 'count') continue;
                        
                        const league = gameLeagues[leagueKey]?.league;
                        if (!league || !Array.isArray(league)) continue;

                        // Extract league info
                        const leagueInfo: Record<string, string | number | boolean> = {};
                        league.forEach((item: Record<string, unknown>) => {
                            if (item.league_key) leagueInfo.league_key = item.league_key as string;
                            if (item.name) leagueInfo.name = item.name as string;
                            if (item.season) leagueInfo.season = item.season as number;
                            if (item.game_code) leagueInfo.game_code = item.game_code as string;
                            if (item.current_week) leagueInfo.current_week = item.current_week as number;
                            if (item.is_finished !== undefined) leagueInfo.is_finished = item.is_finished as boolean;
                        });

                        // Try to extract team info if available
                        let teamKey: string | undefined;
                        let teamName: string | undefined;
                        
                        // Yahoo sometimes includes team info in the league response
                        const teamsBlock = league.find((item: any) => item.teams);
                        if (teamsBlock?.teams) {
                            // User's team is usually the first one
                            for (const teamIdx in teamsBlock.teams) {
                                if (teamIdx === 'count') continue;
                                const team = teamsBlock.teams[teamIdx]?.team;
                                if (team && Array.isArray(team)) {
                                    for (const teamItem of team) {
                                        if (teamItem.team_key) teamKey = teamItem.team_key;
                                        if (teamItem.name) teamName = teamItem.name;
                                    }
                                    break; // Take first team (user's team)
                                }
                            }
                        }

                        if (leagueInfo.league_key && leagueInfo.name) {
                            // Map game code to sport
                            const sportMap: Record<string, string> = {
                                'mlb': 'baseball',
                                'nba': 'basketball',
                                'nhl': 'hockey',
                                'nfl': 'football'
                            };
                            
                            leagues.push({
                                league_key: leagueInfo.league_key as string,
                                name: leagueInfo.name as string,
                                sport: sportMap[leagueInfo.game_code as string] || leagueInfo.game_code as string,
                                season: leagueInfo.season as number,
                                is_active: !leagueInfo.is_finished,
                                current_week: leagueInfo.current_week as number | undefined,
                                team_key: teamKey,
                                team_name: teamName
                            });
                        }
                    }
                }
            }
        }

        // Store/update leagues in database
        if (leagues.length > 0) {
            // Ensure user exists
            await sql`
                INSERT INTO users (yahoo_guid, nickname, email)
                VALUES (${userGuid}, ${session.user?.name || 'User'}, ${session.user?.email || ''})
                ON CONFLICT (yahoo_guid) 
                DO UPDATE SET 
                    nickname = ${session.user?.name || 'User'},
                    updated_at = CURRENT_TIMESTAMP
            `;

            // Get user ID
            const userResult = await sql`SELECT id FROM users WHERE yahoo_guid = ${userGuid}`;
            const userId = userResult[0]?.id;

            if (userId) {
                // Upsert leagues
                for (const league of leagues) {
                    await sql`
                        INSERT INTO user_leagues (
                            user_id, league_key, league_name, sport, season, is_active, team_key, team_name
                        )
                        VALUES (
                            ${userId}, ${league.league_key}, ${league.name}, 
                            ${league.sport}, ${league.season}, ${league.is_active},
                            ${league.team_key || null}, ${league.team_name || null}
                        )
                        ON CONFLICT (user_id, league_key)
                        DO UPDATE SET
                            league_name = ${league.name},
                            is_active = ${league.is_active},
                            team_key = ${league.team_key || null},
                            team_name = ${league.team_name || null},
                            updated_at = CURRENT_TIMESTAMP
                    `;
                }
            }
        }

        return NextResponse.json({
            success: true,
            leagues,
            count: leagues.length
        });

    } catch (error) {
        console.error("Error fetching user leagues:", error);
        return NextResponse.json({ 
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
