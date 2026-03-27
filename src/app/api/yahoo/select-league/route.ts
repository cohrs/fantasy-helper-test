import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getDb } from '@/lib/db';

const sql = getDb();

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { leagueKey } = await request.json();

        if (!leagueKey) {
            return NextResponse.json({ error: 'League key required' }, { status: 400 });
        }

        const userGuid = session.user?.email?.split('@')[0] || 'unknown';

        // Get user ID
        const userResult = await sql`SELECT id FROM users WHERE yahoo_guid = ${userGuid}`;
        
        if (!userResult.length) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const userId = userResult[0].id;

        // Get league ID
        const leagueResult = await sql`
            SELECT id, league_key FROM user_leagues 
            WHERE user_id = ${userId} AND league_key = ${leagueKey}
        `;

        if (!leagueResult.length) {
            return NextResponse.json({ error: 'League not found' }, { status: 404 });
        }

        const leagueId = leagueResult[0].id;

        // Update selected league (store league_key)
        await sql`
            INSERT INTO user_selected_league (user_id, league_id, league_key)
            VALUES (${userId}, ${leagueId}, ${leagueKey})
            ON CONFLICT (user_id)
            DO UPDATE SET 
                league_id = ${leagueId},
                league_key = ${leagueKey},
                updated_at = CURRENT_TIMESTAMP
        `;

        return NextResponse.json({ success: true, leagueKey });

    } catch (error) {
        console.error("Error selecting league:", error);
        return NextResponse.json({ 
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

export async function GET() {
    try {
        const session = await getServerSession(authOptions);

        if (!session) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userGuid = session.user?.email?.split('@')[0] || 'unknown';

        // Get user's selected league
        const result = await sql`
            SELECT 
                ul.id,
                ul.league_key,
                ul.league_name,
                ul.sport,
                ul.season,
                ul.is_active,
                ul.team_key,
                ul.team_name
            FROM user_selected_league usl
            JOIN users u ON u.id = usl.user_id
            JOIN user_leagues ul ON ul.id = usl.league_id
            WHERE u.yahoo_guid = ${userGuid}
        `;

        if (!result.length) {
            return NextResponse.json({ 
                success: true, 
                selectedLeague: null 
            });
        }

        return NextResponse.json({ 
            success: true, 
            selectedLeague: result[0] 
        });

    } catch (error) {
        console.error("Error getting selected league:", error);
        return NextResponse.json({ 
            error: 'Internal Server Error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
