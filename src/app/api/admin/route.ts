import { NextResponse } from 'next/server';
import { getServerSession } from "next-auth/next";
import { authOptions } from "../auth/[...nextauth]/route";
import { getDb, getUserId } from '@/lib/db';

const sql = getDb();
export const dynamic = 'force-dynamic';

// Check if current user is admin
async function isAdmin(session: any): Promise<boolean> {
  if (!session?.user?.email) return false;
  const result = await sql`SELECT role FROM users WHERE email = ${session.user.email} LIMIT 1`;
  return result[0]?.role === 'admin';
}

// GET - List all users (admin only)
export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!await isAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const users = await sql`
      SELECT u.id, u.email, u.nickname, u.yahoo_guid, u.role, u.is_blocked, u.created_at,
        (SELECT COUNT(*) FROM chat_history WHERE user_id = u.id) as chat_count,
        (SELECT COUNT(*) FROM user_leagues WHERE user_id = u.id) as league_count
      FROM users u ORDER BY u.created_at DESC
    `;

    return NextResponse.json({ success: true, users });
  } catch (error) {
    console.error('[Admin] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}


// POST - Update user (block/unblock, change role)
export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!await isAdmin(session)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { action, userId, value } = await request.json();
    if (!userId || !action) {
      return NextResponse.json({ error: 'Missing action or userId' }, { status: 400 });
    }

    // Don't allow admin to block themselves
    const myId = await getUserId(session);
    if (userId === myId && action === 'block') {
      return NextResponse.json({ error: 'Cannot block yourself' }, { status: 400 });
    }

    switch (action) {
      case 'block':
        await sql`UPDATE users SET is_blocked = true WHERE id = ${userId}`;
        break;
      case 'unblock':
        await sql`UPDATE users SET is_blocked = false WHERE id = ${userId}`;
        break;
      case 'setRole':
        if (!['admin', 'user'].includes(value)) {
          return NextResponse.json({ error: 'Invalid role' }, { status: 400 });
        }
        await sql`UPDATE users SET role = ${value} WHERE id = ${userId}`;
        break;
      default:
        return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[Admin POST] Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
