import { NextResponse } from 'next/server';
import { savePlayerStats } from '@/lib/db';

// This endpoint migrates stats from the static JSON file to the database
// Call it once after deployment to populate the database
export async function POST(request: Request) {
    try {
        // Check for a secret key to prevent unauthorized access
        const { secret } = await request.json();
        
        if (secret !== process.env.NEXTAUTH_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Import the stats JSON file
        const YAHOO_STATS_DATA = await import('../../../../yahoo-stats.json');
        const players = YAHOO_STATS_DATA.default?.players || YAHOO_STATS_DATA.players || [];
        
        if (players.length === 0) {
            return NextResponse.json({ 
                error: 'No players found in yahoo-stats.json' 
            }, { status: 400 });
        }
        
        // Save to database
        await savePlayerStats(players, 2025);
        
        return NextResponse.json({ 
            success: true,
            message: `Migrated ${players.length} player stats for 2025 season`,
            count: players.length
        });
        
    } catch (error) {
        console.error('Stats migration error:', error);
        return NextResponse.json({ 
            error: 'Migration failed', 
            detail: String(error) 
        }, { status: 500 });
    }
}

// GET endpoint to check migration status
export async function GET() {
    try {
        const { getDb } = await import('@/lib/db');
        const sql = getDb();
        
        const result = await sql`SELECT COUNT(*) as count FROM player_stats WHERE season = 2025`;
        const count = result[0]?.count || 0;
        
        return NextResponse.json({
            success: true,
            statsCount: parseInt(count),
            message: count > 0 
                ? `Database has ${count} player stats for 2025 season` 
                : 'No stats in database yet. Run POST /api/migrate-stats to migrate.'
        });
        
    } catch (error) {
        console.error('Stats check error:', error);
        return NextResponse.json({ 
            error: 'Failed to check stats', 
            detail: String(error) 
        }, { status: 500 });
    }
}
