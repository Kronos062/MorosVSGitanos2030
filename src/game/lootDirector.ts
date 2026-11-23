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
import { ITEMS } from '../content/items';
import type { RunDirector } from './runDirector';
import type { BiomeDef } from '../content/biomes';
import { runRandom } from './random';

export type LootCategory = 'gold' | 'heal' | 'shield' | 'weapon' | 'equipment' | 'relic' | 'nothing';

export interface LootTableDef {
  id: string;
  categories: Partial<Record<LootCategory, number>>;
  qualityBias: Partial<Record<Rarity, number>>;
  allowLegendary: boolean;
}

export const LOOT_TABLES: LootTableDef[] = [
  {
    id: 'enemy_normal',
    categories: { gold: 70, heal: 14, shield: 6, weapon: 2, equipment: 2, relic: 3, nothing: 6 },
    qualityBias: { common: 1.3, uncommon: 1, rare: 0.7, epic: 0.3, legendary: 0 },
    allowLegendary: false,
  },
  {
    id: 'enemy_miniboss',
    categories: { gold: 40, heal: 15, shield: 10, weapon: 18, equipment: 15, relic: 8, nothing: 2 },
    qualityBias: { common: 0.6, uncommon: 1, rare: 1.2, epic: 0.8, legendary: 0.15 },
    allowLegendary: true,
  },
  {
    id: 'enemy_boss',
    categories: { gold: 20, heal: 15, shield: 12, weapon: 26, equipment: 24, relic: 10, nothing: 3 },
    qualityBias: { common: 0.2, uncommon: 0.8, rare: 1.3, epic: 1.4, legendary: 1.0 },
    allowLegendary: true,
  },
  {
    id: 'chest_common',
    categories: { gold: 20, heal: 20, shield: 10, weapon: 25, equipment: 25, relic: 10 },
    qualityBias: { common: 1, uncommon: 1.1, rare: 0.9, epic: 0.4, legendary: 0.1 },
    allowLegendary: false,
  },
  {
    id: 'chest_rare',
    categories: { heal: 10, shield: 10, weapon: 35, equipment: 45, relic: 15 },
    qualityBias: { common: 0.4, uncommon: 1, rare: 1.3, epic: 0.9, legendary: 0.3 },
    allowLegendary: true,
  },
  {
    id: 'chest_legendary',
    categories: { weapon: 45, equipment: 55, relic: 20 },
    qualityBias: { common: 0, uncommon: 0.4, rare: 1, epic: 1.5, legendary: 1.2 },
    allowLegendary: true,
  },
  {
    id: 'reward',
    categories: { weapon: 50, equipment: 50, relic: 15 },
    qualityBias: { common: 0.3, uncommon: 1, rare: 1.2, epic: 1, legendary: 0.5 },
    allowLegendary: true,
  },
];

export function getLootTable(id: string): LootTableDef {
  return LOOT_TABLES.find((t) => t.id === id) ?? LOOT_TABLES[0];
}

export interface BuildContext {
  mapNumber: number;
  totalMaps: number;
  weaponTags: string[];
  weaponElement?: string;
  weaponAffixId?: string;
  setCounts: Record<string, number>;
  petId?: string | null;
}

interface BuildPreference {
  tags: Set<string>;
  affixIds: Set<string>;
  elements: Set<string>;
}

function computePreference(ctx: BuildContext): BuildPreference {
  const tags = new Set<string>();
  const affixIds = new Set<string>();
  const elements = new Set<string>();

  for (const [setId, count] of Object.entries(ctx.setCounts)) {
    if (count < 2) continue;
    const def = SET_DEFS.find((s) => s.setId === setId);
    if (!def?.synergy) continue;
    def.synergy.weaponTags?.forEach((t) => tags.add(t));
    def.synergy.affixIds?.forEach((a) => affixIds.add(a));
    if (def.synergy.element) elements.add(def.synergy.element);
  }

  ctx.weaponTags.forEach((t) => tags.add(t));
  if (ctx.weaponElement) elements.add(ctx.weaponElement);
  if (ctx.weaponAffixId) affixIds.add(ctx.weaponAffixId);

  return { tags, affixIds, elements };
}

function mapCurve(mapNumber: number, totalMaps: number): Record<Rarity, number> {
  const t = Math.max(0, Math.min(1, (mapNumber - 1) / Math.max(1, totalMaps - 1)));
  const eased = t * t * (3 - 2 * t);
  return {
    common: 1 - eased * 0.7,
    uncommon: 0.6 + eased * 0.8,
    rare: 0.25 + eased * 1.9,
    epic: 0.06 + eased * 2.6,
    legendary: 0.01 + eased * eased * 2.2,
  };
}

const RECENT_MAX = 6;

export class LootMemory {
  private recentBases: string[] = [];
  private recentSets: string[] = [];
  private recentAffixes: string[] = [];
  private recentItems: string[] = [];

  reset() {
    this.recentBases = [];
    this.recentSets = [];
    this.recentAffixes = [];
    this.recentItems = [];
  }

  private penalty(list: string[], id: string): number {
    const idx = list.indexOf(id);
    if (idx === -1) return 1;
    const recencyFromNewest = list.length - 1 - idx;
    return 0.35 + 0.1 * recencyFromNewest;
  }

  baseWeight(id: string) { return this.penalty(this.recentBases, id); }
  setWeight(id: string) { return this.penalty(this.recentSets, id); }
  affixWeight(id: string) { return this.penalty(this.recentAffixes, id); }
  itemWeight(id: string) { return this.penalty(this.recentItems, id); }

  rememberBase(id: string) { this.push(this.recentBases, id); }
  rememberSet(id: string) { this.push(this.recentSets, id); }
  rememberAffix(id: string) { this.push(this.recentAffixes, id); }
  rememberItem(id: string) { this.push(this.recentItems, id); }

  private push(list: string[], id: string) {
    list.push(id);
    while (list.length > RECENT_MAX) list.shift();
  }
}

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

const BUILD_MATCH_BONUS = 1.6;
const USELESS_PENALTY = 0.6;

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

  const quality = rollDirectedQuality(table, ctx, runDirector);

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

export function pickDirectedItem(
  table: LootTableDef,
  ctx: BuildContext,
  mem: LootMemory,
  runDirector?: RunDirector,
): { itemId: string; rarity: Rarity } {
  const rarity = rollDirectedQuality(table, ctx, runDirector);

  let pool = ITEMS.filter((it) => it.rarity === rarity);
  if (pool.length === 0) pool = ITEMS;

  const weighted = pool.map((it) => ({ item: it, weight: Math.max(0.05, mem.itemWeight(it.id)) }));
  const total = weighted.reduce((s, p) => s + p.weight, 0);
  let r = runRandom.next('loot') * total;
  let chosen = weighted[0].item;
  for (const p of weighted) {
    r -= p.weight;
    if (r <= 0) { chosen = p.item; break; }
  }

  mem.rememberItem(chosen.id);
  return { itemId: chosen.id, rarity: chosen.rarity };
}

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

export { getAffix };