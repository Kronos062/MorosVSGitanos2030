export type Faction = 'bando_moros' | 'bando_gitanos';

/**
 * Mod entry used by character passives. Reuses the same stat keys and ops
 * already handled by the engine's `addMods` and `applyStatBalance` so a
 * passive is just a small set of permanent stat tweaks.
 */
export interface CharacterPassiveMod {
  stat: string;
  op: 'add' | 'mult' | 'add_pct';
  value: number;
}

export interface CharacterDef {
  id: string;
  name: string;
  faction: Faction;
  stats: { hp: number; speed: number; armor: number; critChance: number };
  startingWeapon: string;
  sprite: { color: string; glow: string; shape: string };
  description: string;
  /**
   * Permanent passive (data-driven). Applied once per stat recompute,
   * flows through the same `addMods` pipeline as equipment/set/pet mods
   * and ends up in the global stat balance layer. No active abilities,
   * no separate code path — just a tiny set of stat tweaks.
   */
  passive: CharacterPassiveMod[];
  /** Display-only metadata for the passive (used by the UI, never read by the engine). */
  passiveName: string;
  passiveIcon: string;
}

/**
 * Generic, stat-agnostic labels reused to describe any passive/mod entry in
 * the UI. Not specific to any character — the same map that equipment/skill
 * mods already rely on for their human-readable descriptions.
 */
export const PASSIVE_STAT_LABELS: Record<string, string> = {
  maxHp: 'HP Máxima',
  armor: 'Armadura',
  speed: 'Velocidad',
  speedMult: 'Velocidad',
  critChance: 'Prob. Crítico',
  critDamageMult: 'Daño Crítico',
  damageMult: 'Daño',
  fireRateMult: 'Cadencia',
  projectileSize: 'Tamaño Proy.',
  pierce: 'Perforación',
  count: 'Proyectiles',
  bounce: 'Rebotes',
  lifesteal: 'Robo de Vida',
  dashCooldown: 'CD Dash',
  shield: 'Escudo',
  explosionRadius: 'Radio Explosión',
};

/**
 * Formats a single passive mod into a short human-readable string, e.g.
 * "+2 Armadura" or "+10% Daño". Purely generic — driven by `op`/`value`,
 * never by which character owns the mod.
 */
export function formatPassiveMod(mod: CharacterPassiveMod): string {
  const label = PASSIVE_STAT_LABELS[mod.stat] ?? mod.stat;
  if (mod.op === 'add_pct' || mod.op === 'mult') {
    const pct = Math.round(mod.value * 100);
    return `${pct >= 0 ? '+' : ''}${pct}% ${label}`;
  }
  const isPercentStat = mod.stat === 'critChance' || mod.stat === 'lifesteal';
  const value = isPercentStat ? Math.round(mod.value * 100) : mod.value;
  const suffix = isPercentStat ? '%' : '';
  return `${value >= 0 ? '+' : ''}${value}${suffix} ${label}`;
}

