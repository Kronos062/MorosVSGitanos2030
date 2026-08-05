/* ======================================================================
 * lootDirector.ts — Data-driven Loot Director.
 * ----------------------------------------------------------------------
 * A thin decision layer ON TOP of the existing loot generators. It never
 * guarantees drops: it only re-weights the existing pools using:
 *
 *   finalWeight = base × map × build × source × repetition × rarity
 *
 * The engine keeps calling generateWeapon / generateEquipment exactly as
 * before; the Director only decides WHICH baseId / setId / quality / affix
 * to feed them. Adding content (weapons, armour, affixes, sets) requires
 * ZERO changes here — everything reads from the existing content arrays.
 * ==================================================================== */

import {
  WEAPON_BASES,
  AFFIXES,
  AFFIX_CHANCE,
  getAffix,
  type Rarity,
  type WeaponBase,
  type AffixDef,
} from '../content/weapons';
import { SET_DEFS, type EquipSlot } from '../content/equipment';
import type { RunDirector } from './runDirector';
import type { BiomeDef } from '../content/biomes';
import { runRandom } from './random';

/* ------------------------------------------------------------------ */
/*  LOOT TABLES — pure data. One table per loot source.               */
/*  weights are relative; add new sources by adding new entries.      */
/* ------------------------------------------------------------------ */

export type LootCategory = 'gold' | 'heal' | 'shield' | 'weapon' | 'equipment' | 'nothing';

export interface LootTableDef {
  id: string;
  /** Relative category weights for this source. */
  categories: Partial<Record<LootCategory, number>>;
  /** Multiplier applied on top of quality weights (rarer skew when >1 for high tiers). */
  qualityBias: Partial<Record<Rarity, number>>;
  /** If true, this source may roll legendary quality at all. */
  allowLegendary: boolean;
}

export const LOOT_TABLES: LootTableDef[] = [
  {
    id: 'enemy_normal',
    categories: { gold: 70, heal: 14, shield: 6, weapon: 2, equipment: 2, nothing: 6 },
    qualityBias: { common: 1.3, uncommon: 1, rare: 0.7, epic: 0.3, legendary: 0 },
    allowLegendary: false,
  },
  {
    id: 'enemy_miniboss',
    categories: { gold: 40, heal: 15, shield: 10, weapon: 18, equipment: 15, nothing: 2 },
    qualityBias: { common: 0.6, uncommon: 1, rare: 1.2, epic: 0.8, legendary: 0.15 },
    allowLegendary: true,
  },
  {
    id: 'enemy_boss',
    categories: { gold: 20, heal: 15, shield: 12, weapon: 26, equipment: 24, nothing: 3 },
    qualityBias: { common: 0.2, uncommon: 0.8, rare: 1.3, epic: 1.4, legendary: 1.0 },
    allowLegendary: true,
  },
  {
    id: 'chest_common',
    categories: { gold: 20, heal: 20, shield: 10, weapon: 25, equipment: 25 },
    qualityBias: { common: 1, uncommon: 1.1, rare: 0.9, epic: 0.4, legendary: 0.1 },
    allowLegendary: false,
  },
  {
    id: 'chest_rare',
    categories: { heal: 10, shield: 10, weapon: 35, equipment: 45 },
    qualityBias: { common: 0.4, uncommon: 1, rare: 1.3, epic: 0.9, legendary: 0.3 },
    allowLegendary: true,
  },
  {
    id: 'chest_legendary',
    categories: { weapon: 45, equipment: 55 },
    qualityBias: { common: 0, uncommon: 0.4, rare: 1, epic: 1.5, legendary: 1.2 },
    allowLegendary: true,
  },
  {
    id: 'reward',
    categories: { weapon: 50, equipment: 50 },
    qualityBias: { common: 0.3, uncommon: 1, rare: 1.2, epic: 1, legendary: 0.5 },
    allowLegendary: true,
  },
];

