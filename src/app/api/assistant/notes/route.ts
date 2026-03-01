import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const notesFile = path.join(process.cwd(), 'ai-notes.json');
        if (fs.existsSync(notesFile)) {
            const data = JSON.parse(fs.readFileSync(notesFile, 'utf-8'));

            // Transform the array of recommendations into a Record<string, string> (name -> rationale)
            // If a player has multiple recommendations across different chat sessions, concatenate them.
            const notesMap: Record<string, string> = {};
            data.forEach((item: any) => {
                if (item.name && item.rationale) {
                    const key = item.name.toLowerCase();
                    if (notesMap[key]) {
                        // Append with a separator if it already exists
                        notesMap[key] = notesMap[key] + '\n\n---\n\n' + item.rationale;
                    } else {
                        notesMap[key] = item.rationale;
                    }
                }
            });
            return NextResponse.json(notesMap);
        }
        return NextResponse.json({});
    } catch (err) {
        console.error("Error reading AI notes map:", err);
        return NextResponse.json({});
    }
}
