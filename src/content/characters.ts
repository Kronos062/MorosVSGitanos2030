export type Faction = 'bando_moros' | 'bando_gitanos';

export interface CharacterDef {
  id: string;
  name: string;
  faction: Faction;
  stats: { hp: number; speed: number; armor: number; critChance: number };
  startingWeapon: string;
  sprite: { color: string; glow: string; shape: string };
  description: string;
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
  },
  {
    id: 'ziryab',
    name: 'Alquimista Ziryab',
    faction: 'bando_moros',
    stats: { hp: 90, speed: 250, armor: 1, critChance: 0.15 },
    startingWeapon: 'laser',
    sprite: { color: '#39ff88', glow: '#39ff88', shape: 'triangle' },
    description: 'Maestro de la química y energía. Disparos corrosivos.',
  },
  {
    id: 'benghazi',
    name: 'Jinete Benghazi',
    faction: 'bando_moros',
    stats: { hp: 100, speed: 310, armor: 1, critChance: 0.1 },
    startingWeapon: 'crossbow',
    sprite: { color: '#ffe14a', glow: '#ffe14a', shape: 'triangle' },
    description: 'Rápido y ágil en combate a distancia.',
  },
  {
    id: 'sombra',
    name: 'Sombra de Córdoba',
    faction: 'bando_moros',
    stats: { hp: 85, speed: 290, armor: 0, critChance: 0.25 },
    startingWeapon: 'blade_launcher',
    sprite: { color: '#b04dff', glow: '#b04dff', shape: 'triangle' },
    description: 'Asesino sigiloso con alta probabilidad crítica.',
  },
  {
    id: 'alhambra',
    name: 'Guardián Alhambra',
    faction: 'bando_moros',
    stats: { hp: 160, speed: 200, armor: 5, critChance: 0.05 },
    startingWeapon: 'shotgun',
    sprite: { color: '#0099ff', glow: '#00f0ff', shape: 'triangle' },
    description: 'Baluarte inexpugnable de alta supervivencia.',
  },
  {
    id: 'bailaor_furia',
    name: 'Bailaor Furia',
    faction: 'bando_gitanos',
    stats: { hp: 110, speed: 280, armor: 2, critChance: 0.12 },
    startingWeapon: 'flame_thrower',
    sprite: { color: '#ff2bd6', glow: '#ff2bd6', shape: 'triangle' },
    description: 'Ataques de fuego frenéticos con alto ritmo.',
  },
  {
    id: 'rayo',
    name: 'Guitarrista Rayo',
    faction: 'bando_gitanos',
    stats: { hp: 95, speed: 270, armor: 1, critChance: 0.18 },
    startingWeapon: 'tesla_gun',
    sprite: { color: '#ffe14a', glow: '#ffe14a', shape: 'triangle' },
    description: 'Descargas eléctricas resonantes en cadena.',
  },
  {
    id: 'bronce',
    name: 'Campero Bronce',
    faction: 'bando_gitanos',
    stats: { hp: 125, speed: 240, armor: 3, critChance: 0.1 },
    startingWeapon: 'rifle',
    sprite: { color: '#ff8800', glow: '#ff8800', shape: 'triangle' },
    description: 'Especialista en emboscadas y rifles de largo alcance.',
  },
  {
    id: 'hechicera_lola',
    name: 'Hechicera Lola',
    faction: 'bando_gitanos',
    stats: { hp: 90, speed: 260, armor: 0, critChance: 0.2 },
    startingWeapon: 'laser',
    sprite: { color: '#ff3b5c', glow: '#ff3b5c', shape: 'triangle' },
    description: 'Mística misteriosa de gran potencia mística.',
  },
  {
    id: 'patriarca',
    name: 'Patriarca Hierro',
    faction: 'bando_gitanos',
    stats: { hp: 150, speed: 220, armor: 4, critChance: 0.08 },
    startingWeapon: 'void_cannon',
    sprite: { color: '#ff2bd6', glow: '#ffe14a', shape: 'triangle' },
    description: 'Veterano curtido con potencia devastadora.',
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
