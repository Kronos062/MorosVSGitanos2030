import type { Rarity } from './weapons';
import { runRandom } from '../game/random';

export type EquipSlot = 'helm' | 'chest' | 'pants' | 'boots';

export interface StatMod {
  stat: string;
  op: 'add' | 'mult';
  value: number;
}

export interface EquipmentDef {
  id: string;
  name: string;
  rarity: Rarity;
  slot: EquipSlot;
  icon: string;
  description: string;
  color: string;
  mods: StatMod[];
  setId?: string;
}

/* ================================================================== */
/*  QUALITY — armour pieces scale with quality, like weapons          */
/* ================================================================== */

export interface ArmorQualityDef {
  rarity: Rarity;
  label: string;
  /** Multiplier applied to every numeric stat on the base piece. */
  statMult: number;
  dropWeight: number;
  color: string;
}

export const ARMOR_QUALITIES: ArmorQualityDef[] = [
  { rarity: 'common',    label: 'Común',      statMult: 1.00, dropWeight: 60, color: '#94a3b8' },
  { rarity: 'uncommon',  label: 'Poco Común', statMult: 1.15, dropWeight: 25, color: '#39ff88' },
  { rarity: 'rare',      label: 'Rara',       statMult: 1.30, dropWeight: 10, color: '#00c8ff' },
  { rarity: 'epic',      label: 'Épica',      statMult: 1.55, dropWeight: 4,  color: '#b04dff' },
  { rarity: 'legendary', label: 'Legendaria', statMult: 1.85, dropWeight: 1,  color: '#ffe14a' },
];

export function getArmorQuality(rarity: Rarity): ArmorQualityDef {
  return ARMOR_QUALITIES.find((q) => q.rarity === rarity) ?? ARMOR_QUALITIES[0];
}

/* ================================================================== */
/*  SET DEFINITIONS — one data entry per set, 4 slots each            */
/* ================================================================== */

export interface SetPieceTemplate {
  namePrefix: string; // e.g. "Casco del Berserker"
  icon: string;
  mods: StatMod[];
  description: string;
}

/** Weapon synergy: sets can amplify weapons that match a tag or affix. */
export interface WeaponSynergyDef {
  /** Weapon tags that trigger the synergy (any match). */
  weaponTags?: string[];
  /** Weapon affix ids that triggers the synergy (any match). */
  affixIds?: string[];
  /** Elemental affix element that triggers the synergy. */
  element?: string;
  /** Extra damage multiplier applied when a matching weapon is held. */
  damageMult?: number;
  /** Human-readable synergy description. */
  description: string;
}

/** Counter-synergy: a soft penalty when the set meets an incompatible build.
 *  Never prohibitive — just reduced efficiency, described as data. */
export interface CounterSynergyDef {
  /** Weapon tags that conflict with this set. */
  weaponTags?: string[];
  /** Weapon affix ids that conflict. */
  affixIds?: string[];
  /** Element that conflicts. */
  element?: string;
  /** Penalty multiplier applied to damage when conflict detected (0..1). */
  damageMult?: number;
  /** Human-readable conflict description. */
  description: string;
}

export interface SetBonusTier {
  pieces: number;
  description: string;
  mods: StatMod[];
  special?: string;
}

export interface SetDef {
  setId: string;
  name: string;
  color: string;
  identity: string;
  pieces: Record<EquipSlot, SetPieceTemplate>;
  bonuses: SetBonusTier[];
  synergy?: WeaponSynergyDef;
  /** Short description of the playstyle this set promotes. */
  playstyle: string;
  /** Tags describing what this set is good at (displayed in UI). */
  strengths: string[];
  /** Tags describing what this set sacrifices (displayed in UI). */
  weaknesses: string[];
  /** Soft conflict definition (data-driven). */
  counterSynergy?: CounterSynergyDef;
}

/* Helper to compactly declare a set's four pieces. */
type SlotMods = { helm: StatMod[]; chest: StatMod[]; pants: StatMod[]; boots: StatMod[] };
type SlotIcons = { helm: string; chest: string; pants: string; boots: string };

const DEFAULT_ICONS: SlotIcons = { helm: '🪖', chest: '🛡️', pants: '👖', boots: '👢' };

function makePieces(
  setName: string,
  slotMods: SlotMods,
  slotDesc: Record<EquipSlot, string>,
  icons: SlotIcons = DEFAULT_ICONS,
): Record<EquipSlot, SetPieceTemplate> {
  return {
    helm:  { namePrefix: `Casco ${setName}`,      icon: icons.helm,  mods: slotMods.helm,  description: slotDesc.helm },
    chest: { namePrefix: `Pechera ${setName}`,    icon: icons.chest, mods: slotMods.chest, description: slotDesc.chest },
    pants: { namePrefix: `Grebas ${setName}`,     icon: icons.pants, mods: slotMods.pants, description: slotDesc.pants },
    boots: { namePrefix: `Botas ${setName}`,      icon: icons.boots, mods: slotMods.boots, description: slotDesc.boots },
  };
}

