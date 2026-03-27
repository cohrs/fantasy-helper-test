import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getDb } from '@/lib/db';
import { getYahooAccessToken } from '@/lib/yahoo-auth';

const sql = getDb();
export const dynamic = 'force-dynamic';

// GET - Fetch your roster live from Yahoo (with selected_position)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueKey = searchParams.get('leagueKey');
    const teamKeyParam = searchParams.get('teamKey');

    if (!leagueKey) {
      return NextResponse.json({ error: 'leagueKey required' }, { status: 400 });
    }

    // Get access token via yahoo-auth (handles refresh)
    const userResult = await sql`SELECT yahoo_guid FROM users WHERE email = ${session.user.email}`;
    if (!userResult.length) return NextResponse.json({ error: 'User not found' }, { status: 401 });
    const accessToken = await getYahooAccessToken(userResult[0].yahoo_guid);
    if (!accessToken) return NextResponse.json({ error: 'Yahoo token expired. Re-login.' }, { status: 401 });

    // Resolve team key if not provided
    let teamKey = teamKeyParam;
    if (!teamKey) {
      const ul = await sql`SELECT team_key FROM user_leagues WHERE league_key = ${leagueKey} AND user_id = (SELECT id FROM users WHERE email = ${session.user.email}) LIMIT 1`;
      teamKey = ul[0]?.team_key || null;
    }
    if (!teamKey) {
      return NextResponse.json({ error: 'Could not resolve team_key' }, { status: 404 });
    }

    const rosterUrl = `https://fantasysports.yahooapis.com/fantasy/v2/team/${teamKey}/roster?format=json`;
    const rosterResp = await fetch(rosterUrl, { headers: { Authorization: `Bearer ${accessToken}` } });

    if (!rosterResp.ok) {
      const errorText = await rosterResp.text();
      return NextResponse.json({ error: `Yahoo API ${rosterResp.status}`, detail: errorText.substring(0, 500) }, { status: rosterResp.status });
    }

    const rosterData = await rosterResp.json();
    const playersRaw = rosterData?.fantasy_content?.team?.[1]?.roster?.['0']?.players;
    if (!playersRaw) return NextResponse.json({ error: 'No roster data' }, { status: 404 });

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
      const fullName = (typeof nameObj === 'object' && nameObj?.full) ? nameObj.full : 'Unknown';
      const selectedPos = playerObj.player[1]?.selected_position?.[1]?.position || 'BN';
      const positions = findField('eligible_positions');
      const eligiblePos = Array.isArray(positions) ? positions.map((p: any) => typeof p === 'object' && p.position ? p.position : p).join(',') : 'UTIL';

      roster.push({
        playerKey: findField('player_key'),
        name: fullName,
        team: findField('editorial_team_abbr') || 'FA',
        selectedPosition: selectedPos,
        eligiblePositions: eligiblePos,
        status: findField('status') || 'Active',
      });
    }

    return NextResponse.json({ success: true, teamKey, roster });
  } catch (error) {
    console.error('[Yahoo Roster GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', detail: String(error) }, { status: 500 });
  }
}


// POST - Update lineup position (move player to new slot)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { teamKey, playerKey, newPosition, leagueKey } = await request.json();
    if (!teamKey || !playerKey || !newPosition) {
      return NextResponse.json({ error: 'Missing: teamKey, playerKey, newPosition' }, { status: 400 });
    }

    const userResult = await sql`SELECT yahoo_guid FROM users WHERE email = ${session.user.email}`;
    if (!userResult.length) return NextResponse.json({ error: 'User not found' }, { status: 401 });
    const accessToken = await getYahooAccessToken(userResult[0].yahoo_guid);
    if (!accessToken) return NextResponse.json({ error: 'Yahoo token expired. Re-login.' }, { status: 401 });

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

    const updateUrl = `https://fantasysports.yahooapis.com/fantasy/v2/team/${teamKey}/roster`;
    const response = await fetch(updateUrl, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/xml' },
      body: xml
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json({
        error: `Yahoo returned ${response.status}`,
        detail: errorText.substring(0, 500)
      }, { status: response.status });
    }

    // Update local DB to reflect the change immediately
    if (leagueKey && playerKey) {
      await sql`
        UPDATE team_rosters
        SET selected_position = ${newPosition}, position = ${newPosition}
        WHERE league_key = ${leagueKey} AND player_key = ${playerKey}
      `;
    }

    return NextResponse.json({ success: true, message: 'Position updated' });
  } catch (error) {
    console.error('[Yahoo Roster POST] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', detail: String(error) }, { status: 500 });
  }
}
