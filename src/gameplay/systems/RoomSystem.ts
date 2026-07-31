/**
 * RoomSystem.ts — lógica ECS de activación y avance entre salas (TDD §3.3, §7).
 *
 * Mantiene el ciclo de vida de los nodos del mapa lineal continuo:
 * - Detecta cuando el jugador entra físicamente en una nueva sala.
 * - Cierra y bloquea la puerta de entrada.
 * - Spawnea las oleadas de enemigos dentro de los límites de la sala.
 * - Al limpiar todos los enemigos, abre la puerta de salida para continuar por el pasillo.
 */

import type { System, SystemContext } from '@/engine/core/GameLoop';
import type { World, EntityId } from '@/engine/ecs/World';
import type { EventBus } from '@/engine/events/EventBus';
import type { ContentRepository } from '@/engine/content/ContentRepository';
import type { MutationSystem } from '../mutations/MutationSystem';
import { EventTypes } from '@/engine/events/EventBus';
import { rectContains, randInt, chance } from '@/engine/utils/math';
import type { Position, MapNode, Door, Health, Combat, AIState, Enemy, Sprite, Velocity, Collider } from '../components';

interface EnemyDef {
  id: string; name: string; hp: number; speed: number; damage: number; size: number;
  color: string; glow: string; shape: string; score: number; xp: number;
  aiProfile: string; attackRange: number; attackCooldown: number;
  explosionRadius?: number;
  projectile?: { speed: number; color: string; size: number };
  tags?: string[];
}

export class RoomSystem implements System {
  readonly name = 'Room';
  readonly phase = 'fixed';
  readonly priority = 15;

  activeEnemiesInRoom = 0;

  constructor(
    private world: World,
    private events: EventBus,
    private content: ContentRepository,
    private mutationSystem: MutationSystem
  ) {
    // Escuchar cuando un enemigo es eliminado para decrementar la cuenta de la sala
    events.on<{ entity: EntityId }>(EventTypes.ENTITY_KILLED, (e) => {
      if (this.world.hasComponent(e.entity, 'Enemy')) {
        this.activeEnemiesInRoom = Math.max(0, this.activeEnemiesInRoom - 1);
      }
    });
  }

  update(ctx: SystemContext): void {
    const playerEnt = this.world.getTag('player');
    if (playerEnt === undefined) return;
    const pp = this.world.getComponent<Position>(playerEnt, 'Position');
    if (!pp) return;

    for (const [nodeEnt, node] of this.world.iter<MapNode>('MapNode')) {
      if (node.status === 'unvisited' && node.type !== 'corridor') {
        // Comprobar si el jugador ha entrado físicamente en la sala
        if (rectContains(node.bounds, pp)) {
          this.activateRoom(nodeEnt, node);
        }
      } else if (node.status === 'active') {
        // Comprobar si los enemigos de la oleada actual han sido eliminados
        if (this.activeEnemiesInRoom === 0) {
          if (node.currentWave < node.waves.length) {
            this.spawnNextWave(node);
          } else {
            this.clearRoom(nodeEnt, node);
          }
        }
      }
    }

    void ctx;
  }

  private activateRoom(nodeEnt: EntityId, node: MapNode): void {
    node.status = 'active';
    node.currentWave = 0;

    // Bloquear puerta de entrada
    if (node.entryDoorEnt) {
      const entryDoor = this.world.getComponent<Door>(node.entryDoorEnt, 'Door');
      if (entryDoor) entryDoor.locked = true;
    }

    // Bloquear puerta de salida hasta limpiar la sala
    if (node.exitDoorEnt) {
      const exitDoor = this.world.getComponent<Door>(node.exitDoorEnt, 'Door');
      if (exitDoor) exitDoor.locked = true;
    }

    this.events.emit(EventTypes.ROOM_ENTERED, { nodeIndex: node.index, level: node.level, biome: node.biomeId });
    this.events.emit(EventTypes.PLAY_SOUND, { id: 'wave_start' });

    // Spawnear primera oleada
    this.spawnNextWave(node);
  }

