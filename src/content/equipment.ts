import type { Rarity } from './weapons';

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

/* ------------------------------------------------------------------ */
/*  SET BONUSES — data-driven thresholds                              */
/* ------------------------------------------------------------------ */
export interface SetBonusDef {
  setId: string;
  name: string;
  color: string;
  bonuses: Array<{
    pieces: number;
    description: string;
    mods: StatMod[];
    /** Special flag that can be picked up by the engine as a named trait */
    special?: string;
  }>;
}

export const SETS: SetBonusDef[] = [
  {
    setId: 'set_berserker', name: 'Berserker', color: '#ff5500',
    bonuses: [
      { pieces: 2, description: '+15% Daño', mods: [{ stat: 'damageMult', op: 'mult', value: 0.15 }] },
      { pieces: 3, description: '+20% Velocidad', mods: [{ stat: 'speed', op: 'mult', value: 0.20 }] },
      { pieces: 4, description: 'Furia permanente: +35% Daño, -15% cadencia', special: 'permaFury', mods: [{ stat: 'damageMult', op: 'mult', value: 0.35 }, { stat: 'fireRateMult', op: 'mult', value: -0.15 }] },
    ],
  },
  {
    setId: 'set_legionario', name: 'Legionario', color: '#0099ff',
    bonuses: [
      { pieces: 2, description: '+20 HP, +2 Armadura', mods: [{ stat: 'maxHp', op: 'add', value: 20 }, { stat: 'armor', op: 'add', value: 2 }] },
      { pieces: 3, description: '+1 Escudo, +10 HP', mods: [{ stat: 'shield', op: 'add', value: 1 }, { stat: 'maxHp', op: 'add', value: 10 }] },
      { pieces: 4, description: 'Formación: +4 Armadura, +40 HP', special: 'formation', mods: [{ stat: 'armor', op: 'add', value: 4 }, { stat: 'maxHp', op: 'add', value: 40 }] },
    ],
  },
  {
    setId: 'set_asesino', name: 'Asesino', color: '#ff2bd6',
    bonuses: [
      { pieces: 2, description: '+15% Crítico', mods: [{ stat: 'critChance', op: 'add', value: 0.15 }] },
      { pieces: 3, description: '+2 Perforación', mods: [{ stat: 'pierce', op: 'add', value: 2 }] },
      { pieces: 4, description: 'Golpe letal: críticos hacen ×3 daño en vez de ×2', special: 'lethalStrike', mods: [] },
    ],
  },
  {
    setId: 'set_explorador', name: 'Explorador', color: '#39ff88',
    bonuses: [
      { pieces: 2, description: '+25% Velocidad', mods: [{ stat: 'speed', op: 'mult', value: 0.25 }] },
      { pieces: 3, description: 'Dash cooldown -0.5s', mods: [{ stat: 'dashCooldown', op: 'add', value: -0.5 }] },
      { pieces: 4, description: 'Zancada: +40% velocidad, +2 rebotes', special: 'stride', mods: [{ stat: 'speed', op: 'mult', value: 0.4 }, { stat: 'bounce', op: 'add', value: 2 }] },
    ],
  },
  {
    setId: 'set_chaman', name: 'Chamán', color: '#b04dff',
    bonuses: [
      { pieces: 2, description: '+10% Robo de vida', mods: [{ stat: 'lifesteal', op: 'add', value: 0.10 }] },
      { pieces: 3, description: '+20% Cadencia', mods: [{ stat: 'fireRateMult', op: 'mult', value: 0.20 }] },
      { pieces: 4, description: 'Espíritu ancestral: +15% robo, +30% cadencia', special: 'ancestralSpirit', mods: [{ stat: 'lifesteal', op: 'add', value: 0.15 }, { stat: 'fireRateMult', op: 'mult', value: 0.30 }] },
    ],
  },
  {
    setId: 'set_caballero', name: 'Caballero', color: '#ffe14a',
    bonuses: [
      { pieces: 2, description: '+3 Armadura', mods: [{ stat: 'armor', op: 'add', value: 3 }] },
      { pieces: 3, description: '+25 HP, +1 Escudo', mods: [{ stat: 'maxHp', op: 'add', value: 25 }, { stat: 'shield', op: 'add', value: 1 }] },
      { pieces: 4, description: 'Brillo sagrado: +5 armadura, +2 escudos, +15% daño', special: 'holyRadiance', mods: [{ stat: 'armor', op: 'add', value: 5 }, { stat: 'shield', op: 'add', value: 2 }, { stat: 'damageMult', op: 'mult', value: 0.15 }] },
    ],
  },
  {
    setId: 'set_mercenario', name: 'Mercenario', color: '#ff8800',
    bonuses: [
      { pieces: 2, description: '+1 Proyectil', mods: [{ stat: 'count', op: 'add', value: 1 }] },
      { pieces: 3, description: '+10% Daño, +10% Cadencia', mods: [{ stat: 'damageMult', op: 'mult', value: 0.10 }, { stat: 'fireRateMult', op: 'mult', value: 0.10 }] },
      { pieces: 4, description: 'Contrato sellado: +2 proyectos, +20% daño', special: 'sealedContract', mods: [{ stat: 'count', op: 'add', value: 2 }, { stat: 'damageMult', op: 'mult', value: 0.20 }] },
    ],
  },
];

