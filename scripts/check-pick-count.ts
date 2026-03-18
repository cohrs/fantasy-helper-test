import { getDb } from '../src/lib/db';

const sql = getDb();

async function checkPickCount() {
    try {
        // Get latest picks
        const latestPicks = await sql`
            SELECT pick, player_name, drafted_by, is_keeper
            FROM draft_picks
            WHERE league_id = 2 AND drafted_by IS NOT NULL
            ORDER BY pick DESC
            LIMIT 10
        `;
        
        console.log('🔴 Latest 10 picks:');
        latestPicks.reverse().forEach((p: any) => {
            const type = p.is_keeper ? '[KEEPER]' : '[DRAFT]';
            console.log(`  Pick ${p.pick} ${type}: ${p.player_name} → ${p.drafted_by}`);
        });
        
        // Count non-keeper picks
        const draftPickCount = await sql`
            SELECT COUNT(*) as count
            FROM draft_picks
            WHERE league_id = 2 AND drafted_by IS NOT NULL AND is_keeper = false
        `;
        
        console.log(`\n📊 Total draft picks (non-keepers): ${draftPickCount[0].count}`);
        
        // Check if Chad Patrick is there
        const chadPick = await sql`
            SELECT pick, drafted_by, is_keeper
            FROM draft_picks
            WHERE league_id = 2 AND player_name LIKE '%Chad%Patrick%'
        `;
        
        if (chadPick.length > 0) {
            console.log(`\n✅ Chad Patrick found: Pick ${chadPick[0].pick} to ${chadPick[0].drafted_by} (Keeper: ${chadPick[0].is_keeper})`);
        } else {
            console.log(`\n❌ Chad Patrick NOT found in database`);
        }
        
        // Calculate next pick
        const currentPick = draftPickCount[0].count + 1;
        const myPosition = 11;
        const totalTeams = 18;
        
        // Linear draft: position 11 picks at 11, 29, 47, 65, etc.
        const currentRound = Math.floor((currentPick - 1) / totalTeams) + 1;
        const pickInRound = ((currentPick - 1) % totalTeams) + 1;
        
        console.log(`\n🎯 Current pick: ${currentPick} (Round ${currentRound}, Pick ${pickInRound})`);
        console.log(`   Your position: ${myPosition}`);
        
        if (pickInRound === myPosition) {
            console.log(`   ✅ IT'S YOUR PICK!`);
        } else if (pickInRound < myPosition) {
            const picksUntil = myPosition - pickInRound;
            console.log(`   ⏳ ${picksUntil} picks until your turn`);
        } else {
            const picksUntil = (totalTeams - pickInRound) + myPosition;
            console.log(`   ⏳ ${picksUntil} picks until your turn (next round)`);
        }
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkPickCount();
