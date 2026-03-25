import { NextRequest, NextResponse } from 'next/server';
import { getChatHistory } from '@/lib/db';

export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const leagueKeyParam = searchParams.get('leagueKey');
        
        if (!leagueKeyParam) {
            return NextResponse.json({ error: 'League key required' }, { status: 400 });
        }
        
        const leagueKey = leagueKeyParam;
        const history = await getChatHistory(leagueKey);
        
        // Transform to chat format
        const chatMessages = history.flatMap((entry: any) => {
            const messages = [];
            
            // User message
            messages.push({
                role: 'user' as const,
                parts: [{ text: entry.prompt }],
                timestamp: entry.created_at
            });
            
            // Assistant response
            const recommendations = typeof entry.recommendations === 'string' 
                ? JSON.parse(entry.recommendations)
                : entry.recommendations;
            
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
