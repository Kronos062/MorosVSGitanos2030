import { describe, it, expect } from 'vitest';
import { WeaponInteractionSystem } from './index';
import { World, ComponentRegistry } from '@/engine/core/World';
import { EventBus } from '@/engine/events/EventBus';
import { ContentRepository, SchemaValidator } from '@/engine/content/ContentRepository';
import weaponsData from '@/content/weapons.json';
import type { Position, Player, Weapon, Pickup, Collider } from '../components';

describe('WeaponInteractionSystem', () => {
  it('shows weapon prompt when in range and swaps only when KeyE (interact) is pressed', () => {
    const registry = new ComponentRegistry();
    registry.register({ name: 'Position', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Collider', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Weapon', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Player', clone: (s) => ({ ...(s as object) }) as never });
    registry.register({ name: 'Pickup', clone: (s) => ({ ...(s as object) }) as never });

    const world = new World(registry);
    const events = new EventBus();
    const repo = new ContentRepository(new SchemaValidator());
    repo.load(weaponsData.map((w) => ({ ...w, type: 'weapons' as const })) as never[]);

    let interactPressed = false;
    const inputState = {
      move: { x: 0, y: 0 },
      attack: false, attackPressed: false,
      skill: false, skillPressed: false,
      dash: false, dashPressed: false,
      interact: false, interactPressed: false,
      map: false, mapPressed: false,
      pause: false, pausePressed: false,
      confirm: false, confirmPressed: false,
    };

    const sys = new WeaponInteractionSystem(() => {
      inputState.interactPressed = interactPressed;
      return inputState;
    }, repo);

    // Player
    const player = world.createEntity();
    world.addComponent<Position>(player, 'Position', { x: 100, y: 100 });
    world.addComponent<Weapon>(player, 'Weapon', {
      id: 'pistol', damage: 12, fireRate: 3.5, projectileSpeed: 550, projectileSize: 4,
      color: '#00f0ff', spread: 0.04, count: 1, pierce: 0, sound: 'shoot', cooldown: 0,
    });
    world.setTag('player', player);

    // Weapon pickup on floor
    const pkEnt = world.createEntity();
    world.addComponent<Position>(pkEnt, 'Position', { x: 120, y: 100 });
    world.addComponent<Collider>(pkEnt, 'Collider', { radius: 12 });
    world.addComponent<Pickup>(pkEnt, 'Pickup', {
      kind: 'weapon', color: '#ffe14a', glow: '#ffe14a', value: 0,
      weaponId: 'shotgun', bobPhase: 0, life: 30,
    });
    world.addToGroup('pickups', pkEnt);

    // Update 1: In range, NO E pressed yet
    sys.update({
      world, events,
      time: { elapsed: 0, fixedDt: 1 / 60, alpha: 0, frameDt: 0, timeScale: 1 },
    });

    // Active prompt should be shown
    expect(sys.activePrompt).not.toBeNull();
    expect(sys.activePrompt?.weaponId).toBe('shotgun');
    // Pickup still exists on floor
    expect(world.isAlive(pkEnt)).toBe(true);

    // Update 2: Player presses E (interactPressed = true)
    interactPressed = true;
    sys.update({
      world, events,
      time: { elapsed: 0, fixedDt: 1 / 60, alpha: 0, frameDt: 0, timeScale: 1 },
    });

    // Pickup should be destroyed/swapped
    expect(world.isAlive(pkEnt)).toBe(false);
    expect(sys.activePrompt).toBeNull();
  });
});
