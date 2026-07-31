import { describe, it, expect } from 'vitest';
import { BossSystem, BossComponentDef, type BossComponent } from './BossSystem';
import { World, ComponentRegistry } from '@/engine/ecs/World';
import { EventBus, EventTypes } from '@/engine/events/EventBus';
import { ContentRepository, SchemaValidator } from '@/engine/content/ContentRepository';
import bossesData from '@/content/bosses.json';

describe('BossSystem', () => {
  it('triggers phase transitions when boss HP drops below thresholds', () => {
    const registry = new ComponentRegistry();
    registry.register({ name: 'Health', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Combat', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Enemy', clone: (s) => ({ ...(s as object) }) as never });
    registry.register(BossComponentDef);

    const world = new World(registry);
    const events = new EventBus();
    const repo = new ContentRepository(new SchemaValidator());
    repo.load(bossesData.map((b) => ({ ...b, type: 'bosses' as const })) as never[]);

    const system = new BossSystem(world, events, repo);

    const b = world.createEntity();
    world.addComponent(b, 'Health', { current: 600, max: 600, armor: 0 });
    world.addComponent(b, 'Combat', { damage: 30, attackCooldown: 1.5, attackTimer: 0, attackRange: 300 });
    world.addComponent(b, 'Enemy', { id: 'boss_dragon_2030', color: '#ff3b5c', speed: 50 });
    world.addComponent<BossComponent>(b, 'Boss', { bossId: 'boss_dragon_2030', currentPhase: 1 });

    let phaseChangedTo = 0;
    events.on<{ phase: number }>(EventTypes.BOSS_PHASE_CHANGED, (e) => {
      phaseChangedTo = e.phase;
    });

    // Drop HP to 50% (threshold for phase 2 is <= 60%)
    const health = world.getComponent<{ current: number }>(b, 'Health')!;
    health.current = 300;

    system.update({
      world, events,
      time: { elapsed: 0, fixedDt: 1 / 60, alpha: 0, frameDt: 0, timeScale: 1 },
    });

    expect(phaseChangedTo).toBe(2);
    expect(world.getComponent<BossComponent>(b, 'Boss')?.currentPhase).toBe(2);
  });
});
