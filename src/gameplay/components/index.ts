/**
 * gameplay/components/index.ts — definiciones de componentes ECS (TDD §3.2).
 *
 * El motor provee World + ComponentRegistry; el gameplay define los
 * componentes concretos. Cada componente es un struct de datos plano.
 */

import type { ComponentDefinition, EntityId } from '@/engine/ecs/World';

const clone = <T>(src: T): T => ({ ...(src as object) } as T);

// ===== Posición / Movimiento =====
export interface Position { x: number; y: number }
export interface Velocity { vx: number; vy: number }
export interface Collider { radius: number }
export interface Facing { dx: number; dy: number }

export const PositionDef: ComponentDefinition = { name: 'Position', clone };
export const VelocityDef: ComponentDefinition = { name: 'Velocity', clone };
export const ColliderDef: ComponentDefinition = { name: 'Collider', clone };
export const FacingDef: ComponentDefinition = { name: 'Facing', clone };

// ===== Vida / Combate =====
export interface Health { current: number; max: number; armor: number }
export interface Combat { damage: number; attackCooldown: number; attackTimer: number; attackRange: number }
export interface Invulnerable { time: number }
export interface Shield { charges: number }
export interface StatusEffect { kind: string; time: number; strength: number }

export const HealthDef: ComponentDefinition = { name: 'Health', clone };
export const CombatDef: ComponentDefinition = { name: 'Combat', clone };
export const InvulnerableDef: ComponentDefinition = { name: 'Invulnerable', clone };
export const ShieldDef: ComponentDefinition = { name: 'Shield', clone };
export const StatusEffectDef: ComponentDefinition = { name: 'StatusEffect', clone };

// ===== Arma =====
export interface Weapon {
  id: string;
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  projectileSize: number;
  color: string;
  spread: number;
  count: number;
  pierce: number;
  sound: string;
  cooldown: number;
}
export const WeaponDef: ComponentDefinition = { name: 'Weapon', clone };

// ===== Proyectil =====
export interface Projectile {
  vx: number;
  vy: number;
  damage: number;
  color: string;
  size: number;
  pierce: number;
  pierced: number[];
  life: number;
  owner: 'player' | 'enemy';
}
export const ProjectileDef: ComponentDefinition = { name: 'Projectile', clone };

// ===== IA =====
export interface AIState { profileId: string; target?: number; attackTimer: number }
export const AIStateDef: ComponentDefinition = { name: 'AIState', clone };

// ===== Enemigo (meta) =====
export interface Enemy {
  id: string;
  name: string;
  color: string;
  glow: string;
  shape: string;
  score: number;
  xp: number;
  spawnAnim: number;
  hitFlash: number;
  speed?: number;
  damage?: number;
  explosionRadius?: number;
  projectile?: { speed: number; color: string; size: number };
  lootTable?: string;
}
export const EnemyDef: ComponentDefinition = { name: 'Enemy', clone };

// ===== Jugador (meta) =====
export interface Player {
  name: string;
  color: string;
  glow: string;
  shape: string;
  isDashing: boolean;
  dashTime: number;
  dashCooldown: number;
  dashCooldownMax: number;
  xp: number;
  level: number;
  xpToNext: number;
  critChance: number;
  speedMult?: number;
}
export const PlayerDef: ComponentDefinition = { name: 'Player', clone };

// ===== Mascota =====
export interface Pet {
  id: string;
  name: string;
  color: string;
  glow: string;
  attackCooldown: number;
  attackTimer: number;
  damage: number;
  range: number;
  orbitRadius: number;
  orbitSpeed: number;
  orbitAngle: number;
  vacuumRadius?: number;
}
export const PetDef: ComponentDefinition = { name: 'Pet', clone };

// ===== Pickup =====
export interface Pickup {
  kind: 'heal' | 'score' | 'weapon' | 'shield';
  color: string;
  glow: string;
  value: number;
  weaponId?: string;
  bobPhase: number;
  life: number;
}
export const PickupDef: ComponentDefinition = { name: 'Pickup', clone };

// ===== Puerta =====
export interface Door {
  x: number;
  y: number;
  w: number;
  h: number;
  locked: boolean;
  kind: 'entry' | 'exit';
  nodeIndex: number;
}
export const DoorDef: ComponentDefinition = { name: 'Door', clone };

// ===== Mapa Continuo (Nodos de Salas y Pasillos) =====
export type MapNodeType = 'room' | 'corridor' | 'treasure' | 'boss';

export interface MapNode {
  index: number;
  level: number;
  type: MapNodeType;
  bounds: { x: number; y: number; w: number; h: number };
  status: 'unvisited' | 'active' | 'cleared';
  waves: Array<{ enemies: Array<{ id: string; count: number }>; pacing: string }>;
  currentWave: number;
  biomeId: string;
  difficulty: number;
  pickupPool: string[];
  entryDoorEnt?: EntityId;
  exitDoorEnt?: EntityId;
  chestSpawns?: Array<{ x: number; y: number; chestId: string }>;
}
export const MapNodeDef: ComponentDefinition = { name: 'MapNode', clone };

// ===== Room meta =====
export interface Room { width: number; height: number }
export const RoomDef: ComponentDefinition = { name: 'Room', clone };

// ===== Render =====
export interface Sprite {
  shape: 'triangle' | 'square' | 'circle' | 'diamond' | 'hexagon' | 'circle_pulse';
  color: string;
  glow: string;
  size: number;
  rotation?: number;
}
export const SpriteDef: ComponentDefinition = { name: 'Sprite', clone };

/** Registra todos los componentes de gameplay en el registry del World. */
export function registerGameplayComponents(registry: { register(def: ComponentDefinition): void }): void {
  const defs = [
    PositionDef, VelocityDef, ColliderDef, FacingDef,
    HealthDef, CombatDef, InvulnerableDef, ShieldDef, StatusEffectDef,
    WeaponDef, ProjectileDef,
    AIStateDef, EnemyDef, PlayerDef, PetDef,
    PickupDef, DoorDef, RoomDef, SpriteDef, MapNodeDef,
  ];
  for (const d of defs) registry.register(d);
}
