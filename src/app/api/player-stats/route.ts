import { NextResponse } from 'next/server';
import { getPlayerStats } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const season = searchParams.get('season');
        
        const stats = await getPlayerStats(season ? parseInt(season) : undefined);
        return NextResponse.json(stats);
    } catch (err) {
        console.error("Error reading player stats from database:", err);
        return NextResponse.json({});
    }
}
