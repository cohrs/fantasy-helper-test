import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const sql = getDb();

// Same normalization function as scraper
function normalizeTeamName(name: string | null): string | null {
    if (!name) return null;
    
    return name
        .trim()
        .toLowerCase()              // Convert to lowercase
        .replace(/^the\s+/i, '')    // Remove "The" prefix
        .replace(/[''`]/g, '')      // Remove ALL apostrophes and quotes
        .replace(/\s*-\s*/g, '-')   // Normalize spaces around hyphens (K- Bandits -> K-Bandits)
        .replace(/\s+/g, ' ')       // Normalize spaces
        .replace(/[^\w\s-]/g, '')   // Remove special chars except hyphen
        .trim()
        .split(' ')                 // Split into words
        .map(w => w.charAt(0).toUpperCase() + w.slice(1)) // Title case each word
        .join(' ');                 // Join back
}

export async function POST(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueIdParam = searchParams.get('leagueId');
        
        if (!leagueIdParam) {
            return NextResponse.json({ 
                error: 'leagueId parameter required' 
            }, { status: 400 });
        }
        
        const leagueId = parseInt(leagueIdParam);
        
        // Get all unique team names from draft_picks for this league
        const teams = await sql`
            SELECT DISTINCT drafted_by 
            FROM draft_picks 
            WHERE league_id = ${leagueId} AND drafted_by IS NOT NULL
        `;
        
        console.log(`🔧 Found ${teams.length} unique team names to normalize`);
        
        const updates: Array<{old: string, new: string}> = [];
        
        // Normalize each team name
        for (const team of teams) {
            const oldName = team.drafted_by;
            const newName = normalizeTeamName(oldName);
            
            if (oldName !== newName && newName) {
                updates.push({ old: oldName, new: newName });
                
                console.log(`  ✓ "${oldName}" → "${newName}"`);
                
                // Update all picks with this team name
                await sql`
                    UPDATE draft_picks 
                    SET drafted_by = ${newName}
                    WHERE league_id = ${leagueId} AND drafted_by = ${oldName}
                `;
            }
        }
        
        // Get final team list
        const finalTeams = await sql`
            SELECT drafted_by, COUNT(*) as picks
            FROM draft_picks 
            WHERE league_id = ${leagueId} AND drafted_by IS NOT NULL
            GROUP BY drafted_by
            ORDER BY drafted_by
        `;
        
        console.log(`✅ Normalization complete. ${finalTeams.length} unique teams remaining.`);
        
        return NextResponse.json({
            success: true,
            updates,
            finalTeams,
            message: `Normalized ${updates.length} team names. ${finalTeams.length} unique teams remaining.`
        });
        
    } catch (error) {
        console.error('Error normalizing teams:', error);
        return NextResponse.json({ 
            error: 'Failed to normalize team names',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
