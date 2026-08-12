/* ======================================================================
 * ascension.ts — Data-driven Ascension Level Definitions.
 * ----------------------------------------------------------------------
 * Ascension is a post-endgame difficulty system. Each level introduces
 * reusable modifiers that affect enemy, loot, and event directors via
 * weight multipliers. All data lives here — no code changes needed to
 * add new levels.
 *
 * Modifiers are pure weight multipliers (never direct stat hacks).
 * 1.0 = no change, >1 amplifies, <1 reduces.
 * ==================================================================== */

export interface AscensionModifier {
  id: string;
  label: string;
  description: string;
  icon: string;
  /** Multiplier applied to enemy director intensity (higher = harder). */
  enemyIntensityMult?: number;
  /** Multiplier applied to elite/miniboss composition weight. */
  eliteWeightMult?: number;
  /** Multiplier applied to loot gold-category weight. */
  goldWeightMult?: number;
  /** Multiplier applied to loot heal-category weight. */
  healWeightMult?: number;
  /** Multiplier applied to loot quality weights (rarer shift). */
  lootQualityShift?: Partial<Record<string, number>>;
  /** Multiplier applied to enemy composition weights. */
  compositionWeightMult?: Partial<Record<string, number>>;
  /** Multiplier applied to event weights (e.g. cursed higher, merchant lower). */
  eventWeightMult?: Partial<Record<string, number>>;
  /** Extra damage multiplier applied to ALL enemies (gentle scaling). */
  enemyDamageMult?: number;
  /** XP multiplier applied to gains. */
  xpMult?: number;
  /** Score multiplier applied at end of run. */
  scoreMult?: number;
}

export interface AscensionLevel {
  level: number;
  name: string;
  description: string;
  color: string;
  icon: string;
  modifiers: AscensionModifier[];
  /** Required to unlock this level: previous level must be beaten. */
  requiresPrevious: boolean;
  /** Bonus gold awarded at start of run. */
  startingGoldBonus: number;
  /** Bonus XP multiplier. */
  /** End-of-run score multiplier for higher leaderboard value. */
  scoreMult?: number;
  xpMult?: number;
}

