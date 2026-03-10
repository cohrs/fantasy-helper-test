import { getDb } from '../src/lib/db';
import { getDefaultYahooAccessToken } from '../src/lib/yahoo-auth';

const sql = getDb();

async function fetchRosterPositions() {
    try {
        // Get the baseball league info
        const leagueResult = await sql`
            SELECT league_key, sport, league_name
            FROM user_leagues
            WHERE id = 2
        `;
        
        if (!leagueResult.length) {
            console.error('❌ League not found');
            process.exit(1);
        }
        
        const { league_key, sport, league_name } = leagueResult[0];
        
        console.log(`\n📋 Fetching roster positions for: ${league_name} (${sport})`);
        console.log(`League Key: ${league_key}\n`);
        
        // Get access token from database
        const accessToken = await getDefaultYahooAccessToken();
        
        if (!accessToken) {
            console.error('❌ No valid access token available');
            console.error('Please log in to the app first to authorize Yahoo access');
            process.exit(1);
        }
        
        // Fetch league settings from Yahoo
        const yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${league_key}/settings?format=json`;
        
        const response = await fetch(yahooUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('❌ Yahoo API Error:', response.status, errorText);
            process.exit(1);
        }
        
        const data = await response.json();
        const league = data?.fantasy_content?.league;
        
        if (!league || !Array.isArray(league)) {
            console.error('❌ Invalid response from Yahoo');
            process.exit(1);
        }
        
        // Extract roster positions
        let rosterPositions: any[] = [];
        
        league.forEach((item: any) => {
            if (item.settings) {
                const settingsArray = item.settings[0];
                
                if (settingsArray.roster_positions) {
                    const positions = settingsArray.roster_positions;
                    for (const key in positions) {
                        if (key === 'count') continue;
                        const pos = positions[key].roster_position;
                        if (pos) {
                            rosterPositions.push({
                                position: pos.position,
                                count: parseInt(pos.count || '1'),
                                abbreviation: pos.abbreviation || pos.position
                            });
                        }
                    }
                }
            }
        });
        
        console.log('✅ Roster Positions:\n');
        rosterPositions.forEach(pos => {
            console.log(`  ${pos.position.padEnd(6)} × ${pos.count}`);
        });
        
        console.log('\n📊 Total roster spots:', rosterPositions.reduce((sum, p) => sum + p.count, 0));
        
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

fetchRosterPositions();