export function getLootTable(id: string): LootTableDef {
  return LOOT_TABLES.find((t) => t.id === id) ?? LOOT_TABLES[0];
}

/* ------------------------------------------------------------------ */
/*  BUILD CONTEXT — snapshot the engine passes in each roll.          */
/* ------------------------------------------------------------------ */

export interface BuildContext {
  mapNumber: number;
  totalMaps: number;
  /** Tags of the currently held weapon (e.g. 'sniper', 'energy'). */
  weaponTags: string[];
  /** Current weapon element (from affix), if any. */
  weaponElement?: string;
  /** Current weapon affix id, if any. */
  weaponAffixId?: string;
  /** Set ids currently equipped and how many pieces each. */
  setCounts: Record<string, number>;
  /** Equipped pet id, if any. */
  petId?: string | null;
}

/* ------------------------------------------------------------------ */
/*  DERIVED BUILD PREFERENCES (data-driven, computed from content).    */
/*  We read each set's declared `synergy` to know which weapon tags /  */
/*  affixes / elements the player's build "likes". No hardcoding.      */
/* ------------------------------------------------------------------ */

interface BuildPreference {
  tags: Set<string>;
  affixIds: Set<string>;
  elements: Set<string>;
}

function computePreference(ctx: BuildContext): BuildPreference {
  const tags = new Set<string>();
  const affixIds = new Set<string>();
  const elements = new Set<string>();

  // Preferences inferred from equipped sets' synergy definitions.
  for (const [setId, count] of Object.entries(ctx.setCounts)) {
    if (count < 2) continue; // only committed sets bias the loot
    const def = SET_DEFS.find((s) => s.setId === setId);
    if (!def?.synergy) continue;
    def.synergy.weaponTags?.forEach((t) => tags.add(t));
    def.synergy.affixIds?.forEach((a) => affixIds.add(a));
    if (def.synergy.element) elements.add(def.synergy.element);
  }

  // The currently held weapon's own tags/element/affix also nudge future loot
  // toward that same playstyle (so drops "match" what you're using).
  ctx.weaponTags.forEach((t) => tags.add(t));
  if (ctx.weaponElement) elements.add(ctx.weaponElement);
  if (ctx.weaponAffixId) affixIds.add(ctx.weaponAffixId);

  return { tags, affixIds, elements };
}

/* ------------------------------------------------------------------ */
/*  MAP PROGRESSION CURVE (Rule 1) — non-linear.                      */
/*  Returns a per-rarity multiplier that rises with map progress.     */
/* ------------------------------------------------------------------ */

function mapCurve(mapNumber: number, totalMaps: number): Record<Rarity, number> {
  const t = Math.max(0, Math.min(1, (mapNumber - 1) / Math.max(1, totalMaps - 1)));
  // eased progress — slow start, faster mid/late (feels like a curve)
  const eased = t * t * (3 - 2 * t); // smoothstep
  return {
    common: 1 - eased * 0.7,
    uncommon: 0.6 + eased * 0.8,
    rare: 0.25 + eased * 1.9,
    epic: 0.06 + eased * 2.6,
    legendary: 0.01 + eased * eased * 2.2, // extra-steep so early maps ≈ 0
  };
}

/* ------------------------------------------------------------------ */
/*  ANTI-DUPLICATION MEMORY (Rule 4) — recent loot fades weights.     */
/* ------------------------------------------------------------------ */

const RECENT_MAX = 6;

export class LootMemory {
  private recentBases: string[] = [];
  private recentSets: string[] = [];
  private recentAffixes: string[] = [];

  reset() {
    this.recentBases = [];
    this.recentSets = [];
    this.recentAffixes = [];
  }

  private penalty(list: string[], id: string): number {
    // Most recent → strongest reduction, fading over time. Never zero.
    const idx = list.indexOf(id);
    if (idx === -1) return 1;
    const recencyFromNewest = list.length - 1 - idx; // 0 = newest
    return 0.35 + 0.1 * recencyFromNewest; // 0.35..~0.85, always > 0
  }

