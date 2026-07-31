import { describe, it, expect } from 'vitest';
import { ChestSystem, ChestComponentDef, type ChestComponent } from './ChestSystem';
import { World, ComponentRegistry } from '@/engine/ecs/World';
import { EventBus } from '@/engine/events/EventBus';
import { ContentRepository, SchemaValidator } from '@/engine/content/ContentRepository';
import { ItemFactory } from '../items/ItemFactory';
import chestsData from '@/content/chests.json';
import weaponsData from '@/content/weapons.json';
import affixesData from '@/content/affixes.json';

describe('ChestSystem', () => {
  const makeSetup = () => {
    const registry = new ComponentRegistry();
    registry.register({ name: 'Position', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Collider', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Health', clone: (s) => ({ ...(s as object) }) as never });
    registry.register(ChestComponentDef);

    const world = new World(registry);
    const events = new EventBus();
    const repo = new ContentRepository(new SchemaValidator());
    repo.load(chestsData.map((c) => ({ ...c, type: 'chests' as const })) as never[]);
    repo.load(weaponsData.map((w) => ({ ...w, type: 'weapons' as const })) as never[]);
    repo.load(affixesData.map((a) => ({ ...a, type: 'affixes' as const })) as never[]);

    const itemFactory = new ItemFactory(repo);
    const sys = new ChestSystem(world, events, repo, itemFactory);

    return { world, events, repo, itemFactory, sys };
  };

  it('opens chest when player approaches and awards loot', () => {
    const { world, events, sys } = makeSetup();

    // Create player
    const p = world.createEntity();
    world.addComponent(p, 'Position', { x: 100, y: 100 });
    world.addComponent(p, 'Health', { current: 50, max: 100, armor: 0 });
    world.setTag('player', p);

    // Create chest nearby
    const c = world.createEntity();
    world.addComponent(c, 'Position', { x: 110, y: 100 });
    world.addComponent(c, 'Collider', { radius: 16 });
    world.addComponent<ChestComponent>(c, 'Chest', {
      id: 'chest_common', name: 'Cofre Común', color: '#b8c0d8', glow: '#b8c0d8',
      size: 16, opened: false,
      loot: {
        pool: [{ kind: 'heal', weight: 1, value: 30 }],
      },
    });
    world.addToGroup('chests', c);

    sys.update({
      world, events,
      time: { elapsed: 0, fixedDt: 1 / 60, alpha: 0, frameDt: 0, timeScale: 1 },
    });

    // Health should have increased
    const health = world.getComponent<{ current: number }>(p, 'Health');
    expect(health?.current).toBe(80);
    // Chest entity should be destroyed
    expect(world.isAlive(c)).toBe(false);
  });
});