export const SET_DEFS: SetDef[] = [
  /* 1. BERSERKER — daño masivo, poca supervivencia */
  {
    setId: 'set_berserker', name: 'Berserker', color: '#ff5500', identity: 'Daño extremo, fragilidad.',
    playstyle: 'Golpea fuerte y rápido. Sobrevive con velocidad y asesinatos, no con defensa.',
    strengths: ['daño', 'velocidad', 'cadencia', 'crítico'],
    weaknesses: ['defensa', 'escudo', 'armadura', 'regeneración'],
    pieces: makePieces('del Berserker',
      { helm: [{ stat: 'critChance', op: 'add', value: 0.06 }, { stat: 'maxHp', op: 'add', value: -10 }],
        chest: [{ stat: 'damageMult', op: 'mult', value: 0.10 }],
        pants: [{ stat: 'speed', op: 'mult', value: 0.10 }],
        boots: [{ stat: 'fireRateMult', op: 'mult', value: 0.08 }] },
      { helm: '+Crítico a costa de vida.', chest: '+Daño puro.', pants: '+Velocidad.', boots: '+Cadencia.' },
      { helm: '👹', chest: '🩸', pants: '🦵', boots: '👣' }),
    bonuses: [
      { pieces: 2, description: '+15% Daño', mods: [{ stat: 'damageMult', op: 'mult', value: 0.15 }] },
      { pieces: 3, description: '+20% Velocidad', mods: [{ stat: 'speed', op: 'mult', value: 0.20 }] },
      { pieces: 4, description: 'Furia: +40% daño, -20% cadencia', special: 'permaFury', mods: [{ stat: 'damageMult', op: 'mult', value: 0.40 }, { stat: 'fireRateMult', op: 'mult', value: -0.20 }] },
    ],
    synergy: { weaponTags: ['melee'], damageMult: 0.30, description: 'Potencia armas cuerpo a cuerpo (+30% daño).' },
  },

  /* 2. FRANCOTIRADOR — precisión, crítico, alcance */
  {
    setId: 'set_sniper', name: 'Francotirador', color: '#00c8ff', identity: 'Precisión y crítico letal.',
    playstyle: 'Disparos precisos de alto impacto. Poca cadencia y movilidad a cambio de letalidad.',
    strengths: ['crítico', 'precisión', 'penetración', 'daño'],
    weaknesses: ['cadencia', 'movilidad', 'proyectiles', 'rebotes'],
    counterSynergy: { weaponTags: ['spread', 'shotgun'], damageMult: 0.75, description: 'Armas de dispersión pierden eficiencia con precisión extrema.' },
    pieces: makePieces('del Francotirador',
      { helm: [{ stat: 'critChance', op: 'add', value: 0.10 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 18 }],
        pants: [{ stat: 'projectileSize', op: 'add', value: 1 }],
        boots: [{ stat: 'speed', op: 'mult', value: 0.06 }] },
      { helm: '+Crítico.', chest: '+Vida.', pants: '+Tamaño de proyectil.', boots: '+Movilidad.' },
      { helm: '🎯', chest: '🦺', pants: '📏', boots: '👟' }),
    bonuses: [
      { pieces: 2, description: '+12% Crítico', mods: [{ stat: 'critChance', op: 'add', value: 0.12 }] },
      { pieces: 3, description: '+2 Perforación', mods: [{ stat: 'pierce', op: 'add', value: 2 }] },
      { pieces: 4, description: 'Ojo de halcón: críticos ×3, +20% daño', special: 'lethalStrike', mods: [{ stat: 'damageMult', op: 'mult', value: 0.20 }, { stat: 'critChance', op: 'add', value: 0.10 }] },
    ],
    synergy: { weaponTags: ['sniper', 'precision'], damageMult: 0.30, description: 'Potencia rifles de precisión (+30% daño).' },
  },

  /* 3. ASESINO — crítico, sigilo, velocidad */
  {
    setId: 'set_asesino', name: 'Asesino', color: '#ff2bd6', identity: 'Golpes críticos y agilidad.',
    playstyle: 'Críticos devastadores y velocidad de movimiento. Frágil a cambio de letalidad.',
    strengths: ['crítico', 'movilidad', 'velocidad', 'esquiva'],
    weaknesses: ['vida', 'escudo', 'armadura'],
    pieces: makePieces('del Asesino',
      { helm: [{ stat: 'critChance', op: 'add', value: 0.08 }],
        chest: [{ stat: 'lifesteal', op: 'add', value: 0.04 }],
        pants: [{ stat: 'speed', op: 'mult', value: 0.12 }],
        boots: [{ stat: 'dashCooldown', op: 'add', value: -0.2 }] },
      { helm: '+Crítico.', chest: '+Robo de vida.', pants: '+Velocidad.', boots: '-Enfriamiento dash.' },
      { helm: '🥷', chest: '🖤', pants: '🦿', boots: '👟' }),
    bonuses: [
      { pieces: 2, description: '+15% Crítico', mods: [{ stat: 'critChance', op: 'add', value: 0.15 }] },
      { pieces: 3, description: '+2 Perforación, +10% velocidad', mods: [{ stat: 'pierce', op: 'add', value: 2 }, { stat: 'speed', op: 'mult', value: 0.10 }] },
      { pieces: 4, description: 'Marca mortal: críticos ×3', special: 'lethalStrike', mods: [] },
    ],
    synergy: { weaponTags: ['fast', 'smg'], damageMult: 0.20, description: 'Potencia armas rápidas y SMG (+20%).' },
  },

  /* 4. TANQUE — vida, armadura, reducción */
  {
    setId: 'set_tank', name: 'Tanque', color: '#0099ff', identity: 'Supervivencia inquebrantable.',
    playstyle: 'Muralla viviente. Aguanta todo a cambio de daño y velocidad.',
    strengths: ['vida', 'armadura', 'escudo', 'regeneración'],
    weaknesses: ['daño', 'velocidad', 'cadencia', 'movilidad'],
    counterSynergy: { weaponTags: ['fast', 'smg'], damageMult: 0.80, description: 'Armas rápidas no se benefician del estilo pesado del tanque.' },
    pieces: makePieces('del Tanque',
      { helm: [{ stat: 'armor', op: 'add', value: 2 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 40 }],
        pants: [{ stat: 'maxHp', op: 'add', value: 25 }, { stat: 'speed', op: 'mult', value: -0.05 }],
        boots: [{ stat: 'armor', op: 'add', value: 2 }] },
      { helm: '+Armadura.', chest: '+Vida.', pants: '+Vida robusta.', boots: '+Armadura.' },
      { helm: '⛑️', chest: '🛡️', pants: '🦿', boots: '🥾' }),
    bonuses: [
      { pieces: 2, description: '+30 HP, +2 Armadura', mods: [{ stat: 'maxHp', op: 'add', value: 30 }, { stat: 'armor', op: 'add', value: 2 }] },
      { pieces: 3, description: '+2 Escudos', mods: [{ stat: 'shield', op: 'add', value: 2 }] },
      { pieces: 4, description: 'Fortaleza: +6 armadura, +60 HP, +2 escudos', special: 'formation', mods: [{ stat: 'armor', op: 'add', value: 6 }, { stat: 'maxHp', op: 'add', value: 60 }, { stat: 'shield', op: 'add', value: 2 }] },
    ],
    synergy: { weaponTags: ['heavy', 'shotgun'], damageMult: 0.15, description: 'Potencia armas pesadas y escopetas (+15%).' },
  },

  /* 5. VAMPIRO — robo de vida, regeneración */
  {
    setId: 'set_vampiro', name: 'Vampiro', color: '#ff3b5c', identity: 'Vive de la sangre enemiga.',
    playstyle: 'Sostenido por robo de vida. Menos daño bruto, más supervivencia pasiva.',
    strengths: ['robo de vida', 'regeneración', 'supervivencia'],
    weaknesses: ['daño bruto', 'cadencia', 'escudo'],
    counterSynergy: { element: 'ice', damageMult: 0.80, description: 'El hielo reduce la eficiencia de la curación por contacto.' },
    pieces: makePieces('del Vampiro',
      { helm: [{ stat: 'lifesteal', op: 'add', value: 0.05 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 25 }, { stat: 'lifesteal', op: 'add', value: 0.04 }],
        pants: [{ stat: 'lifesteal', op: 'add', value: 0.04 }],
        boots: [{ stat: 'speed', op: 'mult', value: 0.08 }] },
      { helm: '+Robo de vida.', chest: '+Vida y robo.', pants: '+Robo de vida.', boots: '+Velocidad.' },
      { helm: '🧛', chest: '🩸', pants: '🦇', boots: '👢' }),
    bonuses: [
      { pieces: 2, description: '+10% Robo de vida', mods: [{ stat: 'lifesteal', op: 'add', value: 0.10 }] },
      { pieces: 3, description: '+20% Robo de vida', mods: [{ stat: 'lifesteal', op: 'add', value: 0.20 }] },
      { pieces: 4, description: 'Sed de sangre: bajas curan y dan daño temporal', special: 'bloodlust', mods: [{ stat: 'lifesteal', op: 'add', value: 0.10 }, { stat: 'damageMult', op: 'mult', value: 0.15 }] },
    ],
    synergy: { affixIds: ['vampiric', 'dark'], damageMult: 0.20, description: 'Potencia armas Vampíricas y Oscuras (+20%).' },
  },

  /* 6. INGENIERO — proyectiles extra, explosiones */
  {
    setId: 'set_ingeniero', name: 'Ingeniero', color: '#ffe14a', identity: 'Fuego de saturación y artefactos.',
    playstyle: 'Muchos proyectiles y explosiones. Daño de área sobre daño directo.',
    strengths: ['proyectiles', 'explosiones', 'área'],
    weaknesses: ['precisión', 'crítico', 'penetración'],
    counterSynergy: { weaponTags: ['precision', 'sniper'], damageMult: 0.70, description: 'La saturación es ineficiente con armas de precisión.' },
    pieces: makePieces('del Ingeniero',
      { helm: [{ stat: 'explosionRadius', op: 'add', value: 15 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 20 }],
        pants: [{ stat: 'count', op: 'add', value: 1 }],
        boots: [{ stat: 'fireRateMult', op: 'mult', value: 0.06 }] },
      { helm: '+Radio de explosión.', chest: '+Vida.', pants: '+1 Proyectil.', boots: '+Cadencia.' },
      { helm: '🔧', chest: '🦺', pants: '⚙️', boots: '🥾' }),
    bonuses: [
      { pieces: 2, description: '+1 Proyectil', mods: [{ stat: 'count', op: 'add', value: 1 }] },
      { pieces: 3, description: '+40 Radio de explosión', mods: [{ stat: 'explosionRadius', op: 'add', value: 40 }] },
      { pieces: 4, description: 'Sobrecarga: +2 proyectos, +60 radio', special: 'overclock', mods: [{ stat: 'count', op: 'add', value: 2 }, { stat: 'explosionRadius', op: 'add', value: 60 }] },
    ],
    synergy: { weaponTags: ['explosive', 'launcher'], damageMult: 0.25, description: 'Potencia explosivos y lanzadores (+25%).' },
  },

  /* 7. PIRÓMANO — fuego, quemadura */
  {
    setId: 'set_piromano', name: 'Pirómano', color: '#ff6a00', identity: 'Todo arde a tu paso.',
    playstyle: 'Quemaduras y explosiones masivas. Pierde control y precisión.',
    strengths: ['fuego', 'explosiones', 'área', 'daño'],
    weaknesses: ['precisión', 'control', 'escudo', 'regeneración'],
    counterSynergy: { element: 'ice', damageMult: 0.70, description: 'El fuego pierde eficiencia con builds de hielo (anti-sinergia elemental).' },
    pieces: makePieces('del Pirómano',
      { helm: [{ stat: 'damageMult', op: 'mult', value: 0.06 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 18 }],
        pants: [{ stat: 'explosionRadius', op: 'add', value: 12 }],
        boots: [{ stat: 'fireRateMult', op: 'mult', value: 0.06 }] },
      { helm: '+Daño.', chest: '+Vida.', pants: '+Radio de explosión.', boots: '+Cadencia.' },
      { helm: '🔥', chest: '🧯', pants: '🌋', boots: '👢' }),
    bonuses: [
      { pieces: 2, description: '+12% Daño', mods: [{ stat: 'damageMult', op: 'mult', value: 0.12 }] },
      { pieces: 3, description: '+30 Radio de explosión', mods: [{ stat: 'explosionRadius', op: 'add', value: 30 }] },
      { pieces: 4, description: 'Infierno: +25% daño, +50 radio', special: 'inferno', mods: [{ stat: 'damageMult', op: 'mult', value: 0.25 }, { stat: 'explosionRadius', op: 'add', value: 50 }] },
    ],
    synergy: { element: 'fire', affixIds: ['igneous'], weaponTags: ['fire'], damageMult: 0.30, description: 'Potencia armas Ígneas y de fuego (+30%).' },
  },

  /* 8. CRIOMANTE — hielo, control */
  {
    setId: 'set_criomante', name: 'Criomante', color: '#6ef0ff', identity: 'Congela y controla la horda.',
    playstyle: 'Control masivo y ralentizaciones. Daño base más bajo, control más alto.',
    strengths: ['hielo', 'control', 'ralentización', 'penetración'],
    weaknesses: ['daño bruto', 'explosiones', 'fuego'],
    counterSynergy: { element: 'fire', damageMult: 0.70, description: 'El control se pierde con builds de fuego (anti-sinergia elemental).' },
    pieces: makePieces('del Criomante',
      { helm: [{ stat: 'critChance', op: 'add', value: 0.05 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 22 }],
        pants: [{ stat: 'pierce', op: 'add', value: 1 }],
        boots: [{ stat: 'speed', op: 'mult', value: 0.08 }] },
      { helm: '+Crítico.', chest: '+Vida.', pants: '+Perforación.', boots: '+Velocidad.' },
      { helm: '❄️', chest: '🧊', pants: '🌨️', boots: '👢' }),
    bonuses: [
      { pieces: 2, description: '+10% Daño', mods: [{ stat: 'damageMult', op: 'mult', value: 0.10 }] },
      { pieces: 3, description: '+2 Perforación', mods: [{ stat: 'pierce', op: 'add', value: 2 }] },
      { pieces: 4, description: 'Cero absoluto: +20% daño, +2 perf', special: 'absoluteZero', mods: [{ stat: 'damageMult', op: 'mult', value: 0.20 }, { stat: 'pierce', op: 'add', value: 2 }] },
    ],
    synergy: { element: 'ice', affixIds: ['glacial'], weaponTags: ['ice'], damageMult: 0.30, description: 'Potencia armas Glaciales y de hielo (+30%).' },
  },

  /* 9. ELECTRICISTA — cadenas de rayos, rebotes */
  {
    setId: 'set_electricista', name: 'Electricista', color: '#6ef0ff', identity: 'Rayos que saltan entre enemigos.',
    playstyle: 'Cadenas eléctricas y rebotes. Menos explosiones, más control de masas.',
    strengths: ['electricidad', 'rebotes', 'cadena', 'área'],
    weaknesses: ['explosiones', 'fuego', 'precisión'],
    counterSynergy: { weaponTags: ['explosive'], damageMult: 0.75, description: 'Las explosiones interrumpen las cadenas eléctricas.' },
    pieces: makePieces('del Electricista',
      { helm: [{ stat: 'fireRateMult', op: 'mult', value: 0.06 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 18 }],
        pants: [{ stat: 'bounce', op: 'add', value: 1 }],
        boots: [{ stat: 'speed', op: 'mult', value: 0.08 }] },
      { helm: '+Cadencia.', chest: '+Vida.', pants: '+1 Rebote.', boots: '+Velocidad.' },
      { helm: '⚡', chest: '🔌', pants: '🌩️', boots: '👢' }),
    bonuses: [
      { pieces: 2, description: '+12% Daño eléctrico', mods: [{ stat: 'damageMult', op: 'mult', value: 0.12 }] },
      { pieces: 3, description: '+2 Rebotes', mods: [{ stat: 'bounce', op: 'add', value: 2 }] },
      { pieces: 4, description: 'Tormenta: +20% daño, +3 rebotes', special: 'stormcaller', mods: [{ stat: 'damageMult', op: 'mult', value: 0.20 }, { stat: 'bounce', op: 'add', value: 3 }] },
    ],
    synergy: { element: 'electric', affixIds: ['electric'], weaponTags: ['electric', 'chain'], damageMult: 0.30, description: 'Potencia armas Eléctricas (+30%).' },
  },

  /* 10. TOXICÓLOGO — veneno */
  {
    setId: 'set_toxicologo', name: 'Toxicólogo', color: '#9dff00', identity: 'Veneno persistente.',
    playstyle: 'Daño en el tiempo con veneno. Lento pero letal a largo plazo.',
    strengths: ['veneno', 'persistente', 'robo de vida'],
    weaknesses: ['instantáneo', 'explosiones', 'cadencia'],
    counterSynergy: { weaponTags: ['spread', 'shotgun'], damageMult: 0.80, description: 'La dispersión diluye el veneno concentrado.' },
    pieces: makePieces('del Toxicólogo',
      { helm: [{ stat: 'lifesteal', op: 'add', value: 0.03 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 20 }],
        pants: [{ stat: 'pierce', op: 'add', value: 1 }],
        boots: [{ stat: 'fireRateMult', op: 'mult', value: 0.06 }] },
      { helm: '+Robo de vida.', chest: '+Vida.', pants: '+Perforación.', boots: '+Cadencia.' },
      { helm: '☠️', chest: '🧪', pants: '🧫', boots: '👢' }),
    bonuses: [
      { pieces: 2, description: '+10% Daño', mods: [{ stat: 'damageMult', op: 'mult', value: 0.10 }] },
      { pieces: 3, description: '+8% Robo de vida', mods: [{ stat: 'lifesteal', op: 'add', value: 0.08 }] },
      { pieces: 4, description: 'Plaga: +20% daño, +12% robo', special: 'plague', mods: [{ stat: 'damageMult', op: 'mult', value: 0.20 }, { stat: 'lifesteal', op: 'add', value: 0.12 }] },
    ],
    synergy: { element: 'toxic', affixIds: ['toxic'], weaponTags: ['bio', 'toxic'], damageMult: 0.30, description: 'Potencia armas Tóxicas (+30%).' },
  },

  /* 11. EXPLORADOR — movilidad extrema */
  {
    setId: 'set_explorador', name: 'Explorador', color: '#39ff88', identity: 'Movilidad y esquiva.',
    playstyle: 'Velocidad pura. Esquiva todo, pero frágil y poco daño directo.',
    strengths: ['velocidad', 'movilidad', 'esquiva', 'dash'],
    weaknesses: ['daño', 'defensa', 'vida'],
    pieces: makePieces('del Explorador',
      { helm: [{ stat: 'critChance', op: 'add', value: 0.05 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 15 }],
        pants: [{ stat: 'speed', op: 'mult', value: 0.14 }],
        boots: [{ stat: 'dashCooldown', op: 'add', value: -0.3 }] },
      { helm: '+Crítico.', chest: '+Vida.', pants: '+Velocidad.', boots: '-Enfriamiento dash.' },
      { helm: '🎩', chest: '🎒', pants: '🩳', boots: '👟' }),
    bonuses: [
      { pieces: 2, description: '+25% Velocidad', mods: [{ stat: 'speed', op: 'mult', value: 0.25 }] },
      { pieces: 3, description: 'Dash -0.5s', mods: [{ stat: 'dashCooldown', op: 'add', value: -0.5 }] },
      { pieces: 4, description: 'Zancada: +40% vel, +2 rebotes', special: 'stride', mods: [{ stat: 'speed', op: 'mult', value: 0.40 }, { stat: 'bounce', op: 'add', value: 2 }] },
    ],
    synergy: { weaponTags: ['pistol', 'fast'], damageMult: 0.15, description: 'Potencia pistolas y armas rápidas (+15%).' },
  },

  /* 12. ARTILLERO — cadencia, ametralladoras */
  {
    setId: 'set_artillero', name: 'Artillero', color: '#ff8800', identity: 'Lluvia de balas.',
    playstyle: 'Volumen de fuego brutal. Mucha cadencia, poco control.',
    strengths: ['cadencia', 'proyectiles', 'saturación'],
    weaknesses: ['daño unitario', 'precisión', 'movilidad', 'crítico'],
    pieces: makePieces('del Artillero',
      { helm: [{ stat: 'fireRateMult', op: 'mult', value: 0.08 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 22 }],
        pants: [{ stat: 'fireRateMult', op: 'mult', value: 0.06 }],
        boots: [{ stat: 'speed', op: 'mult', value: -0.04 }, { stat: 'armor', op: 'add', value: 1 }] },
      { helm: '+Cadencia.', chest: '+Vida.', pants: '+Cadencia.', boots: '+Armadura.' },
      { helm: '🎖️', chest: '🦺', pants: '🔩', boots: '🥾' }),
    bonuses: [
      { pieces: 2, description: '+15% Cadencia', mods: [{ stat: 'fireRateMult', op: 'mult', value: 0.15 }] },
      { pieces: 3, description: '+1 Proyectil', mods: [{ stat: 'count', op: 'add', value: 1 }] },
      { pieces: 4, description: 'Barrera de fuego: +30% cadencia, +1 proy', special: 'suppressiveFire', mods: [{ stat: 'fireRateMult', op: 'mult', value: 0.30 }, { stat: 'count', op: 'add', value: 1 }] },
    ],
    synergy: { weaponTags: ['lmg', 'rapid'], damageMult: 0.25, description: 'Potencia ametralladoras (+25%).' },
  },

  /* 13. COMANDO — equilibrio ofensivo */
  {
    setId: 'set_comando', name: 'Comando', color: '#39ff88', identity: 'Versatilidad de combate.',
    playstyle: 'Equilibrado en todo. No sobresale en nada, pero tampoco falla.',
    strengths: ['versatilidad', 'equilibrio'],
    weaknesses: [],
    pieces: makePieces('del Comando',
      { helm: [{ stat: 'critChance', op: 'add', value: 0.05 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 25 }],
        pants: [{ stat: 'damageMult', op: 'mult', value: 0.06 }],
        boots: [{ stat: 'speed', op: 'mult', value: 0.08 }] },
      { helm: '+Crítico.', chest: '+Vida.', pants: '+Daño.', boots: '+Velocidad.' },
      { helm: '🪖', chest: '🎽', pants: '🪢', boots: '🥾' }),
    bonuses: [
      { pieces: 2, description: '+10% Daño, +10% Cadencia', mods: [{ stat: 'damageMult', op: 'mult', value: 0.10 }, { stat: 'fireRateMult', op: 'mult', value: 0.10 }] },
      { pieces: 3, description: '+1 Perforación, +20 HP', mods: [{ stat: 'pierce', op: 'add', value: 1 }, { stat: 'maxHp', op: 'add', value: 20 }] },
      { pieces: 4, description: 'Operación total: +20% daño, +1 proy', special: 'fullOp', mods: [{ stat: 'damageMult', op: 'mult', value: 0.20 }, { stat: 'count', op: 'add', value: 1 }] },
    ],
    synergy: { weaponTags: ['ar', 'balanced'], damageMult: 0.20, description: 'Potencia fusiles de asalto (+20%).' },
  },

  /* 14. FANÁTICO — glass cannon extremo */
  {
    setId: 'set_fanatico', name: 'Fanático', color: '#ff2bd6', identity: 'Todo por el daño.',
    playstyle: 'Glass cannon absoluto. Daño extremo a cambio de supervivencia.',
    strengths: ['daño', 'crítico', 'cadencia'],
    weaknesses: ['vida', 'defensa', 'escudo', 'regeneración'],
    pieces: makePieces('del Fanático',
      { helm: [{ stat: 'damageMult', op: 'mult', value: 0.08 }, { stat: 'maxHp', op: 'add', value: -8 }],
        chest: [{ stat: 'damageMult', op: 'mult', value: 0.08 }],
        pants: [{ stat: 'fireRateMult', op: 'mult', value: 0.08 }],
        boots: [{ stat: 'critChance', op: 'add', value: 0.05 }] },
      { helm: '+Daño (menos vida).', chest: '+Daño.', pants: '+Cadencia.', boots: '+Crítico.' },
      { helm: '👿', chest: '🕯️', pants: '📿', boots: '👢' }),
    bonuses: [
      { pieces: 2, description: '+20% Daño', mods: [{ stat: 'damageMult', op: 'mult', value: 0.20 }] },
      { pieces: 3, description: '+15% Crítico', mods: [{ stat: 'critChance', op: 'add', value: 0.15 }] },
      { pieces: 4, description: 'Éxtasis: +40% daño, -30 HP', special: 'zealotry', mods: [{ stat: 'damageMult', op: 'mult', value: 0.40 }, { stat: 'maxHp', op: 'add', value: -30 }] },
    ],
    synergy: { affixIds: ['unstable', 'devastating'], damageMult: 0.25, description: 'Potencia afijos Inestable y Devastadora (+25%).' },
  },

  /* 15. MERCENARIO — proyectiles múltiples */
  {
    setId: 'set_mercenario', name: 'Mercenario', color: '#ff8800', identity: 'Cantidad sobre calidad.',
    playstyle: 'Saturación por cantidad. Muchos proyectiles, poco daño individual.',
    strengths: ['proyectiles', 'cadencia', 'saturación'],
    weaknesses: ['daño unitario', 'precisión', 'crítico'],
    pieces: makePieces('del Mercenario',
      { helm: [{ stat: 'critChance', op: 'add', value: 0.05 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 20 }],
        pants: [{ stat: 'count', op: 'add', value: 1 }],
        boots: [{ stat: 'fireRateMult', op: 'mult', value: 0.06 }] },
      { helm: '+Crítico.', chest: '+Vida.', pants: '+1 Proyectil.', boots: '+Cadencia.' },
      { helm: '🎩', chest: '🎽', pants: '💰', boots: '🥾' }),
    bonuses: [
      { pieces: 2, description: '+1 Proyectil', mods: [{ stat: 'count', op: 'add', value: 1 }] },
      { pieces: 3, description: '+10% Daño, +10% Cadencia', mods: [{ stat: 'damageMult', op: 'mult', value: 0.10 }, { stat: 'fireRateMult', op: 'mult', value: 0.10 }] },
      { pieces: 4, description: 'Contrato: +2 proyectos, +20% daño', special: 'sealedContract', mods: [{ stat: 'count', op: 'add', value: 2 }, { stat: 'damageMult', op: 'mult', value: 0.20 }] },
    ],
    synergy: { weaponTags: ['spread', 'shotgun'], damageMult: 0.20, description: 'Potencia armas de dispersión (+20%).' },
  },

  /* 16. MÉDICO — sustain, escudos */
  {
    setId: 'set_medico', name: 'Médico', color: '#39ff88', identity: 'Sustain y resistencia.',
    playstyle: 'Supervivencia máxima. Sobrevive todo pero mata lento.',
    strengths: ['regeneración', 'escudo', 'vida', 'robo de vida'],
    weaknesses: ['daño', 'cadencia', 'velocidad'],
    counterSynergy: { weaponTags: ['fast', 'smg'], damageMult: 0.80, description: 'La cadencia del soporte no explota armas rápidas.' },
    pieces: makePieces('del Médico',
      { helm: [{ stat: 'lifesteal', op: 'add', value: 0.04 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 35 }],
        pants: [{ stat: 'shield', op: 'add', value: 1 }],
        boots: [{ stat: 'speed', op: 'mult', value: 0.06 }] },
      { helm: '+Robo de vida.', chest: '+Vida.', pants: '+Escudo.', boots: '+Velocidad.' },
      { helm: '⚕️', chest: '💊', pants: '🩹', boots: '👟' }),
    bonuses: [
      { pieces: 2, description: '+30 HP', mods: [{ stat: 'maxHp', op: 'add', value: 30 }] },
      { pieces: 3, description: '+2 Escudos', mods: [{ stat: 'shield', op: 'add', value: 2 }] },
      { pieces: 4, description: 'Trauma: +8% robo, +2 escudos, +40 HP', special: 'triage', mods: [{ stat: 'lifesteal', op: 'add', value: 0.08 }, { stat: 'shield', op: 'add', value: 2 }, { stat: 'maxHp', op: 'add', value: 40 }] },
    ],
    synergy: { weaponTags: ['support', 'heal'], damageMult: 0.20, description: 'Potencia armas de soporte (+20%).' },
  },

  /* 17. CAZADOR — perforación, precisión */
  {
    setId: 'set_cazador', name: 'Cazador', color: '#00c8ff', identity: 'Perforación y precisión.',
    playstyle: 'Tiro penetrante y sigiloso. Poca cadencia, mucha puntería.',
    strengths: ['penetración', 'precisión', 'daño', 'crítico'],
    weaknesses: ['cadencia', 'movilidad', 'proyectiles'],
    pieces: makePieces('del Cazador',
      { helm: [{ stat: 'critChance', op: 'add', value: 0.06 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 18 }],
        pants: [{ stat: 'pierce', op: 'add', value: 1 }],
        boots: [{ stat: 'speed', op: 'mult', value: 0.08 }] },
      { helm: '+Crítico.', chest: '+Vida.', pants: '+Perforación.', boots: '+Velocidad.' },
      { helm: '🏹', chest: '🦺', pants: '🪶', boots: '🥾' }),
    bonuses: [
      { pieces: 2, description: '+2 Perforación', mods: [{ stat: 'pierce', op: 'add', value: 2 }] },
      { pieces: 3, description: '+15% Daño', mods: [{ stat: 'damageMult', op: 'mult', value: 0.15 }] },
      { pieces: 4, description: 'Presa marcada: +3 perf, +25% daño', special: 'markedPrey', mods: [{ stat: 'pierce', op: 'add', value: 3 }, { stat: 'damageMult', op: 'mult', value: 0.25 }] },
    ],
    synergy: { affixIds: ['piercing', 'precise'], weaponTags: ['precision'], damageMult: 0.25, description: 'Potencia afijos Perforante y Precisa (+25%).' },
  },

  /* 18. TECNOMANTE — energía, rebotes */
  {
    setId: 'set_tecnomante', name: 'Tecnomante', color: '#00f0ff', identity: 'Energía y proyectiles inteligentes.',
    playstyle: 'Proyectiles que rebotan y encadenan. Daño indirecto y control.',
    strengths: ['energía', 'rebotes', 'inteligente'],
    weaknesses: ['precisión', 'daño directo', 'penetración'],
    pieces: makePieces('del Tecnomante',
      { helm: [{ stat: 'fireRateMult', op: 'mult', value: 0.06 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 20 }],
        pants: [{ stat: 'bounce', op: 'add', value: 1 }],
        boots: [{ stat: 'projectileSize', op: 'add', value: 1 }] },
      { helm: '+Cadencia.', chest: '+Vida.', pants: '+1 Rebote.', boots: '+Tamaño proyectil.' },
      { helm: '🤖', chest: '💻', pants: '🔮', boots: '👟' }),
    bonuses: [
      { pieces: 2, description: '+12% Cadencia', mods: [{ stat: 'fireRateMult', op: 'mult', value: 0.12 }] },
      { pieces: 3, description: '+2 Rebotes', mods: [{ stat: 'bounce', op: 'add', value: 2 }] },
      { pieces: 4, description: 'Singularidad: +20% cadencia, +2 rebotes, +1 proy', special: 'singularity', mods: [{ stat: 'fireRateMult', op: 'mult', value: 0.20 }, { stat: 'bounce', op: 'add', value: 2 }, { stat: 'count', op: 'add', value: 1 }] },
    ],
    synergy: { weaponTags: ['energy'], damageMult: 0.25, description: 'Potencia armas de energía (+25%).' },
  },

  /* 19. CAÓTICO — aleatoriedad, inestable */
  {
    setId: 'set_caotico', name: 'Caótico', color: '#b04dff', identity: 'Poder impredecible.',
    playstyle: 'Alta varianza. Grandes picos de daño, pero impredecible.',
    strengths: ['daño', 'proyectiles', 'rebotes'],
    weaknesses: ['consistencia', 'precisión', 'control'],
    pieces: makePieces('del Caos',
      { helm: [{ stat: 'damageMult', op: 'mult', value: 0.07 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 20 }],
        pants: [{ stat: 'count', op: 'add', value: 1 }],
        boots: [{ stat: 'critChance', op: 'add', value: 0.06 }] },
      { helm: '+Daño.', chest: '+Vida.', pants: '+1 Proyectil.', boots: '+Crítico.' },
      { helm: '🎲', chest: '🌀', pants: '💢', boots: '👢' }),
    bonuses: [
      { pieces: 2, description: '+15% Daño', mods: [{ stat: 'damageMult', op: 'mult', value: 0.15 }] },
      { pieces: 3, description: '+1 Proyectil, +1 Rebote', mods: [{ stat: 'count', op: 'add', value: 1 }, { stat: 'bounce', op: 'add', value: 1 }] },
      { pieces: 4, description: 'Entropía: +30% daño, +1 proy, +2 rebotes', special: 'entropy', mods: [{ stat: 'damageMult', op: 'mult', value: 0.30 }, { stat: 'count', op: 'add', value: 1 }, { stat: 'bounce', op: 'add', value: 2 }] },
    ],
    synergy: { affixIds: ['unstable', 'quantum'], damageMult: 0.25, description: 'Potencia afijos Inestable y Cuántico (+25%).' },
  },

  /* 20. CUÁNTICO — perforación, proyectiles, alta gama */
  {
    setId: 'set_cuantico', name: 'Cuántico', color: '#00f0ff', identity: 'Realidad manipulada.',
    playstyle: 'Alta penetración y proyectiles. Preciso pero frágil.',
    strengths: ['penetración', 'crítico', 'proyectiles', 'precisión'],
    weaknesses: ['defensa', 'cadencia', 'velocidad'],
    pieces: makePieces('Cuántica',
      { helm: [{ stat: 'critChance', op: 'add', value: 0.07 }],
        chest: [{ stat: 'maxHp', op: 'add', value: 25 }],
        pants: [{ stat: 'pierce', op: 'add', value: 1 }, { stat: 'count', op: 'add', value: 1 }],
        boots: [{ stat: 'dashCooldown', op: 'add', value: -0.25 }] },
      { helm: '+Crítico.', chest: '+Vida.', pants: '+Perf y +1 proy.', boots: '-Enfriamiento dash.' },
      { helm: '🌌', chest: '✨', pants: '🔭', boots: '🪽' }),
    bonuses: [
      { pieces: 2, description: '+1 Proyectil, +1 Perforación', mods: [{ stat: 'count', op: 'add', value: 1 }, { stat: 'pierce', op: 'add', value: 1 }] },
      { pieces: 3, description: '+15% Daño, +2 Perforación', mods: [{ stat: 'damageMult', op: 'mult', value: 0.15 }, { stat: 'pierce', op: 'add', value: 2 }] },
      { pieces: 4, description: 'Superposición: +30% daño, +2 proy, +3 perf', special: 'superposition', mods: [{ stat: 'damageMult', op: 'mult', value: 0.30 }, { stat: 'count', op: 'add', value: 2 }, { stat: 'pierce', op: 'add', value: 3 }] },
    ],
    synergy: { affixIds: ['quantum'], weaponTags: ['experimental', 'void'], damageMult: 0.30, description: 'Potencia armas experimentales y del vacío (+30%).' },
  },
];

