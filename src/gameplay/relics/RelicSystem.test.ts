import { describe, it, expect } from 'vitest';
import { RelicSystem } from './RelicSystem';
import { World, ComponentRegistry } from '@/engine/ecs/World';
import { EventBus, EventTypes } from '@/engine/events/EventBus';
import { ContentRepository, SchemaValidator } from '@/engine/content/ContentRepository';
import { RuleEngine, EffectExecutor } from '@/engine/rules/RuleEngine';
import relicsData from '@/content/relics.json';

describe('RelicSystem', () => {
  it('equips relics and registers rules in RuleEngine', () => {
    const registry = new ComponentRegistry();
    registry.register({ name: 'Health', clone: (s) => ({ ...(s as object) }) as never });

    const world = new World(registry);
    const events = new EventBus();
    const repo = new ContentRepository(new SchemaValidator());
    repo.load(relicsData.map((r) => ({ ...r, type: 'relics' as const })) as never[]);

    const executor = new EffectExecutor();
    const engine = new RuleEngine(events, executor);
    const system = new RelicSystem(world, events, repo, engine);

    const player = world.createEntity();
    world.addComponent(player, 'Health', { current: 50, max: 100, armor: 0 });
    world.setTag('player', player);

    system.equipRelic('heal_potion');
    expect(system.equippedRelics.includes('heal_potion')).toBe(true);
  });
});
