import { describe, it, expect } from 'vitest';
import { World, ComponentRegistry } from '@/engine/ecs/World';
import { EventBus, EventTypes } from '@/engine/events/EventBus';
import { DamageApplicationSystem, DeathSystem } from './index';
import type { Health } from '../components';

describe('Restart Combat Integrity', () => {
  it('applies damage and kills entities properly across multiple run resets', () => {
    const registry = new ComponentRegistry();
    registry.register({ name: 'Health', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Position', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Enemy', clone: (s) => ({ ...(s as object) }) as never });

    const world = new World(registry);
    const events = new EventBus();

    const dmgSys = new DamageApplicationSystem(events);
    const deathSys = new DeathSystem(events);

    // Run 1
    const e1 = world.createEntity();
    world.addComponent<Health>(e1, 'Health', { current: 20, max: 20, armor: 0 });

    events.emit(EventTypes.DAMAGE_DEALT, { target: e1, amount: 25, source: e1, kind: 'test' });
    dmgSys.update({ world, events, time: { elapsed: 0, fixedDt: 1 / 60, alpha: 0, frameDt: 0, timeScale: 1 } });
    deathSys.update({ world, events, time: { elapsed: 0, fixedDt: 1 / 60, alpha: 0, frameDt: 0, timeScale: 1 } });

    expect(world.isAlive(e1)).toBe(false);

    // Simulated Restart (world.clear without clearing system event listeners)
    world.clear();

    // Run 2
    const e2 = world.createEntity();
    world.addComponent<Health>(e2, 'Health', { current: 30, max: 30, armor: 0 });

    events.emit(EventTypes.DAMAGE_DEALT, { target: e2, amount: 10, source: e2, kind: 'test' });
    dmgSys.update({ world, events, time: { elapsed: 0, fixedDt: 1 / 60, alpha: 0, frameDt: 0, timeScale: 1 } });

    const health2 = world.getComponent<Health>(e2, 'Health');
    expect(health2?.current).toBe(20); // Damage WAS applied in Run 2!
  });
});
