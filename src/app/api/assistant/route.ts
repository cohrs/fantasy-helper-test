import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { getPlayerNotes, savePlayerNote, saveChatHistory } from '@/lib/db';

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === "undefined") {
            throw new Error("GEMINI_API_KEY environment variable is missing. Did you restart the server after adding it to .env.local?");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

        const body = await request.json();
        const { myTeam, openSlots, availablePool, picksUntilTurn, customPrompt, chatHistory = [], allDrafted = [] } = body;

        // Feedback Loop: Read historical AI notes from database
        const historicalNotes = await getPlayerNotes();

        let feedbackContext = '';
        if (Object.keys(historicalNotes).length > 0 && allDrafted.length > 0) {
            const draftedTargets = allDrafted.filter((d: any) =>
                d.name && historicalNotes[normalizeName(d.name)]
            );
            if (draftedTargets.length > 0) {
                feedbackContext = `\n=== PAST PREDICTION EVALUATION ===\nYou recently recommended these players who have since been DRAFTED by other teams. Use this feedback to adjust your understanding of how the room values players:\n`;
                draftedTargets.slice(0, 10).forEach((d: any) => {
                    feedbackContext += `- ${d.name} (${d.pos}) was taken by ${d.tm}.\n`;
                });
            }
        }

        // Build RECENT DRAFT TRENDS
        let draftTrendsContext = '';
        const recentPicks = [...(allDrafted || [])].sort((a: any, b: any) => b.pk - a.pk).slice(0, 20);
        if (recentPicks.length > 0) {
            draftTrendsContext = '\n=== RECENT DRAFT TRENDS (last 20 picks) ===\nUse this to calibrate how aggressively this room is drafting each position.\n';
            recentPicks.forEach((d: any) => {
                const projection = d.yahooRank || d.adp;
                if (projection && d.pk) {
                    const diff = d.pk - projection;
                    const label = diff < -10 ? `[REACHED ${Math.abs(diff)} picks early]` :
                        diff > 10 ? `[FELL ${diff} picks late]` : `[On value]`;
                    draftTrendsContext += `- Pick #${d.pk}: ${d.name} (${d.pos}) — Projected ${projection}, Actual ${d.pk} ${label}\n`;
                } else {
                    draftTrendsContext += `- Pick #${d.pk}: ${d.name} (${d.pos}) — No projection data\n`;
                }
            });
        }

        const topBoardClipped = (availablePool || []).map((p: any) =>
            `${p.yahooRank || p.adp}. ${p.name} (${p.team} - ${p.pos})`
        ).join('\n');

        const systemContext = `You are a cutthroat expert fantasy baseball analyst playing in a massively deep 18-team, 7x7 categories league (R, H, HR, RBI, SB, AVG, OPS x W, SV, K, HLD, ERA, WHIP, QS).
Rosters are extraordinarily deep: C, 1B, 2B, 3B, SS, LF, CF, RF, Util, SP, SP, SP, SP, RP, RP, P, P, BNx4.
Because 10 players are kept per team (180 total elite players off the board), the draft pool consists mostly of mid-tier to deep sleepers and prospects.

=== IMPORTANT GROUNDING RULE ===
You MUST use your Google Search tool to verify the most recent 2026 spring training news, injury statuses, and positional changes before recommending any player. Real-time accuracy is critical.
${feedbackContext}${draftTrendsContext}
=== MY ROSTER CONTEXT ===
${JSON.stringify(myTeam, null, 2)}

Open slots still needed:
${JSON.stringify(openSlots, null, 2)}

Picks until my next turn: ${picksUntilTurn}

=== AVAILABLE PLAYERS (top 150 by ADP/AR) ===
${topBoardClipped}

=== INSTRUCTIONS ===
Analyze the board using your expert knowledge of MLB prospects, playing time, and 7x7 category formats.
${customPrompt ? `\nCRITICAL USER REQUEST — MUST prioritize: "${customPrompt}"\n` : ''}

If the user is asking for player recommendations, draft advice, or "who should I pick", respond with a JSON array of recommended players:
[
  {
    "name": "Player Name",
    "pos": "Position String",
    "rank": "ADP or AR number",
    "team": "Team Abbreviation",
    "rationale": "2-3 sentences on why they fit this roster right now vs waiting."
  }
]

If the user is asking a general question about players, injuries, news, or strategy (not asking for specific recommendations), respond conversationally in plain text to answer their question. You can still provide insights and analysis, just don't force it into the JSON format.`;

        // Build multi-turn conversation
        const cleanedHistory = chatHistory.map((msg: any) => ({
            role: msg.role,
            parts: msg.parts
        }));
        
        const contents = [
            { role: 'user' as const, parts: [{ text: systemContext }] },
            { role: 'model' as const, parts: [{ text: 'Understood. Ready to analyze with live 2026 data.' }] },
            ...cleanedHistory,
        ];

        const response = await model.generateContent({
            contents,
            tools: [{ googleSearch: {} } as any],
            generationConfig: {
                temperature: 0.7,
            }
        });

        const text = response.response.text();
        let recommendations: any[] = [];
        
        try {
            // Extract JSON from response
            const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/) || text.match(/(\[\s*\{[\s\S]*\}\s*\])/);
            const cleaned = jsonMatch ? jsonMatch[1].trim() : text.trim();
            recommendations = JSON.parse(cleaned || "[]");

            // Save recommendations to database
            if (Array.isArray(recommendations) && recommendations.length > 0) {
                const now = new Date();
                const timeStr = now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' }) + ' ' + now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                
                for (const r of recommendations) {
                    if (r.name && r.rationale) {
                        const normalized = normalizeName(r.name);
                        const newNote = `[${timeStr}] ${r.rationale}`;
                        const existingNote = historicalNotes[normalized];
                        const combinedNote = existingNote 
                            ? newNote + '\n\n---\n\n' + existingNote
                            : newNote;
                        
                        await savePlayerNote(r.name, normalized, combinedNote);
                    }
                }
            } else if (customPrompt && text) {
                // Handle conversational player-specific queries
                const playerNameMatch = customPrompt.match(/(?:analyze|about|why|tell me about|what about)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)/i);
                if (playerNameMatch) {
                    const playerName = playerNameMatch[1].trim();
                    const normalized = normalizeName(playerName);
                    const now = new Date();
                    const timeStr = now.toLocaleDateString([], { month: 'numeric', day: 'numeric', year: 'numeric' }) + ' ' + now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
                    const newNote = `[${timeStr}] ${text}`;
                    const existingNote = historicalNotes[normalized];
                    const combinedNote = existingNote 
                        ? newNote + '\n\n---\n\n' + existingNote
                        : newNote;
                    
                    await savePlayerNote(playerName, normalized, combinedNote);
                }
            }
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", text);
        }

        // Save chat history to database
        try {
            await saveChatHistory(
                customPrompt || "General Analysis",
                text,
                recommendations
            );
        } catch (e) {
            console.error("Failed to save chat history:", e);
        }

        return NextResponse.json({ recommendations, assistantMessage: text });
    } catch (error) {
        console.error('Assistant API Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error generating recommendation' },
            { status: 500 }
        );
    }
}

// Helper function to normalize player names
function normalizeName(name: string) {
    return name
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z\s]/g, '')
        .replace(/\s+(jr|sr|ii|iii)$/, '')
        .trim()
        .replace(/\s+/g, '');
}
