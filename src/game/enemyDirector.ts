/* ======================================================================
 * enemyDirector.ts — Data-driven Enemy Director.
 * ----------------------------------------------------------------------
 * A context-aware decision layer that controls WHICH enemies appear,
 * in WHAT composition, and at WHAT pacing — without ever modifying
 * enemy stats. The engine still calls spawnEnemyInRoom with the chosen
 * EnemyDef; the Director only decides the list and timing.
 *
 * Everything is driven by data: composition templates, enemy metadata
 * (threat/cost/role), and a live intensity tracker. Adding new enemies
 * requires ZERO changes here.
 * ==================================================================== */

import {
  ENEMIES,
  type EnemyDef,
} from '../content/enemies';
import type { RunDirector } from './runDirector';
import type { BiomeDef } from '../content/biomes';
import type { PlayerState } from './types';

/* ------------------------------------------------------------------ */
/*  COMPOSITION TEMPLATES (data-driven encounter archetypes)          */
/* ------------------------------------------------------------------ */

export interface CompositionTemplate {
  id: string;
  name: string;
  description: string;
  /** How early this composition can appear (1=map1, 10=map10). */
  minMap: number;
  /** How many role slots this composition fills. */
  slots: Array<{
    role: EnemyDef['role'];
    count: number;
  }>;
  /** Weight multiplier at different intensity bands. */
  intensityWeights: { low: number; mid: number; high: number };
}

export const COMPOSITIONS: CompositionTemplate[] = [
  {
    id: 'swarm', name: 'Enjambre', description: 'Muchos enemigos débiles.',
    minMap: 1, slots: [{ role: 'fodder', count: 8 }],
    intensityWeights: { low: 1.2, mid: 1, high: 0.6 },
  },
  {
    id: 'balanced', name: 'Equilibrado', description: 'Mezcla estándar.',
    minMap: 1, slots: [
      { role: 'fodder', count: 4 },
      { role: 'ranged', count: 2 },
    ],
    intensityWeights: { low: 1, mid: 1, high: 1 },
  },
  {
    id: 'tank_push', name: 'Empujón blindado', description: 'Tanques con apoyo.',
    minMap: 2, slots: [
      { role: 'tank', count: 2 },
      { role: 'fodder', count: 3 },
      { role: 'ranged', count: 1 },
    ],
    intensityWeights: { low: 0.8, mid: 1.2, high: 1.4 },
  },
  {
    id: 'assassin_pack', description: 'Emboscada rápida.',
    name: 'Emboscada', minMap: 2, slots: [
      { role: 'assassin', count: 4 },
      { role: 'fodder', count: 2 },
    ],
    intensityWeights: { low: 0.9, mid: 1.1, high: 1.3 },
  },
  {
    id: 'ranged_fort', name: 'Fortaleza', description: 'Muchos tiradores protegidos.',
    minMap: 3, slots: [
      { role: 'ranged', count: 4 },
      { role: 'tank', count: 1 },
    ],
    intensityWeights: { low: 1, mid: 1.2, high: 0.9 },
  },
  {
    id: 'burst_party', name: 'Fiesta explosiva', description: 'Explosivos y drones.',
    minMap: 3, slots: [
      { role: 'burst', count: 3 },
      { role: 'fodder', count: 3 },
      { role: 'support', count: 1 },
    ],
    intensityWeights: { low: 0.9, mid: 1, high: 1.5 },
  },
  {
    id: 'elite_hunt', name: 'Cacería elite', description: 'Enemigos amenazadores.',
    minMap: 4, slots: [
      { role: 'assassin', count: 2 },
      { role: 'ranged', count: 2 },
      { role: 'tank', count: 1 },
    ],
    intensityWeights: { low: 0.8, mid: 1.1, high: 1.5 },
  },
  {
    id: 'miniboss', name: 'Patrulla pesada', description: 'Minibosses con guardia.',
    minMap: 5, slots: [
      { role: 'miniboss', count: 1 },
      { role: 'tank', count: 2 },
      { role: 'ranged', count: 1 },
    ],
    intensityWeights: { low: 0.7, mid: 1, high: 1.4 },
  },
  {
    id: 'meat_grinder', name: 'Picadora', description: 'Presión constante.',
    minMap: 6, slots: [
      { role: 'fodder', count: 6 },
      { role: 'assassin', count: 2 },
      { role: 'burst', count: 1 },
    ],
    intensityWeights: { low: 0.9, mid: 1.3, high: 1 },
  },
  {
    id: 'siege', name: 'Asedio', description: 'Artillería de largo alcance.',
    minMap: 7, slots: [
      { role: 'ranged', count: 3 },
      { role: 'burst', count: 2 },
      { role: 'tank', count: 2 },
    ],
    intensityWeights: { low: 0.8, mid: 1.1, high: 1.6 },
  },
  {
    id: 'nightmare', name: 'Pesadilla', description: 'Todo al máximo.',
    minMap: 9, slots: [
      { role: 'miniboss', count: 1 },
      { role: 'assassin', count: 3 },
      { role: 'ranged', count: 2 },
      { role: 'burst', count: 1 },
    ],
    intensityWeights: { low: 1, mid: 1.3, high: 1.8 },
  },
];

