import type { Rarity } from './weapons';

/* ==================================================================
   PETS — permanent, data-driven companions.
   ------------------------------------------------------------------
   Every pet is defined purely as data. The engine reads a list of
   generic `effects` and applies them with no pet-specific code, so
   adding dozens of new pets only requires new PET_DEFS entries.
   ================================================================== */

/** Generic effect kinds the engine knows how to run. */
export type PetEffectKind =
  | 'coin_magnet'       // pulls score/coin pickups toward the player
  | 'auto_fire'         // shoots nearby enemies periodically
  | 'slow_aura'         // slows enemies within radius
  | 'reveal_map'        // reveals more of the minimap
  | 'regen'             // slowly heals the player
  | 'apply_status'      // applies a status (fire/ice/toxic) to nearby enemies
  | 'block_projectiles' // periodically destroys nearby enemy projectiles
  | 'loot_luck'         // increases drop chance of items/equipment
  | 'xp_boost'          // increases XP gained
  | 'gold_boost'        // increases gold gained
  | 'stat_boost';       // flat/relative stat modifiers (build synergy)

export interface PetEffect {
  kind: PetEffectKind;
  /** Generic numeric parameters (meaning depends on kind). */
  value?: number;       // primary magnitude
  radius?: number;      // area of effect (world units)
  interval?: number;    // seconds between ticks (for periodic effects)
  /** For apply_status: which status. For stat_boost: which stat. */
  key?: string;
  /** For stat_boost: additive or multiplicative. */
  op?: 'add' | 'mult';
  /** Optional synergy tags: effect strengthened if build matches (data-only). */
  synergyTags?: string[];
}

export interface PetStats {
  /** Orbit radius around the player. */
  orbitRadius: number;
  /** Orbit angular speed (rad/s). */
  orbitSpeed: number;
  /** Visual size. */
  size: number;
}

export interface PetDef {
  id: string;
  name: string;
  description: string;
  ability: string;      // short human-readable summary of the main ability
  rarity: Rarity;
  icon: string;
  color: string;
  cost: number;
  stats: PetStats;
  effects: PetEffect[];
}

export const PET_RARITY_COLORS: Record<Rarity, string> = {
  common: '#94a3b8', uncommon: '#39ff88', rare: '#00c8ff', epic: '#b04dff', legendary: '#ffe14a',
};

