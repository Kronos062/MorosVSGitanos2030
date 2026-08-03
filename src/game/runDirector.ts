/* ======================================================================
 * runDirector.ts — Global Run Director (Data-Driven Manager).
 * ----------------------------------------------------------------------
 * Keeps dynamic run telemetry (HP ratio, damage taken, kills, gold, pet,
 * build tags, boss resonance) and derives a subtle Run Mood (thriving,
 * stable, struggling).
 *
 * It provides weight multipliers to the Loot, Enemy, and Event directors.
 * It NEVER cheats, forces drops, or hardcodes specific weapons/items.
 * Everything is driven by tag/element matching and relative weight factors.
 * ==================================================================== */

import type { Rarity } from '../content/weapons';
import type { LootCategory } from './lootDirector';
import type { EventDef } from './eventDirector';
import type { CompositionTemplate } from './enemyDirector';
import type { BiomeDef } from '../content/biomes';


export type RunMood = 'thriving' | 'stable' | 'struggling';

export interface RunTelemetry {
  mapNumber: number;
  totalMaps: number;
  roomsCleared: number;
  totalKills: number;
  recentKills: number;
  damageTakenRecent: number;
  damageTakenTotal: number;
  healsUsed: number;
  goldEarned: number;
  bossesDefeated: number;
  playerHpRatio: number;
  playerShield: number;
  playerLevel: number;
  weaponTags: string[];
  weaponElement?: string;
  weaponAffixId?: string;
  equippedSets: string[];
  equippedPetId: string | null;
  petElement?: string;
  petTags?: string[];
}

const EVENT_MEMORY_MAX = 6;

export class RunDirector {
  private mood: RunMood = 'stable';
  private recentEventIds: string[] = [];
  private bossResonance: string | null = null;
  private recentDamageTimer = 0;
  private recentKillTimer = 0;

  resetRun(): void {
    this.mood = 'stable';
    this.recentEventIds = [];
    this.bossResonance = null;
    this.recentDamageTimer = 0;
    this.recentKillTimer = 0;
  }

  onNextMap(): void {
    // Boss resonance clears when descending to the next map
    this.bossResonance = null;
  }

  onEventCompleted(eventId: string): void {
    this.recentEventIds.push(eventId);
    if (this.recentEventIds.length > EVENT_MEMORY_MAX) {
      this.recentEventIds.shift();
    }
  }

  onBossDefeated(bossId: string): void {
    this.bossResonance = bossId;
  }

  getMood(): RunMood {
    return this.mood;
  }

  update(telemetry: RunTelemetry, dt: number): void {
    // Update internal timers and decay recent counters
    this.recentDamageTimer += dt;
    this.recentKillTimer += dt;

    // Calculate Mood Score from data-driven telemetry factors
    let score = 0;

    // HP factor
    if (telemetry.playerHpRatio > 0.8) score += 2;
    else if (telemetry.playerHpRatio < 0.35) score -= 3;
    else if (telemetry.playerHpRatio < 0.5) score -= 1;

    // Shield cushion
    if (telemetry.playerShield > 1) score += 1;

    // Damage stress
    if (telemetry.damageTakenRecent > 45) score -= 2;
    else if (telemetry.damageTakenRecent < 10) score += 1;

    // Kills & Level
    if (telemetry.recentKills > 6) score += 2;
    else if (telemetry.recentKills < 2) score -= 1;

    // Heals reliance
    if (telemetry.healsUsed > 4) score -= 1;

    // Determine mood
    if (score >= 3) this.mood = 'thriving';
    else if (score <= -2) this.mood = 'struggling';
    else this.mood = 'stable';
  }

  /* ------------------------------------------------------------------ */
  /*  LOOT DIRECTOR INFLUENCES                                          */
  /* ------------------------------------------------------------------ */

  getLootCategoryWeightMult(category: LootCategory, _sourceTableId: string): number {
    if (this.mood === 'struggling') {
      if (category === 'heal') return 1.4;
      if (category === 'shield') return 1.25;
      if (category === 'gold') return 1.2;
      if (category === 'weapon') return 0.95;
      if (category === 'equipment') return 0.95;
    }
    if (this.mood === 'thriving') {
      if (category === 'weapon') return 1.25;
      if (category === 'equipment') return 1.25;
      if (category === 'heal') return 0.75;
      if (category === 'shield') return 0.85;
    }
    return 1.0;
  }

  getLootQualityWeightMult(rarity: Rarity, _sourceTableId: string): number {
    if (this.mood === 'thriving') {
      if (rarity === 'rare') return 1.15;
      if (rarity === 'epic') return 1.2;
      if (rarity === 'legendary') return 1.25;
    }
    if (this.mood === 'struggling') {
      if (rarity === 'common') return 1.2;
      if (rarity === 'uncommon') return 1.1;
      if (rarity === 'epic') return 0.85;
      if (rarity === 'legendary') return 0.7;
    }
    return 1.0;
  }