/* ------------------------------------------------------------------ */
/*  DIRECTOR CONTEXT (observed state, data-driven)                   */
/* ------------------------------------------------------------------ */

export interface DirectorContext {
  mapNumber: number;
  roomId: number;
  totalRunTime: number;
  roomTime: number;
  playerHpRatio: number;
  playerShield: number;
  playerLevel: number;
  playerWeaponId: string;
  weaponRarity: string;
  equippedSets: string[];
  equippedPetId: string | null;
  totalKills: number;
  recentKills: number;
  killRate: number;
  recentDamageTaken: number;
  nearDeathCount: number;
  gold: number;
  chestsOpened: number;
  bossesDefeated: number;
  roomCleared: boolean;
}

/* ------------------------------------------------------------------ */
/*  INTENSITY TRACKER                                                 */
/* ------------------------------------------------------------------ */

export class IntensityTracker {
  private intensity = 30;
  private readonly decayRate = 2;
  private readonly maxIntensity = 100;
  private readonly minIntensity = 0;

  update(ctx: DirectorContext, dt: number): void {
    let delta = 0;

    // Player stress
    if (ctx.playerHpRatio < 0.3) delta += 8;
    else if (ctx.playerHpRatio < 0.6) delta += 3;

    // Recent damage
    if (ctx.recentDamageTaken > 0) delta += Math.min(5, ctx.recentDamageTaken * 0.3);

    // Near-death experience
    delta += ctx.nearDeathCount * 4;

    // High kill rate → dominant player, lower intensity
    if (ctx.killRate > 8) delta -= 6;
    else if (ctx.killRate > 5) delta -= 3;

    // Long room time
    if (ctx.roomTime > 30) delta += 2;
    if (ctx.roomTime > 60) delta += 3;

    // Safe zones reduce intensity
    if (ctx.playerShield > 0) delta -= 1;

    // Natural decay
    delta -= this.decayRate * dt;

    this.intensity = Math.max(this.minIntensity, Math.min(this.maxIntensity, this.intensity + delta));
  }

  getIntensity(): number {
    return this.intensity;
  }

  getBand(): 'low' | 'mid' | 'high' {
    if (this.intensity < 30) return 'low';
    if (this.intensity < 70) return 'mid';
    return 'high';
  }

  onRoomCleared(): void {
    this.intensity = Math.max(0, this.intensity - 15);
  }

  onSafeZone(): void {
    this.intensity = Math.max(0, this.intensity - 20);
  }

  reset(): void {
    this.intensity = 30;
  }
}

/* ------------------------------------------------------------------ */
/*  ANTI-REPETITION MEMORY                                            */
/* ------------------------------------------------------------------ */

