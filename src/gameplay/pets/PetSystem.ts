/**
 * PetSystem.ts — sistema de mascotas acompañantes (TDD Cap. 8).
 *
 * Las mascotas orbitan al jugador, atacan de forma autónoma a los enemigos
 * dentro de su rango y pueden vacuumizar pickups lejanos.
 */

import type { System, SystemContext } from '@/engine/core/GameLoop';
import type { World, EntityId } from '@/engine/ecs/World';
import type { EventBus } from '@/engine/events/EventBus';
import type { ContentRepository } from '@/engine/content/ContentRepository';
import { EventTypes } from '@/gameplay/events/GameEventTypes';
import { v2Dist, v2Norm } from '@/engine/utils/math';
import type { Position, Pet, Projectile, Pickup, Collider } from '../components';

export interface PetDef {
  id: string;
  name: string;
  description: string;
  color: string;
  glow: string;
  attackCooldown: number;
  damage: number;
  range: number;
  orbitRadius: number;
  orbitSpeed: number;
  vacuumRadius?: number;
}

export class PetSystem implements System {
  readonly name = 'Pet';
  readonly phase = 'fixed';
  readonly priority = 25;

  constructor(
    private world: World,
    private events: EventBus,
    private content: ContentRepository
  ) {}

  spawnPet(petId: string, playerEnt: EntityId): EntityId | null {
    const def = this.content.get<PetDef>('pets', petId);
    if (!def) return null;

    const playerPos = this.world.getComponent<Position>(playerEnt, 'Position');
    if (!playerPos) return null;

    const ent = this.world.createEntity();
    this.world.addComponent<Position>(ent, 'Position', {
      x: playerPos.x + def.orbitRadius,
      y: playerPos.y,
    });
    this.world.addComponent<Pet>(ent, 'Pet', {
      id: def.id,
      name: def.name,
      color: def.color,
      glow: def.glow,
      attackCooldown: def.attackCooldown,
      attackTimer: 0,
      damage: def.damage,
      range: def.range,
      orbitRadius: def.orbitRadius,
      orbitSpeed: def.orbitSpeed,
      orbitAngle: 0,
      vacuumRadius: def.vacuumRadius,
    });
    this.world.addComponent(ent, 'Sprite', {
      shape: 'circle',
      color: def.color,
      glow: def.glow,
      size: 8,
    });
    this.world.addToGroup('pets', ent);
    return ent;
  }

  update(ctx: SystemContext): void {
    const dt = ctx.time.fixedDt;
    const playerEnt = this.world.getTag('player');
    if (playerEnt === undefined) return;
    const playerPos = this.world.getComponent<Position>(playerEnt, 'Position');
    if (!playerPos) return;

    for (const ent of this.world.getGroup('pets')) {
      const pet = this.world.getComponent<Pet>(ent, 'Pet');
      const pos = this.world.getComponent<Position>(ent, 'Position');
      if (!pet || !pos) continue;

      // Orbitar al jugador
      pet.orbitAngle += pet.orbitSpeed * dt;
      pos.x = playerPos.x + Math.cos(pet.orbitAngle) * pet.orbitRadius;
      pos.y = playerPos.y + Math.sin(pet.orbitAngle) * pet.orbitRadius;

      // Vacuum pickups si la mascota lo soporta
      if (pet.vacuumRadius && pet.vacuumRadius > 0) {
        for (const pickEnt of this.world.getGroup('pickups')) {
          const pkPos = this.world.getComponent<Position>(pickEnt, 'Position');
          if (!pkPos) continue;
          if (v2Dist(pos, pkPos) < pet.vacuumRadius) {
            const pull = v2Norm({ x: playerPos.x - pkPos.x, y: playerPos.y - pkPos.y });
            pkPos.x += pull.x * 400 * dt;
            pkPos.y += pull.y * 400 * dt;
          }
        }
      }

      // Ataque autónomo
      pet.attackTimer = Math.max(0, pet.attackTimer - dt);
      if (pet.attackTimer <= 0 && pet.damage > 0) {
        let nearest: EntityId | null = null;
        let nearestDist = pet.range;
        for (const enemyEnt of this.world.getGroup('enemies')) {
          const ePos = this.world.getComponent<Position>(enemyEnt, 'Position');
          if (!ePos) continue;
          const d = v2Dist(pos, ePos);
          if (d < nearestDist) {
            nearestDist = d;
            nearest = enemyEnt;
          }
        }

        if (nearest !== null) {
          const ePos = this.world.getComponent<Position>(nearest, 'Position')!;
          const dir = v2Norm({ x: ePos.x - pos.x, y: ePos.y - pos.y });
          pet.attackTimer = pet.attackCooldown;

          // Disparar bola ígnea / láser
          const projEnt = this.world.createEntity();
          this.world.addComponent<Position>(projEnt, 'Position', { x: pos.x, y: pos.y });
          this.world.addComponent<Collider>(projEnt, 'Collider', { radius: 5 });
          this.world.addComponent<Projectile>(projEnt, 'Projectile', {
            vx: dir.x * 500,
            vy: dir.y * 500,
            damage: pet.damage,
            color: pet.color,
            size: 5,
            pierce: 1,
            pierced: [],
            life: 1.5,
            owner: 'player',
          });

          this.events.emit(EventTypes.PLAY_SOUND, { id: 'shoot' });
        }
      }
    }
  }
}
