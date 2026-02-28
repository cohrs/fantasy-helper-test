import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";

const LEAGUE_KEY = '469.l.4136';

export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);

        if (!session || !(session as any).accessToken) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const accessToken = (session as any).accessToken;
        const { searchParams } = new URL(request.url);
        const endpoint = searchParams.get('endpoint') || 'league';

        let yahooUrl = '';
        if (endpoint === 'players') {
            yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${LEAGUE_KEY}/players;start=0;count=5;format=json`;
        } else {
            yahooUrl = `https://fantasysports.yahooapis.com/fantasy/v2/league/${LEAGUE_KEY}?format=json`;
        }

        console.log('[Yahoo Debug] Testing URL:', yahooUrl);

        const response = await fetch(yahooUrl, {
            headers: { "Authorization": `Bearer ${accessToken}` },
        });

        const text = await response.text();
        console.log('[Yahoo Debug] Status:', response.status);
        console.log('[Yahoo Debug] First 2000 chars:', text.substring(0, 2000));

        return NextResponse.json({
            endpoint,
            url: yahooUrl,
            status: response.status,
            raw: text.substring(0, 4000),
        });

    } catch (error) {
        console.error('[Yahoo Debug] Error:', error);
        return NextResponse.json({ error: String(error) }, { status: 500 });
    }
}
