/**
 * ItemFactory.ts — generación procedural de variantes de armas (TDD §5.9, §6).
 *
 * NO se generan miles de JSON físicos: se guardan ~5 armas base + tablas de
 * prefijos/sufijos como listas pequeñas, y el ItemFactory compone la variante
 * final en runtime. Coherente con DRY y con el espíritu data-driven del TDD.
 *
 * Un arma generada = weaponBase × [prefijo opcional] × [sufijo opcional] × [rareza].
 */

import type { ContentRepository } from '@/engine/content/ContentRepository';
import { randInt, chance } from '@/engine/utils/math';

export interface AffixDef {
  id: string;
  kind: 'prefix' | 'suffix';
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  tags: string[];
  mods: Array<{ stat: string; op: 'add' | 'add_pct' | 'mul' | 'set'; value: number | string }>;
  color?: string;
}

export interface WeaponBase {
  id: string;
  name: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  projectileSize: number;
  color: string;
  spread: number;
  count: number;
  pierce: number;
  sound: string;
  tags: string[];
}

export interface WeaponInstance extends WeaponBase {
  /** Nombre completo mostrado (ej. "Pistola Flamígera del Filo"). */
  displayName: string;
  /** Afijos aplicados. */
  affixes: string[];
  /** Rareza efectiva (máx de base y afijos). */
  effectiveRarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  /** Extras aplicados por afijos. */
  lifesteal?: number;
  critChance?: number;
}

const RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'] as const;
type Rarity = (typeof RARITY_ORDER)[number];

const rarityRank = (r: Rarity): number => RARITY_ORDER.indexOf(r);
const maxRarity = (a: Rarity, b: Rarity): Rarity =>
  rarityRank(a) >= rarityRank(b) ? a : b;

export class ItemFactory {
  constructor(private readonly content: ContentRepository) {}

  /**
   * Genera una variante de arma aplicando afijos según un "rollBudget" (0..1).
   * RollBudget alto = más probabilidad de afijos épicos/legendarios.
   */
  rollWeapon(baseId?: string, rollBudget = 0.5): WeaponInstance {
    const bases = this.content.all<WeaponBase>('weapons');
    if (bases.length === 0) throw new Error('ItemFactory: no hay armas base en el content');
    const base = baseId
      ? this.content.get<WeaponBase>('weapons', baseId) ?? bases[0]
      : bases[randInt(0, bases.length - 1)];

    const inst: WeaponInstance = {
      ...base,
      displayName: base.name,
      affixes: [],
      effectiveRarity: base.rarity,
    };

    // Decidir número de afijos según rollBudget
    const maxAffixes = rollBudget < 0.3 ? 1 : rollBudget < 0.7 ? 2 : 3;
    const numAffixes = Math.min(maxAffixes, randInt(0, maxAffixes));

    const affixes = this.content.all<AffixDef>('affixes');
    const usedKinds = new Set<'prefix' | 'suffix'>();

    for (let i = 0; i < numAffixes; i++) {
      const candidates = affixes.filter((a) =>
        !usedKinds.has(a.kind) && rarityRank(a.rarity) <= Math.floor(rollBudget * 4 + 1)
      );
      if (candidates.length === 0) break;
      const af = candidates[randInt(0, candidates.length - 1)];
      usedKinds.add(af.kind);
      this.applyAffix(inst, af);
      inst.affixes.push(af.id);
      inst.effectiveRarity = maxRarity(inst.effectiveRarity, af.rarity);
    }

    // Construir displayName: "Prefijo Base Sufijo"
    const prefix = inst.affixes
      .map((id) => affixes.find((a) => a.id === id))
      .find((a) => a?.kind === 'prefix');
    const suffix = inst.affixes
      .map((id) => affixes.find((a) => a.id === id))
      .find((a) => a?.kind === 'suffix');

    let name = base.name;
    if (prefix) name = `${prefix.name} ${name}`;
    if (suffix) name = `${name} ${suffix.name}`;
    inst.displayName = name;

    // El color del arma refleja el afijo más fuerte si existe
    const dominantColor =
      (suffix?.color) ?? (prefix?.color) ?? base.color;
    inst.color = dominantColor;

    return inst;
  }

  private applyAffix(inst: WeaponInstance, af: AffixDef): void {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const obj = inst as unknown as Record<string, any>;
    for (const mod of af.mods) {
      const key = mod.stat;
      if (mod.op === 'add') {
        obj[key] = (obj[key] as number) + (mod.value as number);
      } else if (mod.op === 'add_pct') {
        obj[key] = (obj[key] as number) * (1 + (mod.value as number));
      } else if (mod.op === 'mul') {
        obj[key] = (obj[key] as number) * (mod.value as number);
      } else if (mod.op === 'set') {
        if (mod.stat === 'tags') {
          inst.tags = [...inst.tags, mod.value as string];
        } else {
          obj[key] = mod.value;
        }
      }
    }
  }

  /** Rueda un arma por rareza objetivo (para cofres, etc.). */
  rollWeaponByRarity(targetRarity: Rarity): WeaponInstance {
    const bases = this.content.all<WeaponBase>('weapons');
    // Preferir bases de rareza cercana
    const sorted = bases
      .slice()
      .sort((a, b) =>
        Math.abs(rarityRank(a.rarity) - rarityRank(targetRarity)) -
        Math.abs(rarityRank(b.rarity) - rarityRank(targetRarity))
      );
    const base = sorted[0];
    // El rollBudget escala con la rareza objetivo
    const budget = (rarityRank(targetRarity) + 1) / RARITY_ORDER.length;
    return this.rollWeapon(base.id, budget);
  }
}

/** Helper: elige una rareza según pesos. */
export function pickRarity(weights: Record<string, number>): Rarity {
  const entries = Object.entries(weights).filter(([k]) => RARITY_ORDER.includes(k as Rarity));
  const total = entries.reduce((s, [, w]) => s + w, 0);
  let r = Math.random() * total;
  for (const [k, w] of entries) {
    r -= w;
    if (r <= 0) return k as Rarity;
  }
  return 'common';
}

export { chance };
