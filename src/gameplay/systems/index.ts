/**
 * gameplay/systems/index.ts — sistemas del juego (TDD §3.2).
 *
 * Cada sistema implementa la interfaz `System` del engine. El engine no
 * conoce el contenido del juego; los sistemas traducen componentes
 * genéricos (Position, Velocity, Health...) a comportamiento jugable.
 */

import type { System, SystemContext } from '@/engine/core/GameLoop';
import type { World, EntityId } from '@/engine/ecs/World';
import type { EventBus } from '@/engine/events/EventBus';
import type { IRenderer, RenderCommand } from '@/engine/rendering/IRenderer';
import type { InputState } from '@/engine/input/InputManager';
import type { CollisionSystem } from '@/engine/physics/CollisionSystem';
import { EventTypes } from '@/gameplay/events/GameEventTypes';
import { v2Norm, v2Len, v2Dist, clamp, type Vec2 } from '@/engine/utils/math';
import type { ParticleSystem } from '@/engine/rendering/ParticleSystem';
import type {
  Position, Velocity, Collider, Facing, Health, Combat, Invulnerable,
  Weapon, Projectile, AIState, Enemy, Player, Pickup, Door, Sprite,
  StatusEffect, Shield,
} from '../components';

// ===== InputSystem: aplica input del jugador =====
export class PlayerInputSystem implements System {
  readonly name = 'PlayerInput';
  readonly phase = 'fixed';
  readonly priority = -100;
  constructor(private getInput: () => InputState) {}

  update(ctx: SystemContext): void {
    const input = this.getInput();
    const playerEnt = ctx.world.getTag('player');
    if (playerEnt === undefined) return;
    const vel = ctx.world.getComponent<Velocity>(playerEnt, 'Velocity');
    const player = ctx.world.getComponent<Player>(playerEnt, 'Player');
    const facing = ctx.world.getComponent<Facing>(playerEnt, 'Facing');
    if (!vel || !player || !facing) return;

    if (player.isDashing) {
      player.dashTime -= ctx.time.fixedDt;
      if (player.dashTime <= 0) {
        player.isDashing = false;
        vel.vx *= 0.3;
        vel.vy *= 0.3;
      }
      return;
    }

    const speed = 260 * (player.speedMult ?? 1);
    vel.vx = input.move.x * speed;
    vel.vy = input.move.y * speed;
    if (v2Len(input.move) > 0.1) {
      facing.dx = input.move.x;
      facing.dy = input.move.y;
    } else {
      // Auto-aim: facing hacia enemigo más cercano
      const nearest = findNearestEnemy(ctx.world, playerEnt);
      if (nearest) {
        const p = ctx.world.getComponent<Position>(playerEnt, 'Position')!;
        const e = ctx.world.getComponent<Position>(nearest, 'Position');
        if (e) {
          const d = v2Norm({ x: e.x - p.x, y: e.y - p.y });
          facing.dx = d.x;
          facing.dy = d.y;
        }
      }
    }
  }
}

function findNearestEnemy(world: World, playerEnt: EntityId): EntityId | null {
  const p = world.getComponent<Position>(playerEnt, 'Position');
  if (!p) return null;
  let best: EntityId | null = null;
  let bestDist = Infinity;
  for (const ent of world.getGroup('enemies')) {
    const e = world.getComponent<Position>(ent, 'Position');
    if (!e) continue;
    const d = v2Dist(p, e);
    if (d < bestDist) {
      bestDist = d;
      best = ent;
    }
  }
  return bestDist < 500 ? best : null;
}

// ===== MovementSystem =====
export class MovementSystem implements System {
  readonly name = 'Movement';
  readonly phase = 'fixed';
  readonly priority = 0;

  update(ctx: SystemContext): void {
    const dt = ctx.time.fixedDt;
    for (const [ent, pos] of ctx.world.iter<Position>('Position')) {
      const vel = ctx.world.getComponent<Velocity>(ent, 'Velocity');
      if (!vel) continue;
      pos.x += vel.vx * dt;
      pos.y += vel.vy * dt;

      // Colisiones con paredes de Nodos y Puertas del Mapa Continuo
      const col = ctx.world.getComponent<Collider>(ent, 'Collider');
      if (!col) continue;

      let currentMapNode: import('../components').MapNode | null = null;
      for (const [, node] of ctx.world.iter<import('../components').MapNode>('MapNode')) {
        const b = node.bounds;
        if (pos.x >= b.x - 20 && pos.x <= b.x + b.w + 20 &&
            pos.y >= b.y - 20 && pos.y <= b.y + b.h + 20) {
          currentMapNode = node;
          break;
        }
      }

      if (currentMapNode) {
        const b = currentMapNode.bounds;
        // Limitar Y estrictamente al alto del nodo actual
        pos.y = clamp(pos.y, b.y + col.radius, b.y + b.h - col.radius);

        // Comprobar paso por la puerta izquierda (entrada)
        if (pos.x < b.x + col.radius) {
          let canPassLeft = false;
          if (currentMapNode.entryDoorEnt) {
            const door = ctx.world.getComponent<Door>(currentMapNode.entryDoorEnt, 'Door');
            if (door && !door.locked) {
              // El personaje debe estar posicionado dentro de la apertura vertical de la puerta
              if (pos.y >= door.y - col.radius / 2 && pos.y <= door.y + door.h + col.radius / 2) {
                canPassLeft = true;
              }
            }
          }
          if (!canPassLeft) pos.x = Math.max(pos.x, b.x + col.radius);
        }

        // Comprobar paso por la puerta derecha (salida)
        if (pos.x > b.x + b.w - col.radius) {
          let canPassRight = false;
          if (currentMapNode.exitDoorEnt) {
            const door = ctx.world.getComponent<Door>(currentMapNode.exitDoorEnt, 'Door');
            if (door && !door.locked) {
              // El personaje debe estar posicionado dentro de la apertura vertical de la puerta
              if (pos.y >= door.y - col.radius / 2 && pos.y <= door.y + door.h + col.radius / 2) {
                canPassRight = true;
              }
            }
          }
          if (!canPassRight) pos.x = Math.min(pos.x, b.x + b.w - col.radius);
        }
      }
    }
  }
}

