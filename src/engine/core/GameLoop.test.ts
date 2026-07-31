import { describe, it, expect } from 'vitest';
import { SystemScheduler, GameLoop } from '@/engine/core/GameLoop';
import { World, ComponentRegistry } from '@/engine/ecs/World';
import { EventBus } from '@/engine/events/EventBus';
import type { System, SystemContext } from '@/engine/core/GameLoop';

describe('SystemScheduler', () => {
  const mkCtx = (): SystemContext => ({
    world: new World(new ComponentRegistry()),
    events: new EventBus(),
    time: { elapsed: 0, fixedDt: 1 / 60, alpha: 0, frameDt: 0, timeScale: 1 },
  });

  it('ordena sistemas por prioridad', () => {
    const sch = new SystemScheduler();
    const order: string[] = [];
    const mk = (name: string, priority: number): System => ({
      name, phase: 'fixed', priority,
      update: () => { order.push(name); },
    });
    sch.add(mk('C', 10));
    sch.add(mk('A', -5));
    sch.add(mk('B', 0));
    sch.runFixed(mkCtx());
    expect(order).toEqual(['A', 'B', 'C']);
  });

  it('respeta el flag enabled=false', () => {
    const sch = new SystemScheduler();
    let called = false;
    const sys: System = {
      name: 'X', phase: 'fixed', enabled: false,
      update: () => { called = true; },
    };
    sch.add(sys);
    sch.runFixed(mkCtx());
    expect(called).toBe(false);
    sys.enabled = true;
    sch.runFixed(mkCtx());
    expect(called).toBe(true);
  });

  it('remove quita el sistema por nombre', () => {
    const sch = new SystemScheduler();
    let count = 0;
    sch.add({ name: 'X', phase: 'fixed', update: () => { count++; } });
    sch.runFixed(mkCtx());
    expect(count).toBe(1);
    sch.remove('X');
    sch.runFixed(mkCtx());
    expect(count).toBe(1);
  });
});

describe('GameLoop.stepFixed (para tests)', () => {
  it('avanza la simulación exactamente un paso', () => {
    const sch = new SystemScheduler();
    let fixedCount = 0;
    sch.add({
      name: 'F', phase: 'fixed',
      update: (ctx) => {
        fixedCount++;
        expect(ctx.time.fixedDt).toBeCloseTo(1 / 60);
      },
    });
    const ctx: SystemContext = {
      world: new World(new ComponentRegistry()),
      events: new EventBus(),
      time: { elapsed: 0, fixedDt: 1 / 60, alpha: 0, frameDt: 0, timeScale: 1 },
    };
    const loop = new GameLoop(sch, ctx, { fixedHz: 60 });
    loop.stepFixed();
    loop.stepFixed();
    loop.stepFixed();
    expect(fixedCount).toBe(3);
  });
});