  getWeaponWeightMult(weaponTags: string[], weaponElement?: string, buildTags?: string[], biome?: BiomeDef): number {
    let mult = 1.0;
    if (buildTags && buildTags.length > 0) {
      const tagMatches = weaponTags.filter((t) => buildTags.includes(t)).length;
      if (tagMatches > 0) mult += tagMatches * 0.15;
      if (weaponElement && buildTags.includes(weaponElement)) mult += 0.2;
    }

    // Biome influences (data-driven weights)
    if (biome) {
      if (biome.lootTagWeights) {
        for (const tag of weaponTags) {
          if (biome.lootTagWeights[tag]) mult *= biome.lootTagWeights[tag];
        }
      }
      if (weaponElement && biome.lootElementWeights?.[weaponElement]) {
        mult *= biome.lootElementWeights[weaponElement];
      }
    }

    return Math.min(2.5, mult);
  }

  getEquipmentWeightMult(setDef: { setId: string; synergy?: { weaponTags?: string[]; element?: string } }, buildTags?: string[], biome?: BiomeDef): number {
    let mult = 1.0;
    if (buildTags && buildTags.length > 0) {
      const syn = setDef.synergy;
      if (syn) {
        if (syn.weaponTags?.some((t) => buildTags.includes(t))) mult += 0.2;
        if (syn.element && buildTags.includes(syn.element)) mult += 0.2;
      }
    }

    // Biome influences
    if (biome?.lootTagWeights && setDef.synergy?.weaponTags) {
      for (const tag of setDef.synergy.weaponTags) {
        if (biome.lootTagWeights[tag]) mult *= biome.lootTagWeights[tag];
      }
    }

    return Math.min(2.5, mult);
  }

  /* ------------------------------------------------------------------ */
  /*  ENEMY DIRECTOR INFLUENCES                                         */
  /* ------------------------------------------------------------------ */

  getEnemyIntensityDelta(): number {
    if (this.mood === 'thriving') return 8; // subtle pressure boost
    if (this.mood === 'struggling') return -12; // subtle relief
    return 0;
  }

  getEnemyCompositionWeightMult(template: CompositionTemplate): number {
    let mult = 1.0;
    if (this.mood === 'thriving') {
      if (template.id === 'miniboss' || template.id === 'burst_party' || template.id === 'siege') mult *= 1.3;
    } else if (this.mood === 'struggling') {
      if (template.id === 'swarm' || template.id === 'balanced') mult *= 1.3;
      if (template.id === 'nightmare' || template.id === 'siege') mult *= 0.6;
    }
    return mult;
  }

  /* ------------------------------------------------------------------ */
  /*  EVENT DIRECTOR INFLUENCES                                        */
  /* ------------------------------------------------------------------ */

  getEventWeightMult(eventDef: EventDef, buildTags: string[], biome?: BiomeDef): number {
    let mult = 1.0;

    // Anti-repetition across run
    const recencyIndex = this.recentEventIds.lastIndexOf(eventDef.id);
    if (recencyIndex !== -1) {
      const recency = this.recentEventIds.length - 1 - recencyIndex;
      mult *= 0.3 + recency * 0.12; // 0.3..~0.9 penalty
    }

    // Mood adjustments
    if (this.mood === 'struggling') {
      if (eventDef.type === 'merchant') mult *= 1.4;
      if (eventDef.type === 'cursed') mult *= 0.5;
      if (eventDef.type === 'altar') mult *= 0.85;
    } else if (this.mood === 'thriving') {
      if (eventDef.type === 'cursed') mult *= 1.35;
      if (eventDef.type === 'challenge') mult *= 1.3;
      if (eventDef.type === 'altar') mult *= 1.2;
      if (eventDef.type === 'merchant') mult *= 0.85;
    }

    // Boss resonance from previous defeat
    if (this.bossResonance) {
      if (eventDef.type === 'shrine' || eventDef.type === 'challenge') mult *= 1.25;
    }

    // Elemental / Build thematic synergies with events
    if (buildTags.includes('fire') && eventDef.id.includes('sangre')) mult *= 1.25;
    if (buildTags.includes('electric') && eventDef.type === 'shrine') mult *= 1.25;
    if (buildTags.includes('melee') && eventDef.type === 'challenge') mult *= 1.2;

    // Biome event preferences
    if (biome?.eventDefWeights?.[eventDef.id]) {
      mult *= biome.eventDefWeights[eventDef.id];
    }

    return Math.max(0.1, mult);
  }
}
