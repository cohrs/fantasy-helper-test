import { getDb } from '../src/lib/db';

const sql = getDb();

async function checkDraftStatus() {
    try {
        console.log('🔍 Checking draft status for league 2...\n');
        
        // Get total picks
        const totalPicks = await sql`
            SELECT COUNT(*) as count
            FROM draft_picks
            WHERE league_id = 2
        `;
        
        console.log(`📊 Total picks in database: ${totalPicks[0].count}`);
        
        // Get picks by team
        const teamCounts = await sql`
            SELECT drafted_by, COUNT(*) as picks
            FROM draft_picks
            WHERE league_id = 2 AND drafted_by IS NOT NULL
            GROUP BY drafted_by
            ORDER BY drafted_by
        `;
        
        console.log('\n👥 Picks per team:');
        teamCounts.forEach((team: any) => {
            const status = team.picks < 10 ? '⚠️ ' : '✓ ';
            console.log(`  ${status} ${team.drafted_by}: ${team.picks} picks`);
        });
        
        // Get your team's picks
        const myPicks = await sql`
            SELECT player_name, position, round, pick
            FROM draft_picks
            WHERE league_id = 2 AND drafted_by = 'New Jersey Nine'
            ORDER BY pick ASC
        `;
        
        console.log('\n🏆 Your picks (New Jersey Nine):');
        myPicks.forEach((pick: any) => {
            console.log(`  Pick ${pick.pick} (R${pick.round}): ${pick.player_name} - ${pick.position}`);
        });
        
        // Get latest pick
        const latestPick = await sql`
            SELECT player_name, drafted_by, round, pick
            FROM draft_picks
            WHERE league_id = 2 AND drafted_by IS NOT NULL
            ORDER BY pick DESC
            LIMIT 1
        `;
        
        if (latestPick.length > 0) {
            console.log(`\n🔴 Latest pick in database: Pick ${latestPick[0].pick} (R${latestPick[0].round}) - ${latestPick[0].player_name} to ${latestPick[0].drafted_by}`);
        }
        
        // Check for keepers
        const keepers = await sql`
            SELECT COUNT(*) as count
            FROM draft_picks
            WHERE league_id = 2 AND is_keeper = true
        `;
        
        console.log(`\n🔒 Keepers: ${keepers[0].count}`);
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

checkDraftStatus();
