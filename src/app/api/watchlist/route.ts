import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getDb, getSelectedLeagueKey } from '@/lib/db';

const sql = getDb();
export const dynamic = 'force-dynamic';

// POST - Add a single player to the watchlist
export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, pos, team, leagueKey: bodyLeagueKey } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Player name required' }, { status: 400 });
    }

    const leagueKey = bodyLeagueKey || await getSelectedLeagueKey(session);
    if (!leagueKey) {
      return NextResponse.json({ error: 'No league selected' }, { status: 400 });
    }

    // Check if already on watchlist
    const existing = await sql`
      SELECT id FROM watchlist WHERE league_key = ${leagueKey} AND player_name = ${name}
    `;
    if (existing.length > 0) {
      return NextResponse.json({ success: false, error: 'Already on watchlist' });
    }

    // Get max sort_order
    const maxOrder = await sql`
      SELECT COALESCE(MAX(sort_order), -1) as max_order FROM watchlist WHERE league_key = ${leagueKey}
    `;
    const nextOrder = (maxOrder[0]?.max_order ?? -1) + 1;

    await sql`
      INSERT INTO watchlist (league_key, player_name, position, team_abbr, sort_order)
      VALUES (${leagueKey}, ${name}, ${pos || 'UTIL'}, ${team || null}, ${nextOrder})
    `;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Watchlist POST] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// DELETE - Remove a player from the watchlist
export async function DELETE(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { name, leagueKey: bodyLeagueKey } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Player name required' }, { status: 400 });
    }

    const leagueKey = bodyLeagueKey || await getSelectedLeagueKey(session);
    if (!leagueKey) {
      return NextResponse.json({ error: 'No league selected' }, { status: 400 });
    }

    await sql`DELETE FROM watchlist WHERE league_key = ${leagueKey} AND player_name = ${name}`;

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Watchlist DELETE] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}

// GET - Get all watchlist player names for the current league
export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueKeyParam = searchParams.get('leagueKey');
    const leagueKey = leagueKeyParam || await getSelectedLeagueKey(session);
    if (!leagueKey) {
      return NextResponse.json({ error: 'No league selected' }, { status: 400 });
    }

    const rows = await sql`
      SELECT player_name FROM watchlist WHERE league_key = ${leagueKey} ORDER BY sort_order ASC
    `;

    return NextResponse.json({ success: true, players: rows.map((r: any) => r.player_name) });
  } catch (error) {
    console.error('[Watchlist GET] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
