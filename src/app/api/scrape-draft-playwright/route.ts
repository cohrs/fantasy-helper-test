import { NextResponse } from 'next/server';
import { saveDraftPicks, getSelectedLeagueId, getDb } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

const sql = getDb();

const DRAFT_URLS: Record<string, string> = {
  'baseball': "https://www.tapatalk.com/groups/asshatrotoleagues/2026-draft-player-list-t1235.html",
  'basketball': "https://www.tapatalk.com/groups/asshatrotoleagues/2025-2026-player-list-t611.html"
};

interface ParsedPlayer {
  rd: number;
  pk: number | null;
  rank: number;
  tm: string | null;
  name: string;
  pos: string;
  playerTeam: string;
  isKeeper: boolean;
}

// Canonical team name map — keys are lowercase variants from Tapatalk
const CANONICAL_TEAM_NAMES: Record<string, string> = {
    'amazins': 'Amazins',
    'brohams': 'Brohams',
    'timberwolves': 'Timberwolves',
    'timber wolves': 'Timberwolves',
    'cubs win cubs win': 'Cubs Win Cubs Win',
    'cubs win': 'Cubs Win Cubs Win',
    'cubs wins cubs win': 'Cubs Win Cubs Win',
    'dillweed': 'Dillweed',
    'dilllweed': 'Dillweed',
    'hulkamania': 'Hulkamania',
    'hulkmania': 'Hulkamania',
    '1st to 3rd': '1st to 3rd',
    '1st to 3rd ': '1st to 3rd',
    'pirates baseball': 'Pirates Baseball',
    'pirate baseball': 'Pirates Baseball',
    'k-bandits': 'K-Bandits',
    'k bandits': 'K-Bandits',
    'k- bandits': 'K-Bandits',
    'the papelboners': 'The Papelboners',
    'papelboners': 'The Papelboners',
    'new jersey nine': 'New Jersey Nine',
    'jack mckeon': 'Jack McKeon',
    'jungle town piranhas': 'Jungle Town Piranhas',
    'jp': 'JP',
    'no talent ass clowns': 'No Talent Ass Clowns',
    'the joshua trees': 'The Joshua Trees',
    'joshua trees': 'The Joshua Trees',
    'mountain diehards': 'Mountain Diehards',
    'mdub321': 'Mdub321',
    'mdub': 'Mdub321',
};

