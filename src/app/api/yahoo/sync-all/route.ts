import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getDb, getSelectedLeagueKey } from '@/lib/db';
import { getYahooAccessToken } from '@/lib/yahoo-auth';

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

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Accept leagueKey from request body (client knows it from localStorage)
        let bodyLeagueKey: string | null = null;
        try {
            const body = await request.json();
            bodyLeagueKey = body?.leagueKey || null;
        } catch {}

        // Get Yahoo GUID from database using email
        const userResult = await sql`
            SELECT yahoo_guid FROM users WHERE email = ${session.user.email}
        `;

        if (!userResult.length) {
            return NextResponse.json({ error: 'User not found in database. Please re-login.' }, { status: 401 });
        }

        const yahooGuid = userResult[0].yahoo_guid;
        
        // Get valid access token (will refresh if needed)
        const accessToken = await getYahooAccessToken(yahooGuid);
        
        if (!accessToken) {
            return NextResponse.json({ error: 'Failed to get Yahoo access token. Please re-login.' }, { status: 401 });
        }

        const leagueKey = bodyLeagueKey || await getSelectedLeagueKey(session);
        
        if (!leagueKey) {
            return NextResponse.json({ error: 'No league selected' }, { status: 400 });
        }

        // Get league info
        const leagueResult = await sql`
            SELECT league_key, sport FROM user_leagues WHERE league_key = ${leagueKey}
        `;

        if (!leagueResult.length) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

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
                    await sql`DELETE FROM draft_picks WHERE league_key = ${leagueKey}`;
                    
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
                                        league_key, round, pick, player_name, position, 
                                        team_abbr, drafted_by, is_keeper
                                    )
                                    VALUES (
                                        ${leagueKey},
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
                    // Create standings table if it doesn't exist (with stats_json for category data)
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
                            stats_json JSONB,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(league_id, team_key)
                        )
                    `;
                    // Add stats_json column if it doesn't exist (for existing tables)
                    await sql`ALTER TABLE standings ADD COLUMN IF NOT EXISTS stats_json JSONB`;

                    await sql`DELETE FROM standings WHERE league_key = ${leagueKey}`;

                    let standingsCount = 0;
                    let insertOrder = 1; // Yahoo returns roto teams in rank order
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
                        let pointsFor = 0;
                        let pointsAgainst = 0;
                        const statsMap: Record<string, string> = {};

                        teamArr[0].forEach((item: any) => {
                            if (item.team_key) teamKey = item.team_key;
                            if (item.name) teamName = item.name;
                        });

                        const teamStandings = teamArr[1]?.team_standings;
                        if (teamStandings) {
                            rank = parseInt(teamStandings.rank) || 0;
                            const outcome = teamStandings.outcome_totals;
                            if (outcome) {
                                wins = parseInt(outcome.wins) || 0;
                                losses = parseInt(outcome.losses) || 0;
                                ties = parseInt(outcome.ties) || 0;
                            }
                            pointsFor = parseFloat(teamStandings.points_for) || 0;
                            pointsAgainst = parseFloat(teamStandings.points_against) || 0;
                        }

                        // For roto leagues rank comes from points_total or insertion order
                        if (rank === 0) {
                            // Try points_total (roto scoring)
                            const pointsTotal = teamArr[1]?.team_points?.total || teamArr[1]?.team_standings?.points_total;
                            if (pointsTotal) {
                                pointsFor = parseFloat(pointsTotal) || 0;
                            }
                            rank = insertOrder; // Yahoo returns in rank order
                        }

                        // Capture category stats — check multiple locations in Yahoo response
                        const teamStatsObj = teamArr[1]?.team_stats;
                        const statsArray = teamStatsObj?.stats || teamArr[1]?.stats;
                        if (Array.isArray(statsArray)) {
                            for (const statEntry of statsArray) {
                                const stat = statEntry?.stat;
                                if (stat?.stat_id && stat?.value !== undefined) {
                                    statsMap[String(stat.stat_id)] = String(stat.value);
                                }
                            }
                        }

                        if (teamKey) {
                            await sql`
                                INSERT INTO standings (
                                    league_key, team_key, team_name, rank, wins, losses, ties,
                                    points_for, points_against, stats_json
                                )
                                VALUES (
                                    ${leagueKey}, ${teamKey}, ${teamName}, ${rank}, ${wins}, ${losses}, ${ties},
                                    ${pointsFor}, ${pointsAgainst}, ${JSON.stringify(statsMap)}
                                )
                            `;
                            standingsCount++;
                            insertOrder++;
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

                await sql`DELETE FROM team_rosters WHERE league_key = ${leagueKey}`;

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
                                            league_key, team_key, team_name, player_name, player_key,
                                            position, nba_team, status
                                        )
                                        VALUES (
                                            ${leagueKey}, ${team.teamKey}, ${team.teamName}, ${fullName},
                                            ${findField('player_key')}, ${position},
                                            ${findField('editorial_team_abbr') || 'FA'},
                                            ${findField('status') || 'Active'}
                                        )
                                        ON CONFLICT (league_key, team_key, player_key) DO NOTHING
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

                // Update team_name on the league record
                // First try: match by stored team_key
                const userTeamResult = await sql`SELECT team_key FROM user_leagues WHERE league_key = ${leagueKey}`;
                const userTeamKey = userTeamResult[0]?.team_key;
                if (userTeamKey) {
                    const myTeam = teams.find(t => t.teamKey === userTeamKey);
                    if (myTeam) {
                        await sql`UPDATE user_leagues SET team_name = ${myTeam.teamName} WHERE league_key = ${leagueKey}`;
                        console.log(`✅ Updated team_name to "${myTeam.teamName}" for league ${leagueKey}`);
                    }
                } else {
                    // Second try: fetch league teams with manager info to match by Yahoo GUID
                    try {
                        const teamsWithMgrUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/teams?format=json`;
                        const teamsWithMgrResp = await fetch(teamsWithMgrUrl, { headers: { "Authorization": `Bearer ${accessToken}` } });
                        if (teamsWithMgrResp.ok) {
                            const teamsWithMgrData = await teamsWithMgrResp.json();
                            const teamsWithMgrRaw = teamsWithMgrData?.fantasy_content?.league?.[1]?.teams;
                            
                            // Get the user's Yahoo GUID from DB
                            const userGuidResult = await sql`SELECT yahoo_guid FROM users WHERE email = (SELECT email FROM users WHERE yahoo_guid IS NOT NULL LIMIT 1)`;
                            const yahooGuid = userGuidResult[0]?.yahoo_guid;
                            
                            if (teamsWithMgrRaw && yahooGuid) {
                                for (const tk in teamsWithMgrRaw) {
                                    if (tk === 'count') continue;
                                    const teamArr = teamsWithMgrRaw[tk]?.team;
                                    if (!teamArr) continue;
                                    
                                    let tKey = '', tName = '';
                                    let isMyTeam = false;
                                    
                                    teamArr[0].forEach((item: any) => {
                                        if (item.team_key) tKey = item.team_key;
                                        if (item.name) tName = item.name;
                                        // Check managers array for matching GUID
                                        if (item.managers) {
                                            for (const mk in item.managers) {
                                                if (mk === 'count') continue;
                                                const mgr = item.managers[mk]?.manager;
                                                if (mgr?.guid === yahooGuid || mgr?.guid?.toLowerCase() === yahooGuid?.toLowerCase()) {
                                                    isMyTeam = true;
                                                }
                                            }
                                        }
                                    });
                                    
                                    if (isMyTeam && tKey && tName) {
                                        await sql`UPDATE user_leagues SET team_key = ${tKey}, team_name = ${tName} WHERE league_key = ${leagueKey}`;
                                        console.log(`✅ Found user team by GUID: "${tName}" (${tKey})`);
                                        break;
                                    }
                                }
                            }
                        }
                    } catch (err) {
                        console.error('Error finding user team by GUID:', err);
                    }
                }
            }
        } catch (error) {
            console.error('Error syncing rosters:', error);
        }

        // 4. SCOREBOARD (current week matchups)
        try {
            console.log('🏀 Fetching scoreboard...');
            const scoreboardUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/scoreboard?format=json`;
            const scoreboardResp = await fetch(scoreboardUrl, {
                headers: { "Authorization": `Bearer ${accessToken}` }
            });

            if (scoreboardResp.ok) {
                const scoreboardData = await scoreboardResp.json();
                const matchupsRaw = scoreboardData?.fantasy_content?.league?.[1]?.scoreboard?.['0']?.matchups;

                if (matchupsRaw) {
                    await sql`
                        CREATE TABLE IF NOT EXISTS matchups (
                            id SERIAL PRIMARY KEY,
                            league_id INT NOT NULL REFERENCES user_leagues(id) ON DELETE CASCADE,
                            week INT NOT NULL,
                            team1_key VARCHAR(255),
                            team1_name VARCHAR(255),
                            team1_points DECIMAL,
                            team1_wins INT DEFAULT 0,
                            team1_losses INT DEFAULT 0,
                            team1_ties INT DEFAULT 0,
                            team2_key VARCHAR(255),
                            team2_name VARCHAR(255),
                            team2_points DECIMAL,
                            team2_wins INT DEFAULT 0,
                            team2_losses INT DEFAULT 0,
                            team2_ties INT DEFAULT 0,
                            is_playoffs BOOLEAN DEFAULT false,
                            updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                            UNIQUE(league_id, week, team1_key, team2_key)
                        )
                    `;

                    // Get current week from scoreboard
                    const weekNum = parseInt(scoreboardData?.fantasy_content?.league?.[0]?.current_week || '1');
                    await sql`DELETE FROM matchups WHERE league_key = ${leagueKey} AND week = ${weekNum}`;

                    let matchupCount = 0;
                    for (const mk in matchupsRaw) {
                        if (mk === 'count') continue;
                        const matchup = matchupsRaw[mk]?.matchup;
                        if (!matchup) continue;

                        const week = parseInt(matchup.week || weekNum);
                        const isPlayoffs = matchup.is_playoffs === '1';
                        const teamsInMatchup = matchup['0']?.teams;
                        if (!teamsInMatchup) continue;

                        const teams: any[] = [];
                        for (const tk in teamsInMatchup) {
                            if (tk === 'count') continue;
                            const teamArr = teamsInMatchup[tk]?.team;
                            if (!teamArr) continue;

                            let teamKey = '', teamName = '';
                            let points = 0, wins = 0, losses = 0, ties = 0;

                            teamArr[0].forEach((item: any) => {
                                if (item.team_key) teamKey = item.team_key;
                                if (item.name) teamName = item.name;
                            });

                            const teamPoints = teamArr[1]?.team_points;
                            if (teamPoints) points = parseFloat(teamPoints.total || '0');

                            const teamStats = teamArr[1]?.team_standings;
                            if (teamStats?.outcome_totals) {
                                wins = parseInt(teamStats.outcome_totals.wins || '0');
                                losses = parseInt(teamStats.outcome_totals.losses || '0');
                                ties = parseInt(teamStats.outcome_totals.ties || '0');
                            }

                            teams.push({ teamKey, teamName, points, wins, losses, ties });
                        }

                        if (teams.length === 2) {
                            await sql`
                                INSERT INTO matchups (
                                    league_key, week,
                                    team1_key, team1_name, team1_points, team1_wins, team1_losses, team1_ties,
                                    team2_key, team2_name, team2_points, team2_wins, team2_losses, team2_ties,
                                    is_playoffs
                                ) VALUES (
                                    ${leagueKey}, ${week},
                                    ${teams[0].teamKey}, ${teams[0].teamName}, ${teams[0].points}, ${teams[0].wins}, ${teams[0].losses}, ${teams[0].ties},
                                    ${teams[1].teamKey}, ${teams[1].teamName}, ${teams[1].points}, ${teams[1].wins}, ${teams[1].losses}, ${teams[1].ties},
                                    ${isPlayoffs}
                                )
                                ON CONFLICT (league_key, week, team1_key, team2_key) DO UPDATE SET
                                    team1_points = EXCLUDED.team1_points,
                                    team2_points = EXCLUDED.team2_points,
                                    updated_at = CURRENT_TIMESTAMP
                            `;
                            matchupCount++;
                        }
                    }

                    results.schedule = { success: true, count: matchupCount, week: weekNum };
                    console.log(`✅ Saved ${matchupCount} matchups for week ${weekNum}`);
                }
            }
        } catch (error) {
            console.error('Error syncing scoreboard:', error);
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
