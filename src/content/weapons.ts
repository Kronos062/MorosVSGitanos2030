/* ======================================================================
   weapons.ts — Complete weapon system with qualities.
   ======================================================================
   • Base definitions (WeaponBase) — one per weapon, NO quality/rarity
   • Quality definitions (WeaponQuality) — 5 tiers with stat multipliers
   • GeneratedWeapon — what the player actually holds (base + quality)
   • getWeapon / getGenerated — retrieval helpers
   ====================================================================== */

export type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';

/* ------------------------------------------------------------------ */
/*  Base weapon definitions                                            */
/* ------------------------------------------------------------------ */

export interface WeaponBase {
  id: string;
  name: string;
  /** Intrinsic power tier (affects which tier generates it, but NOT stats). */
  baseRarity: Rarity;
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
  burstCount?: number;
  bounceCount?: number;
  explosionRadius?: number;
  lifetime?: number;
  sizeMult?: number;
}

export const WEAPON_BASES: WeaponBase[] = [
  /* ─────────────────── PISTOLAS ─────────────────── */
  { id: 'pulse_pistol', name: 'Pistola de Pulso', baseRarity: 'common', damage: 12, fireRate: 3.5, projectileSpeed: 550, projectileSize: 4, color: '#00f0ff', spread: 0.04, count: 1, pierce: 0, sound: 'shoot', tags: ['energy', 'basic', 'pistol'] },
  { id: 'zip9', name: 'ZIP-9 Compacta', baseRarity: 'common', damage: 8, fireRate: 5.2, projectileSpeed: 520, projectileSize: 3, color: '#94a3b8', spread: 0.08, count: 1, pierce: 0, sound: 'shoot', tags: ['kinetic', 'fast', 'pistol'] },
  { id: 'rattler45', name: 'Rattler .45', baseRarity: 'uncommon', damage: 18, fireRate: 2.8, projectileSpeed: 600, projectileSize: 5, color: '#ffe14a', spread: 0.03, count: 1, pierce: 1, sound: 'shoot', tags: ['kinetic', 'heavy', 'pistol'] },
  { id: 'crimson_sidearm', name: 'Falcón Carmesí', baseRarity: 'rare', damage: 22, fireRate: 4.0, projectileSpeed: 680, projectileSize: 4, color: '#ff3b5c', spread: 0.05, count: 1, pierce: 1, sound: 'shoot', tags: ['kinetic', 'pistol', 'fire_rate'] },

  /* ─────────────────── REVÓLVERES ─────────────────── */
  { id: 'street_judge', name: 'Juez de Calle', baseRarity: 'uncommon', damage: 28, fireRate: 1.8, projectileSpeed: 720, projectileSize: 6, color: '#ff8800', spread: 0.02, count: 1, pierce: 1, sound: 'shoot_heavy', tags: ['kinetic', 'revolver', 'heavy'] },
  { id: 'iron_python', name: 'Pitón de Hierro', baseRarity: 'rare', damage: 42, fireRate: 1.2, projectileSpeed: 800, projectileSize: 7, color: '#b04dff', spread: 0.01, count: 1, pierce: 2, sound: 'shoot_heavy', tags: ['kinetic', 'revolver', 'heavy'] },
  { id: 'six_shooter_v2', name: 'Six-Shooter V2', baseRarity: 'epic', damage: 55, fireRate: 1.6, projectileSpeed: 900, projectileSize: 7, color: '#ffe14a', spread: 0.04, count: 1, pierce: 3, sound: 'shoot_heavy', tags: ['kinetic', 'revolver', 'piercing'] },

  /* ─────────────────── SUBFUSILES / SMGs ─────────────────── */
  { id: 'street_buzz', name: 'Street Buzz', baseRarity: 'common', damage: 6, fireRate: 9.0, projectileSpeed: 480, projectileSize: 3, color: '#94a3b8', spread: 0.14, count: 1, pierce: 0, sound: 'shoot', tags: ['kinetic', 'smg', 'rapid'] },
  { id: 'vector_x', name: 'Vector-X', baseRarity: 'uncommon', damage: 7, fireRate: 11.0, projectileSpeed: 520, projectileSize: 3, color: '#ffe14a', spread: 0.12, count: 1, pierce: 0, sound: 'shoot', tags: ['kinetic', 'smg', 'rapid'] },
  { id: 'uzi_cyber', name: 'Uzi Cyberpunk', baseRarity: 'rare', damage: 8, fireRate: 13.0, projectileSpeed: 560, projectileSize: 3, color: '#ff8800', spread: 0.16, count: 1, pierce: 1, sound: 'shoot', tags: ['kinetic', 'smg', 'rapid'] },
  { id: 'kriss_vector', name: 'Kriss Spectra', baseRarity: 'epic', damage: 9, fireRate: 15.0, projectileSpeed: 600, projectileSize: 3, color: '#ff2bd6', spread: 0.10, count: 1, pierce: 2, sound: 'shoot', tags: ['kinetic', 'smg', 'rapid'] },

  /* ─────────────────── FUSILES / ARS ─────────────────── */
  { id: 'ar_pulse', name: 'AR-2000 de Pulso', baseRarity: 'common', damage: 10, fireRate: 6.5, projectileSpeed: 600, projectileSize: 4, color: '#94a3b8', spread: 0.06, count: 1, pierce: 0, sound: 'shoot', tags: ['kinetic', 'ar', 'balanced'] },
  { id: 'mk_carbine', name: 'MK-16 Carbine', baseRarity: 'uncommon', damage: 13, fireRate: 7.0, projectileSpeed: 650, projectileSize: 4, color: '#39ff88', spread: 0.05, count: 1, pierce: 1, sound: 'shoot', tags: ['kinetic', 'ar', 'balanced'] },
  { id: 'honey_badger', name: 'Mangosta Asesina', baseRarity: 'rare', damage: 14, fireRate: 8.5, projectileSpeed: 700, projectileSize: 4, color: '#ffe14a', spread: 0.07, count: 1, pierce: 1, sound: 'shoot', tags: ['kinetic', 'ar', 'rapid'] },
  { id: 'ak_milspec', name: 'AK-2077 Militar', baseRarity: 'epic', damage: 16, fireRate: 7.5, projectileSpeed: 680, projectileSize: 5, color: '#ff5500', spread: 0.06, count: 1, pierce: 2, sound: 'shoot_heavy', tags: ['kinetic', 'ar', 'heavy'] },

  /* ─────────────────── ESCOPETAS ─────────────────── */
  { id: 'street_sawed', name: 'Escopeta Serrada', baseRarity: 'common', damage: 6, fireRate: 1.4, projectileSpeed: 400, projectileSize: 4, color: '#94a3b8', spread: 0.40, count: 6, pierce: 0, sound: 'shoot_heavy', tags: ['kinetic', 'shotgun', 'spread'] },
  { id: 'scatter_pump', name: 'Scatter-Pump', baseRarity: 'uncommon', damage: 8, fireRate: 1.6, projectileSpeed: 480, projectileSize: 4, color: '#ffe14a', spread: 0.35, count: 5, pierce: 0, sound: 'shoot_heavy', tags: ['kinetic', 'shotgun', 'spread'] },
  { id: 'double_hammer', name: 'Martillo Doble', baseRarity: 'rare', damage: 10, fireRate: 1.2, projectileSpeed: 520, projectileSize: 5, color: '#ff3b5c', spread: 0.38, count: 7, pierce: 1, sound: 'shoot_heavy', tags: ['kinetic', 'shotgun', 'heavy'] },
  { id: 'sawed_spas', name: 'SPAS-Doom', baseRarity: 'epic', damage: 12, fireRate: 1.5, projectileSpeed: 560, projectileSize: 5, color: '#b04dff', spread: 0.42, count: 8, pierce: 2, sound: 'shoot_heavy', tags: ['kinetic', 'shotgun', 'piercing'] },

  /* ─────────────────── RIFLES DE PRECISIÓN ─────────────────── */
  { id: 'hunting_rifle', name: 'Rifle de Caza', baseRarity: 'common', damage: 30, fireRate: 1.0, projectileSpeed: 1100, projectileSize: 4, color: '#94a3b8', spread: 0.01, count: 1, pierce: 1, sound: 'shoot_heavy', tags: ['kinetic', 'sniper', 'precision'] },
  { id: 'rail_scout', name: 'Rail Scout', baseRarity: 'uncommon', damage: 38, fireRate: 1.2, projectileSpeed: 1200, projectileSize: 4, color: '#39ff88', spread: 0, count: 1, pierce: 2, sound: 'shoot_heavy', tags: ['energy', 'sniper', 'precision'] },
  { id: 'rail_driver', name: 'Rail Driver', baseRarity: 'rare', damage: 22, fireRate: 5.0, projectileSpeed: 900, projectileSize: 3, color: '#ff2bd6', spread: 0.02, count: 1, pierce: 2, sound: 'shoot_heavy', tags: ['energy', 'precision', 'rail'] },
  { id: 'antimateriel', name: 'Rifle Antimateria', baseRarity: 'epic', damage: 80, fireRate: 0.9, projectileSpeed: 1200, projectileSize: 5, color: '#ffe14a', spread: 0, count: 1, pierce: 10, sound: 'shoot_heavy', tags: ['kinetic', 'sniper', 'heavy'] },
  { id: 'void_sniper', name: 'Franco del Vacío', baseRarity: 'legendary', damage: 110, fireRate: 0.6, projectileSpeed: 1400, projectileSize: 6, color: '#b04dff', spread: 0, count: 1, pierce: 15, sound: 'shoot_heavy', tags: ['void', 'sniper', 'legendary'] },

  /* ─────────────────── AMETRALLADORAS ─────────────────── */
  { id: 'lmg_pork', name: 'Porquero Ligero', baseRarity: 'uncommon', damage: 7, fireRate: 8.5, projectileSpeed: 620, projectileSize: 3, color: '#ffe14a', spread: 0.14, count: 1, pierce: 0, sound: 'shoot', tags: ['kinetic', 'lmg', 'rapid'] },
  { id: 'mg_beltfed', name: 'MG-60 Cinturón', baseRarity: 'rare', damage: 9, fireRate: 10.0, projectileSpeed: 750, projectileSize: 3, color: '#ff8800', spread: 0.18, count: 1, pierce: 0, sound: 'shoot', tags: ['kinetic', 'lmg', 'rapid'] },
  { id: 'minigun', name: 'Minigun Rotatoria', baseRarity: 'rare', damage: 9, fireRate: 10.0, projectileSpeed: 750, projectileSize: 3, color: '#ff8800', spread: 0.18, count: 1, pierce: 0, sound: 'shoot', tags: ['kinetic', 'lmg', 'rapid'] },
  { id: 'bfg_minigun', name: 'BFG Minigun', baseRarity: 'epic', damage: 10, fireRate: 12.0, projectileSpeed: 820, projectileSize: 4, color: '#ff3b5c', spread: 0.15, count: 1, pierce: 1, sound: 'shoot', tags: ['kinetic', 'lmg', 'heavy'] },
  { id: 'gatling_laser', name: 'Láser Gatling', baseRarity: 'epic', damage: 8, fireRate: 14.0, projectileSpeed: 820, projectileSize: 4, color: '#ff2bd6', spread: 0.08, count: 1, pierce: 2, sound: 'shoot', tags: ['energy', 'lmg', 'precision'] },

  /* ─────────────────── ENERGÍA ─────────────────── */
  { id: 'blaster', name: 'Blaster Estándar', baseRarity: 'common', damage: 10, fireRate: 3.0, projectileSpeed: 580, projectileSize: 5, color: '#00f0ff', spread: 0.06, count: 1, pierce: 0, sound: 'shoot', tags: ['energy', 'basic'] },
  { id: 'sonic_blaster', name: 'Blaster Sónico', baseRarity: 'uncommon', damage: 15, fireRate: 2.8, projectileSpeed: 500, projectileSize: 7, color: '#39ff88', spread: 0.20, count: 3, pierce: 1, sound: 'shoot', tags: ['sonic', 'area'] },
  { id: 'venom_blaster', name: 'Blaster Biotóxico', baseRarity: 'uncommon', damage: 11, fireRate: 4.2, projectileSpeed: 580, projectileSize: 4, color: '#9dff00', spread: 0.06, count: 1, pierce: 1, sound: 'shoot', tags: ['bio', 'toxic'] },
  { id: 'plasma_rifle', name: 'Lanza de Plasma', baseRarity: 'epic', damage: 35, fireRate: 2.0, projectileSpeed: 1100, projectileSize: 5, color: '#b04dff', spread: 0, count: 1, pierce: 5, sound: 'shoot_heavy', tags: ['energy', 'piercing'] },
  { id: 'proton_beam', name: 'Rayo Protónico', baseRarity: 'epic', damage: 40, fireRate: 1.8, projectileSpeed: 1000, projectileSize: 6, color: '#00f0ff', spread: 0, count: 1, pierce: 6, sound: 'shoot_heavy', tags: ['energy', 'precision'] },
  { id: 'arc_discharger', name: 'Descargador de Arco', baseRarity: 'epic', damage: 30, fireRate: 2.2, projectileSpeed: 800, projectileSize: 5, color: '#6ef0ff', spread: 0.05, count: 2, pierce: 4, sound: 'shoot_heavy', tags: ['electric', 'piercing'] },
  { id: 'tesla_gun', name: 'Cañón Tesla', baseRarity: 'rare', damage: 16, fireRate: 3.8, projectileSpeed: 620, projectileSize: 5, color: '#6ef0ff', spread: 0.10, count: 2, pierce: 2, sound: 'shoot', tags: ['electric', 'chain'], burstCount: 2 },
  { id: 'bouncer_gun', name: 'Rebotador', baseRarity: 'rare', damage: 14, fireRate: 3.2, projectileSpeed: 520, projectileSize: 5, color: '#b04dff', spread: 0.05, count: 1, pierce: 1, sound: 'shoot', tags: ['energy', 'bounce'], bounceCount: 3 },
  { id: 'nova_cannon', name: 'Detonador Nova', baseRarity: 'legendary', damage: 14, fireRate: 2.4, projectileSpeed: 520, projectileSize: 6, color: '#ffe14a', spread: 0.08, count: 8, pierce: 1, sound: 'shoot_heavy', tags: ['energy', 'spread', 'legendary'] },

  /* ─────────────────── FUEGO / ÁREA ─────────────────── */
  { id: 'flame_thrower', name: 'Lanzallamas Térmico', baseRarity: 'rare', damage: 6, fireRate: 12.0, projectileSpeed: 380, projectileSize: 8, color: '#ff6a00', spread: 0.25, count: 2, pierce: 3, sound: 'shoot', tags: ['fire', 'area'], lifetime: 0.6 },
  { id: 'frost_cannon', name: 'Cañón Criogénico', baseRarity: 'rare', damage: 20, fireRate: 2.5, projectileSpeed: 600, projectileSize: 6, color: '#6ef0ff', spread: 0.12, count: 2, pierce: 2, sound: 'shoot', tags: ['ice', 'control'] },
  { id: 'cluster_mortar', name: 'Mortero de Cúmulo', baseRarity: 'rare', damage: 18, fireRate: 1.4, projectileSpeed: 400, projectileSize: 8, color: '#ff3b5c', spread: 0.30, count: 4, pierce: 0, sound: 'shoot_heavy', tags: ['explosive', 'spread'], explosionRadius: 60 },
  { id: 'plasma_grenade', name: 'Lanzagranadas de Plasma', baseRarity: 'epic', damage: 32, fireRate: 1.7, projectileSpeed: 460, projectileSize: 7, color: '#ff2bd6', spread: 0.15, count: 3, pierce: 0, sound: 'shoot_heavy', tags: ['explosive', 'area'], explosionRadius: 75 },

  /* ─────────────────── LANZACOHETES / LANZADORES ─────────────────── */
  { id: 'rpg_junk', name: 'RPG Chatarra', baseRarity: 'uncommon', damage: 40, fireRate: 0.8, projectileSpeed: 350, projectileSize: 8, color: '#ff8800', spread: 0.03, count: 1, pierce: 0, sound: 'shoot_heavy', tags: ['explosive', 'launcher'], explosionRadius: 80, lifetime: 1.5 },
  { id: 'missile_pack', name: 'Misil-6 Táctico', baseRarity: 'rare', damage: 55, fireRate: 0.7, projectileSpeed: 400, projectileSize: 9, color: '#ff3b5c', spread: 0.02, count: 1, pierce: 0, sound: 'shoot_heavy', tags: ['explosive', 'launcher', 'heavy'], explosionRadius: 100, lifetime: 1.5 },
  { id: 'rocket_mlr', name: 'MLR de Asalto', baseRarity: 'epic', damage: 35, fireRate: 1.4, projectileSpeed: 380, projectileSize: 7, color: '#ffe14a', spread: 0.10, count: 3, pierce: 0, sound: 'shoot_heavy', tags: ['explosive', 'launcher', 'spread'], explosionRadius: 70, lifetime: 1.3 },

  /* ─────────────────── EXPERIMENTALES / EXÓTICAS ─────────────────── */
  { id: 'void_cannon', name: 'Cañón del Vacío', baseRarity: 'legendary', damage: 45, fireRate: 1.5, projectileSpeed: 450, projectileSize: 10, color: '#b04dff', spread: 0, count: 1, pierce: 8, sound: 'shoot_heavy', tags: ['void', 'heavy'], explosionRadius: 85 },
  { id: 'dark_matter', name: 'Lanzador de Materia Oscura', baseRarity: 'legendary', damage: 60, fireRate: 1.2, projectileSpeed: 500, projectileSize: 9, color: '#b04dff', spread: 0.05, count: 2, pierce: 5, sound: 'shoot_heavy', tags: ['void', 'legendary'], explosionRadius: 100, burstCount: 2 },
  { id: 'quantum_caster', name: 'Teje-Cuánticos', baseRarity: 'legendary', damage: 30, fireRate: 3.0, projectileSpeed: 650, projectileSize: 5, color: '#00f0ff', spread: 0.12, count: 4, pierce: 3, sound: 'shoot', tags: ['energy', 'experimental'], bounceCount: 1, burstCount: 2 },
  { id: 'chrono_disruptor', name: 'Disruptor Cronológico', baseRarity: 'legendary', damage: 25, fireRate: 2.0, projectileSpeed: 700, projectileSize: 6, color: '#ffe14a', spread: 0.04, count: 2, pierce: 2, sound: 'shoot_heavy', tags: ['experimental', 'temporal'], burstCount: 3 },
  { id: 'gravity_well', name: 'Pozo Gravitatorio', baseRarity: 'legendary', damage: 40, fireRate: 1.0, projectileSpeed: 300, projectileSize: 12, color: '#b04dff', spread: 0, count: 1, pierce: 4, sound: 'shoot_heavy', tags: ['experimental', 'void'], explosionRadius: 120, sizeMult: 2, lifetime: 1.2 },

  /* ─────────────────── ARMAS CUERPO A CUERPO ─────────────────── */
  { id: 'bat', name: 'Bate de Callejón', baseRarity: 'common', damage: 28, fireRate: 1.4, projectileSpeed: 0, projectileSize: 18, color: '#94a3b8', spread: 0, count: 1, pierce: 3, sound: 'hit', tags: ['melee', 'kinetic'], burstCount: 1, lifetime: 0.12 },
  { id: 'cutter', name: 'Cuchillo Táctico', baseRarity: 'common', damage: 18, fireRate: 2.5, projectileSpeed: 0, projectileSize: 12, color: '#94a3b8', spread: 0, count: 1, pierce: 1, sound: 'hit', tags: ['melee', 'kinetic', 'fast'], burstCount: 1, lifetime: 0.1 },
  { id: 'axe_heavy', name: 'Hacha Pesada', baseRarity: 'uncommon', damage: 42, fireRate: 1.0, projectileSpeed: 0, projectileSize: 22, color: '#ff8800', spread: 0, count: 1, pierce: 5, sound: 'hit', tags: ['melee', 'heavy'], burstCount: 1, lifetime: 0.15 },
  { id: 'spud_gun', name: 'Lanzapatatas', baseRarity: 'common', damage: 15, fireRate: 2.8, projectileSpeed: 340, projectileSize: 10, color: '#ff8800', spread: 0.10, count: 1, pierce: 0, sound: 'shoot', tags: ['kinetic', 'slow'], bounceCount: 1 },
  { id: 'blade_launcher', name: 'Lanzacuchillas', baseRarity: 'epic', damage: 25, fireRate: 3.0, projectileSpeed: 650, projectileSize: 6, color: '#ff3b5c', spread: 0.15, count: 3, pierce: 3, sound: 'shoot_heavy', tags: ['kinetic', 'slashing'] },
  { id: 'riot_shield', name: 'Escudo Antidisturbios', baseRarity: 'epic', damage: 6, fireRate: 4.0, projectileSpeed: 280, projectileSize: 24, color: '#0099ff', spread: 0, count: 1, pierce: 6, sound: 'hit', tags: ['melee', 'shield', 'push'], sizeMult: 3 },
  { id: 'judgment', name: 'Martillo del Juicio', baseRarity: 'legendary', damage: 65, fireRate: 0.7, projectileSpeed: 350, projectileSize: 20, color: '#ffe14a', spread: 0, count: 1, pierce: 20, sound: 'shoot_heavy', tags: ['melee', 'heavy', 'legendary'], explosionRadius: 120, burstCount: 1, lifetime: 0.18 },

  /* ─────────────────── SOPORTE / ÚTILES ─────────────────── */
  { id: 'heal_beacon', name: 'Baliza Curativa', baseRarity: 'rare', damage: 3, fireRate: 6.0, projectileSpeed: 200, projectileSize: 14, color: '#39ff88', spread: 0, count: 3, pierce: 0, sound: 'shoot', tags: ['support', 'heal'], lifetime: 0.35, sizeMult: 3 },
  { id: 'defibrillator', name: 'Desfibrilador Táctico', baseRarity: 'legendary', damage: 3, fireRate: 6.0, projectileSpeed: 200, projectileSize: 14, color: '#00f0ff', spread: 0, count: 3, pierce: 0, sound: 'shoot', tags: ['support', 'heal', 'legendary'], lifetime: 0.35, sizeMult: 3 },
];