  baseWeight(id: string) { return this.penalty(this.recentBases, id); }
  setWeight(id: string) { return this.penalty(this.recentSets, id); }
  affixWeight(id: string) { return this.penalty(this.recentAffixes, id); }

  rememberBase(id: string) { this.push(this.recentBases, id); }
  rememberSet(id: string) { this.push(this.recentSets, id); }
  rememberAffix(id: string) { this.push(this.recentAffixes, id); }

  private push(list: string[], id: string) {
    list.push(id);
    while (list.length > RECENT_MAX) list.shift();
  }
}

/* ------------------------------------------------------------------ */
/*  QUALITY ROLL (directed) — Rules 1, 5, 7.                          */
/* ------------------------------------------------------------------ */

const BASE_QUALITY_WEIGHT: Record<Rarity, number> = {
  common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1,
};

const RARITIES: Rarity[] = ['common', 'uncommon', 'rare', 'epic', 'legendary'];

export function rollDirectedQuality(
  table: LootTableDef,
  ctx: BuildContext,
  runDirector?: RunDirector,
): Rarity {
  const curve = mapCurve(ctx.mapNumber, ctx.totalMaps);
  const pool = RARITIES.map((rarity) => {
    if (rarity === 'legendary' && !table.allowLegendary) return { rarity, weight: 0 };
    const runMult = runDirector ? runDirector.getLootQualityWeightMult(rarity, table.id) : 1;
    const w =
      BASE_QUALITY_WEIGHT[rarity] *
      curve[rarity] *
      (table.qualityBias[rarity] ?? 1) *
      runMult;
    return { rarity, weight: Math.max(0, w) };
  });
  const total = pool.reduce((s, q) => s + q.weight, 0);
  if (total <= 0) return 'common';
  let r = runRandom.next('loot') * total;
  for (const q of pool) {
    r -= q.weight;
    if (r <= 0) return q.rarity;
  }
  return 'common';
}

/* ------------------------------------------------------------------ */
/*  WEAPON SELECTION (directed) — Rules 2, 6, 7, plus anti-dup.       */
/* ------------------------------------------------------------------ */

const BUILD_MATCH_BONUS = 1.6;   // slight boost when weapon matches build
const USELESS_PENALTY = 0.6;     // slight reduction for off-build items

/** Does the weapon base overlap the build preference in any way? */
function weaponMatchesBuild(base: WeaponBase, pref: BuildPreference): boolean {
  if (base.tags.some((t) => pref.tags.has(t))) return true;
  return false;
}

export function pickDirectedWeapon(
  table: LootTableDef,
  ctx: BuildContext,
  mem: LootMemory,
  runDirector?: RunDirector,
  biome?: BiomeDef,
): { baseId: string; quality: Rarity; affixId: string | null } {
  const pref = computePreference(ctx);
  const buildTags = Array.from(pref.tags);

  const pool = WEAPON_BASES.map((b) => {
    let w = 1;
    if (weaponMatchesBuild(b, pref)) w *= BUILD_MATCH_BONUS;
    else w *= USELESS_PENALTY;
    w *= mem.baseWeight(b.id);
    if (runDirector) {
      w *= runDirector.getWeaponWeightMult(b.tags, undefined, buildTags, biome);
    }
    return { base: b, weight: Math.max(0.05, w) };
  });

  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = runRandom.next('loot') * total;
  let chosen = pool[0].base;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) { chosen = p.base; break; }
  }

  const quality = rollDirectedQuality(table, ctx);

  // Affix roll — reuse existing chance table, then anti-dup weighted pick.
  let affixId: string | null = null;
  if (runRandom.next('loot') < (AFFIX_CHANCE[quality] ?? 0)) {
    affixId = pickDirectedAffix(chosen, ctx, mem, pref);
  }

  mem.rememberBase(chosen.id);
  if (affixId) mem.rememberAffix(affixId);
  return { baseId: chosen.id, quality, affixId };
}

