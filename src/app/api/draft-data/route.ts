import { NextResponse } from 'next/server';
import { getDraftPicks, getWatchlist, saveWatchlist } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const [draftPicks, watchlist] = await Promise.all([
            getDraftPicks(),
            getWatchlist()
        ]);
        
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
        const { action, rosterData } = await req.json();

        if (action === 'SYNC_ROSTER') {
            await saveWatchlist(rosterData);
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: false, error: "Invalid action" });
    } catch (err) {
        console.error("Error writing to database:", err);
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
    }
}