/* ------------------------------------------------------------------ */
/*  Weapon Qualities — stat multipliers per tier                       */
/* ------------------------------------------------------------------ */

export interface WeaponQualityDef {
  rarity: Rarity;
  label: string;
  /** Multiplicative bonus to all numerical stats */
  damageMult: number;
  fireRateMult: number;
  projSpeedMult: number;
  projSizeMult: number;
  /** Additive bonus to count/pierce/bounces */
  countBonus: number;
  pierceBonus: number;
  bounceBonus: number;
  explosionMult: number;
  lifetimeMult: number;
  /** Drop probability weight (heavier = more common) */
  dropWeight: number;
  /** Visual color for quality name */
  color: string;
}

export const WEAPON_QUALITIES: WeaponQualityDef[] = [
  // Base drop weights ≈ 60/25/10/4/1 distribution.
  { rarity: 'common',    label: 'Común',         damageMult: 1.00, fireRateMult: 1.00, projSpeedMult: 1.00, projSizeMult: 1.00, countBonus: 0, pierceBonus: 0, bounceBonus: 0, explosionMult: 1.0, lifetimeMult: 1.0, dropWeight: 60,  color: '#94a3b8' },
  { rarity: 'uncommon',  label: 'Poco Común',    damageMult: 1.15, fireRateMult: 1.08, projSpeedMult: 1.05, projSizeMult: 1.05, countBonus: 0, pierceBonus: 0, bounceBonus: 0, explosionMult: 1.1, lifetimeMult: 1.05, dropWeight: 25,  color: '#39ff88' },
  { rarity: 'rare',      label: 'Rara',           damageMult: 1.30, fireRateMult: 1.15, projSpeedMult: 1.10, projSizeMult: 1.10, countBonus: 0, pierceBonus: 1, bounceBonus: 0, explosionMult: 1.2, lifetimeMult: 1.10, dropWeight: 10,  color: '#00c8ff' },
  { rarity: 'epic',      label: 'Épica',          damageMult: 1.50, fireRateMult: 1.25, projSpeedMult: 1.15, projSizeMult: 1.15, countBonus: 1, pierceBonus: 2, bounceBonus: 1, explosionMult: 1.4, lifetimeMult: 1.15, dropWeight: 4,   color: '#b04dff' },
  { rarity: 'legendary', label: 'Legendaria',     damageMult: 1.80, fireRateMult: 1.35, projSpeedMult: 1.25, projSizeMult: 1.25, countBonus: 2, pierceBonus: 3, bounceBonus: 2, explosionMult: 1.6, lifetimeMult: 1.30, dropWeight: 1,   color: '#ffe14a' },
];