// Normalize team names to handle variations
function normalizeTeamName(name: string | null): string | null {
    if (!name) return null;
    
    // Strip leading slashes, dashes, spaces
    const cleaned = name.replace(/^[/\- ]+/, '').trim();
    if (!cleaned) return null;
    
    const key = cleaned.toLowerCase().replace(/\s+/g, ' ');
    if (CANONICAL_TEAM_NAMES[key]) return CANONICAL_TEAM_NAMES[key];
    
    // Fallback: strip "the " prefix and title-case
    return key
        .replace(/^the\s+/, '')
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

// Parse player data from text content using improved logic
function parsePlayerData(textContent: string): ParsedPlayer[] {
    const lines = textContent.split('\n');
    
    const allPlayers: { rank: number; name: string; pos: string; playerTeam: string; tm: string | null; isKeeper: boolean; tapatalkRound: number | null }[] = [];

    lines.forEach((line: string) => {
        const cleanLine = line.trim();
        const rankMatch = cleanLine.match(/(?:·*\s*)(\d+)\.\s+/);

        if (rankMatch) {
            const rank = parseInt(rankMatch[1]);
            let tm: string | null = null;
            const startIdx = cleanLine.indexOf(rankMatch[0]) + rankMatch[0].length;
            let namePart = cleanLine.substring(startIdx);
            let isKeeper = false;
            let tapatalkRound: number | null = null;
            
            const keeperMatch = namePart.match(/-\s*Keeper\s*-?\s*(.*)/i);
            if (keeperMatch) {
                tm = keeperMatch[1].trim();
                isKeeper = true;
                namePart = namePart.replace(keeperMatch[0], '').trim();
            } else {
                const roundMatch = namePart.match(/(\d+)\s*(?:st|nd|rd|th)\s*[Rr]?ound\s*-?\s*(.*)/i);
                if (roundMatch) {
                    tapatalkRound = parseInt(roundMatch[1]);
                    tm = roundMatch[2].trim();
                    namePart = namePart.replace(roundMatch[0], '').trim();
                }
            }

            const nameSplit = namePart.split('-');
            const nameRaw = nameSplit[0].trim();
            const pos = nameSplit.length > 1 ? nameSplit[1].trim() : "UTIL";
            const nameWords = nameRaw.split(' ');
            const playerTeam = nameWords.pop() || "FA";
            const name = nameWords.join(' ');
            const normalizedTeam = normalizeTeamName(tm);
            
            allPlayers.push({ rank, name, pos, playerTeam, tm: normalizedTeam, isKeeper, tapatalkRound });
        }
    });

    const results: ParsedPlayer[] = [];

    // Keepers: round 0, no pick number
    allPlayers.filter(p => p.isKeeper).forEach(p => {
        results.push({
            rd: 0, pk: null, rank: p.rank, name: p.name, pos: p.pos,
            tm: p.tm, playerTeam: p.playerTeam, isKeeper: true
        });
    });

    // Draft picks: round = Tapatalk round directly (no offset)
    const draftPicks = allPlayers.filter(p => !p.isKeeper && p.tm && p.tapatalkRound && p.tapatalkRound > 0);
    draftPicks.sort((a, b) => (a.tapatalkRound || 0) - (b.tapatalkRound || 0));

    let pickNumber = 1;
    let currentRound = 0;
    draftPicks.forEach(p => {
        const rd = p.tapatalkRound || 1;
        if (rd !== currentRound) {
            currentRound = rd;
            pickNumber = (rd - 1) * 18 + 1;
        }
        results.push({
            rd, pk: pickNumber, rank: p.rank, name: p.name, pos: p.pos,
            tm: p.tm, playerTeam: p.playerTeam, isKeeper: false
        });
        pickNumber++;
    });

    // Undrafted
    allPlayers.filter(p => !p.isKeeper && (!p.tm || !p.tapatalkRound || p.tapatalkRound === 0)).forEach(p => {
        results.push({
            rd: 0, pk: null, rank: p.rank, name: p.name, pos: p.pos,
            tm: null, playerTeam: p.playerTeam, isKeeper: false
        });
    });

    return results;
}

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueIdParam = searchParams.get('leagueId');
        const textContent = searchParams.get('textContent');
        
        let leagueId: number | null = null;
        
        if (leagueIdParam) {
            leagueId = parseInt(leagueIdParam);
        } else {
            const session = await getServerSession(authOptions);
            leagueId = await getSelectedLeagueId(session);
        }
        
        if (!leagueId) {
            return NextResponse.json({ 
                success: false, 
                error: "No league selected. Please select a league first." 
            }, { status: 400 });
        }

        const leagueInfo = await sql`
            SELECT sport FROM user_leagues WHERE id = ${leagueId}
        `;
        
        if (!leagueInfo.length) {
            return NextResponse.json({ 
                success: false, 
                error: "League not found" 
            }, { status: 404 });
        }

        const sport = leagueInfo[0].sport;
        const TARGET_URL = DRAFT_URLS[sport];

        if (!TARGET_URL) {
            return NextResponse.json({ 
                success: false, 
                error: `No draft URL configured for ${sport}` 
            }, { status: 400 });
        }

        console.log(`🔄 Scraping ${sport} draft for league ${leagueId} using Playwright...`);

        // Check if text content was provided (from AI assistant using Playwright MCP)
        if (!textContent) {
            return NextResponse.json({ 
                success: false, 
                error: "This endpoint requires textContent parameter from Playwright scraping.",
                targetUrl: TARGET_URL,
                instructions: "Use Kiro AI assistant to scrape this URL with Playwright MCP tools"
            }, { status: 400 });
        }

        console.log(`📄 Processing ${textContent.length} characters of text`);

        // Parse the text content
        const parsedData = parsePlayerData(textContent);
        console.log(`✅ Parsed ${parsedData.length} players`);

        // Save to database
        const saved = await saveDraftPicks(parsedData, leagueId);
        console.log(`💾 Saved ${saved} draft picks to database`);

        return NextResponse.json({ 
            success: true, 
            message: `Successfully scraped and saved ${saved} draft picks using Playwright`,
            playersFound: parsedData.length,
            playersSaved: saved,
            sport,
            leagueId
        });

    } catch (error) {
        console.error("Playwright Scraper Error:", error);
        return NextResponse.json({ success: false, error: "Failed to scrape draft data with Playwright" }, { status: 500 });
    }
}
