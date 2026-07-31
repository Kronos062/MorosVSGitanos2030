import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { players, shopUpgrades } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { playerId, stat } = body;

    if (!playerId || !stat) {
      return NextResponse.json({ ok: false, error: 'Missing parameters' }, { status: 400 });
    }

    // Get current upgrade level
    const existingUpgrade = await db.select().from(shopUpgrades)
      .where(and(eq(shopUpgrades.playerId, playerId), eq(shopUpgrades.stat, stat)))
      .limit(1);

    const currentLevel = existingUpgrade[0]?.level ?? 0;
    const cost = Math.floor(100 * Math.pow(1.5, currentLevel));

    // Get player gold
    const playerRows = await db.select().from(players).where(eq(players.id, playerId)).limit(1);
    const gold = playerRows[0]?.gold ?? 0;

    if (gold < cost) {
      return NextResponse.json({ ok: false, error: 'Insficient gold' }, { status: 400 });
    }

    // Deduct gold
    await db.update(players)
      .set({ gold: sql`${players.gold} - ${cost}` })
      .where(eq(players.id, playerId));

    // Increment level
    if (existingUpgrade.length > 0) {
      await db.update(shopUpgrades)
        .set({ level: currentLevel + 1 })
        .where(and(eq(shopUpgrades.playerId, playerId), eq(shopUpgrades.stat, stat)));
    } else {
      await db.insert(shopUpgrades).values({ playerId, stat, level: 1 });
    }

    return NextResponse.json({
      ok: true,
      newLevel: currentLevel + 1,
      remainingGold: gold - cost,
    });
  } catch (error) {
    console.error('Error buying upgrade:', error);
    return NextResponse.json({ ok: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
