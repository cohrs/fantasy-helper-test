import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';
const DB_FILE = path.join(process.cwd(), 'draft-results.json');
const ROSTER_FILE = path.join(process.cwd(), 'my-roster.json');

export async function GET() {
    let draft: any[] = [];
    let roster: any[] = [];
    try {
        if (fs.existsSync(DB_FILE)) {
            draft = JSON.parse(fs.readFileSync(DB_FILE, 'utf-8'));
        }
        if (fs.existsSync(ROSTER_FILE)) {
            roster = JSON.parse(fs.readFileSync(ROSTER_FILE, 'utf-8'));
        }
    } catch (err) {
        console.error("Error reading JSON DB files:", err);
    }
    return NextResponse.json({ draft, roster });
}

export async function POST(req: Request) {
    try {
        const { action, player, rosterData } = await req.json();

        // Support direct roster overwrite
        if (action === 'SYNC_ROSTER') {
            fs.writeFileSync(ROSTER_FILE, JSON.stringify(rosterData, null, 2));
            return NextResponse.json({ success: true });
        }

        return NextResponse.json({ success: false, error: "Invalid action" });
    } catch (err) {
        console.error("Error writing JSON DB file:", err);
        return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
    }
}
