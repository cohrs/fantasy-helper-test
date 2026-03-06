import { NextResponse } from 'next/server';
import { getDraftPicks, getWatchlist, saveWatchlist, getSelectedLeagueId } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueIdParam = searchParams.get('leagueId');
        
        let leagueId: number | null = null;
        
        if (leagueIdParam) {
            leagueId = parseInt(leagueIdParam);
        } else {
            // Fallback to session-based league selection
            const session = await getServerSession(authOptions);
            leagueId = await getSelectedLeagueId(session);
        }
        
        console.log('📊 draft-data GET - leagueId:', leagueId);
        
        const [draftPicks, watchlist] = await Promise.all([
            getDraftPicks(leagueId),
            getWatchlist(leagueId)
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
        
        return NextResponse.json({ draft, roster });
    } catch (err) {
        console.error("Error reading from database:", err);
        return NextResponse.json({ draft: [], roster: [] });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getServerSession(authOptions);
        const leagueId = await getSelectedLeagueId(session);
        
        if (!leagueId) {
            return NextResponse.json({ success: false, error: "No league selected" }, { status: 400 });
        }
        
        const { action, rosterData } = await req.json();

        if (action === 'SYNC_ROSTER') {
            await saveWatchlist(rosterData, leagueId);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: false, error: "Invalid action" });
    } catch (err) {
        console.error("Error writing to database:", err);
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
    }
}
