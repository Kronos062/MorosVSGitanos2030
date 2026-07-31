import { describe, it, expect } from 'vitest';
import { RoomSystem } from './RoomSystem';
import { World, ComponentRegistry } from '@/engine/ecs/World';
import { EventBus, EventTypes } from '@/engine/events/EventBus';
import { ContentRepository, SchemaValidator } from '@/engine/content/ContentRepository';
import { MutationSystem } from '../mutations/MutationSystem';
import enemiesData from '@/content/enemies.json';
import mutationsData from '@/content/mutations.json';
import type { MapNode, Door, Position } from '../components';

describe('RoomSystem', () => {
  it('locks entry door when player enters unvisited room node and unlocks exit door on wave clear', () => {
    const registry = new ComponentRegistry();
    registry.register({ name: 'Position', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Velocity', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Collider', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Health', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Combat', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'AIState', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Enemy', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Sprite', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Door', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'MapNode', clone: (s) => ({ ...(s as object) }) as never });

    const world = new World(registry);
    const events = new EventBus();
    const repo = new ContentRepository(new SchemaValidator());
    repo.load(enemiesData.map((e) => ({ ...e, type: 'enemies' as const })) as never[]);
    repo.load(mutationsData.map((m) => ({ ...m, type: 'mutations' as const })) as never[]);

    const mutSys = new MutationSystem(repo);
    const roomSys = new RoomSystem(world, events, repo, mutSys);

    // Entry and Exit doors
    const entryDoor = world.createEntity();
    world.addComponent<Door>(entryDoor, 'Door', { x: 0, y: 360, w: 16, h: 80, locked: false, kind: 'entry', nodeIndex: 0 });

    const exitDoor = world.createEntity();
    world.addComponent<Door>(exitDoor, 'Door', { x: 984, y: 360, w: 16, h: 80, locked: true, kind: 'exit', nodeIndex: 0 });

    // MapNode
    const nodeEnt = world.createEntity();
    world.addComponent<MapNode>(nodeEnt, 'MapNode', {
      index: 0,
      level: 1,
      type: 'room',
      bounds: { x: 0, y: 0, w: 1000, h: 800 },
      status: 'unvisited',
      waves: [{ enemies: [{ id: 'grunt', count: 1 }], pacing: 'normal' }],
      currentWave: 0,
      biomeId: 'biome_neon_arena',
      difficulty: 1.0,
      pickupPool: ['heal'],
      entryDoorEnt: entryDoor,
      exitDoorEnt: exitDoor,
    });

    // Player enters room bounds
    const player = world.createEntity();
    world.addComponent<Position>(player, 'Position', { x: 500, y: 400 });
    world.setTag('player', player);

    // Update 1: Player enters room -> Activates room and locks entry door
    roomSys.update({
      world, events,
      time: { elapsed: 0, fixedDt: 1 / 60, alpha: 0, frameDt: 0, timeScale: 1 },
    });

    const nodeCmp = world.getComponent<MapNode>(nodeEnt, 'MapNode');
    expect(nodeCmp?.status).toBe('active');
    expect(world.getComponent<Door>(entryDoor, 'Door')?.locked).toBe(true);
    expect(world.getComponent<Door>(exitDoor, 'Door')?.locked).toBe(true);

    // Enemies spawned in room
    const enemies = world.getGroup('enemies');
    expect(enemies.length).toBe(1);

    // Kill enemy
    events.emit(EventTypes.ENTITY_KILLED, { entity: enemies[0] });

    // Update 2: Enemy killed -> Room cleared and exit door unlocked
    roomSys.update({
      world, events,
      time: { elapsed: 0, fixedDt: 1 / 60, alpha: 0, frameDt: 0, timeScale: 1 },
    });

    expect(nodeCmp?.status).toBe('cleared');
    expect(world.getComponent<Door>(exitDoor, 'Door')?.locked).toBe(false);
  });
});
