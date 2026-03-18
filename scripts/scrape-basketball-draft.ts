import { neon } from '@neondatabase/serverless';
import axios from 'axios';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const sql = neon(process.env.POSTGRES_URL!);

const BASKETBALL_URL = "https://www.tapatalk.com/groups/asshatrotoleagues/2025-2026-player-list-t611.html";
const BASKETBALL_LEAGUE_ID = 3; // Asshat Basketball 2025-2026

async function scrapeBasketballDraft() {
  console.log('🏀 Scraping basketball draft from Tapatalk...\n');

  try {
    const { data } = await axios.get(BASKETBALL_URL, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    let cleanContent = data.replace(/&nbsp;/g, " ")
      .replace(/&#160;/g, " ")
      .replace(/\u00A0/g, " ")
      .replace(/&middot;/g, "·");

    cleanContent = cleanContent.replace(/<\/?[^>]+(>|$)/g, "\n");

    const lines = cleanContent.split('\n');
    const results: { rd: number; pk: number; tm: string | null; name: string; pos: string; playerTeam: string; isKeeper: boolean }[] = [];

    lines.forEach((line: string) => {
      const cleanLine = line.trim();
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
          // Handle Round assignments
          const roundMatch = namePart.match(/(\d+)\s*(?:st|nd|rd|th)\s*Round\s*-\s*(.*)/i);
          if (roundMatch) {
            forcedRound = parseInt(roundMatch[1]);
            tm = roundMatch[2].trim();
            namePart = namePart.replace(roundMatch[0], '').trim();
          }
        }

        // Parse name and position (e.g. "LeBron James LAL - SF")
        let nameSplit = namePart.split('-');
        let nameRaw = nameSplit[0].trim();
        let pos = nameSplit.length > 1 ? nameSplit[1].trim() : "UTIL";

        // Extract team from the end of the name string
        let nameWords = nameRaw.split(' ');
        let playerTeam = nameWords.pop() || "FA";
        let name = nameWords.join(' ');

        // Basketball is 12 teams (adjust if different)
        const calculatedRound = forcedRound !== null ? forcedRound : Math.floor((pk - 1) / 12) + 1;
        results.push({ rd: calculatedRound, pk, name, pos, tm, playerTeam, isKeeper });
      }
    });

    // Remove duplicates
    const uniquePicks = Array.from(new Map(results.map(item => [item.pk, item])).values());
    uniquePicks.sort((a, b) => a.pk - b.pk);

    console.log(`📊 Found ${uniquePicks.length} picks\n`);

    // Save to database
    let inserted = 0;
    for (const pick of uniquePicks) {
      try {
        await sql`
          INSERT INTO draft_picks (league_id, round, pick, player_name, position, team_abbr, drafted_by, is_keeper)
          VALUES (
            ${BASKETBALL_LEAGUE_ID},
            ${pick.rd}, 
            ${pick.pk}, 
            ${pick.name}, 
            ${pick.pos}, 
            ${pick.playerTeam}, 
            ${pick.tm}, 
            ${pick.isKeeper}
          )
          ON CONFLICT (league_id, pick) DO NOTHING
        `;
        inserted++;
      } catch (err) {
        console.error(`Error inserting pick ${pick.pk}:`, err);
      }
    }

    console.log(`✅ Inserted ${inserted} basketball draft picks`);
    console.log(`\nSample picks:`);
    uniquePicks.slice(0, 5).forEach(p => {
      console.log(`  ${p.pk}. ${p.name} (${p.pos}) - ${p.playerTeam} ${p.tm ? `[${p.tm}]` : ''}`);
    });

    console.log('\n🎉 Basketball draft scraping complete!');

  } catch (error) {
    console.error('❌ Error scraping basketball draft:', error);
    throw error;
  }
}

scrapeBasketballDraft();