/* ================================================================== */
/*  Legacy-compatible SetBonusDef view (used by engine getSetBonusDef) */
/* ================================================================== */

export interface SetBonusDef {
  setId: string;
  name: string;
  color: string;
  bonuses: Array<{
    pieces: number;
    description: string;
    mods: StatMod[];
    special?: string;
  }>;
  synergy?: WeaponSynergyDef;
  identity?: string;
  playstyle: string;
  strengths: string[];
  weaknesses: string[];
  counterSynergy?: CounterSynergyDef;
}

export const SETS: SetBonusDef[] = SET_DEFS.map((s) => ({
  setId: s.setId,
  name: s.name,
  color: s.color,
  bonuses: s.bonuses,
  synergy: s.synergy,
  identity: s.identity,
  playstyle: s.playstyle,
  strengths: s.strengths,
  weaknesses: s.weaknesses,
  counterSynergy: s.counterSynergy,
}));

export function getSetBonusDef(setId: string): SetBonusDef | undefined {
  return SETS.find((s) => s.setId === setId);
}

export function getSetDef(setId: string): SetDef | undefined {
  return SET_DEFS.find((s) => s.setId === setId);
}

/* ================================================================== */
/*  BASE EQUIPMENT CATALOGUE — generated procedurally from SET_DEFS   */
/*  One base piece (common) per set × slot. Quality applied later.    */
/* ================================================================== */

