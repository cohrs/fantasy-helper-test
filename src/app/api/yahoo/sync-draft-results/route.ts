import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getDb, getSelectedLeagueId } from '@/lib/db';

const sql = getDb();

export const dynamic = 'force-dynamic';

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

        const userGuid = session.user?.email?.split('@')[0] || 'unknown';

        // Get league key
        const leagueResult = await sql`
            SELECT league_key, sport FROM user_leagues WHERE id = ${leagueId}
        `;

        if (!leagueResult.length) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        const leagueKey = leagueResult[0].league_key;
        const sport = leagueResult[0].sport;

        console.log(`📥 Fetching draft results from Yahoo for ${sport} league ${leagueKey}...`);

        // Fetch draft results from Yahoo
        const draftUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/draftresults?format=json`;
        const draftResponse = await fetch(draftUrl, {
            headers: { "Authorization": `Bearer ${accessToken}` }
        });

        if (!draftResponse.ok) {
            const errorText = await draftResponse.text();
            console.error('Yahoo API Error:', draftResponse.status, errorText);
            return NextResponse.json({ 
                error: `Yahoo API returned ${draftResponse.status}`,
                detail: errorText.substring(0, 500)
            }, { status: draftResponse.status });
        }

        const draftData = await draftResponse.json();
        const draftResults = draftData?.fantasy_content?.league?.[1]?.draft_results;

        if (!draftResults) {
            return NextResponse.json({ error: 'No draft results found' }, { status: 404 });
        }

        // Fetch team names to map team_key to team name
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

        console.log(`📋 Found ${Object.keys(teamMap).length} teams`);

        // Parse draft results
        const picks: any[] = [];
        for (const key in draftResults) {
            if (key === 'count') continue;
            const pick = draftResults[key]?.draft_result;
            if (!pick) continue;

            picks.push({
                pick: parseInt(pick.pick),
                round: parseInt(pick.round),
                teamKey: pick.team_key,
                teamName: teamMap[pick.team_key] || 'Unknown',
                playerKey: pick.player_key
            });
        }

        console.log(`📊 Found ${picks.length} draft picks`);

        // Fetch player details for each pick
        const playerDetailsPromises = picks.map(async (pick) => {
            try {
                const playerUrl = `https://fantasysports.yahooapis.com/fantasy/v2/player/${pick.playerKey}?format=json`;
                const playerResponse = await fetch(playerUrl, {
                    headers: { "Authorization": `Bearer ${accessToken}` }
                });

                if (!playerResponse.ok) {
                    console.error(`Failed to fetch player ${pick.playerKey}`);
                    return { ...pick, name: 'Unknown', position: 'UTIL', team: 'FA' };
                }

                const playerData = await playerResponse.json();
                const playerInfo = playerData?.fantasy_content?.player?.[0];

                if (!playerInfo) {
                    return { ...pick, name: 'Unknown', position: 'UTIL', team: 'FA' };
                }

                const findField = (fieldKey: string) => {
                    for (const item of playerInfo) {
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

                return {
                    ...pick,
                    name: fullName,
                    position,
                    team: findField('editorial_team_abbr') || 'FA'
                };
            } catch (error) {
                console.error(`Error fetching player ${pick.playerKey}:`, error);
                return { ...pick, name: 'Unknown', position: 'UTIL', team: 'FA' };
            }
        });

        const detailedPicks = await Promise.all(playerDetailsPromises);

        console.log(`💾 Saving ${detailedPicks.length} picks to database...`);

        // Clear existing draft picks for this league
        await sql`DELETE FROM draft_picks WHERE league_id = ${leagueId}`;

        // Insert new picks
        let inserted = 0;
        for (const pick of detailedPicks) {
            try {
                await sql`
                    INSERT INTO draft_picks (
                        league_id, round, pick, player_name, position, 
                        team_abbr, drafted_by, is_keeper
                    )
                    VALUES (
                        ${leagueId},
                        ${pick.round},
                        ${pick.pick},
                        ${pick.name},
                        ${pick.position},
                        ${pick.team},
                        ${pick.teamName},
                        false
                    )
                `;
                inserted++;
            } catch (error) {
                console.error(`Error inserting pick ${pick.pick}:`, error);
            }
        }

        console.log(`✅ Inserted ${inserted} draft picks`);

        return NextResponse.json({
            success: true,
            totalPicks: detailedPicks.length,
            inserted,
            message: `Synced ${inserted} draft picks from Yahoo`,
            samplePicks: detailedPicks.slice(0, 5)
        });

    } catch (error) {
        console.error('[Yahoo Sync Draft] Error:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            detail: String(error) 
        }, { status: 500 });
    }
}