export const ASCENSION_LEVELS: AscensionLevel[] = [
  {
    level: 0,
    name: 'Normal',
    description: 'La experiencia estándar. Sin modificaciones.',
    color: '#94a3b8',
    icon: '⚡',
    modifiers: [],
    requiresPrevious: false,
    startingGoldBonus: 0,
  },
  {
    level: 1,
    name: 'Dureza Urbana',
    description: 'Los enemigos son más agresivos. Menos curación.',
    color: '#39ff88',
    icon: '🏙️',
    modifiers: [
      { id: 'h1_enemies', label: 'Agresividad +10%', description: 'Los enemigos actúan más rápido.', icon: '⚔️', enemyIntensityMult: 1.10 },
      { id: 'h1_heal', label: 'Menos curación', description: 'Las curaciones aparecen con menor frecuencia.', icon: '💉', healWeightMult: 0.85 },
    ],
    requiresPrevious: true,
    startingGoldBonus: 50,
  },
  {
    level: 2,
    name: 'Distrito Peligroso',
    description: 'Más élites y minibosses. Oro reducido.',
    color: '#00c8ff',
    icon: '🏚️',
    modifiers: [
      { id: 'h2_elite', label: 'Más élites', description: 'Los enemigos elite aparecen con más frecuencia.', icon: '💀', eliteWeightMult: 1.25 },
      { id: 'h2_gold', label: 'Oro escaso', description: 'Las recompensas de oro se reducen.', icon: '🪙', goldWeightMult: 0.80 },
      { id: 'h2_comp', label: 'Combinaciones duras', description: 'Composiciones de tanques favorecidas.', icon: '🛡️', compositionWeightMult: { tank_push: 1.2, siege: 1.15 } },
    ],
    requiresPrevious: true,
    startingGoldBonus: 100,
    xpMult: 1.1,
  },
  {
    level: 3,
    name: 'Calles Tóxicas',
    description: 'Rarezas altas menos frecuentes. Cofres debilitados.',
    color: '#9dff00',
    icon: '☣️',
    modifiers: [
      { id: 'h3_rarity', label: 'Rareza restringida', description: 'Las rarezas altas aparecen con menos frecuencia.', icon: '✨', lootQualityShift: { epic: 0.8, legendary: 0.65 } },
      { id: 'h3_enemy', label: 'Daño base +10%', description: 'Los enemigos infligen más daño.', icon: '🔴', enemyDamageMult: 1.10 },
    ],
    requiresPrevious: true,
    startingGoldBonus: 150,
    xpMult: 1.2,
  },
  {
    level: 4,
    name: 'Zona de Guerra',
    description: 'Eventos más peligrosos. Menos comerciantes.',
    color: '#ff8800',
    icon: '💥',
    modifiers: [
      { id: 'h4_cursed', label: 'Más maldiciones', description: 'Las salas malditas y desafíos aparecen más.', icon: '☠️', eventWeightMult: { cursed_arena: 1.35, challenge_time: 1.3, challenge_nodamage: 1.3, altar_sangre: 1.25 } },
      { id: 'h4_merchant', label: 'Menos comercio', description: 'Los comerciantes aparecen menos.', icon: '🤖', eventWeightMult: { merchant_bot: 0.75 } },
      { id: 'h4_comp2', label: 'Asaltos frecuentes', description: 'Emboscadas y picadoras más habituales.', icon: '⚔️', compositionWeightMult: { assassin_pack: 1.3, meat_grinder: 1.2 } },
    ],
    requiresPrevious: true,
    startingGoldBonus: 200,
    xpMult: 1.3,
  },
  {
    level: 5,
    name: 'Distrito Rojo',
    description: 'Combates largos. Más multiplicadores de daño y dificultad.',
    color: '#ff3b5c',
    icon: '🩸',
    modifiers: [
      { id: 'h5_dmg', label: 'Daño +20%', description: 'Los enemigos infligen significativamente más daño.', icon: '🔴', enemyDamageMult: 1.20 },
      { id: 'h5_intensity', label: 'Presión constante', description: 'La intensidad base de los enemigos aumenta.', icon: '🔥', enemyIntensityMult: 1.25 },
      { id: 'h5_gold2', label: 'Oro muy escaso', description: 'La frecuencia de oro y cofres disminuye.', icon: '🪙', goldWeightMult: 0.70 },
    ],
    requiresPrevious: true,
    startingGoldBonus: 250,
    xpMult: 1.4,
    scoreMult: 1.2,
  },
  {
    level: 6,
    name: 'Zona de Exclusión',
    description: 'Todo más difícil. Contrarrestes más severos.',
    color: '#b04dff',
    icon: '🚫',
    modifiers: [
      { id: 'h6_full', label: 'Amenaza total', description: 'Enemigos más fuertes, peor loot.', icon: '⚠️', enemyIntensityMult: 1.15, eliteWeightMult: 1.15, goldWeightMult: 0.85, healWeightMult: 0.85 },
      { id: 'h6_elite2', label: 'Dominio de élites', description: 'Minibosses y élites mucho más frecuentes.', icon: '💀', eliteWeightMult: 1.35 },
      { id: 'h6_loot', label: 'Botín degradado', description: 'Calidad general del loot inferior.', icon: '📦', lootQualityShift: { rare: 0.85, epic: 0.7, legendary: 0.5 } },
    ],
    requiresPrevious: true,
    startingGoldBonus: 300,
    xpMult: 1.5,
    scoreMult: 1.4,
  },
  {
    level: 7,
    name: 'Bunker',
    description: 'Supervivencia extrema. Sin concesiones.',
    color: '#00f0ff',
    icon: '🏛️',
    modifiers: [
      { id: 'h7_dmg30', label: 'Daño +30%', description: 'Daño base de enemigos brutal.', icon: '🔴', enemyDamageMult: 1.30 },
      { id: 'h7_heal2', label: 'Curación mínima', description: 'Las curaciones son muy raras.', icon: '💉', healWeightMult: 0.60 },
      { id: 'h7_event', label: 'Infierno constante', description: 'Eventos malditos y desafíos omnipresentes.', icon: '☠️', eventWeightMult: { cursed_arena: 1.5, challenge_nodamage: 1.4, challenge_time: 1.4 } },
    ],
    requiresPrevious: true,
    startingGoldBonus: 350,
    xpMult: 1.6,
    scoreMult: 1.6,
  },
  {
    level: 8,
    name: 'Descenso',
    description: 'Las reglas se rompen. Supervivencia pura.',
    color: '#ffe14a',
    icon: '⬇️',
    modifiers: [
      { id: 'h8_hybrid', label: 'Amenaza total', description: 'Enemigos muy fuertes, loot degradado.', icon: '⚠️', enemyIntensityMult: 1.3, eliteWeightMult: 1.3, lootQualityShift: { rare: 0.8, epic: 0.6, legendary: 0.4 }, healWeightMult: 0.7, goldWeightMult: 0.7 },
      { id: 'h8_comp3', label: 'Pesadillas', description: 'Pesadillas y asedios más frecuentes.', icon: '⚔️', compositionWeightMult: { nightmare: 1.4, siege: 1.3, elite_hunt: 1.2 } },
    ],
    requiresPrevious: true,
    startingGoldBonus: 400,
    xpMult: 1.7,
    scoreMult: 1.8,
  },
  {
    level: 9,
    name: 'Ocaso Final',
    description: 'La última ascensión. Solo los mejores sobrevivirán.',
    color: '#ffe14a',
    icon: '🌅',
    modifiers: [
      { id: 'h9_all', label: 'Apocalipsis', description: 'Daño brutal, loot ínfimo, eventos letales.', icon: '🔥', enemyDamageMult: 1.4, enemyIntensityMult: 1.4, eliteWeightMult: 1.4, healWeightMult: 0.5, goldWeightMult: 0.6, lootQualityShift: { epic: 0.5, legendary: 0.3 } },
      { id: 'h9_event2', label: 'Curse eterna', description: 'Maldiciones constantes y sin tregua.', icon: '☠️', eventWeightMult: { cursed_arena: 1.6, altar_sangre: 1.4, challenge_nodamage: 1.5, merchant_bot: 0.5 } },
      { id: 'h9_compfinal', label: 'Pesadillas', description: 'Pesadillas y asedios dominan.', icon: '⚔️', compositionWeightMult: { nightmare: 1.6, siege: 1.4 } },
    ],
    requiresPrevious: true,
    startingGoldBonus: 500,
    xpMult: 2.0,
    scoreMult: 2.5,
  },
];

