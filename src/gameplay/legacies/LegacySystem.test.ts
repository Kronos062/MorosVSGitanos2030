import { describe, it, expect } from 'vitest';
import { LegacySystem } from './LegacySystem';
import { World, ComponentRegistry } from '@/engine/ecs/World';
import { EventBus, EventTypes } from '@/engine/events/EventBus';
import { ContentRepository, SchemaValidator } from '@/engine/content/ContentRepository';
import { RuleEngine, EffectExecutor } from '@/engine/rules/RuleEngine';
import legaciesData from '@/content/legacies.json';

describe('LegacySystem', () => {
  it('registers legacy rules and triggers threshold event', () => {
    const registry = new ComponentRegistry();
    const world = new World(registry);
    const events = new EventBus();
    const repo = new ContentRepository(new SchemaValidator());
    repo.load(legaciesData.map((l) => ({ ...l, type: 'legacies' as const })) as never[]);

    const executor = new EffectExecutor();
    executor.register('stat_mod', () => {});
    const engine = new RuleEngine(events, executor);
    const system = new LegacySystem(world, events, repo, engine);

    let unlockedName = '';
    events.on<{ legacy: { name: string } }>(EventTypes.LEGACY_THRESHOLD_REACHED, (e) => {
      unlockedName = e.legacy.name;
    });

    events.emit('combat:entity_killed', { killsTotal: 50 });

    expect(unlockedName).toBe('Primera Sangre');
    expect(system.unlockedLegacies.has('leg_first_blood')).toBe(true);
  });
});
