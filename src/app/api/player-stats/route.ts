import { NextResponse } from 'next/server';
import { getPlayerStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const seasonParam = searchParams.get('season');
        const sportParam = searchParams.get('sport');
        
        let stats = await getPlayerStats(seasonParam ? parseInt(seasonParam) : undefined, sportParam || undefined);
        
        // Fallback: If no stats for current season (e.g., 2026), try grabbing the previous season (e.g., 2025)
        if (stats.length === 0 && seasonParam) {
            stats = await getPlayerStats(parseInt(seasonParam) - 1, sportParam || undefined);
        }
        
        // Transform array of rows into a dictionary keyed by normalized player name
        const statsMap: Record<string, any> = {};
        stats.forEach((row: any) => {
            if (row.player_name_normalized && row.stats) {
                statsMap[row.player_name_normalized] = typeof row.stats === 'string' ? JSON.parse(row.stats) : row.stats;
            }
        });
        
        return NextResponse.json(statsMap);
    } catch (err) {
        console.error("Error reading player stats from database:", err);
        return NextResponse.json({});
    }
}