export class EncounterMemory {
  private recentCompositions: string[] = [];
  private recentEnemies: string[] = [];
  private readonly maxMemory = 8;

  rememberComposition(compId: string): void {
    this.recentCompositions.push(compId);
    if (this.recentCompositions.length > this.maxMemory) {
      this.recentCompositions.shift();
    }
  }

  rememberEnemy(enemyId: string): void {
    this.recentEnemies.push(enemyId);
    if (this.recentEnemies.length > this.maxMemory * 3) {
      this.recentEnemies = this.recentEnemies.slice(-this.maxMemory * 2);
    }
  }

  compositionWeight(compId: string): number {
    const idx = this.recentCompositions.indexOf(compId);
    if (idx === -1) return 1;
    // Most recent = strongest penalty, fading over time
    const recency = this.recentCompositions.length - 1 - idx;
    return 0.3 + recency * 0.08;
  }

  enemyWeight(enemyId: string): number {
    const idx = this.recentEnemies.indexOf(enemyId);
    if (idx === -1) return 1;
    const recency = this.recentEnemies.length - 1 - idx;
    return 0.5 + recency * 0.05;
  }

  reset(): void {
    this.recentCompositions = [];
    this.recentEnemies = [];
  }
}

/* ------------------------------------------------------------------ */
/*  ENEMY DIRECTOR — the orchestrator                                 */
/* ------------------------------------------------------------------ */

export class EnemyDirector {
  private intensityTracker = new IntensityTracker();
  private memory = new EncounterMemory();
  private totalKills = 0;
  private recentKills = 0;
  private recentDamageTaken = 0;
  private nearDeathCount = 0;
  private killTimer = 0;
  private damageTimer = 0;
  private bossesDefeated = 0;
  private roomsCleared = 0;

  /* ---- event hooks (called by the engine, no coupling) ---- */

  onKill(): void {
    this.totalKills++;
    this.recentKills++;
  }

  onDamageTaken(amount: number): void {
    this.recentDamageTaken += amount;
  }

  onNearDeath(): void {
    this.nearDeathCount++;
  }

  onBossDefeated(): void {
    this.bossesDefeated++;
  }

  onRoomCleared(): void {
    this.roomsCleared++;
    this.intensityTracker.onRoomCleared();
  }

  onSafeZone(): void {
    this.intensityTracker.onSafeZone();
  }

  reset(): void {
    this.intensityTracker.reset();
    this.memory.reset();
    this.totalKills = 0;
    this.recentKills = 0;
    this.recentDamageTaken = 0;
    this.nearDeathCount = 0;
    this.killTimer = 0;
    this.damageTimer = 0;
    this.bossesDefeated = 0;
    this.roomsCleared = 0;
  }

  /* ---- main decision: generate a wave's enemy list ---- */

  generateWave(
    ctx: DirectorContext,
    _player: PlayerState,
    dt: number,
    runDirector?: RunDirector,
    biome?: BiomeDef,
  ): EnemyDef[] {
    // Update trackers
    this.intensityTracker.update(ctx, dt);
    this.killTimer += dt;
    this.damageTimer += dt;

    // Decay recent counters
    if (this.killTimer > 3) {
      this.recentKills = Math.max(0, this.recentKills - 1);
      this.killTimer = 0;
    }
    if (this.damageTimer > 4) {
      this.recentDamageTaken = Math.max(0, this.recentDamageTaken - 2);
      this.damageTimer = 0;
      this.nearDeathCount = Math.max(0, this.nearDeathCount - 1);
    }

    const intensity = this.intensityTracker.getBand();
    const map = ctx.mapNumber;

    // Pick composition template
    const template = this.pickComposition(map, intensity, runDirector);
    this.memory.rememberComposition(template.id);

    // Build enemy list from template slots
    const enemies: EnemyDef[] = [];
    for (const slot of template.slots) {
      const picked = this.pickEnemiesForRole(slot.role, slot.count, map, biome);
      enemies.push(...picked);
    }

    // Remember spawned enemies for anti-repetition
    for (const e of enemies) {
      this.memory.rememberEnemy(e.id);
    }

    return enemies;
  }

