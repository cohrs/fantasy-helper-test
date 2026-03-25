import { NextResponse } from 'next/server';
import { getDraftPicks, getWatchlist, saveWatchlist, getSelectedLeagueKey } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

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
        
        console.log('📊 draft-data GET - leagueKey:', leagueKey);
        
        const [draftPicks, watchlist] = await Promise.all([
            getDraftPicks(leagueKey),
            getWatchlist(leagueKey)
        ]);
        
        console.log('📊 draft-data results - picks:', draftPicks.length, 'watchlist:', watchlist.length);
        
        // Transform database format to match expected format
        const draft = draftPicks.map((pick: any) => ({
            rd: pick.round,
            pk: pick.pick,
            name: pick.player_name,
            pos: pick.position,
            playerTeam: pick.team_abbr,
            tm: pick.drafted_by,
            isKeeper: pick.is_keeper
        }));
        
        const roster = watchlist.map((item: any) => ({
            id: item.id,
            name: item.player_name,
            pos: item.position,
            team: item.team_abbr,
            adp: item.adp,
            rationale: item.rationale
        }));
        
        const response = NextResponse.json({ draft, roster });
        
        // Prevent caching at all levels (browser, CDN, edge)
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        
        return response;
    } catch (err) {
        console.error("Error reading from database:", err);
        const response = NextResponse.json({ draft: [], roster: [] });
        response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
        response.headers.set('Pragma', 'no-cache');
        response.headers.set('Expires', '0');
        return response;
    }
}

export async function POST(req: Request) {
    try {
        const { action, rosterData, leagueKey: payloadLeagueKey } = await req.json();
        
        const session = await getServerSession(authOptions);
        const sessionLeagueKey = await getSelectedLeagueKey(session);
        const finalLeagueKey = payloadLeagueKey || sessionLeagueKey;
        
        if (!finalLeagueKey) {
            return NextResponse.json({ success: false, error: "No league selected" }, { status: 400 });
        }

        if (action === 'SYNC_ROSTER') {
            await saveWatchlist(rosterData, finalLeagueKey);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: false, error: "Invalid action" });
    } catch (err) {
        console.error("Error writing to database:", err);
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
    }
}