function buildEquipmentCatalogue(): EquipmentDef[] {
  const out: EquipmentDef[] = [];
  const slots: EquipSlot[] = ['helm', 'chest', 'pants', 'boots'];
  for (const set of SET_DEFS) {
    for (const slot of slots) {
      const tpl = set.pieces[slot];
      out.push({
        id: `${set.setId}_${slot}`,
        name: tpl.namePrefix,
        rarity: 'common',
        slot,
        icon: tpl.icon,
        description: tpl.description,
        color: set.color,
        mods: tpl.mods,
        setId: set.setId,
      });
    }
  }
  return out;
}

export const EQUIPMENT: EquipmentDef[] = buildEquipmentCatalogue();

/* ================================================================== */
/*  Generated equipment — base piece + quality (registered at runtime) */
/* ================================================================== */

export interface GeneratedEquipment extends EquipmentDef {
  genId: string;
  baseId: string;
  quality: Rarity;
}

const generatedEquipMap = new Map<string, GeneratedEquipment>();

export function registerGeneratedEquip(ge: GeneratedEquipment): void {
  generatedEquipMap.set(ge.genId, ge);
}

/** Scales a piece's mods by the quality multiplier. */
function scaleMods(mods: StatMod[], mult: number): StatMod[] {
  return mods.map((m) => {
    if (m.op === 'mult') return { ...m, value: +(m.value * mult).toFixed(3) };
    // additive: round HP/armor/etc, keep small fractions for lifesteal/crit
    const scaled = m.value * mult;
    const rounded = Math.abs(scaled) >= 1 ? Math.round(scaled) : +scaled.toFixed(3);
    return { ...m, value: rounded };
  });
}

