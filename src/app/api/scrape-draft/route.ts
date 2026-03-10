import { NextResponse } from 'next/server';
import axios from 'axios';
import { saveDraftPicks, getSelectedLeagueId, getDb } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

const sql = getDb();

const DRAFT_URLS: Record<string, string> = {
  'baseball': "https://www.tapatalk.com/groups/asshatrotoleagues/2026-draft-player-list-t1235.html",
  'basketball': "https://www.tapatalk.com/groups/asshatrotoleagues/2025-2026-player-list-t611.html"
};

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

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueIdParam = searchParams.get('leagueId');
        
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

        console.log(`🔄 Scraping ${sport} draft for league ${leagueId}...`);

        const { data } = await axios.get(TARGET_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 30000 // 30 second timeout
        });

        let cleanContent = data.replace(/&nbsp;/g, " ")
            .replace(/&#160;/g, " ")
            .replace(/\u00A0/g, " ")
            .replace(/&middot;/g, "·");

        cleanContent = cleanContent.replace(/<\/?[^>]+(>|$)/g, "\n");

        const lines = cleanContent.split('\n');
        const results: { rd: number; pk: number | null; rank: number; tm: string | null; name: string; pos: string; playerTeam: string; isKeeper: boolean }[] = [];
        
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

        console.log(`\n📊 Scraper Results:`);
        console.log(`   Total players: ${results.length}`);
        console.log(`   Keepers: ${results.filter(p => p.isKeeper).length}`);
        console.log(`   Draft picks: ${results.filter(p => p.pk !== null).length}`);
        console.log(`   Undrafted: ${results.filter(p => !p.isKeeper && p.pk === null).length}`);

        // Save to database
        const newPicksCount = await saveDraftPicks(results, leagueId);

        return NextResponse.json({ 
            success: true, 
            totalPicks: results.length,
            newPicks: newPicksCount,
            picks: results,
            message: newPicksCount > 0 
                ? `Added ${newPicksCount} new picks (${results.length} total)` 
                : `No new picks (${results.length} total)`
        });
    } catch (error) {
        console.error("Scraper Error:", error);
        return NextResponse.json({ success: false, error: "Failed to scrape draft data" }, { status: 500 });
    }
}