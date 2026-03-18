import { NextResponse } from 'next/server';
import axios from 'axios';
import { getSelectedLeagueId, getDb } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";

const sql = getDb();

const DRAFT_URLS: Record<string, string> = {
  'baseball': "https://www.tapatalk.com/groups/asshatrotoleagues/2026-draft-player-list-t1235.html",
  'basketball': "https://www.tapatalk.com/groups/asshatrotoleagues/2025-2026-player-list-t611.html"
};

// Canonical team name map — keys are lowercase/stripped variants from Tapatalk
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
        const allPlayers: { rd: number; rank: number; tm: string | null; name: string; pos: string; playerTeam: string; isKeeper: boolean; draftPosition: number | null }[] = [];

        lines.forEach((line: string) => {
            const cleanLine = line.trim();
            const rankMatch = cleanLine.match(/(?:·*\s*)(\d+)\.\s+/);

            if (rankMatch) {
                const rank = parseInt(rankMatch[1]);
                let tm: string | null = null;

                const startIdx = cleanLine.indexOf(rankMatch[0]) + rankMatch[0].length;
                let namePart = cleanLine.substring(startIdx);

                let isKeeper = false;
                let round: number | null = null;
                
                // Check for Keeper
                const keeperMatch = namePart.match(/-\s*Keeper\s*-?\s*(.*)/i);
                if (keeperMatch) {
                    tm = keeperMatch[1].trim();
                    isKeeper = true;
                    namePart = namePart.replace(keeperMatch[0], '').trim();
                } else {
                    // Check for Round assignment (with or without dash, handle typos, and no space between ordinal and round)
                    const roundMatch = namePart.match(/(\d+)\s*(?:st|nd|rd|th)\s*[Rr]?ound\s*-?\s*(.*)/i);
                    if (!roundMatch) {
                        // Try without space between ordinal and round (e.g., "4thRound")
                        const roundMatch2 = namePart.match(/(\d+)(?:st|nd|rd|th)[Rr]ound\s*-?\s*(.*)/i);
                        if (roundMatch2) {
                            round = parseInt(roundMatch2[1]);
                            tm = roundMatch2[2].trim();
                            namePart = namePart.replace(roundMatch2[0], '').trim();
                        }
                    } else {
                        round = parseInt(roundMatch[1]);
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
                
                allPlayers.push({ 
                    rd: round || 0,
                    rank: rank,
                    name, 
                    pos, 
                    tm: normalizedTeam, 
                    playerTeam, 
                    isKeeper,
                    draftPosition: null // Will be assigned sequentially
                });
            }
        });

        // Separate keepers, drafted players, and undrafted
        const keepers = allPlayers.filter(p => p.isKeeper);
        const draftedPlayers = allPlayers.filter(p => !p.isKeeper && p.tm && p.rd > 0);
        const undrafted = allPlayers.filter(p => !p.isKeeper && (!p.tm || p.rd === 0));

        // Sort drafted players by Tapatalk round, preserve order within round
        draftedPlayers.sort((a, b) => {
            if (a.rd !== b.rd) return a.rd - b.rd;
            return 0;
        });

        const results: { rd: number; pk: number | null; rank: number; tm: string | null; name: string; pos: string; playerTeam: string; isKeeper: boolean }[] = [];
        
        // Keepers: round 0, no pick number
        keepers.forEach(p => {
            results.push({
                rd: 0, pk: null, rank: p.rank, name: p.name,
                pos: p.pos, tm: p.tm, playerTeam: p.playerTeam, isKeeper: true
            });
        });

        // Draft picks: round = Tapatalk round directly (no offset)
        let pickNumber = 1;
        let currentRound = 0;
        
        draftedPlayers.forEach((p) => {
            if (p.rd !== currentRound) {
                currentRound = p.rd;
                pickNumber = (p.rd - 1) * 18 + 1;
            }
            
            results.push({
                rd: p.rd,
                pk: pickNumber,
                rank: p.rank,
                name: p.name,
                pos: p.pos,
                tm: p.tm,
                playerTeam: p.playerTeam,
                isKeeper: false
            });
            pickNumber++;
        });

        // Undrafted players
        undrafted.forEach(p => {
            results.push({
                rd: 0, pk: null, rank: p.rank, name: p.name,
                pos: p.pos, tm: p.tm, playerTeam: p.playerTeam, isKeeper: false
            });
        });

        console.log(`\n📊 Scraper Results:`);
        console.log(`   Total players: ${results.length}`);
        console.log(`   Keepers: ${results.filter(p => p.isKeeper).length}`);
        console.log(`   Draft picks: ${results.filter(p => p.pk !== null).length}`);
        console.log(`   Undrafted: ${results.filter(p => !p.isKeeper && p.pk === null).length}`);

        // Save to database — full replace to avoid duplicates
        // Delete existing data and re-insert everything
        console.log(`🗑️ Clearing existing draft data for league ${leagueId}...`);
        await sql`DELETE FROM draft_picks WHERE league_id = ${leagueId}`;
        
        let insertedCount = 0;
        for (const pick of results) {
            await sql`
                INSERT INTO draft_picks (league_id, round, pick, rank, player_name, position, team_abbr, drafted_by, is_keeper)
                VALUES (
                    ${leagueId},
                    ${pick.rd || 0},
                    ${pick.pk},
                    ${pick.rank},
                    ${pick.name},
                    ${pick.pos},
                    ${pick.playerTeam || null},
                    ${pick.tm || null},
                    ${pick.isKeeper || false}
                )
            `;
            insertedCount++;
        }
        console.log(`✅ Inserted ${insertedCount} rows`);

        return NextResponse.json({ 
            success: true, 
            totalPicks: results.length,
            newPicks: insertedCount,
            picks: results,
            message: `Synced ${insertedCount} picks (${results.filter(p => p.isKeeper).length} keepers, ${results.filter(p => p.pk !== null).length} draft picks)`
        });
    } catch (error) {
        console.error("Scraper Error:", error);
        return NextResponse.json({ success: false, error: "Failed to scrape draft data" }, { status: 500 });
    }
}