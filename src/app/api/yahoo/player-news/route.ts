import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getYahooAccessToken } from '@/lib/yahoo-auth';
import { getDb } from '@/lib/db';

const sql = getDb();
const LEAGUE_KEY = '469.l.4136';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get Yahoo GUID from database using email
        const userResult = await sql`SELECT yahoo_guid FROM users WHERE email = ${session.user.email} LIMIT 1`;
        if (!userResult.length) {
            return NextResponse.json({ error: 'User not found. Please re-login.' }, { status: 401 });
        }
        const yahooGuid = userResult[0].yahoo_guid;
        
        // Get valid access token (will refresh if needed)
        const accessToken = await getYahooAccessToken(yahooGuid);
        
        if (!accessToken) {
            return NextResponse.json({ error: 'Failed to get Yahoo access token. Please re-login.' }, { status: 401 });
        }
        const { searchParams } = new URL(request.url);
        const playerName = searchParams.get('name');
        const leagueKeyParam = searchParams.get('leagueKey');

        if (!playerName) {
            return NextResponse.json({ error: 'Player name required' }, { status: 400 });
        }
        
        const leagueKey = leagueKeyParam || null;
        
        // Normalize player name for database lookup
        const normalizedName = playerName
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z\s]/g, '')
            .replace(/\s+(jr|sr|ii|iii)$/, '')
            .trim()
            .replace(/\s+/g, '');
        
        // Check if we have cached news (less than 1 hour old)
        if (leagueKey) {
            const cached = await sql`
                SELECT * FROM yahoo_player_news
                WHERE league_key = ${leagueKey}
                AND player_name_normalized = ${normalizedName}
                AND fetched_at > NOW() - INTERVAL '1 hour'
            `;
            
            if (cached.length > 0) {
                console.log('📦 Returning cached Yahoo news for', playerName);
                return NextResponse.json({
                    success: true,
                    cached: true,
                    player: {
                        name: cached[0].player_name,
                        team: 'N/A',
                        status: cached[0].status,
                        statusFull: cached[0].status_full,
                        imageUrl: cached[0].image_url,
                        hasNotes: cached[0].notes && cached[0].notes.length > 0,
                        notes: cached[0].notes || []
                    }
                });
            }
        }

        // Search for player by name - request player notes only (editorial not supported)
        const searchUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${LEAGUE_KEY}/players;search=${encodeURIComponent(playerName)};out=player_notes?format=json`;

        const response = await fetch(searchUrl, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({
                error: `Yahoo API returned ${response.status}`,
                detail: errorText.substring(0, 500)
            }, { status: response.status });
        }

        const data = await response.json();
        const playersRaw = data?.fantasy_content?.league?.[1]?.players;

        if (!playersRaw || playersRaw.count === 0) {
            return NextResponse.json({ 
                error: 'Player not found',
                playerName 
            }, { status: 404 });
        }

        // Get first matching player
        const playerObj = playersRaw['0']?.player;
        if (!playerObj) {
            return NextResponse.json({ error: 'No player data' }, { status: 404 });
        }

        const info = playerObj[0];
        
        const findField = (fieldKey: string) => {
            for (const item of info) {
                if (typeof item === 'object' && item !== null && fieldKey in item) return item[fieldKey];
            }
            return null;
        };

        const nameObj = findField('name');
        const fullName = (typeof nameObj === 'object' && nameObj?.full)
            ? nameObj.full
            : (nameObj?.first && nameObj?.last ? `${nameObj.first} ${nameObj.last}` : 'Unknown');

        const status = findField('status') || null;
        const statusFull = findField('status_full') || null;
        const mlbTeam = findField('editorial_team_abbr') || 'FA';
        const imageUrl = findField('image_url') || null;
        const hasNotes = !!findField('has_player_notes');

        // Parse player notes
        const notes: any[] = [];
        const notesBlock = findField('player_notes');
        
        console.log('🔍 Yahoo News Debug:', {
            playerName: fullName,
            hasNotes,
            notesBlock: JSON.stringify(notesBlock, null, 2)
        });
        
        if (notesBlock && Array.isArray(notesBlock)) {
            for (const noteNode of notesBlock) {
                if (noteNode?.player_note) {
                    const note = noteNode.player_note;
                    notes.push({
                        title: note.title || null,
                        summary: note.summary || null,
                        timestamp: note.timestamp || null,
                        type: note.type || null
                    });
                }
            }
        }

        // Save to database for caching (don't await, let it happen in background)
        if (leagueKey) {
            sql`
                INSERT INTO yahoo_player_news (
                    league_key, player_name, player_name_normalized,
                    status, status_full, image_url, notes, fetched_at
                )
                VALUES (
                    ${leagueKey}, ${fullName}, ${normalizedName},
                    ${status}, ${statusFull}, ${imageUrl}, ${JSON.stringify(notes)}, CURRENT_TIMESTAMP
                )
                ON CONFLICT (league_key, player_name_normalized)
                DO UPDATE SET
                    player_name = ${fullName},
                    status = ${status},
                    status_full = ${statusFull},
                    image_url = ${imageUrl},
                    notes = ${JSON.stringify(notes)},
                    fetched_at = CURRENT_TIMESTAMP
            `.catch(err => console.error('Failed to cache Yahoo news:', err));
        }

        return NextResponse.json({
            success: true,
            player: {
                name: fullName,
                team: mlbTeam,
                status,
                statusFull,
                imageUrl,
                hasNotes,
                notes
            }
        });

    } catch (error) {
        console.error('[Yahoo Player News] Error:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            detail: String(error) 
        }, { status: 500 });
    }
}