export function generateEquipment(baseId: string, quality: Rarity, genId: string): GeneratedEquipment {
  const base = EQUIPMENT.find((e) => e.id === baseId) ?? EQUIPMENT[0];
  const q = getArmorQuality(quality);
  const ge: GeneratedEquipment = {
    ...base,
    genId,
    baseId: base.id,
    quality: q.rarity,
    rarity: q.rarity,
    name: `${base.name} [${q.label}]`,
    color: q.color,
    mods: quality === 'common' ? base.mods : scaleMods(base.mods, q.statMult),
  };
  registerGeneratedEquip(ge);
  return ge;
}

/* ================================================================== */
/*  Retrieval — resolves generated pieces first, else base            */
/* ================================================================== */

export function getEquipment(id: string): EquipmentDef {
  const ge = generatedEquipMap.get(id);
  if (ge) return ge;
  return EQUIPMENT.find((e) => e.id === id) ?? EQUIPMENT[0];
}

export function getEquipmentQuality(id: string): Rarity {
  const ge = generatedEquipMap.get(id);
  if (ge) return ge.quality;
  const base = EQUIPMENT.find((e) => e.id === id);
  return base?.rarity ?? 'common';
}

/* ================================================================== */
/*  Procedural generation                                             */
/* ================================================================== */

