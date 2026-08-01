export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

export interface WeaponDef {
  id: string;
  name: string;
  rarity: Rarity;
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  projectileSize: number;
  color: string;
  spread: number;
  count: number;
  pierce: number;
  sound: string;
  tags: string[];
  /** Extra data-driven mechanics — engine handles these generically */
  burstCount?: number;
  /** Number of times the projectile can bounce off walls before dying */
  bounceCount?: number;
  /** Radius for on-hit explosion damage */
  explosionRadius?: number;
  /** Extra projectile lifetime multiplier (slow heavy shots) */
  lifetime?: number;
  /** Base size multiplier for projectiles */
  sizeMult?: number;
}

export const WEAPONS: WeaponDef[] = [
  // ===== COMMON =====
  { id: 'pistol', name: 'Pistola de Pulso', rarity: 'common', damage: 12, fireRate: 3.5, projectileSpeed: 550, projectileSize: 4, color: '#00f0ff', spread: 0.04, count: 1, pierce: 0, sound: 'shoot', tags: ['energy', 'basic'] },
  { id: 'bat_baseball', name: 'Bate de Callejón', rarity: 'common', damage: 28, fireRate: 1.4, projectileSpeed: 0, projectileSize: 18, color: '#94a3b8', spread: 0, count: 1, pierce: 3, sound: 'hit', tags: ['melee', 'kinetic'], burstCount: 1, lifetime: 0.12 },
  { id: 'spud_gun', name: 'Lanzapatatas', rarity: 'common', damage: 15, fireRate: 2.8, projectileSpeed: 340, projectileSize: 10, color: '#ff8800', spread: 0.10, count: 1, pierce: 0, sound: 'shoot', tags: ['kinetic', 'slow'], bounceCount: 1 },

  // ===== UNCOMMON =====
  { id: 'shotgun', name: 'Cañón de Dispersión', rarity: 'uncommon', damage: 8, fireRate: 1.6, projectileSpeed: 480, projectileSize: 4, color: '#ffe14a', spread: 0.35, count: 5, pierce: 0, sound: 'shoot_heavy', tags: ['kinetic', 'spread'] },
  { id: 'crossbow', name: 'Ballesta Táctica', rarity: 'uncommon', damage: 28, fireRate: 2.0, projectileSpeed: 700, projectileSize: 4, color: '#39ff88', spread: 0.01, count: 1, pierce: 1, sound: 'shoot', tags: ['kinetic', 'precision'] },
  { id: 'sonic_blaster', name: 'Blaster Sónico', rarity: 'uncommon', damage: 15, fireRate: 2.8, projectileSpeed: 500, projectileSize: 7, color: '#39ff88', spread: 0.20, count: 3, pierce: 1, sound: 'shoot', tags: ['sonic', 'area'] },
  { id: 'venom_blaster', name: 'Blaster Biotóxico', rarity: 'uncommon', damage: 11, fireRate: 4.2, projectileSpeed: 580, projectileSize: 4, color: '#9dff00', spread: 0.06, count: 1, pierce: 1, sound: 'shoot', tags: ['bio', 'toxic'] },
  { id: 'bolt_revolver', name: 'Revólver de Pernos', rarity: 'uncommon', damage: 18, fireRate: 2.5, projectileSpeed: 680, projectileSize: 5, color: '#ff8800', spread: 0.03, count: 1, pierce: 1, sound: 'shoot', tags: ['kinetic', 'stopper'] },

  // ===== RARE =====
  { id: 'rifle', name: 'Rifle de Riel', rarity: 'rare', damage: 22, fireRate: 5.0, projectileSpeed: 900, projectileSize: 3, color: '#ff2bd6', spread: 0.02, count: 1, pierce: 2, sound: 'shoot_heavy', tags: ['energy', 'precision'] },
  { id: 'flame_thrower', name: 'Lanzallamas Térmico', rarity: 'rare', damage: 6, fireRate: 12.0, projectileSpeed: 380, projectileSize: 8, color: '#ff6a00', spread: 0.25, count: 2, pierce: 3, sound: 'shoot', tags: ['fire', 'area'], lifetime: 0.6 },
  { id: 'tesla_gun', name: 'Cañón Tesla', rarity: 'rare', damage: 16, fireRate: 3.8, projectileSpeed: 620, projectileSize: 5, color: '#6ef0ff', spread: 0.10, count: 2, pierce: 2, sound: 'shoot', tags: ['electric', 'chain'], burstCount: 2 },
  { id: 'minigun', name: 'Minigun Rotatoria', rarity: 'rare', damage: 9, fireRate: 10.0, projectileSpeed: 750, projectileSize: 3, color: '#ff8800', spread: 0.18, count: 1, pierce: 0, sound: 'shoot', tags: ['kinetic', 'rapid'] },
  { id: 'cluster_mortar', name: 'Mortero de Cúmulo', rarity: 'rare', damage: 18, fireRate: 1.4, projectileSpeed: 400, projectileSize: 8, color: '#ff3b5c', spread: 0.30, count: 4, pierce: 0, sound: 'shoot_heavy', tags: ['explosive', 'spread'], explosionRadius: 60 },
  { id: 'frost_cannon', name: 'Cañón Criogénico', rarity: 'rare', damage: 20, fireRate: 2.5, projectileSpeed: 600, projectileSize: 6, color: '#6ef0ff', spread: 0.12, count: 2, pierce: 2, sound: 'shoot', tags: ['ice', 'control'] },
  { id: 'bouncer_gun', name: 'Rebotador', rarity: 'rare', damage: 14, fireRate: 3.2, projectileSpeed: 520, projectileSize: 5, color: '#b04dff', spread: 0.05, count: 1, pierce: 1, sound: 'shoot', tags: ['energy', 'bounce'], bounceCount: 3 },

  // ===== EPIC =====
  { id: 'laser', name: 'Lanza de Plasma', rarity: 'epic', damage: 35, fireRate: 2.0, projectileSpeed: 1100, projectileSize: 5, color: '#b04dff', spread: 0, count: 1, pierce: 5, sound: 'shoot_heavy', tags: ['energy', 'piercing'] },
  { id: 'blade_launcher', name: 'Lanzacuchillas', rarity: 'epic', damage: 25, fireRate: 3.0, projectileSpeed: 650, projectileSize: 6, color: '#ff3b5c', spread: 0.15, count: 3, pierce: 3, sound: 'shoot_heavy', tags: ['kinetic', 'slashing'] },
  { id: 'arc_discharger', name: 'Descargador de Arco', rarity: 'epic', damage: 30, fireRate: 2.2, projectileSpeed: 800, projectileSize: 5, color: '#6ef0ff', spread: 0.05, count: 2, pierce: 4, sound: 'shoot_heavy', tags: ['electric', 'piercing'] },
  { id: 'proton_beam', name: 'Rayo Protónico', rarity: 'epic', damage: 40, fireRate: 1.8, projectileSpeed: 1000, projectileSize: 6, color: '#00f0ff', spread: 0, count: 1, pierce: 6, sound: 'shoot_heavy', tags: ['energy', 'precision'] },
  { id: 'plasma_grenade', name: 'Lanzagranadas de Plasma', rarity: 'epic', damage: 32, fireRate: 1.7, projectileSpeed: 460, projectileSize: 7, color: '#ff2bd6', spread: 0.15, count: 3, pierce: 0, sound: 'shoot_heavy', tags: ['explosive', 'area'], explosionRadius: 75 },
  { id: 'gatling_laser', name: 'Láser Gatling', rarity: 'epic', damage: 8, fireRate: 14.0, projectileSpeed: 820, projectileSize: 4, color: '#ff2bd6', spread: 0.08, count: 1, pierce: 2, sound: 'shoot', tags: ['energy', 'rapid', 'precision'] },
  { id: 'riot_shield', name: 'Escudo Antidisturbios', rarity: 'epic', damage: 6, fireRate: 4.0, projectileSpeed: 280, projectileSize: 24, color: '#0099ff', spread: 0, count: 1, pierce: 6, sound: 'hit', tags: ['melee', 'shield', 'push'], sizeMult: 3 },

  // ===== LEGENDARY =====
  { id: 'nova', name: 'Detonador Nova', rarity: 'legendary', damage: 14, fireRate: 2.4, projectileSpeed: 520, projectileSize: 6, color: '#ffe14a', spread: 0.08, count: 8, pierce: 1, sound: 'shoot_heavy', tags: ['energy', 'spread', 'legendary'] },
  { id: 'void_cannon', name: 'Cañón del Vacío', rarity: 'legendary', damage: 45, fireRate: 1.5, projectileSpeed: 450, projectileSize: 10, color: '#b04dff', spread: 0, count: 1, pierce: 8, sound: 'shoot_heavy', tags: ['void', 'heavy'], explosionRadius: 85 },
  { id: 'heavy_sniper', name: 'Rifle Antimateria', rarity: 'legendary', damage: 80, fireRate: 0.9, projectileSpeed: 1200, projectileSize: 5, color: '#ffe14a', spread: 0, count: 1, pierce: 10, sound: 'shoot_heavy', tags: ['kinetic', 'precision', 'legendary'], bounceCount: 2 },
  { id: 'dark_matter_launcher', name: 'Lanzador de Materia Oscura', rarity: 'legendary', damage: 60, fireRate: 1.2, projectileSpeed: 500, projectileSize: 9, color: '#b04dff', spread: 0.05, count: 2, pierce: 5, sound: 'shoot_heavy', tags: ['void', 'legendary'], explosionRadius: 100, burstCount: 2 },
  { id: 'defibrillator', name: 'Desfibrilador Táctico', rarity: 'legendary', damage: 3, fireRate: 6.0, projectileSpeed: 200, projectileSize: 14, color: '#00f0ff', spread: 0, count: 3, pierce: 0, sound: 'shoot', tags: ['support', 'heal'], lifetime: 0.35, sizeMult: 3 },
  { id: 'judgment', name: 'Martillo del Juicio', rarity: 'legendary', damage: 65, fireRate: 0.7, projectileSpeed: 350, projectileSize: 20, color: '#ffe14a', spread: 0, count: 1, pierce: 20, sound: 'shoot_heavy', tags: ['melee', 'heavy', 'legendary'], explosionRadius: 120, burstCount: 1, lifetime: 0.18 },
];

export function getWeapon(id: string): WeaponDef {
  return WEAPONS.find((w) => w.id === id) ?? WEAPONS[0];
}

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#94a3b8',
  uncommon: '#39ff88',
  rare: '#00c8ff',
  epic: '#b04dff',
  legendary: '#ffe14a',
};

/** Statistical summary for display */
export function weaponStatSummary(w: WeaponDef): string[] {
  const s: string[] = [];
  s.push(`Daño: ${w.damage}`);
  s.push(`Cadencia: ${w.fireRate}/s`);
  s.push(`Proy: ${w.count}`);
  s.push(`Perf: ${w.pierce}`);
  if (w.burstCount && w.burstCount > 1) s.push(`Ráfaga: ×${w.burstCount}`);
  if (w.bounceCount && w.bounceCount > 0) s.push(`Rebotes: ${w.bounceCount}`);
  if (w.explosionRadius && w.explosionRadius > 0) s.push(`Explosión: r${w.explosionRadius}`);
  if (w.sizeMult && w.sizeMult > 1) s.push(`Tamaño: ×${w.sizeMult}`);
  if (w.lifetime && w.lifetime !== 1.8) s.push(`Alcance: ${w.lifetime}`);
  return s;
}
