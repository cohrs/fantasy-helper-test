import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getDb, getSelectedLeagueKey } from '@/lib/db';
import { getYahooAccessToken } from '@/lib/yahoo-auth';

const sql = getDb();
export const dynamic = 'force-dynamic';

// Safe in-season sync: rosters + standings + scoreboard only. NEVER touches draft_picks.
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    let bodyLeagueKey: string | null = null;
    try { const body = await request.json(); bodyLeagueKey = body?.leagueKey || null; } catch {}

    const userResult = await sql`SELECT yahoo_guid, id FROM users WHERE email = ${session.user.email}`;
    if (!userResult.length) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    const yahooGuid = userResult[0].yahoo_guid;
    const userId = userResult[0].id;
    const accessToken = await getYahooAccessToken(yahooGuid);
    if (!accessToken) return NextResponse.json({ error: 'Failed to get Yahoo token. Re-login.' }, { status: 401 });

    const leagueKey = bodyLeagueKey || await getSelectedLeagueKey(session);
    if (!leagueKey) return NextResponse.json({ error: 'No league selected' }, { status: 400 });

    console.log(`🔄 [Season Sync] Starting for league ${leagueKey}...`);
    const results: Record<string, { success: boolean; count: number }> = {};

    // 1. STANDINGS
    try {
      const standingsResp = await fetch(
        `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/standings?format=json`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (standingsResp.ok) {
        const data = await standingsResp.json();
        const teamsRaw = data?.fantasy_content?.league?.[1]?.standings?.[0]?.teams;
        if (teamsRaw) {
          await sql`DELETE FROM standings WHERE league_key = ${leagueKey}`;
          let count = 0, insertOrder = 1;
          for (const key in teamsRaw) {
            if (key === 'count') continue;
            const teamArr = teamsRaw[key]?.team;
            if (!teamArr) continue;
            let teamKey = '', teamName = '', rank = 0, wins = 0, losses = 0, ties = 0, pointsFor = 0, pointsAgainst = 0;
            const statsMap: Record<string, string> = {};
            teamArr[0].forEach((item: any) => { if (item.team_key) teamKey = item.team_key; if (item.name) teamName = item.name; });
            const ts = teamArr[1]?.team_standings;
            if (ts) {
              rank = parseInt(ts.rank) || 0;
              const ot = ts.outcome_totals;
              if (ot) { wins = parseInt(ot.wins) || 0; losses = parseInt(ot.losses) || 0; ties = parseInt(ot.ties) || 0; }
              pointsFor = parseFloat(ts.points_for) || 0;
              pointsAgainst = parseFloat(ts.points_against) || 0;
            }
            if (rank === 0) rank = insertOrder;
            const statsArray = teamArr[1]?.team_stats?.stats || teamArr[1]?.stats;
            if (Array.isArray(statsArray)) {
              for (const s of statsArray) { if (s?.stat?.stat_id) statsMap[String(s.stat.stat_id)] = String(s.stat.value); }
            }
            if (teamKey) {
              await sql`INSERT INTO standings (league_key, team_key, team_name, rank, wins, losses, ties, points_for, points_against, stats_json) VALUES (${leagueKey}, ${teamKey}, ${teamName}, ${rank}, ${wins}, ${losses}, ${ties}, ${pointsFor}, ${pointsAgainst}, ${JSON.stringify(statsMap)})`;
              count++; insertOrder++;
            }
          }
          results.standings = { success: true, count };
          console.log(`✅ [Season Sync] ${count} standings`);
        }
      }
    } catch (e) { console.error('[Season Sync] Standings error:', e); }

    // 2. ALL ROSTERS (with player status for IL tracking)
    try {
      const teamsResp = await fetch(
        `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/teams?format=json`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (teamsResp.ok) {
        const teamsData = await teamsResp.json();
        const teamsRaw = teamsData?.fantasy_content?.league?.[1]?.teams;
        await sql`DELETE FROM team_rosters WHERE league_key = ${leagueKey}`;
        const teams: { teamKey: string; teamName: string }[] = [];
        if (teamsRaw) {
          for (const key in teamsRaw) {
            if (key === 'count') continue;
            const teamArr = teamsRaw[key]?.team;
            if (!teamArr) continue;
            let teamKey = '', teamName = '';
            teamArr[0].forEach((item: any) => { if (item.team_key) teamKey = item.team_key; if (item.name) teamName = item.name; });
            if (teamKey) teams.push({ teamKey, teamName });
          }
        }
        let rosterCount = 0;
        for (const team of teams) {
          try {
            const rosterResp = await fetch(
              `https://fantasysports.yahooapis.com/fantasy/v2/team/${team.teamKey}/roster?format=json`,
              { headers: { Authorization: `Bearer ${accessToken}` } }
            );
            if (rosterResp.ok) {
              const rosterData = await rosterResp.json();
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
                  const fullName = (typeof nameObj === 'object' && nameObj?.full) ? nameObj.full : 'Unknown';
                  const positions = findField('eligible_positions');
                  const eligiblePos = Array.isArray(positions) ? positions.map((p: any) => typeof p === 'object' && p.position ? p.position : p).join(',') : 'UTIL';
                  const selectedPos = playerObj.player[1]?.selected_position?.[1]?.position || null;
                  await sql`INSERT INTO team_rosters (league_key, team_key, team_name, player_name, player_key, position, selected_position, eligible_positions, nba_team, status) VALUES (${leagueKey}, ${team.teamKey}, ${team.teamName}, ${fullName}, ${findField('player_key')}, ${selectedPos || eligiblePos}, ${selectedPos}, ${eligiblePos}, ${findField('editorial_team_abbr') || 'FA'}, ${findField('status') || 'Active'}) ON CONFLICT (league_key, team_key, player_key) DO UPDATE SET position = ${selectedPos || eligiblePos}, selected_position = ${selectedPos}, eligible_positions = ${eligiblePos}, status = ${findField('status') || 'Active'}, nba_team = ${findField('editorial_team_abbr') || 'FA'}`;
                  rosterCount++;
                }
              }
            }
          } catch (e) { console.error(`[Season Sync] Roster error for ${team.teamName}:`, e); }
        }
        results.rosters = { success: true, count: rosterCount };
        console.log(`✅ [Season Sync] ${rosterCount} roster entries across ${teams.length} teams`);

        // Update user's team_name if needed
        const userLeague = await sql`SELECT team_key FROM user_leagues WHERE league_key = ${leagueKey} AND user_id = ${userId}`;
        const userTeamKey = userLeague[0]?.team_key;
        if (userTeamKey) {
          const myTeam = teams.find(t => t.teamKey === userTeamKey);
          if (myTeam) await sql`UPDATE user_leagues SET team_name = ${myTeam.teamName} WHERE league_key = ${leagueKey} AND user_id = ${userId}`;
        }
      }
    } catch (e) { console.error('[Season Sync] Rosters error:', e); }

    // 3. SCOREBOARD / MATCHUPS
    try {
      const scoreResp = await fetch(
        `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/scoreboard?format=json`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (scoreResp.ok) {
        const scoreData = await scoreResp.json();
        const matchupsRaw = scoreData?.fantasy_content?.league?.[1]?.scoreboard?.['0']?.matchups;
        const week = scoreData?.fantasy_content?.league?.[1]?.scoreboard?.week;
        if (matchupsRaw) {
          await sql`DELETE FROM matchups WHERE league_key = ${leagueKey}`;
          let count = 0;
          for (const key in matchupsRaw) {
            if (key === 'count') continue;
            const m = matchupsRaw[key]?.matchup;
            if (!m) continue;
            const teamsInMatchup = m['0']?.teams;
            if (!teamsInMatchup) continue;
            const t1 = teamsInMatchup['0']?.team;
            const t2 = teamsInMatchup['1']?.team;
            if (!t1 || !t2) continue;
            const getName = (t: any) => { let n = ''; t[0].forEach((i: any) => { if (i.name) n = i.name; }); return n; };
            const getKey = (t: any) => { let k = ''; t[0].forEach((i: any) => { if (i.team_key) k = i.team_key; }); return k; };
            const getPoints = (t: any) => t[1]?.team_points?.total || '0';
            await sql`INSERT INTO matchups (league_key, week, team1_key, team1_name, team1_points, team2_key, team2_name, team2_points) VALUES (${leagueKey}, ${week || 1}, ${getKey(t1)}, ${getName(t1)}, ${getPoints(t1)}, ${getKey(t2)}, ${getName(t2)}, ${getPoints(t2)})`;
            count++;
          }
          results.matchups = { success: true, count };
          console.log(`✅ [Season Sync] ${count} matchups for week ${week}`);
        }
      }
    } catch (e) { console.error('[Season Sync] Scoreboard error:', e); }

    console.log(`🎉 [Season Sync] Complete. Draft data preserved.`);
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('[Season Sync] Fatal error:', error);
    return NextResponse.json({ error: 'Sync failed', detail: String(error) }, { status: 500 });
  }
}
