

import { runRandom } from '../game/random';

/* ======================================================================
   biomes.ts — Data-driven Biomes System.
   ----------------------------------------------------------------------
   Defines the complete identity of each map:
   - Visual atmosphere (colors, floor type, wall style, particles)
   - Ambient particle effects
   - Director weighting influences (enemies, loot, events, bosses)
   ====================================================================== */

export type BiomeParticleType = 'spores' | 'embers' | 'sparks' | 'dust' | 'bubbles' | 'ash';
export type DecorStyle = 'urban' | 'lab' | 'nature' | 'volcano' | 'cyber' | 'ruins';

export interface BiomeTheme {
  primaryColor: string;     // grid/accent tone
  floorColor: string;       // base room asphalt/floor tone
  wallColor: string;        // room border stroke
  wallFillColor: string;    // obstacle blocks fill
  corridorColor: string;    // corridor floor tone
  ambientLight: string;     // canvas vignette tint / fog overlay
  minimapBg: string;        // minimap background tint
  minimapRoomColor: string; // default minimap room color
  particleColor: string;    // floating ambient particle color
  particleType: BiomeParticleType;
  particleDensity: number;
  decorStyle: DecorStyle;
}

export interface BiomeDef {
  id: string;
  name: string;
  description: string;
  icon: string;
  weight: number;
  minMap: number;
  maxMap: number;

  theme: BiomeTheme;

  /** Multiplier for enemy probabilities by tag or role (data-driven) */
  enemyTagWeights?: Record<string, number>;
  enemyRoleWeights?: Record<string, number>;

  /** Multiplier for weapon/equipment probabilities by tag/element */
  lootTagWeights?: Record<string, number>;
  lootElementWeights?: Record<string, number>;

  /** Multiplier for event probabilities by eventId */
  eventDefWeights?: Record<string, number>;

  /** Multiplier for boss selection probabilities by bossId */
  bossWeights?: Record<string, number>;
}

