import { NextResponse } from 'next/server';
import axios from 'axios';
import { saveDraftPicks } from '@/lib/db';

const TARGET_URL = "https://www.tapatalk.com/groups/asshatrotoleagues/2026-draft-player-list-t1235.html";

export async function GET() {
    try {
        const { data } = await axios.get(TARGET_URL, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
        });

        let cleanContent = data.replace(/&nbsp;/g, " ")
            .replace(/&#160;/g, " ")
            .replace(/\u00A0/g, " ")
            .replace(/&middot;/g, "·");

        // Remove HTML tags completely and replace with newlines to ensure logical lines
        cleanContent = cleanContent.replace(/<\/?[^>]+(>|$)/g, "\n");

        const lines = cleanContent.split('\n');
        const results: { rd: number; pk: number; tm: string | null; name: string; pos: string; playerTeam: string; isKeeper: boolean }[] = [];

        lines.forEach((line: string) => {
            const cleanLine = line.trim();
            // Match lines starting with a bullet hole character or just a number
            const pkMatch = cleanLine.match(/(?:·*\s*)(\d+)\.\s+/);

            if (pkMatch) {
                const pk = parseInt(pkMatch[1]);
                let tm: string | null = null;

                const startIdx = cleanLine.indexOf(pkMatch[0]) + pkMatch[0].length;
                let namePart = cleanLine.substring(startIdx);

                let isKeeper = false;

                let forcedRound = null;
                // Handle Keeper assignments
                const keeperMatch = namePart.match(/-\s*Keeper\s*-?\s*(.*)/i);
                if (keeperMatch) {
                    tm = keeperMatch[1].trim();
                    isKeeper = true;
                    namePart = namePart.replace(keeperMatch[0], '').trim();
                } else {
                    // Handle Round assignments (e.g. "2nd Round" or "2 nd Round" or "3 rd Round")
                    // Allow flexible spacing: "2nd", "2 nd", "2  nd", etc.
                    const roundMatch = namePart.match(/(\d+)\s*(?:st|nd|rd|th)\s*Round\s*-\s*(.*)/i);
                    if (roundMatch) {
                        forcedRound = parseInt(roundMatch[1]);
                        tm = roundMatch[2].trim();
                        namePart = namePart.replace(roundMatch[0], '').trim();
                    }
                }

                // Clean up the name and pos (e.g. "Pete Alonso BAL - 1B")
                let nameSplit = namePart.split('-');
                let nameRaw = nameSplit[0].trim();
                let pos = nameSplit.length > 1 ? nameSplit[1].trim() : "UTIL";

                // Extract team from the end of the name string (e.g. "Pete Alonso BAL" -> name="Pete Alonso", team="BAL")
                let nameWords = nameRaw.split(' ');
                let playerTeam = nameWords.pop() || "FA";
                let name = nameWords.join(' ');

                const calculatedRound = forcedRound !== null ? forcedRound : Math.floor((pk - 1) / 18) + 1;
                results.push({ rd: calculatedRound, pk, name, pos, tm, playerTeam, isKeeper });
            }
        });

        // Remove duplicates just in case quotes or multiple threads matched
        const uniquePicks = Array.from(new Map(results.map(item => [item.pk, item])).values());

        // Sort by pick number
        uniquePicks.sort((a, b) => a.pk - b.pk);

        // Save to database
        await saveDraftPicks(uniquePicks);

        return NextResponse.json({ success: true, count: uniquePicks.length, picks: uniquePicks });
    } catch (error) {
        console.error("Scraper Error:", error);
        return NextResponse.json({ success: false, error: "Failed to scrape draft data" }, { status: 500 });
    }
}
