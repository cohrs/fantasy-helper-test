import { NextResponse } from 'next/server';
import { getDraftPicks, getWatchlist, saveWatchlist, getSelectedLeagueKey, getUserId } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueKeyParam = searchParams.get('leagueKey');
        
        const session = await getServerSession(authOptions);
        const userId = await getUserId(session);
        const leagueKey = leagueKeyParam || await getSelectedLeagueKey(session);
        
        const [draftPicks, watchlist] = await Promise.all([
            getDraftPicks(leagueKey),
            getWatchlist(leagueKey, userId)
        ]);
        
        const draft = draftPicks.map((pick: any) => ({
            rd: pick.round, pk: pick.pick, name: pick.player_name,
            pos: pick.position, playerTeam: pick.team_abbr,
            tm: pick.drafted_by, isKeeper: pick.is_keeper
        }));
        
        const roster = watchlist.map((item: any) => ({
            id: item.id, name: item.player_name, pos: item.position,
            team: item.team_abbr, adp: item.adp, rationale: item.rationale
        }));
        
        const response = NextResponse.json({ draft, roster });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        return response;
    } catch (err) {
        console.error("Error reading from database:", err);
        const response = NextResponse.json({ draft: [], roster: [] });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        return response;
    }
}

export async function POST(req: Request) {
    try {
        const { action, rosterData, leagueKey: payloadLeagueKey } = await req.json();
        
        const session = await getServerSession(authOptions);
        const userId = await getUserId(session);
        const sessionLeagueKey = await getSelectedLeagueKey(session);
        const finalLeagueKey = payloadLeagueKey || sessionLeagueKey;
        
        if (!finalLeagueKey) {
            return NextResponse.json({ success: false, error: "No league selected" }, { status: 400 });
        }

        if (action === 'SYNC_ROSTER') {
            await saveWatchlist(rosterData, finalLeagueKey, userId);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: false, error: "Invalid action" });
    } catch (err) {
        console.error("Error writing to database:", err);
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
    }
}
