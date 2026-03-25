import { NextResponse } from 'next/server';
import { getPlayerNotes, getSelectedLeagueKey } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueKeyParam = searchParams.get('leagueKey');
        const playerName = searchParams.get('playerName');
        
        let leagueKey: string | null = null;
        
        if (leagueKeyParam) {
            leagueKey = leagueKeyParam;
        } else {
            // Fallback to session-based league selection
            const session = await getServerSession(authOptions);
            leagueKey = await getSelectedLeagueKey(session);
        }
        
        const notes = await getPlayerNotes(leagueKey);
        
        // If requesting a specific player, return just their notes
        if (playerName) {
            const normalizedName = playerName
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z\s]/g, '')
                .replace(/\s+(jr|sr|ii|iii)$/, '')
                .trim()
                .replace(/\s+/g, '');
            
            return NextResponse.json({ 
                notes: notes[normalizedName] || null 
            });
        }
        
        return NextResponse.json(notes);
    } catch (err) {
        console.error("Error reading AI notes from database:", err);
        return NextResponse.json({});
    }
}
