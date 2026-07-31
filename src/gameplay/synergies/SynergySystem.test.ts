import { describe, it, expect } from 'vitest';
import { SynergySystem } from './SynergySystem';
import { World, ComponentRegistry } from '@/engine/ecs/World';
import { EventBus, EventTypes } from '@/engine/events/EventBus';
import { ContentRepository, SchemaValidator } from '@/engine/content/ContentRepository';
import synergiesData from '@/content/synergies.json';

describe('SynergySystem', () => {
  it('automatically detects weapon tag requirements and unlocks synergies', () => {
    const registry = new ComponentRegistry();
    registry.register({ name: 'Weapon', clone: (s) => ({ ...(s as object) }) as never });

    const world = new World(registry);
    const events = new EventBus();
    const repo = new ContentRepository(new SchemaValidator());
    repo.load(synergiesData.map((s) => ({ ...s, type: 'synergies' as const })) as never[]);

    const system = new SynergySystem(world, events, repo);

    const player = world.createEntity();
    world.addComponent(player, 'Weapon', {
      id: 'rifle',
      tags: ['precision'],
    });
    world.setTag('player', player);

    let unlockedSynName = '';
    events.on<{ synergy: { name: string } }>(EventTypes.SYNERGY_UNLOCKED, (e) => {
      unlockedSynName = e.synergy.name;
    });

    system.update({
      world, events,
      time: { elapsed: 0, fixedDt: 1 / 60, alpha: 0, frameDt: 0, timeScale: 1 },
    });

    expect(unlockedSynName).toBe('Furia Armada');
    expect(system.activeSynergies.size).toBe(1);
  });
});
