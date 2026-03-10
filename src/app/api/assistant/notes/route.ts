import { NextResponse } from 'next/server';
import { getPlayerNotes, getSelectedLeagueId } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueIdParam = searchParams.get('leagueId');
        const playerName = searchParams.get('playerName');
        
        let leagueId: number | null = null;
        
        if (leagueIdParam) {
            leagueId = parseInt(leagueIdParam);
        } else {
            // Fallback to session-based league selection
            const session = await getServerSession(authOptions);
            leagueId = await getSelectedLeagueId(session);
        }
        
        const notes = await getPlayerNotes(leagueId);
        
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
