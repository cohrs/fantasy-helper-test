import { NextRequest, NextResponse } from 'next/server';
import { getChatHistory, getUserId } from '@/lib/db';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueKeyParam = searchParams.get('leagueKey');
        
        if (!leagueKeyParam) {
            return NextResponse.json({ error: 'League key required' }, { status: 400 });
        }
        
        const session = await getServerSession(authOptions);
        const userId = await getUserId(session);
        const history = await getChatHistory(leagueKeyParam, 20, userId);
        
        const chatMessages = history.flatMap((entry: any) => {
            const messages = [];
            messages.push({
                role: 'user' as const,
                parts: [{ text: entry.prompt }],
                timestamp: entry.created_at
            });
            const recommendations = typeof entry.recommendations === 'string' 
                ? JSON.parse(entry.recommendations) : entry.recommendations;
            messages.push({
                role: 'model' as const,
                parts: [{ text: entry.raw_response }],
                recommendations: recommendations || [],
                timestamp: entry.created_at
            });
            return messages;
        });
        
        return NextResponse.json({ history: chatMessages });
    } catch (error) {
        console.error('Chat history API Error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Unknown error' },
            { status: 500 }
        );
    }
}
