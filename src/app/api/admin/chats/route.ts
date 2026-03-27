import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../../auth/[...nextauth]/route";
import { getDb } from '@/lib/db';

const sql = getDb();
export const dynamic = 'force-dynamic';

async function isAdmin(session: any): Promise<boolean> {
  if (!session?.user?.email) return false;
  const result = await sql`SELECT role FROM users WHERE email = ${session.user.email} LIMIT 1`;
  return result[0]?.role === 'admin';
}

// GET - View a user's chat history (admin only)
export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!await isAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const leagueKey = searchParams.get('leagueKey');

    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 });
    }

    const chats = leagueKey
      ? await sql`
          SELECT id, league_key, prompt, raw_response, created_at
          FROM chat_history
          WHERE user_id = ${parseInt(userId)} AND league_key = ${leagueKey}
          ORDER BY created_at DESC LIMIT 50
        `
      : await sql`
          SELECT id, league_key, prompt, raw_response, created_at
          FROM chat_history
          WHERE user_id = ${parseInt(userId)}
          ORDER BY created_at DESC LIMIT 50
        `;

    return NextResponse.json({ success: true, chats });
  } catch (error) {
    console.error('[Admin Chats] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
