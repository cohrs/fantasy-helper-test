import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../../auth/[...nextauth]/route';
import fs from 'fs';
import path from 'path';

const LEAGUE_KEY = '469.l.4136';
const CACHE_FILE = path.join(process.cwd(), 'yahoo-stats.json');

// MLB stat IDs we care about (standard Yahoo MLB stat IDs)
// Batting: AVG=3, R=9, HR=12, RBI=13, SB=16, OBP=17, H=11, AB=8
// Pitching: ERA=5, WHIP=9, W=28, K=11 (but 11 clashes – Yahoo uses its own per-league IDs)
// We'll just return all stats and let the UI pick what to show.

async function fetchPage(accessToken: string, start: number, count: number = 25) {
    const url = `https://fantasysports.yahooapis.com/fantasy/v2/league/${LEAGUE_KEY}/players;sort=AR;sort_type=season;start=${start};count=${count}/stats;type=season;season=2025?format=json`;
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Yahoo ${res.status}: ${text.substring(0, 300)}`);
    }
    return res.json();
}

function parsePlayers(data: any): any[] {
    const playersRaw = data?.fantasy_content?.league?.[1]?.players;
    if (!playersRaw) return [];

    const players: any[] = [];

    for (const key in playersRaw) {
        if (key === 'count') continue;
        const playerObj = playersRaw[key];
        if (!playerObj?.player) continue;

        const info = playerObj.player[0]; // array of field objects
        const statsBlock = playerObj.player[1]; // { player_stats: { stats: [...] } }

        if (!info || !Array.isArray(info)) continue;

        const findField = (fieldKey: string) => {
            for (const item of info) {
                if (typeof item === 'object' && item !== null && fieldKey in item) return item[fieldKey];
            }
            return null;
        };

        const nameObj = findField('name');
        const fullName =
            typeof nameObj === 'object' && nameObj?.full
                ? nameObj.full
                : nameObj?.first && nameObj?.last
                    ? `${nameObj.first} ${nameObj.last}`
                    : null;

        if (!fullName) continue;

        const displayPosition = findField('display_position') || '';
        const team = findField('editorial_team_abbr') || 'FA';

        // Parse stats array: [{ stat: { stat_id: "...", value: "..." } }, ...]
        const statsMap: Record<string, string> = {};
        const rawStats = statsBlock?.player_stats?.stats;
        if (Array.isArray(rawStats)) {
            for (const s of rawStats) {
                if (s?.stat?.stat_id != null) {
                    statsMap[String(s.stat.stat_id)] = s.stat.value ?? '-';
                }
            }
        }

        players.push({ name: fullName, team, pos: displayPosition, stats: statsMap });
    }

    return players;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const forceRefresh = searchParams.get('refresh') === '1';

        // Serve from cache if fresh enough (< 6 hours) and not forced
        if (!forceRefresh && fs.existsSync(CACHE_FILE)) {
            const stat = fs.statSync(CACHE_FILE);
            const ageMs = Date.now() - stat.mtimeMs;
            if (ageMs < 6 * 60 * 60 * 1000) {
                const cached = JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'));
                return NextResponse.json({ source: 'cache', ...cached });
            }
        }

        const session = await getServerSession(authOptions);
        if (!session || !(session as any).accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const accessToken = (session as any).accessToken;

        // Paginate — Yahoo returns max 25; typical league pool is 300–500 players
        const allPlayers: any[] = [];
        const PAGE_SIZE = 25;
        let start = 0;

        while (true) {
            const data = await fetchPage(accessToken, start, PAGE_SIZE);
            const page = parsePlayers(data);
            if (page.length === 0) break;
            allPlayers.push(...page);
            if (page.length < PAGE_SIZE) break;
            start += PAGE_SIZE;
            // Safety cap: fetch up to 2000 players (deep FA pool)
            if (start >= 2000) break;
        }

        // Build name-keyed map for easy lookup on the frontend
        const byName: Record<string, any> = {};
        for (const p of allPlayers) {
            byName[p.name.toLowerCase()] = p;
        }

        const payload = { players: allPlayers, byName, fetchedAt: new Date().toISOString() };

        // Cache to disk
        try {
            fs.writeFileSync(CACHE_FILE, JSON.stringify(payload, null, 2));
        } catch (e) {
            console.warn('[Yahoo Stats] Could not write cache:', e);
        }

        return NextResponse.json({ source: 'live', ...payload });

    } catch (err) {
        console.error('[Yahoo Stats] Error:', err);
        return NextResponse.json({ error: String(err) }, { status: 500 });
    }
}
