import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getDb } from '@/lib/db';
import { getYahooAccessToken } from '@/lib/yahoo-auth';

const sql = getDb();
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const leagueIdParam = searchParams.get('leagueId');
    if (!leagueIdParam) return NextResponse.json({ error: 'leagueId required' }, { status: 400 });

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userResult = await sql`SELECT yahoo_guid FROM users WHERE email = ${session.user.email} LIMIT 1`;
    if (!userResult.length) return NextResponse.json({ error: 'User not found' }, { status: 401 });

    const accessToken = await getYahooAccessToken(userResult[0].yahoo_guid);
    if (!accessToken) return NextResponse.json({ error: 'No access token' }, { status: 401 });

    const leagueResult = await sql`SELECT league_key FROM user_leagues WHERE id = ${parseInt(leagueIdParam)}`;
    if (!leagueResult.length) return NextResponse.json({ error: 'League not found' }, { status: 404 });

    const leagueKey = leagueResult[0].league_key;
    const url = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/standings?format=json`;
    const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
    const raw = await resp.json();

    // Return the raw structure so we can see exactly what Yahoo sends
    return NextResponse.json({ raw, leagueKey });
}
