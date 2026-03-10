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

// Normalize team names to handle variations
function normalizeTeamName(name: string | null): string | null {
    if (!name) return null;
    
    let normalized = name
        .trim()
        .toLowerCase()
        .replace(/^the\s+/i, '')
        .replace(/[''`]/g, '')
        .replace(/\s*-\s*/g, '-')
        .replace(/\s+/g, ' ')
        .replace(/[^\w\s-]/g, '')
        .trim();
    
    // Handle specific team name variations
    if (normalized === 'timber wolves') {
        normalized = 'timberwolves';
    }
    
    return normalized
        .split(' ')
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
}

// Parse player data from text content using improved logic
function parsePlayerData(textContent: string): ParsedPlayer[] {
    const lines = textContent.split('\n');
    const results: ParsedPlayer[] = [];
    
    let draftPickCounter = 1; // Sequential counter for ACTUAL draft picks only

    lines.forEach((line: string) => {
        const cleanLine = line.trim();
        const rankMatch = cleanLine.match(/(?:·*\s*)(\d+)\.\s+/);

        if (rankMatch) {
            const rank = parseInt(rankMatch[1]); // This is ALWAYS the player's rank
            let tm: string | null = null;

            const startIdx = cleanLine.indexOf(rankMatch[0]) + rankMatch[0].length;
            let namePart = cleanLine.substring(startIdx);

            let isKeeper = false;
            let forcedRound = null;
            
            // Check for Keeper
            const keeperMatch = namePart.match(/-\s*Keeper\s*-?\s*(.*)/i);
            if (keeperMatch) {
                tm = keeperMatch[1].trim();
                isKeeper = true;
                namePart = namePart.replace(keeperMatch[0], '').trim();
            } else {
                // Check for Round assignment
                const roundMatch = namePart.match(/(\d+)\s*(?:st|nd|rd|th)\s*Round\s*-\s*(.*)/i);
                if (roundMatch) {
                    forcedRound = parseInt(roundMatch[1]);
                    tm = roundMatch[2].trim();
                    namePart = namePart.replace(roundMatch[0], '').trim();
                }
            }

            // Parse player name and position
            const nameSplit = namePart.split('-');
            const nameRaw = nameSplit[0].trim();
            const pos = nameSplit.length > 1 ? nameSplit[1].trim() : "UTIL";

            const nameWords = nameRaw.split(' ');
            const playerTeam = nameWords.pop() || "FA";
            const name = nameWords.join(' ');

            // Normalize team name
            const normalizedTeam = normalizeTeamName(tm);
            
            // Determine pick number and round
            let pickNumber: number | null = null;
            let round = 0;
            
            if (isKeeper) {
                // Keepers: no pick number, round = 0
                pickNumber = null;
                round = 0;
            } else if (normalizedTeam) {
                // Draft pick: sequential pick number
                pickNumber = draftPickCounter;
                round = forcedRound !== null ? forcedRound : Math.floor((draftPickCounter - 1) / 18) + 1;
                draftPickCounter++;
            } else {
                // Undrafted: no pick number, round = 0
                pickNumber = null;
                round = 0;
            }
            
            results.push({ 
                rd: round, 
                pk: pickNumber,
                rank: rank,
                name, 
                pos, 
                tm: normalizedTeam, 
                playerTeam, 
                isKeeper 
            });
        }
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