export function getSetBonusDef(setId: string): SetBonusDef | undefined {
  return SETS.find((s) => s.setId === setId);
}

/* ------------------------------------------------------------------ */
/*  EQUIPMENT CATALOGUE                                                */
/* ------------------------------------------------------------------ */

export const EQUIPMENT: EquipmentDef[] = [
  // ===================== COMMON =====================
  // -- HELMS --
  { id: 'helm_cloth', name: 'Pañuelo de Lona', rarity: 'common', slot: 'helm', icon: '🧢', description: 'Un pañuelo gastado de las calles.', color: '#94a3b8',
    mods: [{ stat: 'maxHp', op: 'add', value: 10 }],
  },
  { id: 'helm_plastic', name: 'Casco de Plástico', rarity: 'common', slot: 'helm', icon: '⛑️', description: 'Protección mínima de fábrica.', color: '#94a3b8',
    mods: [{ stat: 'armor', op: 'add', value: 1 }],
  },
  // -- CHESTS --
  { id: 'chest_leather', name: 'Chaqueta de Cuero', rarity: 'common', slot: 'chest', icon: '🧥', description: 'Cuero curtido. Mejor que nada.', color: '#94a3b8',
    mods: [{ stat: 'maxHp', op: 'add', value: 12 }],
  },
  { id: 'chest_denim', name: 'Chaleco Vaquero', rarity: 'common', slot: 'chest', icon: '👕', description: 'Resistente y clásico.', color: '#94a3b8',
    mods: [{ stat: 'armor', op: 'add', value: 1 }, { stat: 'speed', op: 'mult', value: 0.04 }],
  },
  // -- PANTS --
  { id: 'pants_cargo', name: 'Pantalones Cargo', rarity: 'common', slot: 'pants', icon: '👖', description: 'Bolsillos extra, movilidad ok.', color: '#94a3b8',
    mods: [{ stat: 'speed', op: 'mult', value: 0.06 }],
  },
  { id: 'pants_jeans', name: 'Vaqueros Reforzados', rarity: 'common', slot: 'pants', icon: '👖', description: 'Tela gruesa contra arañazos.', color: '#94a3b8',
    mods: [{ stat: 'maxHp', op: 'add', value: 8 }],
  },
  // -- BOOTS --
  { id: 'boots_sneakers', name: 'Zapatillas Deportivas', rarity: 'common', slot: 'boots', icon: '👟', description: 'Gastadas pero rápidas.', color: '#94a3b8',
    mods: [{ stat: 'speed', op: 'mult', value: 0.08 }],
  },
  { id: 'boots_work', name: 'Botas de Obra', rarity: 'common', slot: 'boots', icon: '🥾', description: 'Puntera de acero.', color: '#94a3b8',
    mods: [{ stat: 'armor', op: 'add', value: 1 }],
  },

  // ===================== UNCOMMON =====================
  // -- HELMS --
  { id: 'helm_tactical', name: 'Casco Táctico', rarity: 'uncommon', slot: 'helm', icon: '🪖', description: 'Visera nocturna integrada.', color: '#39ff88',
    mods: [{ stat: 'maxHp', op: 'add', value: 18 }, { stat: 'critChance', op: 'add', value: 0.04 }],
    setId: 'set_mercenario',
  },
  { id: 'helm_scout', name: 'Capucha de Explorador', rarity: 'uncommon', slot: 'helm', icon: '🎭', description: 'Ligera, excelente campo de visión.', color: '#39ff88',
    mods: [{ stat: 'speed', op: 'mult', value: 0.10 }, { stat: 'critChance', op: 'add', value: 0.05 }],
    setId: 'set_explorador',
  },
  // -- CHESTS --
  { id: 'chest_kevlar', name: 'Chaleco de Kevlar', rarity: 'uncommon', slot: 'chest', icon: '🦺', description: 'Protección balística ligera.', color: '#39ff88',
    mods: [{ stat: 'maxHp', op: 'add', value: 22 }, { stat: 'armor', op: 'add', value: 1 }],
    setId: 'set_legionario',
  },
  { id: 'chest_bruiser', name: 'Cazadora de Combate', rarity: 'uncommon', slot: 'chest', icon: '🧥', description: 'Refuerzos en hombros y codos.', color: '#39ff88',
    mods: [{ stat: 'damageMult', op: 'mult', value: 0.08 }, { stat: 'maxHp', op: 'add', value: 10 }],
    setId: 'set_berserker',
  },
  // -- PANTS --
  { id: 'pants_plate', name: 'Grebas Ligeras', rarity: 'uncommon', slot: 'pants', icon: '🦿', description: 'Placas en muslos y rodillas.', color: '#39ff88',
    mods: [{ stat: 'armor', op: 'add', value: 2 }, { stat: 'maxHp', op: 'add', value: 12 }],
    setId: 'set_caballero',
  },
  { id: 'pants_nomad', name: 'Pantalones Nómadas', rarity: 'uncommon', slot: 'pants', icon: '👖', description: 'Tejido técnico transpirable.', color: '#39ff88',
    mods: [{ stat: 'speed', op: 'mult', value: 0.12 }, { stat: 'maxHp', op: 'add', value: 8 }],
    setId: 'set_explorador',
  },
  // -- BOOTS --
  { id: 'boots_grip', name: 'Botas de Agarre', rarity: 'uncommon', slot: 'boots', icon: '🥾', description: 'Suela de alto coeficiente.', color: '#39ff88',
    mods: [{ stat: 'speed', op: 'mult', value: 0.12 }, { stat: 'dashCooldown', op: 'add', value: -0.15 }],
    setId: 'set_mercenario',
  },
  { id: 'boots_ritual', name: 'Sandalias Rituales', rarity: 'uncommon', slot: 'boots', icon: '👡', description: 'Canalizan energía mística.', color: '#39ff88',
    mods: [{ stat: 'lifesteal', op: 'add', value: 0.04 }, { stat: 'fireRateMult', op: 'mult', value: 0.06 }],
    setId: 'set_chaman',
  },

  // ===================== RARE =====================
  // -- HELMS --
  { id: 'helm_legion', name: 'Yelmo Legionario', rarity: 'rare', slot: 'helm', icon: '🪖', description: 'Penacho de plumas sintéticas.', color: '#00c8ff',
    mods: [{ stat: 'maxHp', op: 'add', value: 30 }, { stat: 'armor', op: 'add', value: 2 }],
    setId: 'set_legionario',
  },
  { id: 'helm_shaman', name: 'Máscara de Chamán', rarity: 'rare', slot: 'helm', icon: '🐺', description: 'Piel curtida con runas pintadas.', color: '#00c8ff',
    mods: [{ stat: 'lifesteal', op: 'add', value: 0.08 }, { stat: 'fireRateMult', op: 'mult', value: 0.10 }],
    setId: 'set_chaman',
  },
  { id: 'helm_dusk', name: 'Velo del Ocaso', rarity: 'rare', slot: 'helm', icon: '🌑', description: 'Susurra secretos del vacío.', color: '#00c8ff',
    mods: [{ stat: 'critChance', op: 'add', value: 0.12 }, { stat: 'damageMult', op: 'mult', value: 0.10 }],
    setId: 'set_asesino',
  },
  // -- CHESTS --
  { id: 'chest_cuirass', name: 'Coraza Templaria', rarity: 'rare', slot: 'chest', icon: '🛡️', description: 'Placas cerámicas superpuestas.', color: '#00c8ff',
    mods: [{ stat: 'maxHp', op: 'add', value: 40 }, { stat: 'armor', op: 'add', value: 2 }, { stat: 'shield', op: 'add', value: 1 }],
    setId: 'set_caballero',
  },
  { id: 'chest_shaman', name: 'Túnica del Chamán', rarity: 'rare', slot: 'chest', icon: '🦺', description: 'Tejido con fibras de la colmena.', color: '#00c8ff',
    mods: [{ stat: 'maxHp', op: 'add', value: 25 }, { stat: 'lifesteal', op: 'add', value: 0.06 }, { stat: 'fireRateMult', op: 'mult', value: 0.12 }],
    setId: 'set_chaman',
  },
  { id: 'chest_merc', name: 'Chaleco Mercenario', rarity: 'rare', slot: 'chest', icon: '🎽', description: 'Bolsillos de carga rápida.', color: '#00c8ff',
    mods: [{ stat: 'damageMult', op: 'mult', value: 0.12 }, { stat: 'fireRateMult', op: 'mult', value: 0.08 }, { stat: 'count', op: 'add', value: 1 }],
    setId: 'set_mercenario',
  },
  // -- PANTS --
  { id: 'pants_berserk', name: 'Grebas del Berserker', rarity: 'rare', slot: 'pants', icon: '🦵', description: 'Cadenas y cuero quemado.', color: '#00c8ff',
    mods: [{ stat: 'speed', op: 'mult', value: 0.08 }, { stat: 'damageMult', op: 'mult', value: 0.10 }],
    setId: 'set_berserker',
  },
  { id: 'pants_scout', name: 'Perneras de Cazador', rarity: 'rare', slot: 'pants', icon: '👖', description: 'Silenciosas como la noche.', color: '#00c8ff',
    mods: [{ stat: 'speed', op: 'mult', value: 0.14 }, { stat: 'critChance', op: 'add', value: 0.08 }],
    setId: 'set_asesino',
  },
  // -- BOOTS --
  { id: 'boots_legion', name: 'Botas Legionarias', rarity: 'rare', slot: 'boots', icon: '👢', description: 'Suela de impacto amortiguado.', color: '#00c8ff',
    mods: [{ stat: 'speed', op: 'mult', value: 0.08 }, { stat: 'maxHp', op: 'add', value: 20 }],
    setId: 'set_legionario',
  },
  { id: 'boots_knight', name: 'Escarpes del Cruzado', rarity: 'rare', slot: 'boots', icon: '👢', description: 'Acero bendecido en cada paso.', color: '#00c8ff',
    mods: [{ stat: 'armor', op: 'add', value: 2 }, { stat: 'dashCooldown', op: 'add', value: -0.20 }],
    setId: 'set_caballero',
  },

  // ===================== EPIC =====================
  // -- HELMS --
  { id: 'helm_berserk', name: 'Casco del Berserker', rarity: 'epic', slot: 'helm', icon: '👹', description: 'Forjado en la rabia de cien combates.', color: '#b04dff',
    mods: [{ stat: 'damageMult', op: 'mult', value: 0.18 }, { stat: 'critChance', op: 'add', value: 0.8 }],
    setId: 'set_berserker',
  },
  { id: 'helm_crown', name: 'Corona del Cruzado', rarity: 'epic', slot: 'helm', icon: '👑', description: 'Aura dorada que desvía proyectiles.', color: '#b04dff',
    mods: [{ stat: 'maxHp', op: 'add', value: 50 }, { stat: 'armor', op: 'add', value: 3 }, { stat: 'shield', op: 'add', value: 1 }],
    setId: 'set_caballero',
  },
  // -- CHESTS --
  { id: 'chest_void', name: 'Pechera del Vacío', rarity: 'epic', slot: 'chest', icon: '🕳️', description: 'Absorbe luz y proyectiles cercanos.', color: '#b04dff',
    mods: [{ stat: 'maxHp', op: 'add', value: 45 }, { stat: 'armor', op: 'add', value: 3 }, { stat: 'lifesteal', op: 'add', value: 0.08 }],
    setId: 'set_asesino',
  },
  { id: 'chest_explorer', name: 'Chaleco de Expedición', rarity: 'epic', slot: 'chest', icon: '🎒', description: 'Compacto, lleno de recursos.', color: '#b04dff',
    mods: [{ stat: 'maxHp', op: 'add', value: 30 }, { stat: 'speed', op: 'mult', value: 0.15 }, { stat: 'dashCooldown', op: 'add', value: -0.3 }],
    setId: 'set_explorador',
  },
  // -- PANTS --
  { id: 'pants_legion', name: 'Faldar Legionario', rarity: 'epic', slot: 'pants', icon: '🦵', description: 'Blindaje de titanio ligero.', color: '#b04dff',
    mods: [{ stat: 'maxHp', op: 'add', value: 40 }, { stat: 'armor', op: 'add', value: 3 }],
    setId: 'set_legionario',
  },
  { id: 'pants_shaman', name: 'Falda del Chamán', rarity: 'epic', slot: 'pants', icon: '👘', description: 'Plumas y escamas cosidas a mano.', color: '#b04dff',
    mods: [{ stat: 'maxHp', op: 'add', value: 25 }, { stat: 'lifesteal', op: 'add', value: 0.10 }, { stat: 'fireRateMult', op: 'mult', value: 0.15 }],
    setId: 'set_chaman',
  },
  // -- BOOTS --
  { id: 'boots_assassin', name: 'Botas del Asesino', rarity: 'epic', slot: 'boots', icon: '👢', description: 'Cada paso es un susurro.', color: '#b04dff',
    mods: [{ stat: 'speed', op: 'mult', value: 0.20 }, { stat: 'critChance', op: 'add', value: 0.12 }, { stat: 'dashCooldown', op: 'add', value: -0.3 }],
    setId: 'set_asesino',
  },
  { id: 'boots_merc', name: 'Botas del Mercenario', rarity: 'epic', slot: 'boots', icon: '👢', description: 'Cierre hermético antiexplosivos.', color: '#b04dff',
    mods: [{ stat: 'speed', op: 'mult', value: 0.12 }, { stat: 'damageMult', op: 'mult', value: 0.12 }, { stat: 'count', op: 'add', value: 1 }],
    setId: 'set_mercenario',
  },

  // ===================== LEGENDARY =====================
  // -- HELMS --
  { id: 'helm_godking', name: 'Yelmo del Rey Dios', rarity: 'legendary', slot: 'helm', icon: '👑', description: 'Quien lo porta decide el destino de la calle.', color: '#ffe14a',
    mods: [{ stat: 'maxHp', op: 'add', value: 60 }, { stat: 'armor', op: 'add', value: 4 }, { stat: 'damageMult', op: 'mult', value: 0.20 }],
  },
  // -- CHESTS --
  { id: 'chest_phoenix', name: 'Coraza Fénix', rarity: 'legendary', slot: 'chest', icon: '🔥', description: 'Renace de sus cenizas tras cada baja.', color: '#ffe14a',
    mods: [{ stat: 'maxHp', op: 'add', value: 70 }, { stat: 'lifesteal', op: 'add', value: 0.15 }, { stat: 'fireRateMult', op: 'mult', value: 0.18 }],
  },
  // -- PANTS --
  { id: 'pants_titan', name: 'Grebas del Titán', rarity: 'legendary', slot: 'pants', icon: '🗿', description: 'Inamovibles como una montaña.', color: '#ffe14a',
    mods: [{ stat: 'maxHp', op: 'add', value: 80 }, { stat: 'armor', op: 'add', value: 5 }, { stat: 'speed', op: 'mult', value: -0.08 }],
  },
  // -- BOOTS --
  { id: 'boots_hermes', name: 'Sandalias de Hermes', rarity: 'legendary', slot: 'boots', icon: '🪽', description: 'Robadas del Olimpo cibernético.', color: '#ffe14a',
    mods: [{ stat: 'speed', op: 'mult', value: 0.35 }, { stat: 'dashCooldown', op: 'add', value: -0.6 }, { stat: 'critChance', op: 'add', value: 0.10 }],
  },
];

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

export function getEquipment(id: string): EquipmentDef {
  return EQUIPMENT.find((e) => e.id === id) ?? EQUIPMENT[0];
}

const RARITY_WEIGHTS: Record<Rarity, number> = {
  common: 50, uncommon: 35, rare: 25, epic: 12, legendary: 4,
};

export function pickRandomEquipment(highTier: boolean): EquipmentDef {
  const pool = EQUIPMENT.filter((e) => {
    if (highTier) return e.rarity === 'epic' || e.rarity === 'legendary' || e.rarity === 'rare';
    return true;
  });
  if (pool.length === 0) return EQUIPMENT[0];
  const weighted = pool.flatMap((e) => Array(RARITY_WEIGHTS[e.rarity]).fill(e));
  return weighted[Math.floor(Math.random() * weighted.length)] ?? pool[0];
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
