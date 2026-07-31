/**
 * ChestSystem.ts — cofres interactivos (Fase 3).
 *
 * El jugador abre un cofre al entrar en contacto (no requiere botón).
 * El cofre consulta content/chests.json para el loot pool y delega al
 * ItemFactory para generar armas procedurales. Todo data-driven.
 */

import type { System, SystemContext } from '@/engine/core/GameLoop';
import type { World, EntityId } from '@/engine/ecs/World';
import type { EventBus } from '@/engine/events/EventBus';
import type { ContentRepository } from '@/engine/content/ContentRepository';
import type { ItemFactory } from '../items/ItemFactory';
import { EventTypes } from '@/gameplay/events/GameEventTypes';
import { v2Dist } from '@/engine/utils/math';
import { pickRarity } from '../items/ItemFactory';
import type { Position, Collider, Weapon, Pickup, Sprite } from '../components';
import { ArmoryStore as ArmoryManager } from '../persistence/ArmoryStore';

export interface ChestComponent {
  id: string;
  name: string;
  color: string;
  glow: string;
  size: number;
  opened: boolean;
  loot: {
    pool: Array<{
      kind: 'weapon' | 'heal' | 'shield';
      rarityWeight?: Record<string, number>;
      weight?: number;
      value?: number;
    }>;
  };
}

export const ChestComponentDef = {
  name: 'Chest',
  clone: <T>(src: T): T => ({ ...(src as object) } as T),
};

export class ChestSystem implements System {
  readonly name = 'Chest';
  readonly phase = 'fixed';
  readonly priority = 75;

  constructor(
    private world: World,
    private events: EventBus,
    private content: ContentRepository,
    private itemFactory: ItemFactory
  ) {}

  update(ctx: SystemContext): void {
    const playerEnt = this.world.getTag('player');
    if (playerEnt === undefined) return;
    const pp = this.world.getComponent<Position>(playerEnt, 'Position');
    if (!pp) return;

    for (const ent of this.world.getGroup('chests')) {
      const chest = this.world.getComponent<ChestComponent>(ent, 'Chest');
      const pos = this.world.getComponent<Position>(ent, 'Position');
      const col = this.world.getComponent<Collider>(ent, 'Collider');
      if (!chest || !pos || !col || chest.opened) continue;

      if (v2Dist(pp, pos) < col.radius + 18) {
        this.openChest(ent, chest, pos, playerEnt);
      }
    }
  }

  private openChest(
    ent: EntityId,
    chest: ChestComponent,
    pos: Position,
    playerEnt: EntityId
  ): void {
    chest.opened = true;
    this.events.emit(EventTypes.PLAY_SOUND, { id: 'pickup' });
    this.events.emit(EventTypes.SCREEN_SHAKE, { intensity: 4, time: 0.15 });
    this.events.emit(EventTypes.PARTICLE_BURST, {
      pos, count: 20, color: chest.color, speed: [80, 200],
      life: [0.3, 0.6], size: [3, 6], glow: true,
    });

    // Elegir item del pool
    const pool = chest.loot.pool;
    const totalWeight = pool.reduce((s, p) => s + (p.weight ?? 1), 0);
    let roll = Math.random() * totalWeight;
    let chosen = pool[0];
    for (const p of pool) {
      roll -= (p.weight ?? 1);
      if (roll <= 0) { chosen = p; break; }
    }

    if (chosen.kind === 'weapon') {
      const rarity = pickRarity(chosen.rarityWeight ?? { uncommon: 60, rare: 30, epic: 10 });
      const weaponInst = this.itemFactory.rollWeaponByRarity(rarity);

      // Registrar descubrimiento en Armería
      ArmoryManager.recordDiscovery(weaponInst.id);

      // Spawnear el pickup de arma en el suelo (NO equipar automáticamente)
      const pkEnt = this.world.createEntity();
      this.world.addComponent<Position>(pkEnt, 'Position', { x: pos.x, y: pos.y + 10 });
      this.world.addComponent<Collider>(pkEnt, 'Collider', { radius: 12 });
      this.world.addComponent<Pickup>(pkEnt, 'Pickup', {
        kind: 'weapon',
        color: weaponInst.color ?? '#ffe14a',
        glow: weaponInst.color ?? '#ffe14a',
        value: 0,
        weaponId: weaponInst.id,
        bobPhase: 0,
        life: 60,
      });
      this.world.addToGroup('pickups', pkEnt);

      this.events.emit(EventTypes.FLOAT_TEXT, {
        target: ent,
        text: weaponInst.displayName.toUpperCase(),
        color: weaponInst.color,
      });
    } else if (chosen.kind === 'heal') {
      const h = this.world.getComponent<{ current: number; max: number }>(playerEnt, 'Health');
      if (h) {
        h.current = Math.min(h.max, h.current + (chosen.value ?? 40));
        this.events.emit(EventTypes.FLOAT_TEXT, { target: playerEnt, text: '+' + (chosen.value ?? 40) + ' HP', color: '#39ff88' });
      }
    } else if (chosen.kind === 'shield') {
      let sh = this.world.getComponent<{ charges: number }>(playerEnt, 'Shield');
      if (!sh) {
        this.world.addComponent(playerEnt, 'Shield', { charges: chosen.value ?? 1 });
      } else {
        sh.charges += (chosen.value ?? 1);
      }
      this.events.emit(EventTypes.FLOAT_TEXT, { target: playerEnt, text: '+SHIELD', color: '#00f0ff' });
    }

    // Destruir el cofre
    this.world.destroyEntity(ent);
  }
}
