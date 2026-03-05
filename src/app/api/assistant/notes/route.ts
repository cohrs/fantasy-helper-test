import { NextResponse } from 'next/server';
import { getPlayerNotes, getSelectedLeagueId } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const session = await getServerSession(authOptions);
        const leagueId = await getSelectedLeagueId(session);
        
        const notes = await getPlayerNotes(leagueId);
        return NextResponse.json(notes);
    } catch (err) {
        console.error("Error reading AI notes from database:", err);
        return NextResponse.json({});
    }
}