export const BIOMES: BiomeDef[] = [
  {
    id: 'biome_neon_city',
    name: 'Distrito Neón 2030',
    description: 'Calles húmedas iluminadas por letreros holográficos y lluvia de chispas.',
    icon: '🏙️',
    weight: 100,
    minMap: 1,
    maxMap: 10,
    theme: {
      primaryColor: 'rgba(0, 240, 255, 0.12)',
      floorColor: '#141722',
      wallColor: 'rgba(0, 200, 255, 0.45)',
      wallFillColor: '#1a1e2e',
      corridorColor: '#12161f',
      ambientLight: 'rgba(0, 200, 255, 0.04)',
      minimapBg: 'rgba(10, 12, 16, 0.92)',
      minimapRoomColor: 'rgba(57, 255, 136, 0.45)',
      particleColor: '#00f0ff',
      particleType: 'sparks',
      particleDensity: 24,
      decorStyle: 'cyber',
    },
    enemyTagWeights: { drone: 1.3, fast: 1.2, basic: 1.2 },
    enemyRoleWeights: { fodder: 1.2, assassin: 1.15 },
    lootTagWeights: { kinetic: 1.2, pistol: 1.2, smg: 1.2 },
    lootElementWeights: { electric: 1.2 },
    eventDefWeights: { merchant_bot: 1.3, mystery_roulette: 1.2 },
    bossWeights: { boss_dragon_2030: 1.2 },
  },
  {
    id: 'biome_synth_lab',
    name: 'Sector Sintético 7',
    description: 'Laboratorio de cibernética militar con paneles de plasma y servidores fríos.',
    icon: '🔬',
    weight: 80,
    minMap: 2,
    maxMap: 10,
    theme: {
      primaryColor: 'rgba(176, 77, 255, 0.12)',
      floorColor: '#101424',
      wallColor: 'rgba(176, 77, 255, 0.5)',
      wallFillColor: '#161b33',
      corridorColor: '#101322',
      ambientLight: 'rgba(176, 77, 255, 0.05)',
      minimapBg: 'rgba(12, 14, 24, 0.95)',
      minimapRoomColor: 'rgba(176, 77, 255, 0.5)',
      particleColor: '#b04dff',
      particleType: 'dust',
      particleDensity: 20,
      decorStyle: 'lab',
    },
    enemyTagWeights: { ranged: 1.3, plasma: 1.4, nanite: 1.3 },
    enemyRoleWeights: { ranged: 1.25, support: 1.3 },
    lootTagWeights: { energy: 1.35, precision: 1.25, electric: 1.3 },
    lootElementWeights: { electric: 1.35, radiant: 1.2 },
    eventDefWeights: { merchant_bot: 1.4, shrine_light: 1.3 },
    bossWeights: { boss_dragon_2030: 1.3 },
  },
  {
    id: 'biome_toxic_slum',
    name: 'Callejón Biotóxico',
    description: 'Pasajes inundados de lodo corrosivo y esporas mutantes.',
    icon: '☣️',
    weight: 75,
    minMap: 2,
    maxMap: 10,
    theme: {
      primaryColor: 'rgba(157, 255, 0, 0.10)',
      floorColor: '#111812',
      wallColor: 'rgba(157, 255, 0, 0.45)',
      wallFillColor: '#172218',
      corridorColor: '#0f170f',
      ambientLight: 'rgba(157, 255, 0, 0.05)',
      minimapBg: 'rgba(10, 16, 11, 0.95)',
      minimapRoomColor: 'rgba(157, 255, 0, 0.45)',
      particleColor: '#9dff00',
      particleType: 'spores',
      particleDensity: 30,
      decorStyle: 'nature',
    },
    enemyTagWeights: { bio: 1.5, toxic: 1.5, beast: 1.3 },
    enemyRoleWeights: { tank: 1.2, assassin: 1.2 },
    lootTagWeights: { bio: 1.5, toxic: 1.5, lifesteal: 1.3 },
    lootElementWeights: { toxic: 1.5, dark: 1.2 },
    eventDefWeights: { altar_sangre: 1.4, cursed_arena: 1.3 },
    bossWeights: { boss_cyber_kraken: 1.3 },
  },
  {
    id: 'biome_volcano_core',
    name: 'Forja Volcánica Urbana',
    description: 'Grietas de hormigón al rojo vivo y fundidoras industriales abandonadas.',
    icon: '🌋',
    weight: 70,
    minMap: 3,
    maxMap: 10,
    theme: {
      primaryColor: 'rgba(255, 85, 0, 0.12)',
      floorColor: '#1a1010',
      wallColor: 'rgba(255, 85, 0, 0.55)',
      wallFillColor: '#241414',
      corridorColor: '#160d0d',
      ambientLight: 'rgba(255, 85, 0, 0.06)',
      minimapBg: 'rgba(18, 10, 10, 0.95)',
      minimapRoomColor: 'rgba(255, 85, 0, 0.5)',
      particleColor: '#ff5500',
      particleType: 'embers',
      particleDensity: 35,
      decorStyle: 'volcano',
    },
    enemyTagWeights: { explosive: 1.5, heavy: 1.3, burst_enemy: 1.4 },
    enemyRoleWeights: { burst: 1.4, tank: 1.2 },
    lootTagWeights: { fire: 1.5, explosive: 1.4, launcher: 1.3 },
    lootElementWeights: { fire: 1.5, radiant: 1.3 },
    eventDefWeights: { challenge_time: 1.4, cursed_arena: 1.3 },
    bossWeights: { boss_dragon_2030: 1.5 },
  },
  {
    id: 'biome_flooded_sewer',
    name: 'Subsuelo Inundado',
    description: 'Túneles de drenaje profundo salpicados de agua negra y algas bioluminiscentes.',
    icon: '🌊',
    weight: 65,
    minMap: 3,
    maxMap: 10,
    theme: {
      primaryColor: 'rgba(0, 150, 255, 0.10)',
      floorColor: '#0e1620',
      wallColor: 'rgba(0, 180, 255, 0.45)',
      wallFillColor: '#122030',
      corridorColor: '#0b121c',
      ambientLight: 'rgba(0, 150, 255, 0.05)',
      minimapBg: 'rgba(8, 14, 20, 0.95)',
      minimapRoomColor: 'rgba(0, 200, 255, 0.45)',
      particleColor: '#00c8ff',
      particleType: 'bubbles',
      particleDensity: 22,
      decorStyle: 'urban',
    },
    enemyTagWeights: { void: 1.4, beast: 1.3, kraken: 1.5 },
    enemyRoleWeights: { assassin: 1.25, support: 1.2 },
    lootTagWeights: { void: 1.4, sonic: 1.3, ice: 1.3 },
    lootElementWeights: { ice: 1.4, dark: 1.3 },
    eventDefWeights: { mystery_roulette: 1.4, shrine_light: 1.2 },
    bossWeights: { boss_cyber_kraken: 1.6 },
  },
  {
    id: 'biome_ancient_ruins',
    name: 'Ruinas de Bronce 2030',
    description: 'Santuario subterráneo con columnas de bronce milenarias y tecnología arcaica.',
    icon: '🏛️',
    weight: 60,
    minMap: 4,
    maxMap: 10,
    theme: {
      primaryColor: 'rgba(255, 204, 0, 0.12)',
      floorColor: '#1c1710',
      wallColor: 'rgba(255, 204, 0, 0.50)',
      wallFillColor: '#282014',
      corridorColor: '#16120b',
      ambientLight: 'rgba(255, 204, 0, 0.05)',
      minimapBg: 'rgba(20, 16, 10, 0.95)',
      minimapRoomColor: 'rgba(255, 204, 0, 0.5)',
      particleColor: '#ffe14a',
      particleType: 'ash',
      particleDensity: 20,
      decorStyle: 'ruins',
    },
    enemyTagWeights: { shield: 1.5, tank: 1.4, golem: 1.5, frontline: 1.3 },
    enemyRoleWeights: { tank: 1.45 },
    lootTagWeights: { heavy: 1.35, precision: 1.3, shield: 1.4 },
    lootElementWeights: { radiant: 1.4 },
    eventDefWeights: { shrine_light: 1.5, altar_sangre: 1.3 },
    bossWeights: { boss_golem_prime: 1.6 },
  },
];

export function getBiome(id: string): BiomeDef {
  return BIOMES.find((b) => b.id === id) ?? BIOMES[0];
}

/** Picks a biome for the given map using weights and map range constraints. */
export function pickBiomeForMap(
  mapNumber: number,
  _totalMaps = 10,
  rng: () => number = () => runRandom.next('map'),
): BiomeDef {
  const eligible = BIOMES.filter((b) => mapNumber >= b.minMap && mapNumber <= b.maxMap);
  if (eligible.length === 0) return BIOMES[0];

  const total = eligible.reduce((sum, b) => sum + b.weight, 0);
  let r = rng() * total;
  for (const b of eligible) {
    r -= b.weight;
    if (r <= 0) return b;
  }
  return eligible[0];
}