// ===== AimingSystem: dispara si el jugador mantiene attack =====
export class PlayerShootSystem implements System {
  readonly name = 'PlayerShoot';
  readonly phase = 'fixed';
  readonly priority = 10;
  constructor(private getInput: () => InputState) {}

  update(ctx: SystemContext): void {
    const input = this.getInput();
    const playerEnt = ctx.world.getTag('player');
    if (playerEnt === undefined) return;
    const weapon = ctx.world.getComponent<Weapon>(playerEnt, 'Weapon');
    const pos = ctx.world.getComponent<Position>(playerEnt, 'Position');
    const facing = ctx.world.getComponent<Facing>(playerEnt, 'Facing');
    if (!weapon || !pos || !facing) return;

    weapon.cooldown = Math.max(0, weapon.cooldown - ctx.time.fixedDt);
    if (!input.attack || weapon.cooldown > 0) return;

    weapon.cooldown = 1 / weapon.fireRate;
    spawnProjectiles(ctx.world, ctx.events, {
      x: pos.x + facing.dx * 16,
      y: pos.y + facing.dy * 16,
      facing: { x: facing.dx, y: facing.dy },
      weapon,
      owner: 'player',
    });
    ctx.events.emit(EventTypes.PLAY_SOUND, { id: weapon.sound });
    ctx.events.emit(EventTypes.SCREEN_SHAKE, { intensity: 2, time: 0.06 });
  }
}

function spawnProjectiles(
  world: World,
  events: EventBus,
  opts: { x: number; y: number; facing: Vec2; weapon: Weapon; owner: 'player' | 'enemy' }
): void {
  const { weapon, facing } = opts;
  const baseAngle = Math.atan2(facing.y, facing.x);
  for (let i = 0; i < weapon.count; i++) {
    const offset = weapon.count > 1
      ? (i - (weapon.count - 1) / 2) * (weapon.spread / Math.max(1, weapon.count - 1))
      : (Math.random() - 0.5) * weapon.spread;
    const angle = baseAngle + offset;
    const vx = Math.cos(angle) * weapon.projectileSpeed;
    const vy = Math.sin(angle) * weapon.projectileSpeed;
    const ent = world.createEntity();
    world.addComponent<Position>(ent, 'Position', { x: opts.x, y: opts.y });
    world.addComponent<Collider>(ent, 'Collider', { radius: weapon.projectileSize });
    world.addComponent<Projectile>(ent, 'Projectile', {
      vx, vy, damage: weapon.damage, color: weapon.color,
      size: weapon.projectileSize, pierce: weapon.pierce,
      pierced: [], life: 1.5, owner: opts.owner,
    });
  }
  // Muzzle particles
  events.emit(EventTypes.PARTICLE_BURST, {
    pos: { x: opts.x, y: opts.y },
    count: 5,
    color: weapon.color,
    speed: [60, 150],
    life: [0.1, 0.2],
    size: [2, 4],
    glow: true,
    direction: facing,
    spread: Math.PI / 3,
  });
}

// ===== ProjectileSystem =====
export class ProjectileSystem implements System {
  readonly name = 'Projectile';
  readonly phase = 'fixed';
  readonly priority = 20;

  update(ctx: SystemContext): void {
    const dt = ctx.time.fixedDt;
    const toKill: EntityId[] = [];
    const room = ctx.world.getTag('room');
    const roomCmp = room !== undefined ? ctx.world.getComponent<{ width: number; height: number }>(room, 'Room') : null;

    for (const [ent, p] of ctx.world.iter<Projectile>('Projectile')) {
      const pos = ctx.world.getComponent<Position>(ent, 'Position');
      if (!pos) { toKill.push(ent); continue; }
      pos.x += p.vx * dt;
      pos.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) { toKill.push(ent); continue; }
      if (roomCmp && (pos.x < 0 || pos.x > roomCmp.width || pos.y < 0 || pos.y > roomCmp.height)) {
        toKill.push(ent);
      }
    }
    for (const id of toKill) ctx.world.destroyEntity(id);
  }
}

// ===== AISystem =====
export class AISystem implements System {
  readonly name = 'AI';
  readonly phase = 'fixed';
  readonly priority = 30;

  update(ctx: SystemContext): void {
    const dt = ctx.time.fixedDt;
    const playerEnt = ctx.world.getTag('player');
    if (playerEnt === undefined) return;
    const playerPos = ctx.world.getComponent<Position>(playerEnt, 'Position');
    if (!playerPos) return;

    for (const ent of ctx.world.getGroup('enemies')) {
      const ai = ctx.world.getComponent<AIState>(ent, 'AIState');
      const enemy = ctx.world.getComponent<Enemy>(ent, 'Enemy');
      const pos = ctx.world.getComponent<Position>(ent, 'Position');
      const vel = ctx.world.getComponent<Velocity>(ent, 'Velocity');
      const combat = ctx.world.getComponent<Combat>(ent, 'Combat');
      if (!ai || !enemy || !pos || !vel || !combat) continue;

      if (enemy.spawnAnim > 0) {
        enemy.spawnAnim -= dt;
        vel.vx = 0; vel.vy = 0;
        continue;
      }
      enemy.hitFlash = Math.max(0, enemy.hitFlash - dt);

      const dx = playerPos.x - pos.x;
      const dy = playerPos.y - pos.y;
      const dist = Math.hypot(dx, dy);

      // AI Culling (Cap 6.23): Desactivar decisiones avanzadas si el enemigo está lejano (> 1000px)
      if (dist > 1000) {
        vel.vx = 0;
        vel.vy = 0;
        ai.attackTimer = Math.max(0, ai.attackTimer - dt);
        continue;
      }

      const dir = dist > 0.01 ? { x: dx / dist, y: dy / dist } : { x: 0, y: 0 };

      // Interpretar AI profile de forma data-driven
      if (ai.profileId === 'chaser') {
        const speed = getEnemySpeed(enemy);
        vel.vx = dir.x * speed;
        vel.vy = dir.y * speed;
        if (dist < combat.attackRange) this.meleeAttack(ctx, ent, playerEnt, combat);
      } else if (ai.profileId === 'ranged_kiter') {
        const speed = getEnemySpeed(enemy);
        if (dist > 200) { vel.vx = dir.x * speed; vel.vy = dir.y * speed; }
        else if (dist < 140) { vel.vx = -dir.x * speed * 0.6; vel.vy = -dir.y * speed * 0.6; }
        else { vel.vx = Math.cos(ctx.time.elapsed * 1.5) * 30; vel.vy = Math.sin(ctx.time.elapsed * 1.5) * 30; }
        if (dist < combat.attackRange) this.rangedAttack(ctx, ent, combat, dir, enemy);
      } else if (ai.profileId === 'bomber_rush') {
        vel.vx = dir.x * getEnemySpeed(enemy);
        vel.vy = dir.y * getEnemySpeed(enemy);
        if (dist < combat.attackRange) this.selfExplode(ctx, ent, enemy, pos);
      }

      // Separación simple
      for (const other of ctx.world.getGroup('enemies')) {
        if (other === ent) continue;
        const op = ctx.world.getComponent<Position>(other, 'Position');
        const oc = ctx.world.getComponent<Collider>(other, 'Collider');
        const myC = ctx.world.getComponent<Collider>(ent, 'Collider');
        if (!op || !oc || !myC) continue;
        const d = v2Dist(pos, op);
        if (d < myC.radius + oc.radius && d > 0.01) {
          const away = v2Norm({ x: pos.x - op.x, y: pos.y - op.y });
          vel.vx += away.x * 30;
          vel.vy += away.y * 30;
        }
      }

      ai.attackTimer = Math.max(0, ai.attackTimer - dt);
    }
  }

