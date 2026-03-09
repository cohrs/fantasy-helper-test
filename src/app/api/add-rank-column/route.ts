import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

const sql = getDb();

export async function POST() {
    try {
        // Add rank column to draft_picks table
        await sql`
            ALTER TABLE draft_picks 
            ADD COLUMN IF NOT EXISTS rank INT
        `;
        
        return NextResponse.json({
            success: true,
            message: 'Added rank column to draft_picks table'
        });
        
    } catch (error) {
        console.error('Error adding rank column:', error);
        return NextResponse.json({ 
            error: 'Failed to add rank column',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
