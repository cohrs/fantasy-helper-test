import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getDb, getSelectedLeagueId, saveChatHistory } from '@/lib/db';
import { getYahooAccessTokenByEmail } from '@/lib/yahoo-auth';

const sql = getDb();
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { message, chatHistory = [], leagueId: bodyLeagueId } = body;

    const leagueId = bodyLeagueId || await getSelectedLeagueId(session);
    if (!leagueId) {
      return NextResponse.json({ error: 'No league selected' }, { status: 400 });
    }

    // Get league info
    const leagueResult = await sql`SELECT league_key, sport, league_name, team_key FROM user_leagues WHERE id = ${leagueId}`;
    if (!leagueResult.length) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }
    const { sport, league_name, team_key } = leagueResult[0];

    // Get Yahoo token for live data
    const accessToken = await getYahooAccessTokenByEmail(session.user.email);
    console.log('🔑 Yahoo token available:', !!accessToken, '| team_key:', team_key);

    // Fetch live roster from Yahoo
    let rosterContext = '';
    const injuredPlayers: string[] = [];
    if (accessToken && team_key) {
      try {
        const rosterResp = await fetch(
          `https://fantasysports.yahooapis.com/fantasy/v2/team/${team_key}/roster/players?format=json`,
          { headers: { 'Authorization': `Bearer ${accessToken}` } }
        );
        console.log('📋 Yahoo roster response:', rosterResp.status);
        if (rosterResp.ok) {
          const rosterData = await rosterResp.json();
          const playersRaw = rosterData?.fantasy_content?.team?.[1]?.roster?.['0']?.players;
          if (playersRaw) {
            const players: string[] = [];
            for (const key in playersRaw) {
              if (key === 'count') continue;
              const p = playersRaw[key]?.player;
              if (!p) continue;
              const info = p[0];
              const findField = (fk: string) => {
                for (const item of info) {
                  if (typeof item === 'object' && item !== null && fk in item) return item[fk];
                }
                return null;
              };
              const nameObj = findField('name');
              const name = nameObj?.full || 'Unknown';
              const team = findField('editorial_team_abbr') || 'FA';
              const positions = findField('eligible_positions');
              const pos = Array.isArray(positions) ? positions.map((ep: { position?: string }) => ep.position).filter(Boolean).join('/') : '?';
              const status = findField('status') || '';
              const statusFull = findField('status_full') || '';
              const selectedPos = findField('selected_position');
              const slot = selectedPos?.[1]?.position || 'BN';

              const statusTag = status ? ` [${status} - ${statusFull}]` : '';
              players.push(`${slot}: ${name} (${team}, ${pos})${statusTag}`);
              if (status) injuredPlayers.push(`${name} (${team}, ${pos}) — ${statusFull || status}`);
            }
            rosterContext = players.join('\n');
          }
        }
      } catch (e) {
        console.error('Error fetching live roster:', e);
      }
    }

    // Fallback: load roster from DB if Yahoo fetch failed
    if (!rosterContext && team_key) {
      try {
        console.log('📋 Falling back to DB roster data...');
        const dbRoster = await sql`
          SELECT player_name, position, nba_team as mlb_team, status 
          FROM team_rosters 
          WHERE league_id = ${leagueId} AND team_key = ${team_key}
          ORDER BY player_name
        `;
        if (dbRoster.length > 0) {
          const players: string[] = [];
          for (const r of dbRoster) {
            const statusTag = r.status && r.status !== 'Active' ? ` [${r.status}]` : '';
            players.push(`${r.player_name} (${r.mlb_team}, ${r.position})${statusTag}`);
            if (r.status && r.status !== 'Active') {
              injuredPlayers.push(`${r.player_name} (${r.mlb_team}, ${r.position}) — ${r.status}`);
            }
          }
          rosterContext = players.join('\n');
          console.log(`✅ Loaded ${dbRoster.length} players from DB`);
        }
      } catch (e) {
        console.error('Error loading DB roster:', e);
      }
    }

    if (!rosterContext) {
      rosterContext = 'Roster data unavailable — Yahoo token may be expired. Please re-login.';
    }

    // Fetch standings
    let standingsContext = '';
    try {
      const standings = await sql`SELECT team_name, rank, wins, losses, ties, points_for FROM standings WHERE league_id = ${leagueId} ORDER BY rank ASC`;
      if (standings.length > 0) {
        standingsContext = '\n=== STANDINGS ===\n' + standings.map((s) =>
          `${s.rank}. ${s.team_name} (${s.wins}-${s.losses}-${s.ties}, ${s.points_for} pts)`
        ).join('\n');
      }
    } catch { /* standings unavailable */ }

    // Fetch all team rosters from DB for trade analysis
    let allRostersContext = '';
    try {
      const allRosters = await sql`
        SELECT team_name, player_name, position, nba_team as mlb_team, status 
        FROM team_rosters 
        WHERE league_id = ${leagueId} 
        ORDER BY team_name, player_name
      `;
      if (allRosters.length > 0) {
        const byTeam: Record<string, string[]> = {};
        for (const r of allRosters) {
          const tn = r.team_name;
          if (!byTeam[tn]) byTeam[tn] = [];
          const statusTag = r.status && r.status !== 'Active' ? ` [${r.status}]` : '';
          byTeam[tn].push(`${r.player_name} (${r.mlb_team}, ${r.position})${statusTag}`);
        }
        allRostersContext = '\n=== ALL 18 TEAM ROSTERS ===\n';
        for (const [teamName, players] of Object.entries(byTeam)) {
          allRostersContext += `\n--- ${teamName} (${players.length} players) ---\n`;
          allRostersContext += players.join('\n') + '\n';
        }
      }
    } catch { /* rosters unavailable */ }

    const sportContextMap: Record<string, string> = {
      baseball: `You are an expert fantasy baseball analyst for "${league_name}", an 18-team, 7x7 categories league (R, H, HR, RBI, SB, AVG, OPS x W, SV, K, HLD, ERA, WHIP, QS).
Rosters: C, 1B, 2B, 3B, SS, LF, CF, RF, Util, SP×4, RP×2, P×2, BN×4, IL, IL+.
18 teams, 10 keepers per team (180 elite players kept off the board each year).
This is an extremely deep league — the waiver wire is barren. Trades are often the best way to improve.`,
      basketball: `You are an expert fantasy basketball analyst for "${league_name}".
18 teams, 10 keepers per team. Extremely deep league.
Help with add/drop decisions, trade analysis, waiver wire pickups, and roster optimization.
Consider player injuries, recent form, schedule (back-to-backs, games per week), and category needs.`,
    };

    const systemPrompt = `${sportContextMap[sport] || sportContextMap.baseball}

=== LEAGUE FORMAT ===
- 18 teams, 10 keepers per team
- Head-to-head categories scoring
- Very deep rosters — waiver wire is thin
- Trades are critical for roster improvement
- My team: New Jersey Nine

=== IMPORTANT ===
Use your Google Search tool to verify current injury statuses, news, and player updates before making recommendations. Real-time accuracy is critical.

=== MY ROSTER ===
${rosterContext}

${injuredPlayers.length > 0 ? `=== INJURY REPORT ===\n${injuredPlayers.join('\n')}` : ''}
${standingsContext}
${allRostersContext}

=== INSTRUCTIONS ===
- Be conversational and helpful. Answer questions about my team, players, matchups, add/drop decisions, trade analysis, etc.
- When suggesting pickups or drops, explain the reasoning clearly.
- If I ask about a specific player, look up their latest news/stats.
- You can reference my roster above to give personalized advice.
- For TRADE ANALYSIS: You have access to all 18 team rosters above. When I ask about trades:
  - Identify teams with surplus at positions I need
  - Identify what I have that other teams might want
  - Suggest realistic 1-for-1 or 2-for-1 trades with specific players
  - Consider each team's strengths/weaknesses when proposing deals
  - Factor in keeper value — young breakout players are worth more in a keeper league
- Keep responses focused and actionable — I'm here to win.`;

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

    const contents = [
      { role: 'user' as const, parts: [{ text: systemPrompt }] },
      { role: 'model' as const, parts: [{ text: `Ready to help manage your ${sport} team. What do you need?` }] },
      ...chatHistory.map((msg: { role: string; parts: { text: string }[] }) => ({ role: msg.role as 'user' | 'model', parts: msg.parts })),
      { role: 'user' as const, parts: [{ text: message }] },
    ];

    const response = await model.generateContent({
      contents,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      tools: [{ googleSearch: {} } as any],
      generationConfig: { temperature: 0.7 },
    });

    const text = response.response.text();

    // Save to chat history
    try {
      await saveChatHistory(message, text, [], leagueId);
    } catch (e) {
      console.error('Failed to save chat history:', e);
    }

    return NextResponse.json({
      message: text,
      chatHistory: [
        ...chatHistory,
        { role: 'user', parts: [{ text: message }] },
        { role: 'model', parts: [{ text }] },
      ],
    });
  } catch (error) {
    console.error('Chat API Error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