  private meleeAttack(ctx: SystemContext, attacker: EntityId, target: EntityId, combat: Combat): void {
    if (combat.attackTimer > 0) return;
    combat.attackTimer = combat.attackCooldown;
    ctx.events.emit(EventTypes.DAMAGE_DEALT, {
      source: attacker, target, amount: combat.damage, kind: 'melee',
    });
  }

  private rangedAttack(ctx: SystemContext, attacker: EntityId, combat: Combat, dir: Vec2, enemy: Enemy): void {
    if (combat.attackTimer > 0 || !enemy.projectile) return;
    combat.attackTimer = combat.attackCooldown;
    const pos = ctx.world.getComponent<Position>(attacker, 'Position')!;
    const ent = ctx.world.createEntity();
    ctx.world.addComponent<Position>(ent, 'Position', { x: pos.x, y: pos.y });
    ctx.world.addComponent<Collider>(ent, 'Collider', { radius: enemy.projectile.size });
    ctx.world.addComponent<Projectile>(ent, 'Projectile', {
      vx: dir.x * enemy.projectile.speed,
      vy: dir.y * enemy.projectile.speed,
      damage: combat.damage,
      color: enemy.projectile.color,
      size: enemy.projectile.size,
      pierce: 0,
      pierced: [],
      life: 2.5,
      owner: 'enemy',
    });
  }

  private selfExplode(ctx: SystemContext, attacker: EntityId, enemy: Enemy, pos: Position): void {
    ctx.events.emit(EventTypes.PARTICLE_BURST, {
      pos, count: 30, color: '#ffe14a', speed: [100, 350],
      life: [0.4, 0.8], size: [3, 7], glow: true,
    });
    ctx.events.emit(EventTypes.SCREEN_SHAKE, { intensity: 14, time: 0.4 });
    ctx.events.emit(EventTypes.PLAY_SOUND, { id: 'explosion' });
    // Daño al jugador si está en rango
    const playerEnt = ctx.world.getTag('player');
    if (playerEnt !== undefined) {
      const pp = ctx.world.getComponent<Position>(playerEnt, 'Position');
      if (pp && v2Dist(pp, pos) < (enemy.explosionRadius ?? 60)) {
        ctx.events.emit(EventTypes.DAMAGE_DEALT, {
          source: attacker, target: playerEnt, amount: combat_damage_fallback(enemy), kind: 'explosion',
        });
      }
    }
    ctx.world.destroyEntity(attacker);
    ctx.events.emit(EventTypes.ENTITY_KILLED, { entity: attacker, killer: attacker, byExplosion: true });
  }
}

function combat_damage_fallback(enemy: Enemy): number {
  // Fallback: el Enemy component no lleva damage (va en Combat), pero para
  // auto-explosión usamos un valor por defecto coherente.
  void enemy;
  return 20;
}

function getEnemySpeed(enemy: Enemy): number {
  return enemy.speed ?? 90;
}

// ===== CombatResolutionSystem =====
export class CombatResolutionSystem implements System {
  readonly name = 'CombatResolution';
  readonly phase = 'fixed';
  readonly priority = 40;

  constructor(private collisions: CollisionSystem) {}

