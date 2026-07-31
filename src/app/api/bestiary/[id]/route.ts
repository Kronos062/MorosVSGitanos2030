import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { bestiary } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: playerId } = await params;
    const records = await db.select().from(bestiary).where(eq(bestiary.playerId, playerId));
    const result: Record<string, number> = {};
    for (const r of records) {
      result[r.enemyId] = r.kills;
    }
    return NextResponse.json({ ok: true, bestiary: result });
  } catch (error) {
    console.error('Error fetching bestiary:', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
