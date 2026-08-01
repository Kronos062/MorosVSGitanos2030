export interface Vec2 {
  x: number;
  y: number;
}

export interface Projectile {
  id: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  damage: number;
  color: string;
  size: number;
  pierce: number;
  pierced: Set<number>;
  life: number;
  owner: 'player' | 'enemy';
  _bounceCount?: number;
  _explosionRadius?: number;
}

export interface EnemyEntity {
  id: number;
  defId: string;
  name: string;
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  speed: number;
  damage: number;
  size: number;
  color: string;
  glow: string;
  shape: string;
  score: number;
  xp: number;
  aiProfile: 'chaser' | 'ranged_kiter' | 'bomber_rush';
  attackRange: number;
  attackCooldown: number;
  attackTimer: number;
  projectile?: { speed: number; color: string; size: number };
  explosionRadius?: number;
  hitFlash: number;
  spawnAnim: number;
  isBoss: boolean;
}

export interface PickupEntity {
  id: number;
  x: number;
  y: number;
  kind: 'heal' | 'score' | 'weapon' | 'shield' | 'item';
  color: string;
  value: number;
  weaponId?: string;
  itemId?: string;
  bob: number;
  life: number;
}

export interface ChestEntity {
  id: number;
  defId: string;
  x: number;
  y: number;
  opened: boolean;
  color: string;
  glow: string;
  name: string;
  roomId: number;
}

export interface RoomBounds {
  x: number;
  y: number;
  w: number;
  h: number;
}

export type RoomKind = 'start' | 'combat' | 'treasure' | 'boss' | 'portal';

export interface RoomNode {
  id: number;
  kind: RoomKind;
  bounds: RoomBounds;
  status: 'locked' | 'active' | 'cleared';
  discovered: boolean;
  connections: number[];
  label: string;
}

export interface CorridorNode {
  id: number;
  from: number;
  to: number;
  bounds: RoomBounds;
}

export interface MinimapData {
  rooms: Array<{
    id: number;
    kind: RoomKind;
    bounds: RoomBounds;
    status: RoomNode['status'];
    discovered: boolean;
    label: string;
  }>;
  corridors: Array<{
    from: number;
    to: number;
    bounds: RoomBounds;
    discovered: boolean;
  }>;
  currentRoomId: number;
  player: { x: number; y: number };
}

export type InputAction =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'interact'
  | 'attack'
  | 'dash'
  | 'pause'
  | 'openBuild'
  | 'openMap';

export type KeyBindings = Record<InputAction, string>;


export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export type EquipSlot = 'helm' | 'chest' | 'pants' | 'boots';

export interface PlayerState {
  x: number;
  y: number;
  hp: number;
  maxHp: number;
  shield: number;
  speed: number;
  armor: number;
  critChance: number;
  facingX: number;
  facingY: number;
  isDashing: boolean;
  dashTime: number;
  dashCooldown: number;
  dashCooldownMax: number;
  xp: number;
  level: number;
  xpToNext: number;
  weaponId: string;
  fireCooldown: number;
  invuln: number;
  color: string;
  glow: string;
  name: string;
  damageMult: number;
  speedMult: number;
  pierceBonus: number;
  countBonus: number;
  lifesteal: number;
  fireRateMult: number;
  projectileSizeBonus: number;
  bounceBonus: number;
  explosionBonus: number;
  /** One item id per slot, null = empty */
  equipment: Record<EquipSlot, string | null>;
  /** Crit damage multiplier (default 2, can be boosted by sets) */
  critDamageMult: number;
}

export interface PortalEntity {
  x: number;
  y: number;
  active: boolean;
  kind: 'descent' | 'final';
}

export interface GameStats {
  hp: number;
  maxHp: number;
  shield: number;
  level: number;
  xp: number;
  xpToNext: number;
  dashPct: number;
  score: number;
  wave: number;
  kills: number;
  combo: number;
  multiplier: number;
  weaponName: string;
  weaponColor: string;
  boss?: { name: string; hp: number; maxHp: number } | null;
  weaponPrompt?: { name: string; color: string } | null;
  chestPrompt?: { name: string; color: string } | null;
  portalPrompt?: { kind: string } | null;
  ended: 'victory' | 'defeat' | null;
  goldEarned: number;
  currentRoomLabel: string;
  roomsCleared: number;
  roomsTotal: number;
  mapNumber: number;
  totalMaps: number;
  minimap: MinimapData | null;
  build: BuildStats | null;
}

export interface BuildItemEntry {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  rarity: string;
  slot: EquipSlot;
  mods: Array<{ stat: string; op: string; value: number; label: string }>;
  setId?: string;
}

export interface ActiveSetInfo {
  setId: string;
  name: string;
  color: string;
  equipped: number;
  bonuses: Array<{
    pieces: number;
    description: string;
    active: boolean;
    special?: string;
  }>;
}

export interface BuildStats {
  name: string;
  color: string;
  hp: number;
  maxHp: number;
  shield: number;
  speed: number;
  armor: number;
  critChance: number;
  critDamageMult: number;
  damageMult: number;
  speedMult: number;
  pierceBonus: number;
  countBonus: number;
  lifesteal: number;
  fireRateMult: number;
  projectileSizeBonus: number;
  bounceBonus: number;
  explosionBonus: number;
  level: number;
  xp: number;
  xpToNext: number;
  weaponId: string;
  weaponName: string;
  weaponColor: string;
  weaponRarity: string;
  weaponDamage: number;
  weaponFireRate: number;
  weaponCount: number;
  weaponPierce: number;
  weaponSpread: number;
  weaponTags: string[];
  weaponBurst?: number;
  weaponBounce?: number;
  weaponExplosion?: number;
  weaponLifetime?: number;
  weaponSizeMult?: number;
  hasNearbyWeapon: boolean;
  nearbyWeaponName?: string;
  equippedItems: BuildItemEntry[];
  maxItemSlots: number;
  activeSets: ActiveSetInfo[];
}

export interface ItemPickupData {
  id: string;
  name: string;
  icon: string;
  description: string;
  color: string;
  rarity: string;
  slot: EquipSlot;
  mods: Array<{ stat: string; op: string; value: number; label: string }>;
  setId?: string;
}

export interface SkillChoice {
  id: string;
  name: string;
  description: string;
  icon: string;
  rarity: string;
}

export type GameScreen =
  | 'menu'
  | 'chars'
  | 'faction'
  | 'armory'
  | 'bestiary'
  | 'shop'
  | 'controls'
  | 'scores'
  | 'options'
  | 'playing'
  | 'paused'
  | 'build'
  | 'map'
  | 'levelup'
  | 'gameover'
  | 'victory'
  | 'itempickup';