  generateBossAdds(_bossId: string, mapNumber: number, biome?: BiomeDef): EnemyDef[] {
    // Data-driven adds for boss encounters
    const adds: EnemyDef[] = [];
    const addBudget = Math.min(6, 2 + Math.floor(mapNumber / 2));
    const pool = ENEMIES.filter((e) => !e.tags.includes('boss') && !e.tags.includes('miniboss'));

    for (let i = 0; i < addBudget; i++) {
      const def = this.pickEnemyByWeight(pool, mapNumber, biome);
      if (def) adds.push(this.scaleEnemy(def, mapNumber));
    }

    return adds;
  }

  getIntensity(): number {
    return this.intensityTracker.getIntensity();
  }

  getIntensityBand(): string {
    return this.intensityTracker.getBand();
  }

  /* ---- internal helpers ---- */

  private pickComposition(map: number, intensity: 'low' | 'mid' | 'high', runDirector?: RunDirector): CompositionTemplate {
    const available = COMPOSITIONS.filter((c) => map >= c.minMap);
    if (available.length === 0) return COMPOSITIONS[0];

    const weighted = available.map((c) => {
      let w = c.intensityWeights[intensity];
      w *= this.memory.compositionWeight(c.id);
      if (runDirector) {
        w *= runDirector.getEnemyCompositionWeightMult(c);
      }
      return { template: c, weight: w };
    });

    return this.weightedPick(weighted);
  }

  private pickEnemiesForRole(role: EnemyDef['role'], count: number, map: number, biome?: BiomeDef): EnemyDef[] {
    const pool = ENEMIES.filter((e) => e.role === role);
    if (pool.length === 0) return [];

    const result: EnemyDef[] = [];
    for (let i = 0; i < count; i++) {
      const def = this.pickEnemyByWeight(pool, map, biome);
      if (def) result.push(this.scaleEnemy(def, map));
    }
    return result;
  }

  private pickEnemyByWeight(pool: EnemyDef[], map: number, biome?: BiomeDef): EnemyDef | null {
    if (pool.length === 0) return null;

    const weighted = pool.map((e) => {
      let w = 1;
      w *= this.memory.enemyWeight(e.id);
      // Prefer higher-threat enemies later in the run
      if (map >= 5 && e.threat >= 3) w *= 1.3;
      if (map >= 8 && e.threat >= 4) w *= 1.5;
      if (map < 3 && e.threat > 2) w *= 0.6;

      // Biome enemy weights
      if (biome) {
        if (biome.enemyRoleWeights?.[e.role]) {
          w *= biome.enemyRoleWeights[e.role];
        }
        if (biome.enemyTagWeights) {
          for (const t of e.tags) {
            if (biome.enemyTagWeights[t]) w *= biome.enemyTagWeights[t];
          }
        }
      }

      return { enemy: e, weight: Math.max(0.05, w) };
    });

    return this.weightedPick(weighted);
  }

  private scaleEnemy(def: EnemyDef, map: number): EnemyDef {
    // Scale stats based on map progression (data-driven, no hardcoding)
    const mapScale = 1 + (map - 1) * 0.12;
    return {
      ...def,
      hp: Math.floor(def.hp * mapScale),
      damage: Math.floor(def.damage * (1 + (map - 1) * 0.08)),
      speed: def.speed * (1 + (map - 1) * 0.02),
      score: Math.floor(def.score * (1 + (map - 1) * 0.08)),
    };
  }

  private weightedPick<T>(items: Array<{ weight: number; [key: string]: T | number }>): T {
    const total = items.reduce((s, i) => s + i.weight, 0);
    let r = Math.random() * total;
    for (const item of items) {
      r -= item.weight;
      if (r <= 0) return Object.values(item)[0] as T;
    }
    return Object.values(items[0])[0] as T;
  }
}
