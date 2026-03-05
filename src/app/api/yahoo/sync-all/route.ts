import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getDb, getSelectedLeagueId } from '@/lib/db';

const sql = getDb();

export const dynamic = 'force-dynamic';

// Normalize team names for consistent matching
function normalizeTeamName(name: string): string {
  return name
    .toLowerCase()
    .replace(/^the\s+/i, '') // Remove "The" prefix
    .replace(/[^a-z0-9]/g, '') // Remove special chars and spaces
    .trim();
}

export async function POST() {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !(session as any).accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessToken = (session as any).accessToken;
        const leagueId = await getSelectedLeagueId(session);
        
        if (!leagueId) {
            return NextResponse.json({ error: 'No league selected' }, { status: 400 });
        }

        // Get league key
        const leagueResult = await sql`
            SELECT league_key, sport FROM user_leagues WHERE id = ${leagueId}
        `;

        if (!leagueResult.length) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        const leagueKey = leagueResult[0].league_key;
        const sport = leagueResult[0].sport;

        console.log(`🔄 Syncing all data from Yahoo for ${sport} league ${leagueKey}...`);

        const results: any = {
            draft: { success: false, count: 0 },
            standings: { success: false, count: 0 },
            rosters: { success: false, count: 0 },
            schedule: { success: false, count: 0 }
        };

        // 1. DRAFT RESULTS
        try {
            console.log('📥 Fetching draft results...');
            const draftUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/draftresults?format=json`;
            const draftResponse = await fetch(draftUrl, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });

            if (draftResponse.ok) {
                const draftData = await draftResponse.json();
                const draftResults = draftData?.fantasy_content?.league?.[1]?.draft_results;

                if (draftResults) {
                    // Get team names
                    const teamsUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/teams?format=json`;
                    const teamsResponse = await fetch(teamsUrl, {
                        headers: { "Authorization": `Bearer ${accessToken}` }
                    });

                    const teamsData = await teamsResponse.json();
                    const teamsRaw = teamsData?.fantasy_content?.league?.[1]?.teams;

                    const teamMap: Record<string, string> = {};
                    if (teamsRaw) {
                        for (const key in teamsRaw) {
                            if (key === 'count') continue;
                            const teamArr = teamsRaw[key]?.team;
                            if (!teamArr) continue;

                            let teamKey = '';
                            let teamName = '';
                            teamArr[0].forEach((item: any) => {
                                if (item.team_key) teamKey = item.team_key;
                                if (item.name) teamName = item.name;
                            });

                            if (teamKey && teamName) {
                                teamMap[teamKey] = teamName;
                            }
                        }
                    }

                    // Parse and save draft picks with actual player names
                    await sql`DELETE FROM draft_picks WHERE league_id = ${leagueId}`;
                    
                    let inserted = 0;
                    const pickPromises = [];
                    
                    for (const key in draftResults) {
                        if (key === 'count') continue;
                        const pick = draftResults[key]?.draft_result;
                        if (!pick) continue;

                        pickPromises.push((async () => {
                            try {
                                // Fetch player details
                                const playerUrl = `https://fantasysports.yahooapis.com/fantasy/v2/player/${pick.player_key}?format=json`;
                                const playerResponse = await fetch(playerUrl, {
                                    headers: { "Authorization": `Bearer ${accessToken}` }
                                });

                                let playerName = 'Unknown';
                                let position = 'UTIL';
                                let team = 'FA';

                                if (playerResponse.ok) {
                                    const playerData = await playerResponse.json();
                                    const playerInfo = playerData?.fantasy_content?.player?.[0];

                                    if (playerInfo) {
                                        const findField = (fieldKey: string) => {
                                            for (const item of playerInfo) {
                                                if (typeof item === 'object' && item !== null && fieldKey in item) return item[fieldKey];
                                            }
                                            return null;
                                        };

                                        const nameObj = findField('name');
                                        playerName = (typeof nameObj === 'object' && nameObj?.full)
                                            ? nameObj.full
                                            : (nameObj?.first && nameObj?.last ? `${nameObj.first} ${nameObj.last}` : 'Unknown');

                                        const positions = findField('eligible_positions');
                                        position = Array.isArray(positions) 
                                            ? positions.map((p: any) => typeof p === 'object' && p.position ? p.position : p).join(',')
                                            : 'UTIL';

                                        team = findField('editorial_team_abbr') || 'FA';
                                    }
                                }

                                await sql`
                                    INSERT INTO draft_picks (
                                        league_id, round, pick, player_name, position, 
                                        team_abbr, drafted_by, is_keeper
                                    )
                                    VALUES (
                                        ${leagueId},
                                        ${parseInt(pick.round)},
                                        ${parseInt(pick.pick)},
                                        ${playerName},
                                        ${position},
                                        ${team},
                                        ${teamMap[pick.team_key] || 'Unknown'},
                                        false
                                    )
                                `;
                                inserted++;
                            } catch (error) {
                                console.error(`Error processing pick ${pick.pick}:`, error);
                            }
                        })());
                    }

                    // Process in batches of 10 to avoid rate limiting
                    for (let i = 0; i < pickPromises.length; i += 10) {
                        await Promise.all(pickPromises.slice(i, i + 10));
                    }

                    results.draft = { success: true, count: inserted };
                    console.log(`✅ Saved ${inserted} draft picks with player details`);
                }
            }
        } catch (error) {
            console.error('Error syncing draft:', error);
        }

        // 2. STANDINGS
        try {
            console.log('📊 Fetching standings...');
            const standingsUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/standings?format=json`;
            const standingsResponse = await fetch(standingsUrl, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });

            if (standingsResponse.ok) {
                const standingsData = await standingsResponse.json();
                const teamsRaw = standingsData?.fantasy_content?.league?.[1]?.standings?.[0]?.teams;

                if (teamsRaw) {
                    // Create standings table if it doesn't exist
                    await sql`
                        CREATE TABLE IF NOT EXISTS standings (
                            id SERIAL PRIMARY KEY,
                            league_id INT NOT NULL REFERENCES user_leagues(id) ON DELETE CASCADE,
                            team_key VARCHAR(255) NOT NULL,
                            team_name VARCHAR(255) NOT NULL,
                            rank INT,
                            wins INT,
                            losses INT,
                            ties INT,
                            points_for DECIMAL,
                            points_against DECIMAL,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(league_id, team_key)
                        )
                    `;

                    await sql`DELETE FROM standings WHERE league_id = ${leagueId}`;

                    let standingsCount = 0;
                    for (const key in teamsRaw) {
                        if (key === 'count') continue;
                        const teamArr = teamsRaw[key]?.team;
                        if (!teamArr) continue;

                        let teamKey = '';
                        let teamName = '';
                        let rank = 0;
                        let wins = 0;
                        let losses = 0;
                        let ties = 0;

                        teamArr[0].forEach((item: any) => {
                            if (item.team_key) teamKey = item.team_key;
                            if (item.name) teamName = item.name;
                        });

                        const standings = teamArr[1]?.team_standings;
                        if (standings) {
                            rank = parseInt(standings.rank) || 0;
                            const outcome = standings.outcome_totals;
                            if (outcome) {
                                wins = parseInt(outcome.wins) || 0;
                                losses = parseInt(outcome.losses) || 0;
                                ties = parseInt(outcome.ties) || 0;
                            }
                        }

                        if (teamKey) {
                            await sql`
                                INSERT INTO standings (
                                    league_id, team_key, team_name, rank, wins, losses, ties
                                )
                                VALUES (
                                    ${leagueId}, ${teamKey}, ${teamName}, ${rank}, ${wins}, ${losses}, ${ties}
                                )
                            `;
                            standingsCount++;
                        }
                    }

                    results.standings = { success: true, count: standingsCount };
                    console.log(`✅ Saved ${standingsCount} team standings`);
                }
            }
        } catch (error) {
            console.error('Error syncing standings:', error);
        }

        // 3. ALL ROSTERS
        try {
            console.log('👥 Fetching all rosters...');
            const teamsUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/teams?format=json`;
            const teamsResponse = await fetch(teamsUrl, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });

            if (teamsResponse.ok) {
                const teamsData = await teamsResponse.json();
                const teamsRaw = teamsData?.fantasy_content?.league?.[1]?.teams;

                // Create rosters table if it doesn't exist
                await sql`
                    CREATE TABLE IF NOT EXISTS team_rosters (
                        id SERIAL PRIMARY KEY,
                        league_id INT NOT NULL REFERENCES user_leagues(id) ON DELETE CASCADE,
                        team_key VARCHAR(255) NOT NULL,
                        team_name VARCHAR(255) NOT NULL,
                        player_name VARCHAR(255) NOT NULL,
                        player_key VARCHAR(255),
                        position VARCHAR(50),
                        nba_team VARCHAR(50),
                        status VARCHAR(50),
                        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        UNIQUE(league_id, team_key, player_key)
                    )
                `;

                await sql`DELETE FROM team_rosters WHERE league_id = ${leagueId}`;

                let rosterCount = 0;
                const teams: any[] = [];

                // Get team keys
                if (teamsRaw) {
                    for (const key in teamsRaw) {
                        if (key === 'count') continue;
                        const teamArr = teamsRaw[key]?.team;
                        if (!teamArr) continue;

                        let teamKey = '';
                        let teamName = '';
                        teamArr[0].forEach((item: any) => {
                            if (item.team_key) teamKey = item.team_key;
                            if (item.name) teamName = item.name;
                        });

                        if (teamKey) {
                            teams.push({ teamKey, teamName });
                        }
                    }
                }

                // Fetch each team's roster
                for (const team of teams) {
                    try {
                        const rosterUrl = `https://fantasysports.yahooapis.com/fantasy/v2/team/${team.teamKey}/roster?format=json`;
                        const rosterResponse = await fetch(rosterUrl, {
                            headers: { "Authorization": `Bearer ${accessToken}` }
                        });

                        if (rosterResponse.ok) {
                            const rosterData = await rosterResponse.json();
                            const playersRaw = rosterData?.fantasy_content?.team?.[1]?.roster?.['0']?.players;

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

                                    const positions = findField('eligible_positions');
                                    const position = Array.isArray(positions) 
                                        ? positions.map((p: any) => typeof p === 'object' && p.position ? p.position : p).join(',')
                                        : 'UTIL';

                                    await sql`
                                        INSERT INTO team_rosters (
                                            league_id, team_key, team_name, player_name, player_key,
                                            position, nba_team, status
                                        )
                                        VALUES (
                                            ${leagueId}, ${team.teamKey}, ${team.teamName}, ${fullName},
                                            ${findField('player_key')}, ${position},
                                            ${findField('editorial_team_abbr') || 'FA'},
                                            ${findField('status') || 'Active'}
                                        )
                                        ON CONFLICT (league_id, team_key, player_key) DO NOTHING
                                    `;
                                    rosterCount++;
                                }
                            }
                        }
                    } catch (error) {
                        console.error(`Error fetching roster for ${team.teamName}:`, error);
                    }
                }

                results.rosters = { success: true, count: rosterCount };
                console.log(`✅ Saved ${rosterCount} roster entries`);
            }
        } catch (error) {
            console.error('Error syncing rosters:', error);
        }

        console.log('🎉 Yahoo sync complete!');

        return NextResponse.json({
            success: true,
            results,
            message: 'Successfully synced all data from Yahoo'
        });

    } catch (error) {
        console.error('[Yahoo Sync All] Error:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            detail: String(error) 
        }, { status: 500 });
    }
}