/* ------------------------------------------------------------------ */
/*  AFFIXES — reusable modifiers applicable to compatible weapons      */
/* ------------------------------------------------------------------ */

export type AffixKind = 'offensive' | 'elemental' | 'special';
/** Runtime status the projectile may carry (handled generically by the engine). */
export type AffixElement = 'fire' | 'ice' | 'electric' | 'toxic' | 'radiant' | 'dark';

export interface AffixDef {
  id: string;
  name: string;
  kind: AffixKind;
  description: string;
  color: string;
  /** Multiplicative stat modifiers (optional). */
  damageMult?: number;
  fireRateMult?: number;
  spreadMult?: number;
  projSpeedMult?: number;
  projSizeMult?: number;
  /** Additive modifiers. */
  pierceBonus?: number;
  bounceBonus?: number;
  explosionBonus?: number;
  countBonus?: number;
  /** Behaviour flags carried into the projectile. */
  lifesteal?: number;         // fraction of damage healed
  element?: AffixElement;     // applies a status effect on hit
  elementChance?: number;     // chance to apply status (0..1)
  chain?: number;             // extra targets hit by a bounce arc
  chainChance?: number;       // chance to chain per hit
  unstable?: boolean;         // random extra damage variance
  /** Tag compatibility: weapon must include ANY of `requires` (if set)
   *  and must NOT include any of `forbids`. Empty requires = any weapon. */
  requires?: string[];
  forbids?: string[];
}

