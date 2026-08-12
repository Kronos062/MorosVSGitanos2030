/* ======================================================================
 * statBalance.ts — Global Stat Balance System (data-driven).
 * ----------------------------------------------------------------------
 * A single upper layer that transforms RAW accumulated stat values into
 * FINAL values, using soft caps + diminishing returns + optional hard
 * caps. Every stat that goes through recalcStats() is post-processed here.
 *
 * Nothing else in the codebase should cap stats. Adding a new stat only
 * requires adding a STAT_BALANCE entry (or none — unlisted stats pass
 * through unchanged).
 * ==================================================================== */

export type StatCategory = 'offensive' | 'defensive' | 'utility';

/**
 * A piecewise diminishing-returns curve. Above `softCap`, each additional
 * unit of the RAW stat contributes only a fraction of its value, defined
 * by descending segments. `hardCap` (optional) clamps the FINAL value.
 *
 * Curve semantics (applied to the amount ABOVE the base/softCap):
 *   segments: [{ upTo, efficiency }, ...]
 *   - `upTo` is measured in RAW units above softCap (Infinity = last).
 *   - `efficiency` (0..1) is how much of each unit in that band counts.
 */
export interface DiminishSegment {
  /** Raw units above softCap where this band ends. Use Infinity for the tail. */
  upTo: number;
  /** Fraction (0..1) of value retained in this band. */
  efficiency: number;
}

export interface StatBalanceDef {
  stat: string;
  category: StatCategory;
  /** Below this RAW value everything counts at 100%. */
  softCap: number;
  /** Optional absolute clamp on the FINAL value. */
  hardCap?: number;
  /** Diminishing-returns bands for the portion above softCap. */
  curve: DiminishSegment[];
  /** Human note (docs only). */
  note?: string;
}

/**
 * Multiplier-type stats (damageMult, fireRateMult, speedMult, critDamageMult)
 * are stored as a factor around 1.0 (e.g. 1.6 = +60%). For these we apply the
 * curve to the BONUS above 1.0 and re-add 1.0 afterwards.
 */
const MULTIPLIER_STATS = new Set([
  'damageMult',
  'fireRateMult',
  'speedMult',
  'critDamageMult',
]);

export function isMultiplierStat(stat: string): boolean {
  return MULTIPLIER_STATS.has(stat);
}

/* ------------------------------------------------------------------ */
/*  Balance configuration table (pure data).                         */
/*  Numbers are illustrative curves, not a rebalance of content.      */
/* ------------------------------------------------------------------ */

