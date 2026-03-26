import { NextResponse } from 'next/server';
import { getPlayerNotes, getSelectedLeagueKey, getUserId } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueKeyParam = searchParams.get('leagueKey');
        const playerName = searchParams.get('playerName');
        
        const session = await getServerSession(authOptions);
        const userId = await getUserId(session);
        const leagueKey = leagueKeyParam || await getSelectedLeagueKey(session);
        
        const notes = await getPlayerNotes(leagueKey, userId);
        
        if (playerName) {
            const normalizedName = playerName
                .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
                .replace(/[^a-z\s]/g, '').replace(/\s+(jr|sr|ii|iii)$/, '')
                .trim().replace(/\s+/g, '');
            return NextResponse.json({ notes: notes[normalizedName] || null });
        }
        
        return NextResponse.json(notes);
    } catch (err) {
        console.error("Error reading AI notes from database:", err);
        return NextResponse.json({});
    }
}