/**
 * Optional risk/reward modifiers offered when continuing an endless cycle.
 * Reuses the existing AscensionModifier type; each field is multiplied into
 * the run's AscensionState exactly like the ascension-level modifiers.
 */
export const ENDLESS_MODIFIERS: AscensionModifier[] = [
  { id: 'endless_brutal', label: 'Oleada Brutal', icon: '💀',
    description: 'Enemigos +20% daño. A cambio, +15% oro.',
    enemyDamageMult: 1.20, goldWeightMult: 1.15 },
  { id: 'endless_swift', label: 'Marabunta', icon: '⚡',
    description: 'Enemigos +15% velocidad e intensidad. A cambio, +10% XP.',
    enemyIntensityMult: 1.15, xpMult: 1.10 },
  { id: 'endless_scarce', label: 'Escasez', icon: '🩸',
    description: '-30% probabilidad de curación. A cambio, +25% probabilidad de objeto raro.',
    healWeightMult: 0.70, lootQualityShift: { rare: 1.25, epic: 1.15 } },
  { id: 'endless_elite', label: 'Vanguardia', icon: '⚔️',
    description: 'Más enemigos de élite. A cambio, +20% puntuación.',
    eliteWeightMult: 1.30, scoreMult: 1.20 },
];

export function getAscensionLevel(level: number): AscensionLevel {
  return ASCENSION_LEVELS[Math.min(level, ASCENSION_LEVELS.length - 1)] ?? ASCENSION_LEVELS[0];
}

export function getMaxAscensionLevel(): number {
  return ASCENSION_LEVELS.length - 1;
}

/** Aggregate all active modifiers into a single lookup map for efficiency. */
export interface AscensionState {
  enemyIntensityMult: number;
  eliteWeightMult: number;
  goldWeightMult: number;
  healWeightMult: number;
  enemyDamageMult: number;
  scoreMult: number;
  xpMult: number;
  lootQualityShift: Record<string, number>;
  compositionWeightMult: Record<string, number>;
  eventWeightMult: Record<string, number>;
}

export function computeAscensionState(level: number): AscensionState {
  const lvl = getAscensionLevel(level);
  const state: AscensionState = {
    enemyIntensityMult: 1,
    eliteWeightMult: 1,
    goldWeightMult: 1,
    healWeightMult: 1,
    enemyDamageMult: 1,
    scoreMult: lvl.scoreMult ?? 1,
    xpMult: lvl.xpMult ?? 1,
    lootQualityShift: {},
    compositionWeightMult: {},
    eventWeightMult: {},
  };

  const nset = (map: Record<string, number>, key: string, val: number) => {
    map[key] = (map[key] ?? 1) * val;
  };

  for (const mod of lvl.modifiers) {
    if (mod.enemyIntensityMult) state.enemyIntensityMult *= mod.enemyIntensityMult;
    if (mod.eliteWeightMult) state.eliteWeightMult *= mod.eliteWeightMult;
    if (mod.goldWeightMult) state.goldWeightMult *= mod.goldWeightMult;
    if (mod.healWeightMult) state.healWeightMult *= mod.healWeightMult;
    if (mod.enemyDamageMult) state.enemyDamageMult *= mod.enemyDamageMult;
    if (mod.scoreMult) state.scoreMult *= mod.scoreMult;

    if (mod.lootQualityShift) {
      for (const r in mod.lootQualityShift) {
        const v = mod.lootQualityShift[r];
        if (v !== undefined) nset(state.lootQualityShift, r, v);
      }
    }
    if (mod.compositionWeightMult) {
      for (const k in mod.compositionWeightMult) {
        const v = mod.compositionWeightMult[k];
        if (v !== undefined) nset(state.compositionWeightMult, k, v);
      }
    }
    if (mod.eventWeightMult) {
      for (const k in mod.eventWeightMult) {
        const v = mod.eventWeightMult[k];
        if (v !== undefined) nset(state.eventWeightMult, k, v);
      }
    }
  }

  return state;
}
