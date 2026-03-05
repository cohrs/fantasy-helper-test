import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

// Get all leagues from database (no auth required)
export async function GET() {
  try {
    const sql = getDb();
    const result = await sql`
      SELECT 
        id,
        league_key,
        league_name,
        sport,
        season,
        is_active,
        created_at
      FROM leagues
      ORDER BY is_active DESC, season DESC, sport
    `;

    return NextResponse.json({
      success: true,
      leagues: result
    });
  } catch (error: any) {
    console.error('Error fetching leagues:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}

// Select a league (store in session/cookie)
export async function POST(request: Request) {
  try {
    const { leagueId } = await request.json();
    const sql = getDb();
    
    const result = await sql`
      SELECT 
        id,
        league_key,
        league_name,
        sport,
        season,
        is_active
      FROM leagues
      WHERE id = ${leagueId}
    `;

    if (result.length === 0) {
      return NextResponse.json({
        success: false,
        error: 'League not found'
      }, { status: 404 });
    }

    const league = result[0];
    
    // Return league info - client will store in localStorage
    return NextResponse.json({
      success: true,
      league
    });
  } catch (error: any) {
    console.error('Error selecting league:', error);
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 });
  }
}
