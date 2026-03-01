import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const notesFile = path.join(process.cwd(), 'public', 'test-assistant-response.json');
        if (fs.existsSync(notesFile)) {
            const data = JSON.parse(fs.readFileSync(notesFile, 'utf-8'));

            // Transform the array of recommendations into a Record<string, string> (name -> rationale)
            const notesMap: Record<string, string> = {};
            data.forEach((item: any) => {
                if (item.name && item.rationale) {
                    notesMap[item.name.toLowerCase()] = item.rationale;
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