  update(ctx: SystemContext): void {
    // Construir entradas de colisión
    const entries: Array<{ id: EntityId; pos: Vec2; radius: number; tag?: string }> = [];
    for (const ent of ctx.world.entities()) {
      const pos = ctx.world.getComponent<Position>(ent, 'Position');
      const col = ctx.world.getComponent<Collider>(ent, 'Collider');
      if (!pos || !col) continue;
      entries.push({ id: ent, pos, radius: col.radius });
    }
    this.collisions.setEntries(entries);

    // Proyectiles del jugador vs enemigos
    for (const projEnt of ctx.world.query('Projectile')) {
      const proj = ctx.world.getComponent<Projectile>(projEnt, 'Projectile')!;
      if (proj.owner !== 'player') continue;
      const projPos = ctx.world.getComponent<Position>(projEnt, 'Position')!;
      for (const enemyEnt of ctx.world.getGroup('enemies')) {
        if (proj.pierced.includes(enemyEnt)) continue;
        const ePos = ctx.world.getComponent<Position>(enemyEnt, 'Position');
        const eCol = ctx.world.getComponent<Collider>(enemyEnt, 'Collider');
        if (!ePos || !eCol) continue;
        if (v2Dist(projPos, ePos) < proj.size + eCol.radius) {
          ctx.events.emit(EventTypes.DAMAGE_DEALT, {
            source: projEnt, target: enemyEnt, amount: proj.damage, kind: 'projectile',
          });
          proj.pierced.push(enemyEnt);
          if (proj.pierce <= 0 || proj.pierced.length > proj.pierce) {
            ctx.world.destroyEntity(projEnt);
            break;
          }
        }
      }
    }

    // Proyectiles enemigos vs jugador
    const playerEnt = ctx.world.getTag('player');
    if (playerEnt !== undefined) {
      const playerPos = ctx.world.getComponent<Position>(playerEnt, 'Position');
      const playerCol = ctx.world.getComponent<Collider>(playerEnt, 'Collider');
      if (playerPos && playerCol) {
        for (const projEnt of ctx.world.query('Projectile')) {
          const proj = ctx.world.getComponent<Projectile>(projEnt, 'Projectile')!;
          if (proj.owner !== 'enemy') continue;
          const projPos = ctx.world.getComponent<Position>(projEnt, 'Position')!;
          if (v2Dist(projPos, playerPos) < proj.size + playerCol.radius) {
            ctx.events.emit(EventTypes.DAMAGE_DEALT, {
              source: projEnt, target: playerEnt, amount: proj.damage, kind: 'projectile',
            });
            ctx.world.destroyEntity(projEnt);
          }
        }
        // Contacto enemigo-jugador
        for (const enemyEnt of ctx.world.getGroup('enemies')) {
          const ePos = ctx.world.getComponent<Position>(enemyEnt, 'Position');
          const eCol = ctx.world.getComponent<Collider>(enemyEnt, 'Collider');
          const eEnemy = ctx.world.getComponent<Enemy>(enemyEnt, 'Enemy');
          if (!ePos || !eCol || !eEnemy) continue;
          if (eEnemy.spawnAnim > 0) continue;
          if (v2Dist(ePos, playerPos) < eCol.radius + playerCol.radius) {
            ctx.events.emit(EventTypes.DAMAGE_DEALT, {
              source: enemyEnt, target: playerEnt, amount: getEnemyDamage(eEnemy), kind: 'contact',
            });
          }
        }
      }
    }

    // Jugador vs pickups (curaciones, puntuación, escudos)
    if (playerEnt !== undefined) {
      const pp = ctx.world.getComponent<Position>(playerEnt, 'Position')!;
      for (const pickEnt of ctx.world.getGroup('pickups')) {
        const pkPos = ctx.world.getComponent<Position>(pickEnt, 'Position');
        const pk = ctx.world.getComponent<Pickup>(pickEnt, 'Pickup');
        if (!pkPos || !pk) continue;

        // Excluir armas en el suelo de la recolección táctil e instantánea (BUG 4)
        if (pk.kind === 'weapon') continue;

        const d = v2Dist(pp, pkPos);
        if (d < 80) {
          // Magnetismo
          const pull = v2Norm({ x: pp.x - pkPos.x, y: pp.y - pkPos.y });
          pkPos.x += pull.x * 300 * ctx.time.fixedDt;
          pkPos.y += pull.y * 300 * ctx.time.fixedDt;
        }
        if (d < 24) {
          ctx.events.emit('pickup:collected', { entity: pickEnt, player: playerEnt });
        }
      }
    }
  }
}

function getEnemyDamage(e: Enemy): number {
  return e.damage ?? 10;
}

// ===== DamageApplicationSystem =====
export class DamageApplicationSystem implements System {
  readonly name = 'DamageApplication';
  readonly phase = 'fixed';
  readonly priority = 50;
  private unsub?: () => void;
  private pending: Array<{ target: EntityId; amount: number; source: EntityId; kind: string }> = [];

  constructor(private events: EventBus) {
    this.unsub = events.on<{ target: EntityId; amount: number; source: EntityId; kind: string }>(
      EventTypes.DAMAGE_DEALT, (e) => this.pending.push(e)
    );
  }

  update(ctx: SystemContext): void {
    const { world, events } = ctx;
    for (const dmg of this.pending) {
      const health = world.getComponent<Health>(dmg.target, 'Health');
      if (!health) continue;
      const invuln = world.getComponent<Invulnerable>(dmg.target, 'Invulnerable');
      if (invuln && invuln.time > 0) continue;
      const shield = world.getComponent<Shield>(dmg.target, 'Shield');
      if (shield && shield.charges > 0) {
        shield.charges--;
        events.emit(EventTypes.PLAY_SOUND, { id: 'pickup' });
        events.emit(EventTypes.FLOAT_TEXT, { target: dmg.target, text: 'BLOCKED', color: '#00f0ff' });
        if (world.hasComponent(dmg.target, 'Invulnerable')) {
          world.getComponent<Invulnerable>(dmg.target, 'Invulnerable')!.time = 0.5;
        } else {
          world.addComponent<Invulnerable>(dmg.target, 'Invulnerable', { time: 0.5 });
        }
        continue;
      }

      const reduction = Math.max(0, health.armor);
      const final = Math.max(1, dmg.amount - reduction);
      health.current -= final;
      events.emit(EventTypes.FLOAT_TEXT, { target: dmg.target, text: '-' + Math.round(final), color: '#ff3b5c' });
      events.emit(EventTypes.PLAY_SOUND, { id: world.getTag('player') === dmg.target ? 'hurt' : 'hit' });
      events.emit(EventTypes.SCREEN_SHAKE, {
        intensity: world.getTag('player') === dmg.target ? 10 : 3,
        time: world.getTag('player') === dmg.target ? 0.25 : 0.08,
      });
      if (world.getTag('player') === dmg.target) events.emit('player:damaged', {});

      // Partículas rojas
      const pos = world.getComponent<Position>(dmg.target, 'Position');
      if (pos) {
        events.emit(EventTypes.PARTICLE_BURST, {
          pos, count: 10, color: '#ff3b5c', speed: [60, 180],
          life: [0.3, 0.5], size: [2, 4], glow: true,
        });
      }

      if (health.current <= 0) {
        health.current = 0;
        events.emit(EventTypes.ENTITY_KILLED, { entity: dmg.target, killer: dmg.source, kind: dmg.kind });
      }
    }
    this.pending.length = 0;

    // Tick invulnerabilidad
    for (const [ent, inv] of world.iter<Invulnerable>('Invulnerable')) {
      inv.time -= ctx.time.fixedDt;
      if (inv.time <= 0) world.removeComponent(ent, 'Invulnerable');
    }
  }

  dispose(): void {
    this.unsub?.();
  }
}

