import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getDb, getSelectedLeagueKey, getUserId } from '@/lib/db';

const sql = getDb();
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = await getUserId(session);
    const { name, pos, team, leagueKey: bodyLeagueKey } = await request.json();
    if (!name) return NextResponse.json({ error: 'Player name required' }, { status: 400 });

    const leagueKey = bodyLeagueKey || await getSelectedLeagueKey(session);
    if (!leagueKey) return NextResponse.json({ error: 'No league selected' }, { status: 400 });

    const existing = userId
      ? await sql`SELECT id FROM watchlist WHERE league_key = ${leagueKey} AND user_id = ${userId} AND player_name = ${name}`
      : await sql`SELECT id FROM watchlist WHERE league_key = ${leagueKey} AND player_name = ${name}`;
    if (existing.length > 0) return NextResponse.json({ success: false, error: 'Already on watchlist' });

    const maxOrder = userId
      ? await sql`SELECT COALESCE(MAX(sort_order), -1) as max_order FROM watchlist WHERE league_key = ${leagueKey} AND user_id = ${userId}`
      : await sql`SELECT COALESCE(MAX(sort_order), -1) as max_order FROM watchlist WHERE league_key = ${leagueKey}`;
    const nextOrder = (maxOrder[0]?.max_order ?? -1) + 1;

    await sql`
      INSERT INTO watchlist (league_key, user_id, player_name, position, team_abbr, sort_order)
      VALUES (${leagueKey}, ${userId || null}, ${name}, ${pos || 'UTIL'}, ${team || null}, ${nextOrder})
    `;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Watchlist POST] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = await getUserId(session);
    const { name, leagueKey: bodyLeagueKey } = await request.json();
    if (!name) return NextResponse.json({ error: 'Player name required' }, { status: 400 });

    const leagueKey = bodyLeagueKey || await getSelectedLeagueKey(session);
    if (!leagueKey) return NextResponse.json({ error: 'No league selected' }, { status: 400 });

    if (userId) {
      await sql`DELETE FROM watchlist WHERE league_key = ${leagueKey} AND user_id = ${userId} AND player_name = ${name}`;
    } else {
      await sql`DELETE FROM watchlist WHERE league_key = ${leagueKey} AND player_name = ${name}`;
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Watchlist DELETE] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userId = await getUserId(session);
    const { searchParams } = new URL(request.url);
    const leagueKeyParam = searchParams.get('leagueKey');
    const leagueKey = leagueKeyParam || await getSelectedLeagueKey(session);
    if (!leagueKey) return NextResponse.json({ error: 'No league selected' }, { status: 400 });

    const rows = userId
      ? await sql`SELECT player_name FROM watchlist WHERE league_key = ${leagueKey} AND user_id = ${userId} ORDER BY sort_order ASC`
      : await sql`SELECT player_name FROM watchlist WHERE league_key = ${leagueKey} ORDER BY sort_order ASC`;

    return NextResponse.json({ success: true, players: rows.map((r: any) => r.player_name) });
  } catch (error) {
    console.error('[Watchlist GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