export const STAT_BALANCE: StatBalanceDef[] = [
  /* ---------------- OFFENSIVE ---------------- */
  // Multiplier applied to raw bonus above +0% (stored as factor around 1).
  {
    stat: 'damageMult', category: 'offensive', softCap: 0.6, hardCap: 3.0,
    curve: [
      { upTo: 0.9, efficiency: 0.7 },
      { upTo: 1.8, efficiency: 0.45 },
      { upTo: Infinity, efficiency: 0.25 },
    ],
    note: 'Damage keeps scaling but stacking a single source gives less.',
  },
  {
    stat: 'fireRateMult', category: 'offensive', softCap: 0.5, hardCap: 2.0,
    curve: [
      { upTo: 0.8, efficiency: 0.6 },
      { upTo: 1.6, efficiency: 0.35 },
      { upTo: Infinity, efficiency: 0.2 },
    ],
  },
  {
    stat: 'critChance', category: 'offensive', softCap: 0.4, hardCap: 0.95,
    curve: [
      { upTo: 0.3, efficiency: 0.6 },
      { upTo: 0.6, efficiency: 0.35 },
      { upTo: Infinity, efficiency: 0.2 },
    ],
    note: 'Never guaranteed crit (hard cap 95%).',
  },
  {
    stat: 'critDamageMult', category: 'offensive', softCap: 1.0,
    curve: [
      { upTo: 1.0, efficiency: 0.6 },
      { upTo: Infinity, efficiency: 0.35 },
    ],
    note: 'Crit multiplier stored as factor; base 2.0 = +1.0 bonus.',
  },
  {
    stat: 'pierceBonus', category: 'offensive', softCap: 4, hardCap: 8,
    curve: [
      { upTo: 4, efficiency: 0.6 },
      { upTo: 8, efficiency: 0.4 },
      { upTo: Infinity, efficiency: 0.25 },
    ],
  },
  {
    stat: 'countBonus', category: 'offensive', softCap: 3, hardCap: 4,
    curve: [
      { upTo: 3, efficiency: 0.6 },
      { upTo: 6, efficiency: 0.4 },
      { upTo: Infinity, efficiency: 0.25 },
    ],
    note: 'Extra projectiles diminish to avoid bullet-hell overload.',
  },
  {
    stat: 'bounceBonus', category: 'offensive', softCap: 4, hardCap: 4,
    curve: [
      { upTo: 4, efficiency: 0.6 },
      { upTo: Infinity, efficiency: 0.35 },
    ],
  },
  {
    stat: 'explosionBonus', category: 'offensive', softCap: 120,
    curve: [
      { upTo: 120, efficiency: 0.55 },
      { upTo: Infinity, efficiency: 0.3 },
    ],
  },
  {
    stat: 'projectileSizeBonus', category: 'offensive', softCap: 6, hardCap: 10,
    curve: [
      { upTo: 6, efficiency: 0.6 },
      { upTo: Infinity, efficiency: 0.35 },
    ],
  },

  /* ---------------- DEFENSIVE ---------------- */
  {
    stat: 'maxHp', category: 'defensive', softCap: 200,
    curve: [
      { upTo: 200, efficiency: 0.75 },
      { upTo: 400, efficiency: 0.5 },
      { upTo: Infinity, efficiency: 0.3 },
    ],
    note: 'HP keeps rising (no hard cap) but stacking it flattens.',
  },
  {
    stat: 'armor', category: 'defensive', softCap: 10, hardCap: 40,
    curve: [
      { upTo: 10, efficiency: 0.6 },
      { upTo: 25, efficiency: 0.35 },
      { upTo: Infinity, efficiency: 0.2 },
    ],
    note: 'Hard cap prevents near-immunity via flat armour.',
  },
  {
    stat: 'shield', category: 'defensive', softCap: 4, hardCap: 12,
    curve: [
      { upTo: 4, efficiency: 0.6 },
      { upTo: Infinity, efficiency: 0.35 },
    ],
    note: 'Shield charges: strong early, capped to avoid invulnerability.',
  },
  {
    stat: 'lifesteal', category: 'defensive', softCap: 0.15, hardCap: 0.6,
    curve: [
      { upTo: 0.15, efficiency: 0.6 },
      { upTo: 0.3, efficiency: 0.35 },
      { upTo: Infinity, efficiency: 0.2 },
    ],
    note: 'Lifesteal capped so you cannot fully outheal all damage.',
  },

  /* ---------------- UTILITY ---------------- */
  {
    stat: 'speedMult', category: 'utility', softCap: 0.4, hardCap: 1.4,
    curve: [
      { upTo: 0.5, efficiency: 0.6 },
      { upTo: 1.0, efficiency: 0.35 },
      { upTo: Infinity, efficiency: 0.2 },
    ],
    note: 'Move speed multiplier: hard cap keeps the game controllable.',
  },
];

const BALANCE_MAP: Record<string, StatBalanceDef> = Object.fromEntries(
  STAT_BALANCE.map((d) => [d.stat, d]),
);

export function getStatBalance(stat: string): StatBalanceDef | undefined {
  return BALANCE_MAP[stat];
}

/* ------------------------------------------------------------------ */
/*  Core transform: raw → final via soft cap + diminishing returns.  */
/* ------------------------------------------------------------------ */

/** Applies the diminishing-returns curve to the portion above softCap. */
function applyCurve(raw: number, def: StatBalanceDef): number {
  // Negative or below soft cap → unchanged.
  if (raw <= def.softCap) return raw;

  let excess = raw - def.softCap;
  let effective = def.softCap;
  let bandStart = 0;

  for (const seg of def.curve) {
    const bandWidth = seg.upTo === Infinity ? Infinity : seg.upTo - bandStart;
    const take = Math.min(excess, bandWidth);
    effective += take * seg.efficiency;
    excess -= take;
    bandStart = seg.upTo;
    if (excess <= 0) break;
  }
  // If the curve ran out of bands (shouldn't with an Infinity tail), pass rest through.
  if (excess > 0) effective += excess * (def.curve[def.curve.length - 1]?.efficiency ?? 1);

  return effective;
}

/**
 * Balance a single stat value. `raw` is the fully-accumulated value from all
 * sources. Returns the final value the engine should use.
 *
 * For multiplier stats, we balance the BONUS above 1.0 and re-add 1.0.
 * Unlisted stats pass through unchanged.
 */
export function balanceStat(stat: string, raw: number): number {
  const def = getStatBalance(stat);
  if (!def) return raw;

  if (isMultiplierStat(stat)) {
    const bonus = raw - 1;
    if (bonus <= 0) {
      let v = raw;
      if (def.hardCap !== undefined) v = Math.min(v, def.hardCap);
      return v;
    }
    let balancedBonus = applyCurve(bonus, def);
    let final = 1 + balancedBonus;
    if (def.hardCap !== undefined) final = Math.min(final, def.hardCap);
    return final;
  }

  let final = applyCurve(raw, def);
  if (def.hardCap !== undefined) final = Math.min(final, def.hardCap);
  return final;
}