// ===== DeathSystem: procesa ENTITY_KILLED =====
export class DeathSystem implements System {
  readonly name = 'Death';
  readonly phase = 'fixed';
  readonly priority = 60;
  private pendingKills: EntityId[] = [];
  private unsub?: () => void;

  constructor(private events: EventBus) {
    this.unsub = events.on<{ entity: EntityId }>(EventTypes.ENTITY_KILLED, (e) => {
      this.pendingKills.push(e.entity);
    });
  }

  update(ctx: SystemContext): void {
    const { world, events } = ctx;
    for (const ent of this.pendingKills) {
      if (!world.isAlive(ent)) continue;
      const enemy = world.getComponent<Enemy>(ent, 'Enemy');
      const pos = world.getComponent<Position>(ent, 'Position');
      if (enemy && pos) {
        // Explosión de muerte
        events.emit(EventTypes.PARTICLE_BURST, {
          pos, count: 18, color: enemy.color, speed: [80, 260],
          life: [0.3, 0.7], size: [2, 5], glow: true,
        });
        events.emit(EventTypes.PLAY_SOUND, { id: 'kill' });
        events.emit(EventTypes.SCREEN_SHAKE, { intensity: 5, time: 0.12 });
        events.emit(EventTypes.SCORE_CHANGED, { delta: enemy.score, source: ent });
        events.emit('enemy:killed', { entity: ent, xp: enemy.xp });
      }
      if (world.getTag('player') === ent) {
        events.emit(EventTypes.PLAYER_DIED, {});
        events.emit(EventTypes.PLAY_SOUND, { id: 'death' });
        events.emit(EventTypes.SCREEN_SHAKE, { intensity: 20, time: 0.6 });
      }
      world.destroyEntity(ent);
    }
    this.pendingKills.length = 0;
  }

  dispose(): void { this.unsub?.(); }
}

// ===== PickupSystem =====
export class PickupSystem implements System {
  readonly name = 'Pickup';
  readonly phase = 'fixed';
  readonly priority = 70;
  private pending: Array<{ entity: EntityId; player: EntityId }> = [];
  private unsub?: () => void;

  constructor(private events: EventBus) {
    this.unsub = events.on<{ entity: EntityId; player: EntityId }>('pickup:collected', (e) => {
      this.pending.push(e);
    });
  }

  update(ctx: SystemContext): void {
    const { world, events } = ctx;
    // Bob anim
    for (const [, p] of world.iter<Pickup>('Pickup')) {
      p.bobPhase += ctx.time.fixedDt * 3;
      p.life -= ctx.time.fixedDt;
    }

    for (const pk of this.pending) {
      const pickup = world.getComponent<Pickup>(pk.entity, 'Pickup');
      const playerPos = world.getComponent<Position>(pk.player, 'Position');
      if (!pickup) continue;
      events.emit(EventTypes.PLAY_SOUND, { id: 'pickup' });
      if (pickup.kind === 'heal') {
        const h = world.getComponent<Health>(pk.player, 'Health');
        if (h) {
          h.current = Math.min(h.max, h.current + pickup.value);
          events.emit(EventTypes.FLOAT_TEXT, { target: pk.player, text: '+' + pickup.value + ' HP', color: '#39ff88' });
        }
      } else if (pickup.kind === 'score') {
        events.emit(EventTypes.SCORE_CHANGED, { delta: pickup.value, source: pk.entity });
        if (playerPos) events.emit(EventTypes.FLOAT_TEXT, { target: pk.player, text: '+' + pickup.value, color: '#ffe14a' });
      } else if (pickup.kind === 'weapon' && pickup.weaponId) {
        events.emit('weapon:picked', { weaponId: pickup.weaponId, player: pk.player });
      } else if (pickup.kind === 'shield') {
        let sh = world.getComponent<Shield>(pk.player, 'Shield');
        if (!sh) {
          world.addComponent<Shield>(pk.player, 'Shield', { charges: pickup.value });
        } else {
          sh.charges += pickup.value;
        }
        events.emit(EventTypes.FLOAT_TEXT, { target: pk.player, text: '+SHIELD', color: '#00f0ff' });
      }
      if (playerPos) {
        events.emit(EventTypes.PARTICLE_BURST, {
          pos: playerPos, count: 10, color: pickup.color, speed: [60, 150],
          life: [0.25, 0.4], size: [2, 4], glow: true,
        });
      }
      world.destroyEntity(pk.entity);
    }
    this.pending.length = 0;

    // Limpiar pickups expirados
    for (const ent of world.getGroup('pickups')) {
      const p = world.getComponent<Pickup>(ent, 'Pickup');
      if (p && p.life <= 0) world.destroyEntity(ent);
    }
  }

  dispose(): void { this.unsub?.(); }
}

// ===== StatusSystem =====
export class StatusSystem implements System {
  readonly name = 'Status';
  readonly phase = 'fixed';
  readonly priority = 80;

  update(ctx: SystemContext): void {
    for (const [ent, s] of ctx.world.iter<StatusEffect>('StatusEffect')) {
      s.time -= ctx.time.fixedDt;
      if (s.time <= 0) {
        ctx.world.removeComponent(ent, 'StatusEffect');
        ctx.events.emit(EventTypes.STATUS_EFFECT_EXPIRED, { entity: ent, kind: s.kind });
      }
    }
  }
}

// ===== DashSystem =====
export class DashSystem implements System {
  readonly name = 'Dash';
  readonly phase = 'fixed';
  readonly priority = -90;
  constructor(private getInput: () => InputState) {}