export function rollArmorQuality(highTier: boolean): Rarity {
  const pool = highTier
    ? ARMOR_QUALITIES.filter((q) => q.rarity !== 'common')
    : ARMOR_QUALITIES;
  const total = pool.reduce((s, q) => s + q.dropWeight, 0);
  let r = runRandom.next('loot') * total;
  for (const q of pool) {
    r -= q.dropWeight;
    if (r <= 0) return q.rarity;
  }
  return pool[0].rarity;
}

let equipGenCounter = 1;

/**
 * Procedural drop: pick set → slot → quality → generate final piece.
 * Returns a fully generated & registered equipment piece.
 */
export function pickRandomEquipment(highTier: boolean): GeneratedEquipment {
  const set = SET_DEFS[runRandom.int('loot', SET_DEFS.length)];
  const slots: EquipSlot[] = ['helm', 'chest', 'pants', 'boots'];
  const slot = slots[runRandom.int('loot', slots.length)];
  const quality = rollArmorQuality(highTier);
  const baseId = `${set.setId}_${slot}`;
  return generateEquipment(baseId, quality, `eq_${equipGenCounter++}`);
}

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#94a3b8', uncommon: '#39ff88', rare: '#00c8ff', epic: '#b04dff', legendary: '#ffe14a',
};

export const EQUIP_SLOTS: EquipSlot[] = ['helm', 'chest', 'pants', 'boots'];

export const EQUIP_SLOT_LABELS: Record<EquipSlot, string> = {
  helm: 'Casco', chest: 'Pechera', pants: 'Pantalón', boots: 'Botas',
};

export const EQUIP_SLOT_ICONS: Record<EquipSlot, string> = {
  helm: '🪖', chest: '🛡️', pants: '👖', boots: '👢',
};