export const PET_DEFS: PetDef[] = [
  /* ─────────────── COMMON ─────────────── */
  {
    id: 'pet_coin_sprite', name: 'Duende Monedero', rarity: 'common', icon: '🪙', color: '#ffe14a', cost: 120,
    description: 'Un pequeño duende que atrae el botín brillante hacia ti.',
    ability: 'Atrae monedas y puntos cercanos.',
    stats: { orbitRadius: 40, orbitSpeed: 2.4, size: 8 },
    effects: [{ kind: 'coin_magnet', radius: 220 }],
  },
  {
    id: 'pet_medic_bot', name: 'Bot Enfermero', rarity: 'common', icon: '⚕️', color: '#39ff88', cost: 140,
    description: 'Dron médico que repara tus heridas poco a poco.',
    ability: 'Regenera vida lentamente.',
    stats: { orbitRadius: 42, orbitSpeed: 2.0, size: 8 },
    effects: [{ kind: 'regen', value: 1.2, interval: 1 }],
  },
  {
    id: 'pet_scout_eye', name: 'Ojo Explorador', rarity: 'common', icon: '👁️', color: '#00c8ff', cost: 110,
    description: 'Un ojo flotante que cartografía el vecindario.',
    ability: 'Revela más zona en el minimapa.',
    stats: { orbitRadius: 44, orbitSpeed: 1.8, size: 7 },
    effects: [{ kind: 'reveal_map', value: 1 }],
  },

  /* ─────────────── UNCOMMON ─────────────── */
  {
    id: 'pet_turret_drone', name: 'Dron Torreta', rarity: 'uncommon', icon: '🔫', color: '#ff8800', cost: 260,
    description: 'Dispara automáticamente a los enemigos más cercanos.',
    ability: 'Fuego automático de apoyo.',
    stats: { orbitRadius: 46, orbitSpeed: 2.2, size: 9 },
    effects: [{ kind: 'auto_fire', value: 8, interval: 0.7, radius: 420 }],
  },
  {
    id: 'pet_lucky_cat', name: 'Gato de la Suerte', rarity: 'uncommon', icon: '🐈', color: '#ffe14a', cost: 280,
    description: 'Su ronroneo atrae fortuna y objetos raros.',
    ability: '+Probabilidad de botín.',
    stats: { orbitRadius: 40, orbitSpeed: 2.0, size: 9 },
    effects: [{ kind: 'loot_luck', value: 0.25 }],
  },
  {
    id: 'pet_savant_owl', name: 'Búho Sabio', rarity: 'uncommon', icon: '🦉', color: '#b04dff', cost: 300,
    description: 'Comparte su sabiduría acelerando tu aprendizaje.',
    ability: '+Experiencia obtenida.',
    stats: { orbitRadius: 44, orbitSpeed: 1.8, size: 9 },
    effects: [{ kind: 'xp_boost', value: 0.20 }],
  },

  /* ─────────────── RARE ─────────────── */
  {
    id: 'pet_frost_wisp', name: 'Fuego Fatuo Gélido', rarity: 'rare', icon: '❄️', color: '#6ef0ff', cost: 480,
    description: 'Emana un aura que congela el aire alrededor.',
    ability: 'Ralentiza a los enemigos cercanos.',
    stats: { orbitRadius: 46, orbitSpeed: 2.4, size: 10 },
    effects: [{ kind: 'slow_aura', radius: 160, interval: 0.4 }],
  },
  {
    id: 'pet_guardian_shell', name: 'Caparazón Guardián', rarity: 'rare', icon: '🛡️', color: '#0099ff', cost: 520,
    description: 'Un escudo viviente que intercepta proyectiles enemigos.',
    ability: 'Destruye proyectiles enemigos cercanos.',
    stats: { orbitRadius: 50, orbitSpeed: 3.0, size: 11 },
    effects: [{ kind: 'block_projectiles', radius: 90, interval: 0.5 }],
  },
  {
    id: 'pet_toxic_slug', name: 'Babosa Tóxica', rarity: 'rare', icon: '🐌', color: '#9dff00', cost: 500,
    description: 'Rezuma esporas venenosas sobre los enemigos próximos.',
    ability: 'Envenena a enemigos cercanos.',
    stats: { orbitRadius: 42, orbitSpeed: 2.0, size: 10 },
    effects: [{ kind: 'apply_status', key: 'toxic', radius: 150, interval: 0.9, value: 6 }],
  },

  /* ─────────────── EPIC ─────────────── */
  {
    id: 'pet_ember_dragon', name: 'Dragoncillo de Brasa', rarity: 'epic', icon: '🐉', color: '#ff6a00', cost: 820,
    description: 'Escupe brasas que incendian a los enemigos cercanos.',
    ability: 'Quema enemigos cercanos y potencia builds de fuego.',
    stats: { orbitRadius: 52, orbitSpeed: 2.6, size: 12 },
    effects: [
      { kind: 'apply_status', key: 'fire', radius: 170, interval: 0.8, value: 8, synergyTags: ['fire'] },
      { kind: 'stat_boost', key: 'damageMult', op: 'mult', value: 0.08, synergyTags: ['fire'] },
    ],
  },
  {
    id: 'pet_battle_drone', name: 'Dron de Batalla', rarity: 'epic', icon: '🤖', color: '#ff2bd6', cost: 880,
    description: 'Sistema de armas autónomo de alta cadencia.',
    ability: 'Fuego automático potente + bonus de cadencia.',
    stats: { orbitRadius: 54, orbitSpeed: 3.2, size: 12 },
    effects: [
      { kind: 'auto_fire', value: 14, interval: 0.4, radius: 480 },
      { kind: 'stat_boost', key: 'fireRateMult', op: 'mult', value: 0.06 },
    ],
  },
  {
    id: 'pet_golden_hoarder', name: 'Acaparador Dorado', rarity: 'epic', icon: '💰', color: '#ffe14a', cost: 900,
    description: 'Convierte cada baja en más riqueza y botín.',
    ability: '+Oro, +Botín y atracción de monedas.',
    stats: { orbitRadius: 44, orbitSpeed: 2.2, size: 12 },
    effects: [
      { kind: 'gold_boost', value: 0.30 },
      { kind: 'loot_luck', value: 0.20 },
      { kind: 'coin_magnet', radius: 280 },
    ],
  },

  /* ─────────────── LEGENDARY ─────────────── */
  {
    id: 'pet_storm_djinn', name: 'Genio de la Tormenta', rarity: 'legendary', icon: '⚡', color: '#6ef0ff', cost: 1500,
    description: 'Un genio ancestral que canaliza rayos y protege a su portador.',
    ability: 'Fuego eléctrico, aura lenta y potencia builds eléctricas.',
    stats: { orbitRadius: 58, orbitSpeed: 3.4, size: 14 },
    effects: [
      { kind: 'auto_fire', value: 18, interval: 0.5, radius: 500 },
      { kind: 'slow_aura', radius: 150, interval: 0.5 },
      { kind: 'stat_boost', key: 'damageMult', op: 'mult', value: 0.10, synergyTags: ['electric'] },
    ],
  },
  {
    id: 'pet_phoenix_chick', name: 'Polluelo Fénix', rarity: 'legendary', icon: '🔥', color: '#ff5500', cost: 1600,
    description: 'La cría de un fénix: regenera, incendia y fortalece.',
    ability: 'Regeneración fuerte, quemadura en área y +daño.',
    stats: { orbitRadius: 52, orbitSpeed: 2.8, size: 14 },
    effects: [
      { kind: 'regen', value: 2.5, interval: 1 },
      { kind: 'apply_status', key: 'fire', radius: 180, interval: 0.7, value: 10, synergyTags: ['fire'] },
      { kind: 'stat_boost', key: 'damageMult', op: 'mult', value: 0.10 },
    ],
  },
  {
    id: 'pet_quantum_core', name: 'Núcleo Cuántico', rarity: 'legendary', icon: '🌌', color: '#00f0ff', cost: 1700,
    description: 'Una singularidad domesticada que reescribe la suerte.',
    ability: '+XP, +Oro, +Botín y potencia builds experimentales.',
    stats: { orbitRadius: 56, orbitSpeed: 3.0, size: 14 },
    effects: [
      { kind: 'xp_boost', value: 0.25 },
      { kind: 'gold_boost', value: 0.25 },
      { kind: 'loot_luck', value: 0.25 },
      { kind: 'stat_boost', key: 'damageMult', op: 'mult', value: 0.08, synergyTags: ['experimental', 'void'] },
    ],
  },
];

export function getPet(id: string): PetDef | undefined {
  return PET_DEFS.find((p) => p.id === id);
}

/** Aggregate stat_boost effects into a compact modifier list for the engine. */
export function petStatBoosts(pet: PetDef): Array<{ key: string; op: 'add' | 'mult'; value: number; synergyTags?: string[] }> {
  return pet.effects
    .filter((e) => e.kind === 'stat_boost' && e.key)
    .map((e) => ({ key: e.key!, op: e.op ?? 'mult', value: e.value ?? 0, synergyTags: e.synergyTags }));
}
