import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const notesFile = path.join(process.cwd(), 'ai-notes.json');
        if (fs.existsSync(notesFile)) {
            const data = JSON.parse(fs.readFileSync(notesFile, 'utf-8'));
            return NextResponse.json(data);
        }
        return NextResponse.json({});
    } catch (err) {
        console.error("Error reading AI notes map:", err);
        return NextResponse.json({});
    }
}
