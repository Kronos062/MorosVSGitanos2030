export interface ChestDef {
  id: string;
  name: string;
  color: string;
  glow: string;
  /** Probabilidad de soltar arma al abrir */
  weaponChance: number;
  /** Recompensas básicas adicionales */
  basicLoot: Array<'heal' | 'score' | 'shield'>;
  /** Si true, arma de rareza alta más probable */
  highTier: boolean;
}

export const CHESTS: ChestDef[] = [
  {
    id: 'chest_street',
    name: 'Cofre de Calle',
    color: '#ffe14a',
    glow: '#ff8800',
    weaponChance: 1,
    basicLoot: ['heal', 'score'],
    highTier: false,
  },
  {
    id: 'chest_armory',
    name: 'Cofre de Armería',
    color: '#00f0ff',
    glow: '#00c8ff',
    weaponChance: 1,
    basicLoot: ['shield'],
    highTier: true,
  },
  {
    id: 'chest_boss',
    name: 'Cofre de Jefe',
    color: '#ff2bd6',
    glow: '#ffe14a',
    weaponChance: 1,
    basicLoot: ['heal', 'score', 'shield'],
    highTier: true,
  },
];

export function getChest(id: string): ChestDef {
  return CHESTS.find((c) => c.id === id) ?? CHESTS[0];
}

export function pickChestWeaponId(highTier: boolean): string {
  // Se resuelve en el engine con WEAPONS para no duplicar tablas
  return highTier ? 'high' : 'any';
}
