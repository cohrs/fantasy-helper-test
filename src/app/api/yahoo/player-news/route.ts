import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

const LEAGUE_KEY = '469.l.4136';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !(session as any).accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessToken = (session as any).accessToken;
        const { searchParams } = new URL(request.url);
        const playerName = searchParams.get('name');

        if (!playerName) {
            return NextResponse.json({ error: 'Player name required' }, { status: 400 });
        }

        // Search for player by name - request all available editorial content
        const searchUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${LEAGUE_KEY}/players;search=${encodeURIComponent(playerName)};out=player_notes,editorial?format=json`;

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
        
        // Try to get editorial content (player outlook)
        const editorial = findField('editorial') || null;
        let playerOutlook = null;
        if (editorial) {
            playerOutlook = editorial.player_outlook || editorial.analysis || null;
        }

        // Parse player notes
        const notes: any[] = [];
        const notesBlock = findField('player_notes');
        
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

        return NextResponse.json({
            success: true,
            player: {
                name: fullName,
                team: mlbTeam,
                status,
                statusFull,
                imageUrl,
                hasNotes,
                playerOutlook,
                notes
            },
            debug: editorial // Include raw editorial data for debugging
        });

    } catch (error) {
        console.error('[Yahoo Player News] Error:', error);
        return NextResponse.json({ 
            error: 'Internal Server Error', 
            detail: String(error) 
        }, { status: 500 });
    }
}