  update(ctx: SystemContext): void {
    const input = this.getInput();
    const playerEnt = ctx.world.getTag('player');
    if (playerEnt === undefined) return;
    const player = ctx.world.getComponent<Player>(playerEnt, 'Player');
    const vel = ctx.world.getComponent<Velocity>(playerEnt, 'Velocity');
    const facing = ctx.world.getComponent<Facing>(playerEnt, 'Facing');
    if (!player || !vel || !facing) return;

    player.dashCooldown = Math.max(0, player.dashCooldown - ctx.time.fixedDt);

    if (input.dashPressed && !player.isDashing && player.dashCooldown <= 0) {
      player.isDashing = true;
      player.dashTime = 0.18;
      player.dashCooldown = player.dashCooldownMax;
      // Invulnerabilidad durante dash
      if (ctx.world.hasComponent(playerEnt, 'Invulnerable')) {
        ctx.world.getComponent<Invulnerable>(playerEnt, 'Invulnerable')!.time = 0.22;
      } else {
        ctx.world.addComponent<Invulnerable>(playerEnt, 'Invulnerable', { time: 0.22 });
      }
      // Impulso
      const mag = v2Len(input.move) > 0.1 ? v2Norm(input.move) : { x: facing.dx, y: facing.dy };
      vel.vx = mag.x * 480;
      vel.vy = mag.y * 480;
      ctx.events.emit(EventTypes.PLAY_SOUND, { id: 'dash' });
      ctx.events.emit(EventTypes.SCREEN_SHAKE, { intensity: 4, time: 0.15 });
      ctx.events.emit(EventTypes.PLAYER_DASHED, {});
    }

    // Trail de partículas durante dash
    if (player.isDashing && Math.random() < 0.8) {
      const pos = ctx.world.getComponent<Position>(playerEnt, 'Position');
      if (pos) {
        ctx.events.emit(EventTypes.PARTICLE_BURST, {
          pos, count: 1, color: '#00f0ff', speed: [10, 40],
          life: [0.2, 0.3], size: [4, 6], glow: true,
        });
      }
    }
  }
}

// ===== ParticleSystem (update wrapper) =====
export class ParticleUpdateSystem implements System {
  readonly name = 'ParticleUpdate';
  readonly phase = 'fixed';
  readonly priority = 90;
  constructor(private particles: ParticleSystem) {}
  update(ctx: SystemContext): void {
    this.particles.update(ctx.time.fixedDt);
  }
}

// ===== WeaponInteractionSystem (BUG 4 Fix: Interacción de intercambio de armas) =====
export interface WeaponPromptData {
  weaponId: string;
  weaponName: string;
  damage: number;
  fireRate: number;
  currentWeaponName: string;
  currentDamage: number;
  currentFireRate: number;
}

export class WeaponInteractionSystem implements System {
  readonly name = 'WeaponInteraction';
  readonly phase = 'fixed';
  readonly priority = 72;

  activePrompt: WeaponPromptData | null = null;

  constructor(
    private getInput: () => InputState,
    private content: import('@/engine/content/ContentRepository').ContentRepository
  ) {}

  update(ctx: SystemContext): void {
    const playerEnt = ctx.world.getTag('player');
    if (playerEnt === undefined) {
      this.activePrompt = null;
      return;
    }

    const pp = ctx.world.getComponent<Position>(playerEnt, 'Position');
    const pWeapon = ctx.world.getComponent<Weapon>(playerEnt, 'Weapon');
    if (!pp || !pWeapon) {
      this.activePrompt = null;
      return;
    }

    const input = this.getInput();
    let closestPickup: { ent: EntityId; dist: number; pickup: Pickup } | null = null;

    for (const ent of ctx.world.getGroup('pickups')) {
      const pickup = ctx.world.getComponent<Pickup>(ent, 'Pickup');
      const pkPos = ctx.world.getComponent<Position>(ent, 'Position');
      if (!pickup || !pkPos || pickup.kind !== 'weapon' || !pickup.weaponId) continue;

      const d = v2Dist(pp, pkPos);
      if (d < 55) {
        if (!closestPickup || d < closestPickup.dist) {
          closestPickup = { ent, dist: d, pickup };
        }
      }
    }

    if (!closestPickup || !closestPickup.pickup.weaponId) {
      this.activePrompt = null;
      return;
    }

    const wId = closestPickup.pickup.weaponId;
    const wDef = this.content.get<{ name: string; damage: number; fireRate: number }>('weapons', wId);

    const groundName = wDef?.name ?? wId.toUpperCase();
    const groundDamage = wDef?.damage ?? 15;
    const groundFireRate = wDef?.fireRate ?? 2.5;

    const currentDef = this.content.get<{ name: string }>('weapons', pWeapon.id);
    const currentName = currentDef?.name ?? pWeapon.id.toUpperCase();

    this.activePrompt = {
      weaponId: wId,
      weaponName: groundName,
      damage: groundDamage,
      fireRate: groundFireRate,
      currentWeaponName: currentName,
      currentDamage: pWeapon.damage,
      currentFireRate: pWeapon.fireRate,
    };

    // Al pulsar E (interact) mientras está en rango
    if (input.interactPressed || input.confirmPressed) {
      import('@/gameplay/persistence/ArmoryStore').then(({ ArmoryStore }) => {
        ArmoryStore.recordDiscovery(wId);
      });
      ctx.events.emit('weapon:picked', { weaponId: wId, player: playerEnt });
      ctx.world.destroyEntity(closestPickup.ent);
      this.activePrompt = null;
    }
  }
}

// ===== RenderSystem: emite RenderCommands al IRenderer =====
export class RenderSystem implements System {
  readonly name = 'Render';
  readonly phase = 'render';
  readonly priority = 0;

  constructor(private renderer: IRenderer) {}