function affixCompatible(a: AffixDef, base: WeaponBase): boolean {
  if (a.forbids && a.forbids.some((t) => base.tags.includes(t))) return false;
  if (a.requires && a.requires.length > 0 && !a.requires.some((t) => base.tags.includes(t))) return false;
  return true;
}

function pickDirectedAffix(
  base: WeaponBase,
  _ctx: BuildContext,
  mem: LootMemory,
  pref: BuildPreference,
): string | null {
  const pool = AFFIXES.filter((a) => affixCompatible(a, base)).map((a) => {
    let w = 1;
    // Build preference: affix matches a preferred affix or its element.
    if (pref.affixIds.has(a.id)) w *= BUILD_MATCH_BONUS;
    if (a.element && pref.elements.has(a.element)) w *= BUILD_MATCH_BONUS;
    w *= mem.affixWeight(a.id);
    return { id: a.id, weight: Math.max(0.05, w) };
  });
  if (pool.length === 0) return null;
  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = runRandom.next('loot') * total;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) return p.id;
  }
  return pool[0].id;
}

/* ------------------------------------------------------------------ */
/*  EQUIPMENT SELECTION (directed) — Rules 2, 4, 6.                   */
/* ------------------------------------------------------------------ */

export function pickDirectedEquipment(
  table: LootTableDef,
  ctx: BuildContext,
  mem: LootMemory,
  runDirector?: RunDirector,
  biome?: BiomeDef,
): { baseId: string; quality: Rarity } {
  const pref = computePreference(ctx);
  const buildTags = Array.from(pref.tags);
  const slots: EquipSlot[] = ['helm', 'chest', 'pants', 'boots'];

  const pool = SET_DEFS.map((s) => {
    let w = 1;
    const syn = s.synergy;
    if (syn) {
      const tagMatch = syn.weaponTags?.some((t) => pref.tags.has(t)) ?? false;
      const affixMatch = syn.affixIds?.some((a) => pref.affixIds.has(a)) ?? false;
      const elemMatch = syn.element ? pref.elements.has(syn.element) : false;
      if (tagMatch || affixMatch || elemMatch) w *= BUILD_MATCH_BONUS;
      else w *= USELESS_PENALTY;
    }
    const owned = ctx.setCounts[s.setId] ?? 0;
    if (owned >= 1 && owned < 4) w *= 1.25;
    w *= mem.setWeight(s.setId);
    if (runDirector) {
      w *= runDirector.getEquipmentWeightMult(s, buildTags, biome);
    }
    return { set: s, weight: Math.max(0.05, w) };
  });

  const total = pool.reduce((s, p) => s + p.weight, 0);
  let r = runRandom.next('loot') * total;
  let chosen = pool[0].set;
  for (const p of pool) {
    r -= p.weight;
    if (r <= 0) { chosen = p.set; break; }
  }

  const slot = slots[runRandom.int('loot', slots.length)];
  const quality = rollDirectedQuality(table, ctx, runDirector);

  mem.rememberSet(chosen.setId);
  return { baseId: `${chosen.setId}_${slot}`, quality };
}

/* ------------------------------------------------------------------ */
/*  CATEGORY ROLL — which kind of drop from a source (Rule 3).       */
/* ------------------------------------------------------------------ */

export function rollLootCategory(table: LootTableDef, runDirector?: RunDirector): LootCategory {
  const entries = (Object.entries(table.categories) as Array<[LootCategory, number]>).map(
    ([cat, w]) => {
      const mult = runDirector ? runDirector.getLootCategoryWeightMult(cat, table.id) : 1;
      return [cat, w * mult] as [LootCategory, number];
    },
  );
  const total = entries.reduce((s, [, w]) => s + w, 0);
  if (total <= 0) return 'nothing';
  let r = runRandom.next('loot') * total;
  for (const [cat, w] of entries) {
    r -= w;
    if (r <= 0) return cat;
  }
  return 'nothing';
}

// Re-export helper so callers can resolve affix metadata if needed.
export { getAffix };
