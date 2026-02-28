import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(request: NextRequest) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey || apiKey === "undefined") {
            throw new Error("GEMINI_API_KEY environment variable is missing. Did you restart the server after adding it to .env.local?");
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

        const body = await request.json();
        const { myTeam, openSlots, availablePool, picksUntilTurn, customPrompt, chatHistory = [] } = body;

        // Build a compact representation of the full available pool
        const topBoardClipped = (availablePool || []).map((p: any) =>
            `${p.yahooRank || p.adp}. ${p.name} (${p.team} - ${p.pos})`
        ).join('\n');

        const systemContext = `You are a cutthroat expert fantasy baseball analyst playing in a massively deep 18-team, 7x7 categories league (R, H, HR, RBI, SB, AVG, OPS x W, SV, K, HLD, ERA, WHIP, QS).
Rosters are extraordinarily deep: C, 1B, 2B, 3B, SS, LF, CF, RF, Util, SP, SP, SP, SP, RP, RP, P, P, BNx4.
Because 10 players are kept per team (180 total elite players off the board), the draft pool consists mostly of mid-tier to deep sleepers and prospects.

=== IMPORTANT GROUNDING RULE ===
You MUST use your Google Search tool to verify the most recent 2026 spring training news, injury statuses, and positional changes before recommending any player. Real-time accuracy is critical.

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
Respond with EXACTLY 3 recommended players as a JSON array and NOTHING ELSE:
[
  {
    "name": "Player Name",
    "pos": "Position String",
    "rank": "ADP or AR number",
    "team": "Team Abbreviation",
    "rationale": "2-3 sentences on why they fit this roster right now vs waiting."
  }
]`;

        // Build multi-turn conversation: system bootstrap + prior history + current request
        const contents = [
            { role: 'user' as const, parts: [{ text: systemContext }] },
            { role: 'model' as const, parts: [{ text: 'Understood. Ready to analyze with live 2026 data.' }] },
            ...chatHistory,
        ];

        const response = await model.generateContent({
            contents,
            tools: [{ googleSearch: {} } as any],
            generationConfig: {
                temperature: 0.7,
            }
        });

        const text = response.response.text();
        let recommendations = [];
        try {
            // Extract JSON from anywhere in the text - handles leading/trailing markdown fences and whitespace
            const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/) || text.match(/```\s*([\s\S]*?)\s*```/) || text.match(/(\[\s*\{[\s\S]*\}\s*\])/);
            const cleaned = jsonMatch ? jsonMatch[1].trim() : text.trim();
            recommendations = JSON.parse(cleaned || "[]");
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", text);
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
