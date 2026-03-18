import { getDb } from './src/lib/db.ts';

const sql = getDb();

const note = `[3/9/2026 ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}] ### Gabriel Moreno: Analysis & Recommendation

Here's a cutthroat analysis of your catcher, Gabriel Moreno, and what you should do with him in this deep 18-team, 7x7 format.

**Performance & Outlook**

Gabriel Moreno took a significant step forward offensively in 2025, even though his season was shortened by injuries. In just 83 games (309 plate appearances), he posted a strong .285 batting average, a .353 on-base percentage, and a .433 slugging percentage, all of which were career highs. He hit 9 home runs, drove in 40 runs, and scored 44 times. The underlying metrics support this improvement; his barrel percentage (7.1%), hard-hit rate (43.4%), and average exit velocity (90.4 mph) were all the best of his career.

The primary concern with Moreno is his health. He has missed significant time in consecutive seasons with various injuries, including a fractured finger in 2025. However, when he's on the field, he's a productive asset, especially for a catcher. His excellent contact skills give him a high floor in batting average, a category where many catchers are a drain. While he may never be a 20-homer threat, projections for 2026 see him hitting around 11 home runs with a .279 average and solid counting stats if he can play a full season. Recent spring training reports are encouraging; he launched a 460-foot home run, his furthest and hardest-hit ball of his career, signaling that the power gains could be real.

**Keep or Trade?**

**Verdict: Keep.**

In a massively deep 18-team league that starts two catchers and has 10 keepers, a player like Moreno is a significant asset. Catcher is a notoriously shallow position, and having one who provides a strong batting average, good on-base skills (which boosts his OPS), and developing power is a major advantage. Your league's depth makes the replacement level at catcher incredibly low, meaning a reliable starter like Moreno is far more valuable than in standard leagues.

While his injury history is a legitimate red flag, his production when healthy is borderline elite for the position. The Diamondbacks have shown their commitment to him, and he's expected to be a key part of their lineup. The team even re-signed veteran James McCann, which could allow Moreno to get some at-bats at DH to keep him healthy and in the lineup more often.

Trading him would create a significant hole on your roster that would be difficult to fill with the available player pool. You would likely have to settle for a catcher with a much lower floor, who could hurt you in AVG and OPS. Given that you've already kept him, his value to your roster is higher than what you would likely receive in a trade, as other managers will try to exploit his injury history in negotiations.

Hold onto Moreno. His combination of a high batting average floor and emerging power at a scarce position makes him a cornerstone of your roster in this format. The risk is outweighed by the potential reward of a top-5 fantasy catcher if he can stay on the field for 120+ games.`;

async function savePeteNote() {
  console.log('💾 Saving Gabriel Moreno note...\n');
  
  const playerName = 'Gabriel Moreno';
  const normalized = 'gabrielmoreno';
  const leagueId = 2;
  
  await sql`
    INSERT INTO player_notes (league_id, player_name, player_name_normalized, notes, updated_at)
    VALUES (${leagueId}, ${playerName}, ${normalized}, ${note}, CURRENT_TIMESTAMP)
    ON CONFLICT (league_id, player_name_normalized)
    DO UPDATE SET 
      notes = ${note},
      updated_at = CURRENT_TIMESTAMP
  `;
  
  console.log('✅ Saved Gabriel Moreno note to database');
  
  // Verify
  const check = await sql`
    SELECT player_name, LEFT(notes, 100) as preview
    FROM player_notes
    WHERE player_name_normalized = 'gabrielmoreno' AND league_id = 2
  `;
  
  if (check.length > 0) {
    console.log('\n✅ Verified:');
    console.log(`   Player: ${check[0].player_name}`);
    console.log(`   Preview: ${check[0].preview}...`);
  }
}

savePeteNote()
  .then(() => process.exit(0))
  .catch(e => { console.error(e); process.exit(1); });