  update(ctx: SystemContext): void {
    this.renderer.beginFrame();
    const commands: RenderCommand[] = [];

    // Fondo / arena
    this.drawArena(ctx, commands);

    // Puerta
    const doorEnt = ctx.world.getTag('door');
    if (doorEnt !== undefined) {
      const d = ctx.world.getComponent<Door>(doorEnt, 'Door');
      if (d) {
        commands.push({
          kind: 'rect', x: d.x + d.w / 2, y: d.y + d.h / 2,
          w: d.w, h: d.h, layer: 1,
          color: d.locked ? '#444' : '#39ff88',
          glow: d.locked ? 0 : 15,
          glowColor: '#39ff88',
        });
      }
    }

    // Cofres (BUG 3 Fix: Renderizar cofres en el mapa principal)
    for (const ent of ctx.world.getGroup('chests')) {
      const pos = ctx.world.getComponent<Position>(ent, 'Position');
      const chest = ctx.world.getComponent<import('./ChestSystem').ChestComponent>(ent, 'Chest');
      const sprite = ctx.world.getComponent<Sprite>(ent, 'Sprite');
      if (!pos || !chest || chest.opened) continue;

      const size = sprite?.size ?? chest.size ?? 16;
      const color = sprite?.color ?? chest.color ?? '#ffe14a';
      const glow = sprite?.glow ?? chest.glow ?? '#ffe14a';

      commands.push({
        kind: 'rect', x: pos.x, y: pos.y,
        w: size * 2, h: size * 2, layer: 2,
        color,
        outline: { color: '#ffffff', width: 2 },
        glow: 15, glowColor: glow,
      });
      commands.push({
        kind: 'rect', x: pos.x, y: pos.y - size * 0.3,
        w: size * 1.8, h: size * 0.5, layer: 3,
        color: '#ffffff', alpha: 0.8,
      });
    }

    // Pickups
    for (const ent of ctx.world.getGroup('pickups')) {
      const pos = ctx.world.getComponent<Position>(ent, 'Position');
      const pk = ctx.world.getComponent<Pickup>(ent, 'Pickup');
      if (!pos || !pk) continue;
      const bob = Math.sin(pk.bobPhase) * 4;
      commands.push({
        kind: 'circle', x: pos.x, y: pos.y + bob,
        radius: 8, layer: 2, color: pk.color,
        glow: 15, glowColor: pk.glow,
      });
    }

    // Mascotas
    for (const ent of ctx.world.getGroup('pets')) {
      const pos = ctx.world.getComponent<Position>(ent, 'Position');
      const pet = ctx.world.getComponent<import('../components').Pet>(ent, 'Pet');
      if (!pos || !pet) continue;
      commands.push({
        kind: 'circle', x: pos.x, y: pos.y,
        radius: 8, layer: 8, color: pet.color,
        glow: 18, glowColor: pet.glow,
      });
      commands.push({
        kind: 'circle', x: pos.x, y: pos.y,
        radius: 3, layer: 9, color: '#ffffff',
      });
    }

    // Enemigos
    for (const ent of ctx.world.getGroup('enemies')) {
      const pos = ctx.world.getComponent<Position>(ent, 'Position');
      const sprite = ctx.world.getComponent<Sprite>(ent, 'Sprite');
      const enemy = ctx.world.getComponent<Enemy>(ent, 'Enemy');
      const health = ctx.world.getComponent<Health>(ent, 'Health');
      if (!pos || !sprite || !enemy || !health) continue;
      if (enemy.spawnAnim > 0) {
        const t = 1 - enemy.spawnAnim / 0.4;
        commands.push({
          kind: 'circle', x: pos.x, y: pos.y,
          radius: sprite.size * (1 + (1 - t) * 2), layer: 3,
          color: 'transparent',
          outline: { color: enemy.color, width: 2 },
          alpha: 1 - t,
        });
        continue;
      }
      const color = enemy.hitFlash > 0 ? '#ffffff' : enemy.color;

      // Aura especial para Campeones y Bosses
      if (enemy.color === '#ffe14a' || ctx.world.hasComponent(ent, 'Boss')) {
        commands.push({
          kind: 'circle', x: pos.x, y: pos.y,
          radius: sprite.size * 1.5, layer: 3,
          color: 'transparent',
          outline: { color: '#ffe14a', width: 2 },
          glow: 20, glowColor: '#ffe14a',
          alpha: 0.6 + Math.sin(ctx.time.elapsed * 6) * 0.3,
        });
      }

      commands.push(this.makeSpriteCmd(pos.x, pos.y, sprite, color, 4));
      // HP bar
      if (health.current < health.max) {
        const bw = sprite.size * 2;
        commands.push({ kind: 'rect', x: pos.x, y: pos.y - sprite.size - 10, w: bw, h: 3, layer: 5, color: '#222' });
        commands.push({ kind: 'rect', x: pos.x - bw / 2 + (bw * (health.current / health.max)) / 2, y: pos.y - sprite.size - 10, w: bw * (health.current / health.max), h: 3, layer: 6, color: '#ff3b5c' });
      }
    }

    // Proyectiles
    for (const [ent, proj] of ctx.world.iter<Projectile>('Projectile')) {
      const pos = ctx.world.getComponent<Position>(ent, 'Position');
      if (!pos) continue;
      commands.push({
        kind: 'circle', x: pos.x, y: pos.y,
        radius: proj.size, layer: 7, color: '#ffffff',
        glow: 10, glowColor: proj.color,
      });
    }

    // Jugador
    const playerEnt = ctx.world.getTag('player');
    if (playerEnt !== undefined) {
      const pos = ctx.world.getComponent<Position>(playerEnt, 'Position');
      const player = ctx.world.getComponent<Player>(playerEnt, 'Player');
      const facing = ctx.world.getComponent<Facing>(playerEnt, 'Facing');
      const sprite = ctx.world.getComponent<Sprite>(playerEnt, 'Sprite');
      const invuln = ctx.world.getComponent<Invulnerable>(playerEnt, 'Invulnerable');
      if (pos && player && facing && sprite) {
        // Flicker si invulnerable
        const flicker = invuln && invuln.time > 0 && Math.floor(invuln.time * 20) % 2 === 0;
        if (!flicker) {
          const rotation = Math.atan2(facing.dy, facing.dx);
          commands.push({
            kind: 'polygon', x: pos.x, y: pos.y,
            points: [
              { x: sprite.size * 1.2, y: 0 },
              { x: -sprite.size, y: -sprite.size * 0.8 },
              { x: -sprite.size * 0.5, y: 0 },
              { x: -sprite.size, y: sprite.size * 0.8 },
            ],
            color: player.isDashing ? '#ffffff' : sprite.color,
            rotation, layer: 8,
            glow: player.isDashing ? 25 : 15,
            glowColor: sprite.glow,
          });
          // Core
          commands.push({
            kind: 'circle', x: pos.x - facing.dx * sprite.size * 0.2, y: pos.y - facing.dy * sprite.size * 0.2,
            radius: sprite.size * 0.3, layer: 9, color: '#ffffff',
          });
        }
        // Shield visual
        const shield = ctx.world.getComponent<Shield>(playerEnt, 'Shield');
        if (shield && shield.charges > 0) {
          commands.push({
            kind: 'circle', x: pos.x, y: pos.y,
            radius: sprite.size * 1.8, layer: 7,
            color: 'transparent',
            outline: { color: '#00f0ff', width: 2 },
            alpha: 0.5 + Math.sin(ctx.time.elapsed * 8) * 0.3,
          });
        }
      }
    }

    // Partículas (con glow)
    for (const [ent, part] of ctx.world.iter<import('@/engine/rendering/ParticleSystem').ParticleComponent>('Particle')) {
      const pos = ctx.world.getComponent<Position>(ent, 'Position');
      if (!pos) continue;
      const alpha = Math.max(0, part.life / part.maxLife);
      commands.push({
        kind: 'rect', x: pos.x, y: pos.y,
        w: part.size, h: part.size, layer: 10,
        color: part.color, alpha,
        glow: part.glow ? 8 : 0, glowColor: part.color,
      });
    }

    this.renderer.draw(commands);
    this.renderer.endFrame();
  }