/** Full description of a character's passive, combining every mod entry. */
export function describePassive(character: CharacterDef): string {
  return character.passive.map(formatPassiveMod).join(' · ');
}

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'tariq',
    name: 'Comandante Tariq',
    faction: 'bando_moros',
    stats: { hp: 130, speed: 230, armor: 3, critChance: 0.08 },
    startingWeapon: 'pistol',
    sprite: { color: '#00f0ff', glow: '#00f0ff', shape: 'triangle' },
    description: 'Líder táctico. Gran armadura inicial y resistencia.',
    // Squad leader: his team rallies around him — extra armor that grows with crit gear.
    passive: [
      { stat: 'armor', op: 'add', value: 1 },
      { stat: 'armor', op: 'add', value: 1 },
    ],
    passiveName: 'Fortaleza',
    passiveIcon: '🛡️',
  },
  {
    id: 'ziryab',
    name: 'Alquimista Ziryab',
    faction: 'bando_moros',
    stats: { hp: 90, speed: 250, armor: 1, critChance: 0.15 },
    startingWeapon: 'laser',
    sprite: { color: '#39ff88', glow: '#39ff88', shape: 'triangle' },
    description: 'Maestro de la química y energía. Disparos corrosivos.',
    // Alchemist: extracts vitality from his own concoctions.
    passive: [{ stat: 'lifesteal', op: 'add', value: 0.02 }],
    passiveName: 'Extracción Vital',
    passiveIcon: '💉',
  },
  {
    id: 'benghazi',
    name: 'Jinete Benghazi',
    faction: 'bando_moros',
    stats: { hp: 100, speed: 310, armor: 1, critChance: 0.1 },
    startingWeapon: 'crossbow',
    sprite: { color: '#ffe14a', glow: '#ffe14a', shape: 'triangle' },
    description: 'Rápido y ágil en combate a distancia.',
    // Mounted rider: darting through cover, never caught — extra pierce.
    passive: [{ stat: 'pierce', op: 'add', value: 1 }],
    passiveName: 'Carga Certera',
    passiveIcon: '🏹',
  },
  {
    id: 'sombra',
    name: 'Sombra de Córdoba',
    faction: 'bando_moros',
    stats: { hp: 85, speed: 290, armor: 0, critChance: 0.25 },
    startingWeapon: 'blade_launcher',
    sprite: { color: '#b04dff', glow: '#b04dff', shape: 'triangle' },
    description: 'Asesino sigiloso con alta probabilidad crítica.',
    // Assassin: stacked crits land even harder.
    passive: [{ stat: 'critDamageMult', op: 'add', value: 0.3 }],
    passiveName: 'Golpe Letal',
    passiveIcon: '🗡️',
  },
  {
    id: 'alhambra',
    name: 'Guardián Alhambra',
    faction: 'bando_moros',
    stats: { hp: 160, speed: 200, armor: 5, critChance: 0.05 },
    startingWeapon: 'shotgun',
    sprite: { color: '#0099ff', glow: '#00f0ff', shape: 'triangle' },
    description: 'Baluarte inexpugnable de alta supervivencia.',
    // Citadel defender: regenerates a barrier every time the engine awards a shield.
    passive: [{ stat: 'shield', op: 'add', value: 1 }],
    passiveName: 'Muralla Viviente',
    passiveIcon: '🏰',
  },
  {
    id: 'bailaor_furia',
    name: 'Bailaor Furia',
    faction: 'bando_gitanos',
    stats: { hp: 110, speed: 280, armor: 2, critChance: 0.12 },
    startingWeapon: 'flame_thrower',
    sprite: { color: '#ff2bd6', glow: '#ff2bd6', shape: 'triangle' },
    description: 'Ataques de fuego frenéticos con alto ritmo.',
    // Flamenco dancer: relentless rhythm, faster cadence every step.
    passive: [{ stat: 'fireRateMult', op: 'add_pct', value: 0.08 }],
    passiveName: 'Ritmo Frenético',
    passiveIcon: '💃',
  },
  {
    id: 'rayo',
    name: 'Guitarrista Rayo',
    faction: 'bando_gitanos',
    stats: { hp: 95, speed: 270, armor: 1, critChance: 0.18 },
    startingWeapon: 'tesla_gun',
    sprite: { color: '#ffe14a', glow: '#ffe14a', shape: 'triangle' },
    description: 'Descargas eléctricas resonantes en cadena.',
    // Rock star amp: his playing rips the air apart — explosions on every hit.
    passive: [{ stat: 'explosionRadius', op: 'add', value: 12 }],
    passiveName: 'Acorde Explosivo',
    passiveIcon: '🎸',
  },
  {
    id: 'bronce',
    name: 'Campero Bronce',
    faction: 'bando_gitanos',
    stats: { hp: 125, speed: 240, armor: 3, critChance: 0.1 },
    startingWeapon: 'rifle',
    sprite: { color: '#ff8800', glow: '#ff8800', shape: 'triangle' },
    description: 'Especialista en emboscadas y rifles de largo alcance.',
    // Sharpshooter: extra reach via extra bounce.
    passive: [{ stat: 'bounce', op: 'add', value: 1 }],
    passiveName: 'Rebote Calculado',
    passiveIcon: '🎯',
  },
  {
    id: 'hechicera_lola',
    name: 'Hechicera Lola',
    faction: 'bando_gitanos',
    stats: { hp: 90, speed: 260, armor: 0, critChance: 0.2 },
    startingWeapon: 'laser',
    sprite: { color: '#ff3b5c', glow: '#ff3b5c', shape: 'triangle' },
    description: 'Mística misteriosa de gran potencia mística.',
    // Mystic: weaves extra projectiles from pure will.
    passive: [{ stat: 'count', op: 'add', value: 1 }],
    passiveName: 'Tejido Arcano',
    passiveIcon: '✨',
  },
  {
    id: 'patriarca',
    name: 'Patriarca Hierro',
    faction: 'bando_gitanos',
    stats: { hp: 150, speed: 220, armor: 4, critChance: 0.08 },
    startingWeapon: 'void_cannon',
    sprite: { color: '#ff2bd6', glow: '#ffe14a', shape: 'triangle' },
    description: 'Veterano curtido con potencia devastadora.',
    // Old warhorse: raw experience translates into raw damage.
    passive: [{ stat: 'damageMult', op: 'add_pct', value: 0.1 }],
    passiveName: 'Veteranía',
    passiveIcon: '💪',
  },
];

export function getCharacter(id: string): CharacterDef {
  return CHARACTERS.find((c) => c.id === id) ?? CHARACTERS[0];
}

export function getCharactersByFaction(faction: Faction): CharacterDef[] {
  return CHARACTERS.filter((c) => c.faction === faction);
}

export function factionColor(faction: Faction): string {
  return faction === 'bando_moros' ? '#00f0ff' : '#ff2bd6';
}

export function factionName(faction: Faction): string {
  return faction === 'bando_moros' ? 'Moros' : 'Gitanos';
}
