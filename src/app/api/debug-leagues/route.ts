import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const sql = getDb();

export async function GET() {
    try {
        const leagues = await sql`
            SELECT id, league_name, sport, team_name, team_key, league_key
            FROM user_leagues 
            ORDER BY id
        `;
        
        const selectedLeague = await sql`
            SELECT usl.league_id, ul.league_name, ul.sport, ul.team_name
            FROM user_selected_league usl
            JOIN user_leagues ul ON ul.id = usl.league_id
        `;
        
        return NextResponse.json({
            leagues,
            selectedLeague: selectedLeague[0] || null
        });
        
    } catch (error) {
        console.error('Error:', error);
        return NextResponse.json({ 
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
