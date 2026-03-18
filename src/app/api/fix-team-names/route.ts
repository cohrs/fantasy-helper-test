import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const sql = getDb();

export async function POST() {
    try {
        // Baseball (league_id = 2) - New Jersey Nine
        await sql`
            UPDATE user_leagues 
            SET team_name = 'New Jersey Nine'
            WHERE id = 2
        `;
        
        // Basketball (league_id = 3) - REAL MADRID
        await sql`
            UPDATE user_leagues 
            SET team_name = 'REAL MADRID',
                team_key = '466.l.8873.t.10'
            WHERE id = 3
        `;
        
        // Verify
        const leagues = await sql`
            SELECT id, league_name, sport, team_name 
            FROM user_leagues 
            WHERE id IN (2, 3)
        `;
        
        return NextResponse.json({
            success: true,
            message: 'Team names updated',
            leagues
        });
        
    } catch (error) {
        console.error('Error fixing team names:', error);
        return NextResponse.json({ 
            error: 'Failed to update team names',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
