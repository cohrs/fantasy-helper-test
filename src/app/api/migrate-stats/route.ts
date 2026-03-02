import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';
import fs from 'fs';
import path from 'path';

// This endpoint migrates stats from the static JSON file to the database
// Call it once after deployment to populate the database
export async function POST(request: Request) {
    try {
        // Check for a secret key to prevent unauthorized access
        const body = await request.json();
        const { secret } = body;
        
        if (secret !== process.env.NEXTAUTH_SECRET) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const sql = neon(process.env.POSTGRES_URL!);
        
        // Read the stats JSON file
        const statsPath = path.join(process.cwd(), 'yahoo-stats.json');
        const statsData = JSON.parse(fs.readFileSync(statsPath, 'utf-8'));
        const players = statsData.players || [];
        
        if (players.length === 0) {
            return NextResponse.json({ 
                error: 'No players found in yahoo-stats.json' 
            }, { status: 400 });
        }
        
        // Save to database using the same logic as the migration script
        let inserted = 0;
        for (const player of players) {
            const normalized = player.name
                .normalize("NFD")
                .replace(/[\u0300-\u036f]/g, "")
                .toLowerCase()
                .replace(/[^a-z\s]/g, '')
                .replace(/\s+(jr|sr|ii|iii)$/, '')
                .trim()
                .replace(/\s+/g, '');
            
            await sql`
                INSERT INTO player_stats (player_name, player_name_normalized, team_abbr, position, stats, season, updated_at)
                VALUES (
                    ${player.name}, 
                    ${normalized}, 
                    ${player.team || null}, 
                    ${player.pos || null}, 
                    ${JSON.stringify(player.stats)}, 
                    2025,
                    CURRENT_TIMESTAMP
                )
                ON CONFLICT (player_name_normalized)
                DO UPDATE SET 
                    stats = ${JSON.stringify(player.stats)},
                    team_abbr = ${player.team || null},
                    position = ${player.pos || null},
                    season = 2025,
                    updated_at = CURRENT_TIMESTAMP
            `;
            inserted++;
        }
        
        return NextResponse.json({ 
            success: true,
            message: `Migrated ${inserted} player stats for 2025 season`,
            count: inserted
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
        const sql = neon(process.env.POSTGRES_URL!);
        
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
