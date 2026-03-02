import { NextResponse } from 'next/server';
import { getPlayerNotes } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const notes = await getPlayerNotes();
        return NextResponse.json(notes);
    } catch (err) {
        console.error("Error reading AI notes from database:", err);
        return NextResponse.json({});
    }
}