export const AFFIXES: AffixDef[] = [
  /* ─────────── OFENSIVOS ─────────── */
  { id: 'heavy',      name: 'Pesada',      kind: 'offensive', color: '#ff8800', description: '+35% daño, -20% cadencia.', damageMult: 1.35, fireRateMult: 0.80 },
  { id: 'light',      name: 'Ligera',      kind: 'offensive', color: '#39ff88', description: '+30% cadencia, -12% daño.', fireRateMult: 1.30, damageMult: 0.88, forbids: ['melee'] },
  { id: 'precise',    name: 'Precisa',     kind: 'offensive', color: '#00c8ff', description: '-70% dispersión, +8% velocidad de proyectil.', spreadMult: 0.30, projSpeedMult: 1.08, forbids: ['melee'] },
  { id: 'brutal',     name: 'Brutal',      kind: 'offensive', color: '#ff3b5c', description: '+22% daño, +10% tamaño de proyectil.', damageMult: 1.22, projSizeMult: 1.10 },
  { id: 'devastating',name: 'Devastadora', kind: 'offensive', color: '#ff2bd6', description: '+50% daño, -25% cadencia, +1 penetración.', damageMult: 1.50, fireRateMult: 0.75, pierceBonus: 1 },
  { id: 'lethal',     name: 'Letal',       kind: 'offensive', color: '#ffe14a', description: '+18% daño, +1 penetración.', damageMult: 1.18, pierceBonus: 1 },
  { id: 'frenetic',   name: 'Frenética',   kind: 'offensive', color: '#ff8800', description: '+45% cadencia, +18% dispersión.', fireRateMult: 1.45, spreadMult: 1.18, forbids: ['melee', 'launcher'] },

  /* ─────────── ELEMENTALES ─────────── */
  { id: 'igneous',    name: 'Ígnea',       kind: 'elemental', color: '#ff6a00', description: 'Quema al impactar (daño en el tiempo).', element: 'fire', elementChance: 0.5, damageMult: 1.05, forbids: ['fire'] },
  { id: 'glacial',    name: 'Glacial',     kind: 'elemental', color: '#6ef0ff', description: 'Ralentiza al impactar (efecto hielo).', element: 'ice', elementChance: 0.5, forbids: ['ice'] },
  { id: 'electric',   name: 'Eléctrica',   kind: 'elemental', color: '#6ef0ff', description: '20% de encadenar rayos entre enemigos cercanos.', element: 'electric', chain: 2, chainChance: 0.2, forbids: ['electric'] },
  { id: 'toxic',      name: 'Tóxica',      kind: 'elemental', color: '#9dff00', description: 'Envenena al impactar (daño en el tiempo).', element: 'toxic', elementChance: 0.5, forbids: ['toxic'] },
  { id: 'radiant',    name: 'Radiactiva',  kind: 'elemental', color: '#ffe14a', description: 'Daño de área radiactivo al impactar.', element: 'radiant', elementChance: 0.4, explosionBonus: 30 },
  { id: 'dark',       name: 'Oscura',      kind: 'elemental', color: '#b04dff', description: 'Marca oscura: +15% daño y curación por baja.', element: 'dark', lifesteal: 0.04, damageMult: 1.15 },

  /* ─────────── ESPECIALES ─────────── */
  { id: 'vampiric',   name: 'Vampírica',   kind: 'special', color: '#ff3b5c', description: 'Cura un 8% del daño infligido.', lifesteal: 0.08 },
  { id: 'explosive',  name: 'Explosiva',   kind: 'special', color: '#ff5500', description: 'Los proyectiles explotan al impactar.', explosionBonus: 55, forbids: ['launcher', 'explosive', 'melee'] },
  { id: 'bouncing',   name: 'Rebotadora',  kind: 'special', color: '#b04dff', description: '+2 rebotes en los proyectiles.', bounceBonus: 2, forbids: ['fire', 'melee', 'launcher'] },
  { id: 'piercing',   name: 'Perforante',  kind: 'special', color: '#00f0ff', description: '+3 penetración.', pierceBonus: 3, forbids: ['melee'] },
  { id: 'unstable',   name: 'Inestable',   kind: 'special', color: '#ff2bd6', description: 'Daño errático: entre -25% y +75%.', unstable: true, damageMult: 1.05 },
  { id: 'quantum',    name: 'Cuántica',    kind: 'special', color: '#00f0ff', description: '+1 proyectil, +1 penetración.', countBonus: 1, pierceBonus: 1, forbids: ['melee'] },
];

