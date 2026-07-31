import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players, runs } from '@/db/schema';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { playerId, characterId, seed } = body;

    if (!playerId || !characterId) {
      return NextResponse.json({ ok: false, error: 'Missing required parameters' }, { status: 400 });
    }

    // Ensure player row exists
    const existingPlayer = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    if (existingPlayer.length === 0) {
      await db.insert(players).values({ id: playerId, gold: 0, gems: 0, bestScore: 0 });
    }

    const runId = `run_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
    const effectiveSeed = seed ?? Math.floor(Math.random() * 1000000);

    await db.insert(runs).values({
      id: runId,
      playerId,
      characterId,
      seed: effectiveSeed,
      status: 'ACTIVE',
    });

    return NextResponse.json({ ok: true, runId, seed: effectiveSeed });
  } catch (error) {
    console.error('Error starting run:', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
