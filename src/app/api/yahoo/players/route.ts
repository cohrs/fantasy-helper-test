import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getDb } from '@/lib/db';
import { getYahooAccessTokenByEmail } from '@/lib/yahoo-auth';

const sql = getDb();

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session?.user?.email) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessToken = await getYahooAccessTokenByEmail(session.user.email);
        if (!accessToken) {
            return NextResponse.json({ error: 'No valid Yahoo token. Please re-login.' }, { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const start = searchParams.get('start') || '0';
        const count = searchParams.get('count') || '25';
        const leagueIdParam = searchParams.get('leagueId');

        // Look up the league key from DB if leagueId provided, otherwise fall back to baseball
        let leagueKey = '469.l.4136';
        if (leagueIdParam) {
            const leagueResult = await sql`SELECT league_key FROM user_leagues WHERE id = ${parseInt(leagueIdParam)} LIMIT 1`;
            if (leagueResult[0]?.league_key) {
                leagueKey = leagueResult[0].league_key;
            }
        }

        const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${leagueKey}/players;sort=AR;sort_type=season;start=${start};count=${count};out=stats,player_notes?format=json`;

        console.log('[Yahoo Players] Fetching:', yahooUrl);

        const response = await fetch(yahooUrl, {
            headers: {
                "Authorization": `Bearer ${accessToken}`,
            },
        });

        const responseText = await response.text();

        if (!response.ok) {
            console.error('[Yahoo Players] Error', response.status, responseText.substring(0, 500));
            return NextResponse.json({
                error: `Yahoo API returned ${response.status}`,
                detail: responseText.substring(0, 500)
            }, { status: response.status });
        }

        let data: any;
        try {
            data = JSON.parse(responseText);
        } catch {
            console.error('[Yahoo Players] Non-JSON response:', responseText.substring(0, 500));
            return NextResponse.json({
                error: 'Yahoo returned non-JSON',
                raw: responseText.substring(0, 1000)
            }, { status: 500 });
        }

        // Parse Yahoo's nested player structure
        const playersRaw = data?.fantasy_content?.league?.[1]?.players;
        if (!playersRaw) {
            console.log('[Yahoo Players] No players found in response:', JSON.stringify(data).substring(0, 500));
            return NextResponse.json({ players: [], count: 0, debug: data });
        }

        const players: any[] = [];
        for (const key in playersRaw) {
            if (key === 'count') continue;
            const playerObj = playersRaw[key];
            if (!playerObj?.player) continue;

            const info = playerObj.player[0];
            if (!info || !Array.isArray(info)) continue;

            const findField = (fieldKey: string) => {
                for (const item of info) {
                    if (typeof item === 'object' && item !== null && fieldKey in item) return item[fieldKey];
                }
                return null;
            };

            // Name is nested: { name: { full: "...", first: "...", last: "..." } }
            const nameObj = findField('name');
            const fullName = (typeof nameObj === 'object' && nameObj?.full)
                ? nameObj.full
                : (nameObj?.first && nameObj?.last ? `${nameObj.first} ${nameObj.last}` : 'Unknown');

            const mlbTeam = findField('editorial_team_abbr') || 'FA';
            const status = findField('status') || null;
            const adp = findField('average_draft_position') || null;

            // eligible_positions is an array of {position: "SP"} objects
            const eligPositions: string[] = [];
            const posArr = findField('eligible_positions');
            if (Array.isArray(posArr)) {
                posArr.forEach((p: any) => {
                    if (p?.position && p.position !== 'Util' && p.position !== 'BN') {
                        eligPositions.push(p.position);
                    }
                });
            } else if (posArr && typeof posArr === 'object') {
                // Sometimes Yahoo returns it as a keyed object
                Object.values(posArr).forEach((p: any) => {
                    if (p?.position && p.position !== 'Util' && p.position !== 'BN') {
                        eligPositions.push(p.position);
                    }
                });
            }

            const statusFull = findField('status_full') || null;
            const hasNotes = !!findField('has_player_notes');
            const displayPosition = findField('display_position') || null;

            // Optional: try to pull the actual note if it was requested via ;out=player_notes
            let recentNote = null;
            const notesBlock = findField('player_notes');
            if (notesBlock && Array.isArray(notesBlock)) {
                // Usually the first note is the most recent
                const firstNoteNode = notesBlock.find((n: any) => n?.player_note);
                if (firstNoteNode?.player_note) {
                    recentNote = firstNoteNode.player_note.summary || firstNoteNode.player_note.title || null;
                }
            }

            players.push({
                name: fullName,
                mlbTeam,
                positions: eligPositions.join(', ') || displayPosition,
                status,
                statusFull,
                hasNotes,
                recentNote,
                adp: adp ? parseFloat(adp) : null,
            });
        }

        console.log(`[Yahoo Players] Parsed ${players.length} players`);
        return NextResponse.json({ players, count: players.length });

    } catch (error) {
        console.error('[Yahoo Players] Unexpected error:', error);
        return NextResponse.json({ error: 'Internal Server Error', detail: String(error) }, { status: 500 });
    }
}
