import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players, runs } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { runId, playerId, score, wave, kills, result } = body;

    if (!playerId || score === undefined || wave === undefined) {
      return NextResponse.json({ ok: false, error: 'Missing parameters' }, { status: 400 });
    }

    // Reglas de negocio server-side (TDD §4.1 / §4.2): El cliente propone resultado, backend siempre recalcula rewards
    const goldEarned = Math.floor(score * 0.1 + wave * 10 + kills * 2);
    const gemsEarned = wave >= 5 ? Math.floor(wave * 0.5) : 0;
    const finalStatus = result === 'victory' ? 'COMPLETED' : 'FAILED';

    // Update run
    if (runId) {
      await db.update(runs)
        .set({
          score, wave, kills, goldEarned, gemsEarned, status: finalStatus,
        })
        .where(eq(runs.id, runId));
    }

    // Update player wallet & best score
    const playerRows = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    const currentBest = playerRows[0]?.bestScore ?? 0;
    const newBest = Math.max(currentBest, score);

    await db.update(players)
      .set({
        gold: sql`${players.gold} + ${goldEarned}`,
        gems: sql`${players.gems} + ${gemsEarned}`,
        bestScore: newBest,
      })
      .where(eq(players.id, playerId));

    return NextResponse.json({
      ok: true,
      rewards: {
        gold: goldEarned,
        gems: gemsEarned,
        score,
        bestScore: newBest,
      },
    });
  } catch (error) {
    console.error('Error ending run:', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
