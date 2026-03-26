import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const sql = getDb();

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueKeyParam = searchParams.get('leagueKey');
        const weekParam = searchParams.get('week');

        if (!leagueKeyParam) {
            return NextResponse.json({ error: 'leagueKey required' }, { status: 400 });
        }

        const leagueKey = leagueKeyParam;

        // Get matchups — latest week if no week specified
        let matchups;
        if (weekParam) {
            matchups = await sql`
                SELECT * FROM matchups WHERE league_key = ${leagueKey} AND week = ${parseInt(weekParam)}
                ORDER BY team1_name ASC
            `;
        } else {
            // Get the most recent week
            const latestWeek = await sql`
                SELECT MAX(week) as week FROM matchups WHERE league_key = ${leagueKey}
            `;
            const week = latestWeek[0]?.week;
            if (!week) return NextResponse.json({ matchups: [], week: null });

            matchups = await sql`
                SELECT * FROM matchups WHERE league_key = ${leagueKey} AND week = ${week}
                ORDER BY team1_name ASC
            `;
        }

        const week = matchups[0]?.week ?? null;
        return NextResponse.json({ success: true, matchups, week });

    } catch (error) {
        console.error('[Scoreboard] Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', detail: String(error) }, { status: 500 });
    }
}