  private makeSpriteCmd(x: number, y: number, sprite: Sprite, color: string, layer: number): RenderCommand {
    const size = sprite.size;
    if (sprite.shape === 'hexagon') {
      const points: Vec2[] = [];
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        points.push({ x: Math.cos(a) * size, y: Math.sin(a) * size });
      }
      return { kind: 'polygon', x, y, points, color, layer, glow: 12, glowColor: sprite.glow };
    }
    if (sprite.shape === 'diamond') {
      return {
        kind: 'polygon', x, y,
        points: [
          { x: 0, y: -size }, { x: size, y: 0 }, { x: 0, y: size }, { x: -size, y: 0 },
        ],
        color, layer, glow: 12, glowColor: sprite.glow,
      };
    }
    if (sprite.shape === 'circle' || sprite.shape === 'circle_pulse') {
      return { kind: 'circle', x, y, radius: size, color, layer, glow: 12, glowColor: sprite.glow };
    }
    // square fallback
    return { kind: 'rect', x, y, w: size * 2, h: size * 2, color, layer, glow: 12, glowColor: sprite.glow };
  }

  private drawArena(ctx: SystemContext, commands: RenderCommand[]): void {
    const gridSize = 80;

    for (const [, node] of ctx.world.iter<import('../components').MapNode>('MapNode')) {
      const b = node.bounds;
      const isCorridor = node.type === 'corridor';
      const borderColor = isCorridor ? '#ffe14a' : node.status === 'active' ? '#ff3b5c' : '#00f0ff';

      // Grid
      for (let x = b.x; x < b.x + b.w; x += gridSize) {
        commands.push({ kind: 'line', x, y: b.y, x2: x, y2: b.y + b.h, color: 'rgba(0,240,255,0.05)', width: 1, layer: 0 });
      }
      for (let y = b.y; y < b.y + b.h; y += gridSize) {
        commands.push({ kind: 'line', x: b.x, y, x2: b.x + b.w, y2: y, color: 'rgba(0,240,255,0.05)', width: 1, layer: 0 });
      }

      // Bordes del nodo
      commands.push({
        kind: 'rect', x: b.x + b.w / 2, y: b.y + b.h / 2,
        w: b.w, h: b.h, layer: 0, color: 'transparent',
        outline: { color: borderColor, width: isCorridor ? 2 : 3 },
        glow: isCorridor ? 8 : 15, glowColor: borderColor,
      });
    }
  }
}

// ===== CameraFollowSystem =====
export class CameraFollowSystem implements System {
  readonly name = 'CameraFollow';
  readonly phase = 'render';
  readonly priority = -10;
  constructor(private renderer: IRenderer) {}
  update(ctx: SystemContext): void {
    const playerEnt = ctx.world.getTag('player');
    if (playerEnt === undefined) return;
    const pos = ctx.world.getComponent<Position>(playerEnt, 'Position');
    if (!pos) return;
    this.renderer.setCamera({ x: pos.x, y: pos.y, zoom: 1 });
  }
}

// ===== ScreenShakeSystem =====
export class ScreenShakeSystem implements System {
  readonly name = 'ScreenShake';
  readonly phase = 'render';
  readonly priority = -5;
  private unsub?: () => void;
  constructor(private renderer: IRenderer, events: EventBus) {
    this.unsub = events.on<{ intensity: number; time: number }>(EventTypes.SCREEN_SHAKE, (e) => {
      this.renderer.setShake(e.intensity, e.time);
    });
  }
  update(): void {}
  dispose(): void { this.unsub?.(); }
}

// ===== ScoreSystem (estado compartido) =====
export interface RunStats {
  score: number;
  wave: number;
  kills: number;
  combo: number;
  comboTimer: number;
}

export class ScoreSystem implements System {
  readonly name = 'Score';
  readonly phase = 'fixed';
  readonly priority = 95;
  stats: RunStats = { score: 0, wave: 0, kills: 0, combo: 0, comboTimer: 0 };
  readonly comboDecay = 2.5;
  private unsubs: Array<() => void> = [];

  constructor(events: EventBus) {
    this.unsubs.push(events.on<{ delta: number }>(EventTypes.SCORE_CHANGED, (e) => {
      const mult = this.comboMultiplier();
      this.stats.score += Math.round(e.delta * mult);
    }));
    this.unsubs.push(events.on<{ entity: EntityId }>(EventTypes.ENTITY_KILLED, () => {
      this.stats.kills++;
      this.stats.combo++;
      this.stats.comboTimer = this.comboDecay;
      events.emit(EventTypes.COMBO_CHANGED, { combo: this.stats.combo, multiplier: this.comboMultiplier() });
    }));
  }

  comboMultiplier(): number {
    const c = this.stats.combo;
    if (c < 3) return 1;
    if (c < 6) return 1.5;
    if (c < 10) return 2;
    if (c < 15) return 3;
    return 4;
  }

  update(ctx: SystemContext): void {
    if (this.stats.combo > 0) {
      this.stats.comboTimer -= ctx.time.fixedDt;
      if (this.stats.comboTimer <= 0) {
        this.stats.combo = 0;
        ctx.events.emit(EventTypes.COMBO_CHANGED, { combo: 0, multiplier: 1 });
      }
    }
  }

  reset(): void {
    this.stats = { score: 0, wave: 0, kills: 0, combo: 0, comboTimer: 0 };
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
  }
}
