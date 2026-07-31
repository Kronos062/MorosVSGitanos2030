import { describe, it, expect } from 'vitest';
import { PetSystem } from './PetSystem';
import { World, ComponentRegistry } from '@/engine/ecs/World';
import { EventBus } from '@/engine/events/EventBus';
import { ContentRepository, SchemaValidator } from '@/engine/content/ContentRepository';
import petsData from '@/content/pets.json';

describe('PetSystem', () => {
  it('spawns pet companion that orbits player and attacks enemies', () => {
    const registry = new ComponentRegistry();
    registry.register({ name: 'Position', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Collider', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Pet', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Sprite', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Projectile', clone: (s) => ({ ...(s as object) }) as never });

    const world = new World(registry);
    const events = new EventBus();
    const repo = new ContentRepository(new SchemaValidator());
    repo.load(petsData.map((p) => ({ ...p, type: 'pets' as const })) as never[]);

    const system = new PetSystem(world, events, repo);

    // Create Player
    const player = world.createEntity();
    world.addComponent(player, 'Position', { x: 100, y: 100 });
    world.setTag('player', player);

    // Spawn Pet
    const petEnt = system.spawnPet('pet_dragon', player);
    expect(petEnt).not.toBeNull();

    // Create Enemy
    const enemy = world.createEntity();
    world.addComponent(enemy, 'Position', { x: 150, y: 100 });
    world.addToGroup('enemies', enemy);

    // Update system
    system.update({
      world, events,
      time: { elapsed: 0, fixedDt: 0.1, alpha: 0, frameDt: 0.1, timeScale: 1 },
    });

    // Pet position updated to orbit
    const petPos = world.getComponent<{ x: number; y: number }>(petEnt!, 'Position');
    expect(petPos).toBeDefined();

    // Check that projectile was fired
    const projs = world.query('Projectile');
    expect(projs.length).toBe(1);
  });
});
