/**
 * MutationSystem.ts — mutaciones de enemigos (TDD §7).
 *
 * Los enemigos pueden aparecer con hasta 4 mutaciones simultáneas.
 * Cada mutación aplica modificadores a los stats base del enemigo.
 * Todo es data-driven: las mutaciones se leen de content/mutations.json.
 */

import type { ContentRepository } from '@/engine/content/ContentRepository';
import { randInt, chance } from '@/engine/utils/math';

export interface MutationDef {
  id: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  description: string;
  mods: Array<{ stat: string; op: 'add' | 'mul' | 'set'; value: number | string }>;
  visual?: { colorTint?: string; sizeScale?: number; aura?: boolean };
}

export interface EnemyStats {
  hp: number;
  damage: number;
  speed: number;
  size: number;
  score: number;
  xp: number;
  color: string;
  onHitEffect?: string;
  lootTier?: string;
  [key: string]: unknown;
}

export interface MutatedEnemy {
  stats: EnemyStats;
  appliedMutations: string[];
  /** Para efectos visuales, aura del campeón, etc. */
  visuals: { colorTint?: string; aura?: boolean };
}

export class MutationSystem {
  constructor(private readonly content: ContentRepository) {}

  /**
   * Decide si un enemigo recibe mutaciones según la dificultad actual,
   * y devuelve los stats modificados.
   */
  mutate(stats: EnemyStats, difficulty: number): MutatedEnemy {
    const result: MutatedEnemy = {
      stats: { ...stats },
      appliedMutations: [],
      visuals: {},
    };

    // Probabilidad y número de mutaciones escalan con difficulty
    const mutationRoll = Math.random();
    let numMuts = 0;
    if (mutationRoll < 0.05 * difficulty) numMuts = 2;
    else if (mutationRoll < 0.2 * difficulty) numMuts = 1;

    // Enemigo campeón (muy raro, solo si difficulty alta)
    if (difficulty >= 1.2 && chance(0.03 * difficulty)) {
      const champ = this.content.get<MutationDef>('mutations', 'mut_champion');
      if (champ) {
        this.applyMutation(result, champ);
        numMuts = 0; // campeón reemplaza otras mutaciones
      }
    }

    const allMuts = this.content.all<MutationDef>('mutations').filter((m) => m.id !== 'mut_champion');
    const used = new Set<string>();
    for (let i = 0; i < numMuts; i++) {
      // Filtrar por rareza apropiada
      const maxRank = Math.min(4, Math.floor(difficulty * 2));
      const rarityOrder = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
      const candidates = allMuts.filter(
        (m) => !used.has(m.id) && rarityOrder.indexOf(m.rarity) <= maxRank
      );
      if (candidates.length === 0) break;
      const mut = candidates[randInt(0, candidates.length - 1)];
      used.add(mut.id);
      this.applyMutation(result, mut);
    }

    return result;
  }

  private applyMutation(result: MutatedEnemy, mut: MutationDef): void {
    result.appliedMutations.push(mut.id);
    for (const mod of mut.mods) {
      const current = result.stats[mod.stat];
      if (mod.op === 'add') {
        result.stats[mod.stat] = ((current as number) ?? 0) + (mod.value as number);
      } else if (mod.op === 'mul') {
        result.stats[mod.stat] = ((current as number) ?? 1) * (mod.value as number);
      } else if (mod.op === 'set') {
        result.stats[mod.stat] = mod.value;
      }
    }
    if (mut.visual) {
      if (mut.visual.colorTint) result.visuals.colorTint = mut.visual.colorTint;
      if (mut.visual.aura) result.visuals.aura = true;
    }
    // Aplicar tinte al color del enemigo si hay uno visual
    if (mut.visual?.colorTint) {
      result.stats.color = mut.visual.colorTint;
    }
  }
}