  private spawnNextWave(node: MapNode): void {
    if (node.currentWave >= node.waves.length) return;
    const wave = node.waves[node.currentWave];
    node.currentWave++;

    let totalEnemies = 0;
    for (const spawn of wave.enemies) {
      for (let i = 0; i < spawn.count; i++) {
        this.spawnEnemyInNode(spawn.id, node);
        totalEnemies++;
      }
    }

    this.activeEnemiesInRoom = totalEnemies;
    this.events.emit(EventTypes.WAVE_STARTED, { wave: node.currentWave });
  }

  private spawnEnemyInNode(enemyId: string, node: MapNode): void {
    const def = this.content.get<EnemyDef>('enemies', enemyId);
    if (!def) return;

    const baseStats = {
      hp: def.hp, damage: def.damage, speed: def.speed, size: def.size,
      score: def.score, xp: def.xp, color: def.color,
    };
    const mutated = this.mutationSystem.mutate(baseStats, node.difficulty);
    const mStats = mutated.stats;

    // Spawnear dentro de los límites físicos de la sala
    const margin = 80;
    const minX = node.bounds.x + margin;
    const maxX = node.bounds.x + node.bounds.w - margin;
    const minY = node.bounds.y + margin;
    const maxY = node.bounds.y + node.bounds.h - margin;

    const x = minX + Math.random() * Math.max(20, maxX - minX);
    const y = minY + Math.random() * Math.max(20, maxY - minY);

    const ent = this.world.createEntity();
    this.world.addComponent<Position>(ent, 'Position', { x, y });
    this.world.addComponent<Velocity>(ent, 'Velocity', { vx: 0, vy: 0 });
    this.world.addComponent<Collider>(ent, 'Collider', { radius: mStats.size });
    this.world.addComponent<Health>(ent, 'Health', { current: Math.round(mStats.hp), max: Math.round(mStats.hp), armor: 0 });
    this.world.addComponent<Combat>(ent, 'Combat', { damage: mStats.damage, attackCooldown: def.attackCooldown, attackTimer: 0.5, attackRange: def.attackRange });
    this.world.addComponent<AIState>(ent, 'AIState', { profileId: def.aiProfile, attackTimer: 0 });
    this.world.addComponent<Enemy>(ent, 'Enemy', {
      id: def.id, name: def.name, color: mStats.color, glow: def.glow, shape: def.shape,
      score: Math.round(mStats.score), xp: Math.round(mStats.xp), spawnAnim: 0.4, hitFlash: 0,
      speed: mStats.speed, damage: mStats.damage, explosionRadius: def.explosionRadius, projectile: def.projectile,
    });
    this.world.addComponent<Sprite>(ent, 'Sprite', {
      shape: def.shape as Sprite['shape'], color: mStats.color, glow: def.glow, size: mStats.size,
    });
    this.world.addToGroup('enemies', ent);

    // Si es un Boss, añadir BossComponent
    if (def.tags?.includes('boss')) {
      this.world.addComponent(ent, 'Boss', { bossId: def.id, currentPhase: 1 });
    }

    this.events.emit(EventTypes.PARTICLE_BURST, {
      pos: { x, y }, count: 12, color: mStats.color, speed: [40, 120],
      life: [0.25, 0.4], size: [2, 4], glow: true,
    });
  }

  private clearRoom(nodeEnt: EntityId, node: MapNode): void {
    node.status = 'cleared';

    // Abrir únicamente la puerta de salida
    if (node.exitDoorEnt) {
      const exitDoor = this.world.getComponent<Door>(node.exitDoorEnt, 'Door');
      if (exitDoor) {
        exitDoor.locked = false;
        this.events.emit(EventTypes.FLOAT_TEXT, { target: node.exitDoorEnt, text: '¡PUERTA ABIERTA!', color: '#39ff88' });
      }
    }

    this.events.emit(EventTypes.ROOM_CLEARED, { nodeIndex: node.index, level: node.level });
    this.events.emit(EventTypes.SCORE_CHANGED, { delta: 100 * node.level });
    this.events.emit(EventTypes.PLAY_SOUND, { id: 'levelup' });
  }
}