export function getAffix(id: string): AffixDef | undefined {
  return AFFIXES.find((a) => a.id === id);
}

function affixCompatible(a: AffixDef, base: WeaponBase): boolean {
  if (a.forbids && a.forbids.some((t) => base.tags.includes(t))) return false;
  if (a.requires && a.requires.length > 0 && !a.requires.some((t) => base.tags.includes(t))) return false;
  return true;
}

export function pickCompatibleAffix(base: WeaponBase): AffixDef | undefined {
  const pool = AFFIXES.filter((a) => affixCompatible(a, base));
  if (pool.length === 0) return undefined;
  return pool[Math.floor(Math.random() * pool.length)];
}

/** Probability a weapon of a given quality rolls an affix. */
export const AFFIX_CHANCE: Record<Rarity, number> = {
  common: 0.0,
  uncommon: 0.2,
  rare: 0.45,
  epic: 0.75,
  legendary: 1.0,
};

/* ------------------------------------------------------------------ */
/*  Generated Weapon — what actually gets used at runtime               */
/* ------------------------------------------------------------------ */

export interface GeneratedWeapon {
  /** Unique runtime id (e.g. "gen_42") */
  genId: string;
  baseId: string;
  quality: Rarity;
  name: string;
  color: string;
  damage: number;
  fireRate: number;
  projectileSpeed: number;
  projectileSize: number;
  spread: number;
  count: number;
  pierce: number;
  bounceCount: number;
  explosionRadius: number;
  lifetime: number;
  sizeMult: number;
  burstCount: number;
  sound: string;
  tags: string[];
  /** Affix data (optional). */
  affixId?: string;
  affixName?: string;
  affixColor?: string;
  affixDescription?: string;
  lifesteal?: number;
  element?: AffixElement;
  elementChance?: number;
  chain?: number;
  chainChance?: number;
  unstable?: boolean;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

export function getBaseWeapon(id: string): WeaponBase {
  return WEAPON_BASES.find((w) => w.id === id) ?? WEAPON_BASES[0];
}

export function getQualityDef(rarity: Rarity): WeaponQualityDef {
  return WEAPON_QUALITIES.find((q) => q.rarity === rarity) ?? WEAPON_QUALITIES[0];
}

/**
 * Quality roll with map progression.
 *  - `mapNumber` (1..totalMaps): higher maps shift odds toward rarer tiers.
 *  - `highTier`: chest/boss loot; boosts odds further and excludes 'common'.
 *
 * The progression multiplies each tier's base weight by a factor derived from
 * how "advanced" the run is. Legendaries are near-impossible on map 1 and grow
 * meaningfully on later maps.
 */
export function rollQuality(highTier: boolean, mapNumber = 1, totalMaps = 10): Rarity {
  // progress 0 (map 1) → 1 (final map)
  const progress = Math.max(0, Math.min(1, (mapNumber - 1) / Math.max(1, totalMaps - 1)));

  // Per-tier progression multiplier: better tiers scale up strongly with progress.
  const tierBoost: Record<Rarity, number> = {
    common: 1 - progress * 0.6,        // becomes less common late
    uncommon: 1 + progress * 0.2,
    rare: 0.4 + progress * 1.6,        // ramps up
    epic: 0.15 + progress * 2.4,       // ramps up hard
    legendary: 0.02 + progress * 1.8,  // near-zero early, real late
  };

  const pool = (highTier
    ? WEAPON_QUALITIES.filter((q) => q.rarity !== 'common')
    : WEAPON_QUALITIES
  ).map((q) => ({
    rarity: q.rarity,
    weight: Math.max(0.0001, q.dropWeight * tierBoost[q.rarity] * (highTier ? 1.15 : 1)),
  }));

  const total = pool.reduce((s, q) => s + q.weight, 0);
  let r = Math.random() * total;
  for (const q of pool) {
    r -= q.weight;
    if (r <= 0) return q.rarity;
  }
  return pool[0].rarity;
}

export function generateWeapon(
  baseId: string,
  quality: Rarity,
  genId: string,
  affixId?: string | null,
): GeneratedWeapon {
  const b = getBaseWeapon(baseId);
  const q = getQualityDef(quality);

  // Base stats from quality
  let damage = b.damage * q.damageMult;
  let fireRate = b.fireRate * q.fireRateMult;
  let projectileSpeed = b.projectileSpeed * q.projSpeedMult;
  let projectileSize = b.projectileSize * q.projSizeMult;
  let spread = b.spread;
  let count = b.count + q.countBonus;
  let pierce = b.pierce + q.pierceBonus;
  let bounceCount = (b.bounceCount ?? 0) + q.bounceBonus;
  let explosionRadius = (b.explosionRadius ?? 0) * q.explosionMult;

  // Resolve affix (either explicit or none)
  const affix = affixId ? getAffix(affixId) : undefined;
  let displayName = `${b.name} [${q.label}]`;
  const gw: GeneratedWeapon = {
    genId,
    baseId: b.id,
    quality: q.rarity,
    name: displayName,
    color: q.color,
    damage: 0, fireRate: 0, projectileSpeed: 0, projectileSize: 0,
    spread: 0, count: 0, pierce: 0, bounceCount: 0, explosionRadius: 0,
    lifetime: +(b.lifetime ?? 1.8) * q.lifetimeMult,
    sizeMult: b.sizeMult ?? 1,
    burstCount: b.burstCount ?? 1,
    sound: b.sound,
    tags: b.tags,
  };

  if (affix) {
    damage *= affix.damageMult ?? 1;
    fireRate *= affix.fireRateMult ?? 1;
    spread *= affix.spreadMult ?? 1;
    projectileSpeed *= affix.projSpeedMult ?? 1;
    projectileSize *= affix.projSizeMult ?? 1;
    pierce += affix.pierceBonus ?? 0;
    bounceCount += affix.bounceBonus ?? 0;
    explosionRadius += affix.explosionBonus ?? 0;
    count += affix.countBonus ?? 0;

    gw.affixId = affix.id;
    gw.affixName = affix.name;
    gw.affixColor = affix.color;
    gw.affixDescription = affix.description;
    gw.lifesteal = affix.lifesteal;
    gw.element = affix.element;
    gw.elementChance = affix.elementChance;
    gw.chain = affix.chain;
    gw.chainChance = affix.chainChance;
    gw.unstable = affix.unstable;

    displayName = `${b.name} [${q.label} · ${affix.name}]`;
    gw.name = displayName;
    // Tint toward the affix color for legendary flair
    gw.color = affix.color;
  }

  gw.damage = Math.round(damage);
  gw.fireRate = +fireRate.toFixed(2);
  gw.projectileSpeed = Math.round(projectileSpeed);
  gw.projectileSize = +projectileSize.toFixed(1);
  gw.spread = +spread.toFixed(3);
  gw.count = count;
  gw.pierce = pierce;
  gw.bounceCount = bounceCount;
  gw.explosionRadius = Math.round(explosionRadius);

  return gw;
}

/** Legacy-compatible lookup: treats unknown IDs as generated weapon keys first. */
const generatedWeaponMap = new Map<string, GeneratedWeapon>();

export function registerGenerated(gw: GeneratedWeapon): void {
  generatedWeaponMap.set(gw.genId, gw);
}

export function getWeapon(id: string): GeneratedWeapon {
  const gw = generatedWeaponMap.get(id);
  if (gw) return gw;
  // Fallback: wrap a base definition as a genId=base.id GeneratedWeapon (common quality)
  return generateWeapon(id, 'common', id);
}

export const RARITY_COLORS: Record<Rarity, string> = {
  common: '#94a3b8', uncommon: '#39ff88', rare: '#00c8ff', epic: '#b04dff', legendary: '#ffe14a',
};

export function weaponStatSummary(gw: GeneratedWeapon): string[] {
  const s: string[] = [];
  s.push(`Daño: ${gw.damage}`);
  s.push(`Cadencia: ${gw.fireRate}/s`);
  s.push(`Proy: ${gw.count}`);
  s.push(`Perf: ${gw.pierce}`);
  if (gw.burstCount > 1) s.push(`Ráfaga: ×${gw.burstCount}`);
  if (gw.bounceCount > 0) s.push(`Rebotes: ${gw.bounceCount}`);
  if (gw.explosionRadius > 0) s.push(`Explosión: r${gw.explosionRadius}`);
  if (gw.sizeMult > 1) s.push(`Tamaño: ×${gw.sizeMult}`);
  if (gw.lifetime !== 1.8) s.push(`Alcance: ${gw.lifetime.toFixed(2)}s`);
  return s;
}

/**
 * Full loot roll: base + quality (with map progression) + optional compatible affix.
 */
export function pickRandomWeaponId(
  highTier: boolean,
  mapNumber = 1,
  totalMaps = 10,
): { baseId: string; quality: Rarity; affixId: string | null } {
  const pool = highTier
    ? WEAPON_BASES.filter((b) => ['rare', 'epic', 'legendary'].includes(b.baseRarity))
    : WEAPON_BASES;
  const base = pool[Math.floor(Math.random() * pool.length)] ?? WEAPON_BASES[0];
  const quality = rollQuality(highTier, mapNumber, totalMaps);

  let affixId: string | null = null;
  if (Math.random() < (AFFIX_CHANCE[quality] ?? 0)) {
    const affix = pickCompatibleAffix(base);
    if (affix) affixId = affix.id;
  }

  return { baseId: base.id, quality, affixId };
}
