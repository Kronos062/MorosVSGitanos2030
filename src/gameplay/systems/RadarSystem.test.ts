import { describe, it, expect } from 'vitest';
import { RadarSystem } from './RadarSystem';
import { World, ComponentRegistry } from '@/engine/ecs/World';
import type { MapNode } from '../components';

describe('RadarSystem', () => {
  it('calculates relative radar dot coordinates', () => {
    const registry = new ComponentRegistry();
    registry.register({ name: 'Position', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'MapNode', clone: (s) => ({ ...(s as object) }) as never });

    const world = new World(registry);
    const system = new RadarSystem();

    const nodeEnt = world.createEntity();
    world.addComponent<MapNode>(nodeEnt, 'MapNode', {
      index: 0,
      level: 1,
      type: 'room',
      bounds: { x: 0, y: 0, w: 1000, h: 500 },
      status: 'active',
      waves: [],
      currentWave: 0,
      biomeId: 'biome_neon_arena',
      difficulty: 1.0,
      pickupPool: [],
    });

    const player = world.createEntity();
    world.addComponent(player, 'Position', { x: 500, y: 250 });
    world.setTag('player', player);

    system.update({
      world,
      events: null as never,
      time: { elapsed: 0, fixedDt: 1 / 60, alpha: 0, frameDt: 0, timeScale: 1 },
    });

    expect(system.radarData.dots.length).toBe(1);
    expect(system.radarData.dots[0].x).toBe(0.5);
    expect(system.radarData.dots[0].y).toBe(0.5);
  });
});
