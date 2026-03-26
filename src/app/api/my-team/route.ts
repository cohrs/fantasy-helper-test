import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getDb, getSelectedLeagueKey } from '@/lib/db';

const sql = getDb();

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

    // Get user_id to scope the query
    const session2 = await getServerSession(authOptions);
    const userId = session2?.user?.email
      ? (await sql`SELECT id FROM users WHERE email = ${session2.user.email} LIMIT 1`)[0]?.id
      : null;

    console.log(`⭐ [My Team] Fetching for league key: ${leagueKey}, user_id: ${userId}`);

    // Get user's team name for this league (scoped to user)
    const result = userId
      ? await sql`
          SELECT team_name, team_key, league_name, sport
          FROM user_leagues
          WHERE league_key = ${leagueKey} AND user_id = ${userId}
        `
      : await sql`
          SELECT team_name, team_key, league_name, sport
          FROM user_leagues
          WHERE league_key = ${leagueKey}
          LIMIT 1
        `;

    if (!result.length) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    let teamName = result[0].team_name;
    let teamKey = result[0].team_key;

    // If team_name is null (not yet synced), try to resolve it
    if (!teamName) {
      try {
        const session = await getServerSession(authOptions);
        if (session?.user?.email) {
          const userResult = await sql`
            SELECT yahoo_guid FROM users WHERE email = ${session.user.email} LIMIT 1
          `;
          const yahooGuid = userResult[0]?.yahoo_guid;
          
          if (yahooGuid) {
            // If team_key is set, look up name from rosters
            if (teamKey) {
              const rosterTeam = await sql`
                SELECT DISTINCT team_name FROM team_rosters 
                WHERE league_key = ${leagueKey} AND team_key = ${teamKey} LIMIT 1
              `;
              if (rosterTeam.length) {
                teamName = rosterTeam[0].team_name;
                // Persist it so we don't have to look it up again
                if (userId) {
                  await sql`UPDATE user_leagues SET team_name = ${teamName} WHERE league_key = ${leagueKey} AND user_id = ${userId}`;
                } else {
                  await sql`UPDATE user_leagues SET team_name = ${teamName} WHERE league_key = ${leagueKey}`;
                }
              }
            }
            
            // If still no team_key, try Yahoo API to match by manager GUID
            if (!teamKey) {
              const { getYahooAccessTokenByEmail } = await import('@/lib/yahoo-auth');
              const accessToken = await getYahooAccessTokenByEmail(session.user.email);
              if (accessToken) {
                const teamsUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/teams?format=json`;
                const teamsResp = await fetch(teamsUrl, { headers: { Authorization: `Bearer ${accessToken}` } });
                if (teamsResp.ok) {
                  const teamsData = await teamsResp.json();
                  const teamsRaw = teamsData?.fantasy_content?.league?.[1]?.teams;
                  if (teamsRaw) {
                    for (const k in teamsRaw) {
                      if (k === 'count') continue;
                      const teamArr = teamsRaw[k]?.team;
                      if (!teamArr) continue;
                      let tk = '', tn = '';
                      let isMe = false;
                      teamArr[0].forEach((item: any) => {
                        if (item.team_key) tk = item.team_key;
                        if (item.name) tn = item.name;
                        if (item.managers) {
                          for (const mk in item.managers) {
                            if (mk === 'count') continue;
                            const mgr = item.managers[mk]?.manager;
                            if (mgr?.guid?.toUpperCase() === yahooGuid.toUpperCase()) isMe = true;
                          }
                        }
                      });
                      if (isMe && tk && tn) {
                        teamKey = tk;
                        teamName = tn;
                        if (userId) {
                          await sql`UPDATE user_leagues SET team_key = ${tk}, team_name = ${tn} WHERE league_key = ${leagueKey} AND user_id = ${userId}`;
                        } else {
                          await sql`UPDATE user_leagues SET team_key = ${tk}, team_name = ${tn} WHERE league_key = ${leagueKey}`;
                        }
                        console.log(`⭐ [My Team] Resolved via Yahoo: ${tn} (${tk})`);
                        break;
                      }
                    }
                  }
                }
              }
            }
          }
        }
      } catch (e) {
        console.error('[My Team] Error looking up team:', e);
      }
    }

    return NextResponse.json({
      success: true,
      teamName: teamName || null,
      teamKey: teamKey,
      leagueName: result[0].league_name,
      sport: result[0].sport
    });
  } catch (error) {
    console.error('[My Team] Error:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      detail: String(error)
    }, { status: 500 });
  }
}
