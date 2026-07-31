import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const existing = await db.select().from(players).where(eq(players.id, id)).limit(1);

    if (existing.length > 0) {
      return NextResponse.json({ ok: true, player: existing[0] });
    }

    // Create player if not exists
    const [newPlayer] = await db.insert(players).values({ id, gold: 0, gems: 0, bestScore: 0 }).returning();
    return NextResponse.json({ ok: true, player: newPlayer });
  } catch (error) {
    console.error('Error fetching player profile:', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
