import type { Rarity } from './weapons';
import { runRandom } from '../game/random';

export type StatId =
  | 'maxHp'
  | 'armor'
  | 'speed'
  | 'critChance'
  | 'damageMult'
  | 'fireRateMult'
  | 'projectileSize'
  | 'pierce'
  | 'count'
  | 'bounce'
  | 'lifesteal'
  | 'dashCooldown'
  | 'shield'
  | 'explosionRadius';

export interface StatMod {
  stat: StatId;
  op: 'add' | 'mult';
  value: number;
}

export interface ItemDef {
  id: string;
  name: string;
  rarity: Rarity;
  icon: string;
  description: string;
  color: string;
  mods: StatMod[];
}

export const ITEMS: ItemDef[] = [
  // ===== COMMON =====
  {
    id: 'item_vital_amplifier', name: 'Amplificador Vital', rarity: 'common',
    icon: '❤️', description: '+25 HP máximos.', color: '#ff2a4b',
    mods: [{ stat: 'maxHp', op: 'add', value: 25 }],
  },
  {
    id: 'item_steel_plates', name: 'Placas de Acero', rarity: 'common',
    icon: '🛡️', description: '+2 Armadura.', color: '#0099ff',
    mods: [{ stat: 'armor', op: 'add', value: 2 }],
  },
  {
    id: 'item_power_cell', name: 'Celda de Potencia', rarity: 'common',
    icon: '🔋', description: '+10% Daño.', color: '#ff8800',
    mods: [{ stat: 'damageMult', op: 'mult', value: 0.1 }],
  },
  {
    id: 'item_sprint_servos', name: 'Servos de Carrera', rarity: 'common',
    icon: '👟', description: '+12% Velocidad.', color: '#39ff88',
    mods: [{ stat: 'speed', op: 'mult', value: 0.12 }],
  },

  // ===== UNCOMMON =====
  {
    id: 'item_hollow_points', name: 'Balas de Punta Hueca', rarity: 'uncommon',
    icon: '🔫', description: '+1 Perforación, +8% Daño.', color: '#ffe14a',
    mods: [{ stat: 'pierce', op: 'add', value: 1 }, { stat: 'damageMult', op: 'mult', value: 0.08 }],
  },
  {
    id: 'item_tactical_mag', name: 'Cargador Táctico', rarity: 'uncommon',
    icon: '📦', description: '+15% Cadencia de disparo.', color: '#00f0ff',
    mods: [{ stat: 'fireRateMult', op: 'mult', value: 0.15 }],
  },
  {
    id: 'item_phase_conduit', name: 'Conducto de Fase', rarity: 'uncommon',
    icon: '🌀', description: '+1 Rebote para proyectiles.', color: '#b04dff',
    mods: [{ stat: 'bounce', op: 'add', value: 1 }],
  },
  {
    id: 'item_energy_shield', name: 'Escudo de Energía', rarity: 'uncommon',
    icon: '🔮', description: '+1 Carga de escudo.', color: '#00f0ff',
    mods: [{ stat: 'shield', op: 'add', value: 1 }],
  },
  {
    id: 'item_quick_blade', name: 'Hoja Refleja', rarity: 'uncommon',
    icon: '🗡️', description: '+10% Crítico.', color: '#ff2bd6',
    mods: [{ stat: 'critChance', op: 'add', value: 0.1 }],
  },
  {
    id: 'item_toxic_filament', name: 'Filamento Tóxico', rarity: 'uncommon',
    icon: '☠️', description: '+5% Robo de vida.', color: '#9dff00',
    mods: [{ stat: 'lifesteal', op: 'add', value: 0.05 }],
  },

  // ===== RARE =====
  {
    id: 'item_blood_pact', name: 'Pacto de Sangre', rarity: 'rare',
    icon: '🩸', description: '+30 HP, +8% Robo de vida.', color: '#ff2a4b',
    mods: [{ stat: 'maxHp', op: 'add', value: 30 }, { stat: 'lifesteal', op: 'add', value: 0.08 }],
  },
  {
    id: 'item_overcharge_core', name: 'Núcleo de Sobrecarga', rarity: 'rare',
    icon: '⚡', description: '+20% Daño, -15% Cadencia.', color: '#ffe14a',
    mods: [{ stat: 'damageMult', op: 'mult', value: 0.2 }, { stat: 'fireRateMult', op: 'mult', value: -0.15 }],
  },
  {
    id: 'item_ricochet_chip', name: 'Chip de Rebote', rarity: 'rare',
    icon: '🔄', description: '+2 Rebotes.', color: '#b04dff',
    mods: [{ stat: 'bounce', op: 'add', value: 2 }],
  },
  {
    id: 'item_kinetic_amplifier', name: 'Amplificador Cinético', rarity: 'rare',
    icon: '💥', description: '+2 Perforación, tamaño proyecto +40%.', color: '#ff8800',
    mods: [{ stat: 'pierce', op: 'add', value: 2 }, { stat: 'projectileSize', op: 'mult', value: 0.4 }],
  },
  {
    id: 'item_titanium_mesh', name: 'Malla de Titanio', rarity: 'rare',
    icon: '🦾', description: '+3 Armadura, +15 HP.', color: '#94a3b8',
    mods: [{ stat: 'armor', op: 'add', value: 3 }, { stat: 'maxHp', op: 'add', value: 15 }],
  },
  {
    id: 'item_assassin_mark', name: 'Marca del Asesino', rarity: 'rare',
    icon: '🎯', description: '+18% Crítico, -10 HP.', color: '#ff2bd6',
    mods: [{ stat: 'critChance', op: 'add', value: 0.18 }, { stat: 'maxHp', op: 'add', value: -10 }],
  },

  // ===== EPIC =====
  {
    id: 'item_dragons_eye', name: 'Ojo de Dragón', rarity: 'epic',
    icon: '🐉', description: '+25% Daño, +25% Cadencia, -25 HP.', color: '#ff5500',
    mods: [
      { stat: 'damageMult', op: 'mult', value: 0.25 },
      { stat: 'fireRateMult', op: 'mult', value: 0.25 },
      { stat: 'maxHp', op: 'add', value: -25 },
    ],
  },
  {
    id: 'item_infinity_edge', name: 'Filo Infinito', rarity: 'epic',
    icon: '⚔️', description: '+3 Perforación, +2 Rebotes, +1 Proyectil.', color: '#00f0ff',
    mods: [
      { stat: 'pierce', op: 'add', value: 3 },
      { stat: 'bounce', op: 'add', value: 2 },
      { stat: 'count', op: 'add', value: 1 },
    ],
  },
  {
    id: 'item_void_heart', name: 'Corazón del Vacío', rarity: 'epic',
    icon: '🕳️', description: '+40 HP, +3 Armadura, +12% Robo.', color: '#b04dff',
    mods: [
      { stat: 'maxHp', op: 'add', value: 40 },
      { stat: 'armor', op: 'add', value: 3 },
      { stat: 'lifesteal', op: 'add', value: 0.12 },
    ],
  },
  {
    id: 'item_demolition_pack', name: 'Mochila de Demolición', rarity: 'epic',
    icon: '💣', description: '+40% tamaño proyecto, radio explosión +60, -10% cadencia.', color: '#ff3b5c',
    mods: [
      { stat: 'projectileSize', op: 'mult', value: 0.4 },
      { stat: 'explosionRadius', op: 'add', value: 60 },
      { stat: 'fireRateMult', op: 'mult', value: -0.1 },
    ],
  },
  {
    id: 'item_chrono_accel', name: 'Acelerador Crónico', rarity: 'epic',
    icon: '⏱️', description: '+35% Velocidad, dash cooldown -0.4s.', color: '#39ff88',
    mods: [
      { stat: 'speed', op: 'mult', value: 0.35 },
      { stat: 'dashCooldown', op: 'add', value: -0.4 },
    ],
  },

  // ===== LEGENDARY =====
  {
    id: 'item_godseed', name: 'Semilla Divina', rarity: 'legendary',
    icon: '🌟', description: '+40% Daño, +30% Cadencia, +50 HP, -2 Armadura.', color: '#ffe14a',
    mods: [
      { stat: 'damageMult', op: 'mult', value: 0.4 },
      { stat: 'fireRateMult', op: 'mult', value: 0.3 },
      { stat: 'maxHp', op: 'add', value: 50 },
      { stat: 'armor', op: 'add', value: -2 },
    ],
  },
  {
    id: 'item_apocalypse_ring', name: 'Anillo del Apocalipsis', rarity: 'legendary',
    icon: '💍', description: 'Todos los proyectiles explotan (r120), -20% cadencia.', color: '#ff2a4b',
    mods: [
      { stat: 'explosionRadius', op: 'add', value: 120 },
      { stat: 'fireRateMult', op: 'mult', value: -0.2 },
    ],
  },
  {
    id: 'item_eternal_ward', name: 'Guarda Eterna', rarity: 'legendary',
    icon: '🛡️', description: '+6 Armadura, +3 Escudos, +50 HP, -20% Daño.', color: '#0099ff',
    mods: [
      { stat: 'armor', op: 'add', value: 6 },
      { stat: 'shield', op: 'add', value: 3 },
      { stat: 'maxHp', op: 'add', value: 50 },
      { stat: 'damageMult', op: 'mult', value: -0.2 },
    ],
  },
  {
    id: 'item_berserker_soul', name: 'Alma del Berserker', rarity: 'legendary',
    icon: '🔥', description: '+50% Daño, +3 Proyectiles, -60 HP.', color: '#ff5500',
    mods: [
      { stat: 'damageMult', op: 'mult', value: 0.5 },
      { stat: 'count', op: 'add', value: 3 },
      { stat: 'maxHp', op: 'add', value: -60 },
    ],
  },
];

export function getItem(id: string): ItemDef {
  return ITEMS.find((it) => it.id === id) ?? ITEMS[0];
}

const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 50,
  uncommon: 35,
  rare: 25,
  epic: 12,
  legendary: 4,
};

export function pickRandomItem(highTier: boolean): ItemDef {
  const pool = ITEMS.filter((it) => {
    if (highTier) return it.rarity === 'epic' || it.rarity === 'legendary' || it.rarity === 'rare';
    return true;
  });
  const weighted = pool.flatMap((it) => Array(RARITY_WEIGHTS[it.rarity]).fill(it));
  return weighted[runRandom.int('loot', weighted.length)] ?? ITEMS[0];
}
