import { getCharacter, getCharactersByFaction, type CharacterDef } from '../content/characters';
import { drawPetSprite } from './sprites/petSprites';
import { drawEventNpc, getEventNpc } from './sprites/eventNpcs';
import { spriteAtlas } from './sprites/spriteAtlas';
import {
  getWeapon,
  generateWeapon,
  registerGenerated,
  getBaseWeapon,
  type GeneratedWeapon,
} from '../content/weapons';
import { BOSSES, getEnemy, type EnemyDef } from '../content/enemies';
import { pickSkillChoices, SKILLS, type SkillDef, type SkillContext } from '../content/skills';
import { getChest, type ChestDef } from '../content/chests';
import { getPet, petStatBoosts, type PetDef } from '../content/pets';
import { balanceStat } from '../content/statBalance';
import {
  LootMemory,
  getLootTable,
  rollLootCategory,
  pickDirectedWeapon,
  pickDirectedEquipment,
  pickDirectedItem,
  type BuildContext,
} from './lootDirector';
import { getItem } from '../content/items';
import {
  getEquipment,
  generateEquipment,
  EQUIP_SLOTS,
  getSetBonusDef,
  type EquipSlot,
} from '../content/equipment';
import type {
  ActiveSetInfo,
  BuildItemEntry,
  ChestEntity,
  CorridorNode,
  EnemyEntity,
  EventInstance,
  GameStats,
  InputAction,
  InteractiveEventEntity,
  ItemPickupData,
  KeyBindings,
  MinimapData,
  NearbyPickupEntry,
  Particle,
  PickupEntity,
  PlayerState,
  PortalEntity,
  Projectile,
  RoomBounds,
  RoomKind,
  RoomNode,
  SkillChoice,
} from './types';
import { audio } from './audio';
import { codeLabel, DEFAULT_BINDINGS, type PermanentUpgrades } from './persistence';
import { EnemyDirector, type DirectorContext } from './enemyDirector';
import { EventDirector, EVENT_DEFS } from './eventDirector';
import { RunDirector, type RunTelemetry } from './runDirector';
import { pickBiomeForMap, type BiomeDef } from '../content/biomes';
import { getBossPhases } from '../content/bosses';
import { getAscensionLevel } from '../content/ascension';
import { createRunSeed, runRandom } from './random';

const ROOM_W = 900;
const ROOM_H = 700;
const CORRIDOR_LEN = 320;
const CORRIDOR_THICK = 150;
const COMBAT_WAVES = 3;
const TOTAL_MAPS = 10;
const PICKUP_INTERACT_RADIUS = 48;
/** Segundos entre disparos consecutivos de una ráfaga (burstCount). */
const BURST_INTERVAL = 0.07;

const MAP_ROOMS_MIN = 7;
const MAP_ROOMS_MAX = 13;
const MIN_COMBAT_ROOMS = 5;

const WORLD_PRESENTATIONS = [
  { id: 'ceuta', name: 'Ceuta', icon: '🌊' },
  { id: 'alhambra', name: 'Alhambra', icon: '🏰' },
  { id: 'mercadillo', name: 'Mercadillo', icon: '📦' },
  { id: 'tetuan', name: 'Tetuán', icon: '🏛️' },
  { id: 'zaragoza', name: 'Zaragoza', icon: '🏰' },
  { id: 'meknes', name: 'Meknes', icon: '🏰' },
  { id: 'sacromonte', name: 'Sacromonte', icon: '🌅' },
  { id: 'jerez', name: 'Jerez de la Frontera', icon: '🏚️' },
  { id: 'chefchaouen', name: 'Chefchaouen', icon: '🌊' },
  { id: 'ait_ben_haddou', name: 'Aït Ben Haddou', icon: '🌋' },
] as const;

function getWorldPresentation(mapNumber: number) {
  const idx = Math.min(WORLD_PRESENTATIONS.length, Math.max(1, Math.floor(mapNumber) || 1)) - 1;
  return WORLD_PRESENTATIONS[idx];
}

function rectsOverlap(a: RoomBounds, b: RoomBounds, pad = 0): boolean {
  return !(
    a.x + a.w + pad <= b.x ||
    b.x + b.w + pad <= a.x ||
    a.y + a.h + pad <= b.y ||
    b.y + b.h + pad <= a.y
  );
}

type InputState = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  shoot: boolean;
  interact: boolean;
  aimX: number;
  aimY: number;
  hasAim: boolean;
  moveX: number;
  moveY: number;
};

function rectsOverlapPoint(r: RoomBounds, x: number, y: number, pad = 0): boolean {
  return x >= r.x - pad && x <= r.x + r.w + pad && y >= r.y - pad && y <= r.y + r.h + pad;
}

function clampToWalkable(x: number, y: number, radius: number, walkables: RoomBounds[]): { x: number; y: number } {
  for (const r of walkables) {
    if (rectsOverlapPoint(r, x, y, 0)) {
      return { x, y };
    }
  }
  let bestX = x;
  let bestY = y;
  let bestD = Infinity;
  for (const r of walkables) {
    const cx = Math.max(r.x + radius, Math.min(r.x + r.w - radius, x));
    const cy = Math.max(r.y + radius, Math.min(r.y + r.h - radius, y));
    const d = (cx - x) * (cx - x) + (cy - y) * (cy - y);
    if (d < bestD) {
      bestD = d;
      bestX = cx;
      bestY = cy;
    }
  }
  return { x: bestX, y: bestY };
}

export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private raf = 0;
  private running = false;
  private last = 0;
  private acc = 0;
  private fixedDt = 1 / 60;
  private nextId = 1;
  private camera = { x: 0, y: 0, shake: 0 };
  private player!: PlayerState;
  private damageBatchActive = false;
  private damageBatchAcceptsHits = false;
  private pendingDamageInvuln = 0;
  private projectiles: Projectile[] = [];
  private enemies: EnemyEntity[] = [];
  private opposingRoster: CharacterDef[] = [];
  private nextOpponent = 0;
  private pickups: PickupEntity[] = [];
  private particles: Particle[] = [];
  private chests: ChestEntity[] = [];
  private rooms: RoomNode[] = [];
  private corridors: CorridorNode[] = [];
  private currentRoomId = 0;
  private activeCombatRoomId: number | null = null;
  private roomCombatActive = false;
  private roomWave = 0;
  private roomWaveTotal = COMBAT_WAVES;
  private inCorridor = false;
  private keys = new Set<string>();
  private pressedKeys = new Set<string>();
  private pointer = { x: 0, y: 0, down: false };
  private touchMove = { x: 0, y: 0, active: false };
  private touchShoot = false;
  private touchActions = new Set<InputAction>();
  private readonly touchLayout = window.matchMedia('(hover: none) and (pointer: coarse)');
  private ultimateCooldown = 0;
  private energy = 0;
  private ultimateShield = 0;
  private stealth = 0;
  private ultimateRoom = -1;
  private tripleDash = 0;
  private stunUntil = new Map<number, number>();

  private activateUltimate() {
    const p = this.player;
    if (this.ultimateCooldown > 0 || p.isDashing || this.inCorridor || this.isPlayerInCorridor()) return;
    const id = this.characterId;
    if (id === 'patriarca') this.energy = getCharacter(id).energy;
    else {
      if (this.energy < 25) return;
      this.energy -= 25;
    }
    this.ultimateCooldown = 60;
    switch (id) {
      case 'bronce': case 'tariq': this.ultimateShield = 3; break;
      case 'rayo': case 'hechicera_lola': this.ultimateRoom = this.currentRoomId; break;
      case 'bailaor_furia': this.tripleDash = 3; break;
      case 'sombra': this.stealth = 5; break;
      case 'benghazi': for (const e of this.enemies) if (!e.dead && Math.hypot(e.x-p.x,e.y-p.y)<=220) this.stunUntil.set(e.id,this.worldTime+5); break;
      case 'ziryab': p.hp = Math.min(p.maxHp,p.hp+p.maxHp*0.25); break;
      case 'alhambra': for (const e of this.enemies) if (!e.dead && !(e.phaseInvuln && e.phaseInvuln>0) && Math.hypot(e.x-p.x,e.y-p.y)<=180) { e.hp *= 0.5; e.hitFlash=0.15; } break;
    }
    this.burst(p.x,p.y,p.color,24);
  }
  private daggerStrike() {
    const p=this.player;
    const e=this.findNearestEnemy(p.x,p.y,65);
    if (!e || e.dead || (e.phaseInvuln && e.phaseInvuln>0)) return;
    e.hp -= getBaseWeapon('cutter').damage * p.damageMult;
    e.hitFlash=0.15;
    if(e.hp<=0) this.killEnemy(e);
  }

  private score = 0;
  private kills = 0;
  private combo = 0;
  private comboTimer = 0;
  private wave = 0;
  private enemiesToSpawn: EnemyDef[] = [];
  private spawnTimer = 0;
  private ended: 'victory' | 'defeat' | null = null;
  private goldEarned = 0;
  /** Oro ganado acumulado en la partida (no baja al gastar en mercaderes). Es el que se premia al acabar. */
  private goldGross = 0;
  private mapNumber = 1;
  private cycle = 1;
  /** Puntuación ya multiplicada por Ascensión/Endless en finales anteriores (el multiplicador solo afecta a lo ganado después). */
  private scoreMultBaseline = 0;
  private runSeed = 0;
  private portal: PortalEntity | null = null;
  private pendingItemPickup: { pk: PickupEntity } | null = null;
  private pendingPickupChoice = false;
  private equippedPetId: string | null = null;
  private pet: { x: number; y: number; trail: { x: number; y: number }[]; timers: Record<string, number> } | null = null;
  private lootMemory = new LootMemory();
  private currentBiome!: BiomeDef;
  private biomeParticles: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number }> = [];
  private enemyDirector = new EnemyDirector();
  private eventDirector = new EventDirector();
  private runDirector = new RunDirector();
  private ascensionLevel = 0;
  private assistMode = false;
  private characterId = 'tariq';
  private pendingSkills: SkillChoice[] | null = null;
  private acquiredSkills: SkillDef[] = [];
  private onStatsCbs = new Set<(s: GameStats) => void>();
  private onLevelUpCbs = new Set<(choices: SkillChoice[]) => void>();
  private onEndCbs = new Set<(result: 'victory' | 'defeat', stats: GameStats) => void>();
  private onWeaponDiscoverCbs = new Set<(id: string) => void>();
  private onKillCbs = new Set<(id: string, characterId: string) => void>();
  private upgrades: PermanentUpgrades = { permHpLevel: 0, permDamageLevel: 0 };
  private worldTime = 0;
  private damageTakenTotal = 0;
  private healsUsed = 0;
  private bossesDefeated = 0;
  private nearestWeapon: PickupEntity | null = null;
  private closestPickup: PickupEntity | null = null;
  private stackedPickupCount = 0;
  private lootVacuum = false;
  private nearestChest: ChestEntity | null = null;
  private closestChestWins = false;
  /** Disparos de ráfaga pendientes (burstCount > 1): se lanzan con retardo real. */
  private pendingVolleys: Array<{ delay: number; angle: number; spread: number; weaponId: string }> = [];
  private dashDirX = 1;
  private dashDirY = 0;
  private lastStatsPush = 0;
  private eventEntities: InteractiveEventEntity[] = [];
  private nearestEvent: InteractiveEventEntity | null = null;
  private currentEvent: EventInstance | null = null;
  private challengeFailed = false;
  private challengeTimer = 0;
  private onEventInteractCbs = new Set<(instance: EventInstance, callback: (idx: number | null) => void) => void>();
  private onItemPickupCbs = new Set<(item: ItemPickupData, equipped: BuildItemEntry[], callback: (slot: EquipSlot | null) => void) => void>();
  private onPickupChoiceCbs = new Set<(items: NearbyPickupEntry[], callback: (pickupId: number | null) => void) => void>();
  private disposed = false;
  private bindings: KeyBindings = { ...DEFAULT_BINDINGS };
  private worldW = 0;
  private worldH = 0;
  private visWeaponId = '';
  private visWeaponBase = '';
  private pickupSlotCache = new WeakMap<PickupEntity, string>();
  private pickupWeaponCache = new WeakMap<PickupEntity, string>();

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No 2d context');
    this.ctx = ctx;
    this.bindInput();
    this.resize();
    window.addEventListener('resize', this.resize);
  }

  private resize = () => {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.floor(window.innerWidth * dpr);
    this.canvas.height = Math.floor(window.innerHeight * dpr);
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  private bindInput() {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    window.addEventListener('pointerup', this.onWindowPointerUp);
    window.addEventListener('pointercancel', this.onWindowPointerUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLElement && e.target.closest('input, select, textarea, [contenteditable="true"]')) return;
    this.keys.add(e.code);
    // Las repeticiones automáticas del teclado no cuentan como nuevas pulsaciones (E, dash...).
    if (!e.repeat) this.pressedKeys.add(e.code);
    if (this.running && ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };
  /** Al perder el foco no llegan los keyup: se sueltan todas las teclas para que no queden "pegadas". */
  private onBlur = () => {
    this.keys.clear();
    this.pressedKeys.clear();
    this.pointer.down = false;
    this.clearTouchInput();
  };
  private onPointerDown = (e: PointerEvent) => {
    this.pointer.down = true;
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    if (e.button === 0) {
      this.keys.add('Mouse0');
      this.pressedKeys.add('Mouse0');
    }
  };
  private onPointerUp = (e?: PointerEvent) => {
    if (!e || (e.buttons ?? 0) === 0) this.pointer.down = false;
    if (!e || e.button === 0) this.keys.delete('Mouse0');
  };
  private onPointerMove = (e: PointerEvent) => {
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
  };
  private onWindowPointerUp = (e: PointerEvent) => this.onPointerUp(e);

  private getElementSynergyMult(element: string): number {
    let mult = 1;
    const setCounts = new Map<string, number>();
    for (const slot of EQUIP_SLOTS) {
      const id = this.player.equipment[slot];
      if (!id) continue;
      const eq = getEquipment(id);
      if (eq.setId) setCounts.set(eq.setId, (setCounts.get(eq.setId) ?? 0) + 1);
    }
    for (const [setId, count] of setCounts) {
      if (count < 2) continue;
      const def = getSetBonusDef(setId);
      if (def?.synergy?.element === element) {
        mult *= 1 + 0.25 * Math.min(3, count - 1);
      }
    }
    const petDef = this.getEquippedPetDef();
    if (petDef) {
      for (const eff of petDef.effects) {
        if (eff.key === element || eff.synergyTags?.includes(element)) {
          mult *= 1.2;
          break;
        }
      }
    }
    return Math.min(2.5, mult);
  }

  setTouchMove(x: number, y: number, active: boolean) { this.touchMove = { x, y, active }; }
  setTouchShoot(v: boolean) { this.touchShoot = v; }
  pressTouchAction(action: 'dash' | 'interact' | 'ultimate') {
    if (this.running) this.touchActions.add(action);
  }
  private clearTouchInput() {
    this.setTouchMove(0, 0, false);
    this.setTouchShoot(false);
    this.touchActions.clear();
  }
  setBindings(bindings: KeyBindings) { this.bindings = { ...bindings }; }
  getBindings(): KeyBindings { return { ...this.bindings }; }

  onStats(cb: (s: GameStats) => void) {
    this.onStatsCbs.add(cb);
    return () => this.onStatsCbs.delete(cb);
  }
  onLevelUp(cb: (choices: SkillChoice[]) => void) {
    this.onLevelUpCbs.add(cb);
    return () => this.onLevelUpCbs.delete(cb);
  }
  onEnd(cb: (result: 'victory' | 'defeat', stats: GameStats) => void) {
    this.onEndCbs.add(cb);
    return () => this.onEndCbs.delete(cb);
  }
  onWeaponDiscover(cb: (id: string) => void) {
    this.onWeaponDiscoverCbs.add(cb);
    return () => this.onWeaponDiscoverCbs.delete(cb);
  }
  onKillRecord(cb: (id: string, characterId: string) => void) {
    this.onKillCbs.add(cb);
    return () => this.onKillCbs.delete(cb);
  }
  onItemPickup(cb: (item: ItemPickupData, equipped: BuildItemEntry[], callback: (slot: EquipSlot | null) => void) => void) {
    this.onItemPickupCbs.add(cb);
    return () => this.onItemPickupCbs.delete(cb);
  }
  onPickupChoice(cb: (items: NearbyPickupEntry[], callback: (pickupId: number | null) => void) => void) {
    this.onPickupChoiceCbs.add(cb);
    return () => this.onPickupChoiceCbs.delete(cb);
  }
  onEventInteract(cb: (instance: EventInstance, callback: (idx: number | null) => void) => void) {
    this.onEventInteractCbs.add(cb);
    return () => this.onEventInteractCbs.delete(cb);
  }

  start(
    characterId: string,
    upgrades: PermanentUpgrades,
    bindings?: KeyBindings,
    petId?: string | null,
    seed?: number | string,
    ascensionLevel = 0,
    assistMode = false,
  ) {
    this.characterId = characterId;
    this.upgrades = upgrades;
    this.assistMode = assistMode;
    if (bindings) this.bindings = { ...bindings };
    this.equippedPetId = petId ?? null;
    this.ascensionLevel = ascensionLevel;
    this.runSeed = runRandom.setSeed(seed ?? createRunSeed());
    this.resetRun();
    audio.resume();
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
    this.pushStats();
  }

  pause() {
    this.running = false;
    this.clearTouchInput();
    if (this.player) this.pushStats();
  }

  resume() {
    if (this.ended || this.pendingSkills || this.pendingItemPickup || this.pendingPickupChoice) return;
    this.running = true;
    this.last = performance.now();
    this.acc = 0;
    this.pressedKeys.clear();
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  togglePause() {
    if (this.running) this.pause();
    else this.resume();
  }

  isRunning() { return this.running; }
  hasPendingSkillChoice(): boolean { return this.pendingSkills !== null; }
  getRunSeed(): number { return this.runSeed; }

  applySkill(skillId: string) {
    const skill = SKILLS.find((s) => s.id === skillId);
    if (!skill) return;
    this.acquiredSkills.push(skill);
    const grantsMaxHp = skill.mods.some((m) => m.stat === 'maxHp');
    this.recalcStats();
    if (grantsMaxHp) this.player.hp = this.player.maxHp;
    this.pendingSkills = null;
    this.resume();
    this.pushStats();
  }

  getStats(): GameStats {
    if (!this.player) {
      return {
        hp: 0, maxHp: 1, shield: 0, maxShield: 0, level: 1, xp: 0, xpToNext: 55, dashPct: 1,
        score: 0, wave: 0, kills: 0, combo: 0, multiplier: 1,
        weaponName: '', weaponColor: '#00f0ff', stackedPickupCount: 0,
        boss: null, weaponPrompt: null, itemPrompt: null, chestPrompt: null, portalPrompt: null,
        eventPrompt: null, activeChallenge: null,
        ended: null, goldEarned: 0,
        currentRoomLabel: '', roomsCleared: 0, roomsTotal: 0,
        mapNumber: 1, totalMaps: TOTAL_MAPS,
        biomeName: '', biomeIcon: '', biomeColor: '#00f0ff',
        minimap: null, build: null,
      };
    }
    const w = getWeapon(this.player.weaponId);
    const boss = this.enemies.find((e) => e.isBoss && !e.dead);
    const room = this.rooms.find((r) => r.id === this.currentRoomId);
    const cleared = this.rooms.filter((r) => r.status === 'cleared').length;
    const cp = this.closestPickup;
    const worldPres = this.worldPresentation();
    return {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      shield: this.player.shield,
      maxShield: this.player.maxShield,
      level: this.player.level,
      xp: this.player.xp,
      xpToNext: this.player.xpToNext,
      ultimateCooldown: this.ultimateCooldown, energy: this.energy, maxEnergy: getCharacter(this.characterId).energy, ultimateShield: this.ultimateShield,
      dashPct: 1 - this.player.dashCooldown / this.player.dashCooldownMax,
      score: this.score,
      wave: this.roomCombatActive ? this.roomWave : this.wave,
      kills: this.kills,
      combo: this.combo,
      multiplier: this.comboMultiplier(),
      weaponName: w.name,
      weaponColor: w.color,
      stackedPickupCount: this.stackedPickupCount,
      boss: boss ? (() => {
        const phases = getBossPhases(boss.defId);
        const idx = Math.max(0, (boss.currentPhase ?? 1) - 1);
        return { name: boss.name, hp: boss.hp, maxHp: boss.maxHp, phase: phases[idx]?.name };
      })() : null,
      weaponPrompt: cp?.kind === 'weapon'
        ? { name: getWeapon(cp.weaponId ?? 'pulse_pistol').name, color: cp.color }
        : null,
      itemPrompt: cp?.kind === 'item'
        ? { name: getEquipment(cp.itemId ?? EQUIP_SLOTS[0]).name, color: cp.color }
        : null,
      chestPrompt: this.nearestChest && this.closestChestWins
        ? { name: this.nearestChest.name, color: this.nearestChest.color }
        : null,
      portalPrompt: this.portal?.active && Math.hypot(this.portal.x - this.player.x, this.portal.y - this.player.y) < 60
        ? { kind: this.portal.kind === 'descent' ? 'Descender' : 'Portal final' }
        : null,
      eventPrompt: this.nearestEvent?.active
        ? { name: this.nearestEvent.instance.name, color: this.nearestEvent.instance.color }
        : null,
      activeChallenge: this.currentEvent?.combatRules ? {
        desc: this.currentEvent.description,
        failed: this.challengeFailed,
        time: this.currentEvent.combatRules.timeLimit ? Math.ceil(this.challengeTimer) : undefined,
      } : null,
      ended: this.ended,
      goldEarned: this.goldEarned,
      goldGross: this.goldGross,
      currentRoomLabel: this.inCorridor
        ? 'Pasillo'
        : room?.label
          ? this.roomCombatActive && room.kind === 'combat'
            ? `${room.label} (${this.roomWave}/${this.roomWaveTotal})`
            : room.label
          : '',
      roomsCleared: cleared,
      roomsTotal: this.rooms.length,
      mapNumber: this.mapNumber,
      totalMaps: TOTAL_MAPS,
      cycle: this.cycle,
      biomeName: worldPres.name ?? this.currentBiome?.name ?? 'Distrito Neón',
      biomeIcon: worldPres.icon ?? this.currentBiome?.icon ?? '🏙️',
      biomeColor: this.currentBiome?.theme?.wallColor ?? '#00f0ff',
      minimap: this.buildMinimap(),
      build: this.getBuildStats(),
    };
  }

  private statLabelMap(): Record<string, string> {
    return {
      maxHp: 'HP', armor: 'Armadura', speed: 'Velocidad', critChance: 'Crítico',
      damageMult: 'Daño', fireRateMult: 'Cadencia', projectileSize: 'Tamaño proy.',
      pierce: 'Perforación', count: 'Proyectiles', countBonus: 'Proyectiles',
      bounce: 'Rebotes', lifesteal: 'Robo de vida', dashCooldown: 'CD Dash',
      shield: 'Escudo', explosionRadius: 'Radio explosión',
      spreadMult: 'Dispersión', gold_boost: 'Oro',
    };
  }

  private buildEquippedItemEntries(): BuildItemEntry[] {
    const entries: BuildItemEntry[] = [];
    for (const slot of EQUIP_SLOTS) {
      const id = this.player.equipment[slot];
      if (!id) continue;
      const eq = getEquipment(id);
      const lb = this.statLabelMap();
      entries.push({
        id: eq.id, name: eq.name, icon: eq.icon, description: eq.description,
        color: eq.color, rarity: eq.rarity, slot: eq.slot, setId: eq.setId,
        mods: eq.mods.map((m) => ({
          stat: m.stat, op: m.op, value: m.value,
          label: `${lb[m.stat] ?? m.stat} ${m.op === 'add' ? (m.value >= 0 ? '+' : '') + m.value : (m.value >= 0 ? '+' : '') + Math.round(m.value * 100) + '%'}`,
        })),
      });
    }
    return entries;
  }

  private buildActiveSets(): ActiveSetInfo[] {
    const counts = new Map<string, number>();
    for (const slot of EQUIP_SLOTS) {
      const id = this.player.equipment[slot];
      if (!id) continue;
      const eq = getEquipment(id);
      if (eq.setId) counts.set(eq.setId, (counts.get(eq.setId) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([setId, count]) => {
      const def = getSetBonusDef(setId);
      let synergyActive = false;
      let counterSynergyActive = false;
      if (count >= 2 && def?.synergy) {
        const w = getWeapon(this.player.weaponId);
        const syn = def.synergy;
        const tagMatch = syn.weaponTags?.some((t) => w.tags.includes(t)) ?? false;
        const affixMatch = syn.affixIds?.some((a) => w.affixId === a) ?? false;
        const elemMatch = syn.element ? w.element === syn.element : false;
        synergyActive = tagMatch || affixMatch || elemMatch;
      }
      if (count >= 2 && def?.counterSynergy) {
        const w = getWeapon(this.player.weaponId);
        const cs = def.counterSynergy;
        const tagMatch = cs.weaponTags?.some((t) => w.tags.includes(t)) ?? false;
        const affixMatch = cs.affixIds?.some((a) => w.affixId === a) ?? false;
        const elemMatch = cs.element ? w.element === cs.element : false;
        counterSynergyActive = tagMatch || affixMatch || elemMatch;
      }
      return {
        setId, name: def?.name ?? setId, color: def?.color ?? '#fff',
        equipped: count,
        bonuses: (def?.bonuses ?? []).map((b) => ({
          pieces: b.pieces, description: b.description,
          active: count >= b.pieces, special: b.special,
        })),
        synergyDescription: def?.synergy?.description,
        synergyActive,
        playstyle: def?.playstyle ?? '',
        strengths: def?.strengths ?? [],
        weaknesses: def?.weaknesses ?? [],
        counterSynergy: def?.counterSynergy,
        counterSynergyActive,
      };
    });
  }

  private getBuildStats() {
    const p = this.player;
    const w = getWeapon(p.weaponId);
    const nw = this.nearestWeapon;
    return {
      name: p.name, color: p.color,
      hp: p.hp, maxHp: p.maxHp, shield: p.shield,
      speed: p.speed, armor: p.armor, critChance: p.critChance,
      critDamageMult: p.critDamageMult,
      damageMult: p.damageMult, speedMult: p.speedMult,
      pierceBonus: p.pierceBonus, countBonus: p.countBonus,
      lifesteal: p.lifesteal, fireRateMult: p.fireRateMult,
      projectileSizeBonus: p.projectileSizeBonus, bounceBonus: p.bounceBonus,
      explosionBonus: p.explosionBonus,
      level: p.level, xp: p.xp, xpToNext: p.xpToNext,
      weaponId: p.weaponId, weaponName: w.name, weaponColor: w.color,
      weaponRarity: w.quality,
      weaponAffixName: w.affixName,
      weaponAffixColor: w.affixColor,
      weaponAffixDescription: w.affixDescription,
      weaponDamage: w.damage,
      weaponFireRate: w.fireRate, weaponCount: w.count,
      weaponPierce: w.pierce, weaponSpread: w.spread, weaponTags: w.tags,
      weaponBurst: w.burstCount, weaponBounce: w.bounceCount,
      weaponExplosion: w.explosionRadius, weaponLifetime: w.lifetime,
      weaponSizeMult: w.sizeMult,
      hasNearbyWeapon: !!nw,
      nearbyWeaponName: nw ? getWeapon(nw.weaponId ?? 'pulse_pistol').name : undefined,
      equippedItems: this.buildEquippedItemEntries(),
      maxItemSlots: EQUIP_SLOTS.length,
      activeSets: this.buildActiveSets(),
      upgrades: this.acquiredSkills.map(skill => skill.name),
    };
  }

  destroy() {
    this.disposed = true;
    this.running = false;
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = 0;
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.canvas.removeEventListener('pointerdown', this.onPointerDown);
    this.canvas.removeEventListener('pointermove', this.onPointerMove);
    this.canvas.removeEventListener('pointerup', this.onPointerUp);
    this.canvas.removeEventListener('pointercancel', this.onPointerUp);
    window.removeEventListener('pointerup', this.onWindowPointerUp);
    window.removeEventListener('pointercancel', this.onWindowPointerUp);
  }

  private buildMinimap(): MinimapData {
    return {
      rooms: this.rooms.map((r) => ({
        id: r.id,
        kind: r.kind,
        bounds: r.bounds,
        status: r.status,
        discovered: r.discovered,
        label: r.label,
      })),
      corridors: this.corridors.map((c) => {
        const a = this.rooms.find((r) => r.id === c.from);
        const b = this.rooms.find((r) => r.id === c.to);
        return {
          from: c.from,
          to: c.to,
          bounds: c.bounds,
          discovered: !!(a?.discovered || b?.discovered),
        };
      }),
      currentRoomId: this.currentRoomId,
      player: { x: this.player.x, y: this.player.y },
      biomeBg: this.currentBiome?.theme?.minimapBg,
      biomeRoomColor: this.currentBiome?.theme?.minimapRoomColor,
    };
  }

  private buildMapLayout() {
    const rng = this.seededRandom();
    const total = MAP_ROOMS_MIN + Math.floor(rng() * (MAP_ROOMS_MAX - MAP_ROOMS_MIN + 1));

    const nodes: Array<{ id: number; kind: RoomKind; label: string }> = [];
    nodes.push({ id: 0, kind: 'start', label: 'Entrada' });
    for (let i = 1; i < total; i++) {
      nodes.push({ id: i, kind: 'combat', label: `Calle ${i}` });
    }

    const edges: Array<[number, number]> = [];
    const connected = new Set<number>([0]);

    const remaining = nodes.slice(1).map((n) => n.id);
    for (let i = remaining.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
    }

    for (const id of remaining) {
      const candidates = Array.from(connected);
      const parent = candidates[Math.floor(rng() * candidates.length)];
      edges.push([parent, id]);
      connected.add(id);
    }
    const treeEdgeCount = edges.length;

    const treeDegree = new Map<number, number>();
    for (const [a, b] of edges) {
      treeDegree.set(a, (treeDegree.get(a) ?? 0) + 1);
      treeDegree.set(b, (treeDegree.get(b) ?? 0) + 1);
    }
    const treeAdj = new Map<number, number[]>();
    for (const [a, b] of edges) {
      if (!treeAdj.has(a)) treeAdj.set(a, []);
      if (!treeAdj.has(b)) treeAdj.set(b, []);
      treeAdj.get(a)!.push(b);
      treeAdj.get(b)!.push(a);
    }
    const dist = new Map<number, number>([[0, 0]]);
    const bfsQ = [0];
    while (bfsQ.length > 0) {
      const cur = bfsQ.shift()!;
      for (const nb of treeAdj.get(cur) ?? []) {
        if (!dist.has(nb)) {
          dist.set(nb, dist.get(cur)! + 1);
          bfsQ.push(nb);
        }
      }
    }
    let bossId = -1;
    let bossDist = -1;
    for (const [id, d] of dist) {
      if (id === 0) continue;
      const deg = treeDegree.get(id) ?? 0;
      const isLeaf = deg === 1;
      if (isLeaf && d > bossDist) { bossDist = d; bossId = id; }
    }
    if (bossId === -1) {
      for (const [id, d] of dist) {
        if (id !== 0 && d > bossDist) { bossDist = d; bossId = id; }
      }
    }
    if (bossId === -1) bossId = total - 1;

    for (const node of nodes) {
      if (node.id === 0) continue;
      if (node.id === bossId) {
        node.kind = 'boss';
        node.label = 'Jefe';
        continue;
      }
      const roll = rng();
      if (roll < 0.15) {
        node.kind = 'treasure';
        node.label = `Botín ${String.fromCharCode(65 + node.id - 1)}`;
      } else if (roll < 0.23 && node.id > 2) {
        node.kind = 'portal';
        node.label = 'Sala vacía';
      } else {
        let evId: string | null = null;
        if (this.eventDirector.rollRoomIsEvent(this.mapNumber, rng)) {
          const buildTags = this.buildLootContext().weaponTags;
          evId = this.eventDirector.pickEvent(this.mapNumber, rng, this.runDirector, buildTags, this.currentBiome);
        }
        if (evId) {
          node.kind = 'event';
          (node as any).eventId = evId;
          node.label = '???';
        } else {
          node.kind = 'combat';
          node.label = `Calle ${node.id}`;
        }
      }
    }

    const combatCount = () => nodes.filter((n) => n.kind === 'combat').length;
    const convertible = nodes.filter((n) => n.kind === 'event');
    const target = Math.min(MIN_COMBAT_ROOMS, combatCount() + convertible.length);
    for (let i = convertible.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [convertible[i], convertible[j]] = [convertible[j], convertible[i]];
    }
    for (const node of convertible) {
      if (combatCount() >= target) break;
      node.kind = 'combat';
      node.label = `Calle ${node.id}`;
      // El evento descartado no debe contar para los límites por partida/mapa.
      this.eventDirector.cancelEvent((node as any).eventId);
      delete (node as any).eventId;
    }

    const extraEdges = Math.floor(total * (0.3 + rng() * 0.5));
    for (let e = 0; e < extraEdges; e++) {
      const a = Math.floor(rng() * total);
      const b = Math.floor(rng() * total);
      if (a === b) continue;
      if (a === bossId || b === bossId) continue;
      if (edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) continue;
      edges.push([a, b]);
    }

    this.rooms = [];
    this.corridors = [];
    const cellW = ROOM_W + CORRIDOR_LEN;
    const cellH = ROOM_H + CORRIDOR_LEN;
    const originX = 80;
    const originY = 80;

    const placed = new Map<number, { gx: number; gy: number }>();
    const occupied = new Set<string>();
    const key = (gx: number, gy: number) => `${gx},${gy}`;

    placed.set(0, { gx: 0, gy: 0 });
    occupied.add(key(0, 0));

    const queue = [0];
    const visited = new Set<number>([0]);
    const deltas = [[0, -1], [0, 1], [-1, 0], [1, 0]];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const pos = placed.get(current)!;
      for (let ei = 0; ei < edges.length; ei++) {
        const [a, b] = edges[ei];
        const nb = a === current ? b : b === current ? a : -1;
        if (nb === -1 || visited.has(nb)) continue;
        if (ei >= treeEdgeCount) continue;
        visited.add(nb);
        let bestGx = pos.gx;
        let bestGy = pos.gy;
        let found = false;
        for (const [dx, dy] of deltas) {
          const ngx = pos.gx + dx;
          const ngy = pos.gy + dy;
          if (!occupied.has(key(ngx, ngy))) {
            bestGx = ngx;
            bestGy = ngy;
            found = true;
            break;
          }
        }
        if (!found) {
          for (let distance = 2; distance <= total && !found; distance++) {
            for (const [dx, dy] of deltas) {
              const ngx = pos.gx + dx * distance;
              const ngy = pos.gy + dy * distance;
              if (occupied.has(key(ngx, ngy))) continue;
              let pathClear = true;
              for (let step = 1; step < distance; step++) {
                if (occupied.has(key(pos.gx + dx * step, pos.gy + dy * step))) {
                  pathClear = false;
                  break;
                }
              }
              if (pathClear) {
                bestGx = ngx;
                bestGy = ngy;
                found = true;
                break;
              }
            }
          }
          if (!found && ei < treeEdgeCount) {
            outerRing: for (let r = 1; r <= total; r++) {
              for (let dx = -r; dx <= r; dx++) {
                for (let dy = -r; dy <= r; dy++) {
                  if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                  const ngx = pos.gx + dx;
                  const ngy = pos.gy + dy;
                  if (!occupied.has(key(ngx, ngy))) {
                    bestGx = ngx;
                    bestGy = ngy;
                    found = true;
                    break outerRing;
                  }
                }
              }
            }
          }
        }
        if (!found && ei < treeEdgeCount) {
          console.warn(
            `[buildMapLayout] tree edge could not be placed: parent ${current} (${pos.gx},${pos.gy}) → nb ${nb}, all cardinal cells already occupied`,
          );
        }
        if (!found) {
          outer: for (let gy = 0; gy <= total * 2; gy++) {
            for (let gx = 0; gx <= total * 2; gx++) {
              if (!occupied.has(key(gx, gy))) {
                bestGx = gx;
                bestGy = gy;
                found = true;
                break outer;
              }
            }
          }
        }
        placed.set(nb, { gx: bestGx, gy: bestGy });
        occupied.add(key(bestGx, bestGy));
        queue.push(nb);
      }
    }

    const adjacency = new Map<number, number[]>();
    for (const [a, b] of edges) {
      if (!adjacency.has(a)) adjacency.set(a, []);
      if (!adjacency.has(b)) adjacency.set(b, []);
      adjacency.get(a)!.push(b);
      adjacency.get(b)!.push(a);
    }

    let minGx = Infinity, minGy = Infinity;
    for (const pos of placed.values()) {
      if (pos.gx < minGx) minGx = pos.gx;
      if (pos.gy < minGy) minGy = pos.gy;
    }
    if (!Number.isFinite(minGx)) { minGx = 0; minGy = 0; }

    for (const node of nodes) {
      const pos = placed.get(node.id) ?? { gx: 0, gy: 0 };
      const bounds: RoomBounds = {
        x: originX + (pos.gx - minGx) * cellW,
        y: originY + (pos.gy - minGy) * cellH,
        w: ROOM_W, h: ROOM_H,
      };
      this.rooms.push({
        id: node.id,
        kind: node.kind,
        bounds,
        status: node.id === 0 ? 'cleared' : 'locked',
        discovered: node.id === 0,
        connections: adjacency.get(node.id) ?? [],
        label: node.label,
        eventId: (node as any).eventId,
      });
    }

    let corridorId = 1000;
    for (let ei = 0; ei < edges.length; ei++) {
      const [aId, bId] = edges[ei];
      const isTreeEdge = ei < treeEdgeCount;
      const a = this.rooms.find((r) => r.id === aId);
      const b = this.rooms.find((r) => r.id === bId);

      const pa = placed.get(aId);
      const pb = placed.get(bId);
      if (!a || !b || !pa || !pb) {
        if (isTreeEdge) {
          console.warn(`[buildMapLayout] tree corridor skipped (missing placed cell): rooms ${aId} and ${bId} unreachable — map may be disconnected`);
        }
        continue;
      }

      let bounds: RoomBounds;
      const thick = CORRIDOR_THICK;
      if (pa.gx === pb.gx && pa.gy !== pb.gy) {
        const top = pa.gy < pb.gy ? a : b;
        const bottom = pa.gy < pb.gy ? b : a;
        bounds = {
          x: top.bounds.x + (ROOM_W - thick) / 2,
          y: top.bounds.y + ROOM_H,
          w: thick,
          h: bottom.bounds.y - (top.bounds.y + ROOM_H),
        };
      } else if (pa.gy === pb.gy && pa.gx !== pb.gx) {
        const left = pa.gx < pb.gx ? a : b;
        const right = pa.gx < pb.gx ? b : a;
        bounds = {
          x: left.bounds.x + ROOM_W,
          y: left.bounds.y + (ROOM_H - thick) / 2,
          w: right.bounds.x - (left.bounds.x + ROOM_W),
          h: thick,
        };
      } else {
        const elbowCells = [
          { gx: pa.gx, gy: pb.gy },
          { gx: pb.gx, gy: pa.gy },
        ];

        const buildElbow = (corner: { gx: number; gy: number }, wThick: number, respectOverlap: boolean): [RoomBounds, RoomBounds] | null => {
          const ex = originX + (corner.gx - minGx) * cellW;
          const ey = originY + (corner.gy - minGy) * cellH;
          const vx = ex + (ROOM_W - wThick) / 2;
          const hy = ey + (ROOM_H - wThick) / 2;

          const vRoom = corner.gx === pa.gx ? a : b;
          const hRoom = corner.gy === pa.gy ? a : b;

          const vTopEdge = Math.min(vRoom.bounds.y, hy);
          const vBottomEdge = Math.max(vRoom.bounds.y + ROOM_H, hy + wThick);
          const v_bounds: RoomBounds = { x: vx, y: vTopEdge, w: wThick, h: vBottomEdge - vTopEdge };

          const hLeftEdge = Math.min(vx, hRoom.bounds.x);
          const hRightEdge = Math.max(vx + wThick, hRoom.bounds.x + ROOM_W);
          const h_bounds: RoomBounds = { x: hLeftEdge, y: hy, w: hRightEdge - hLeftEdge, h: wThick };

          if (v_bounds.w <= 0 || v_bounds.h <= 0 || h_bounds.w <= 0 || h_bounds.h <= 0) return null;

          if (respectOverlap) {
            for (const room of this.rooms) {
              if (room.id === aId || room.id === bId) continue;
              if (rectsOverlap(v_bounds, room.bounds, 1) || rectsOverlap(h_bounds, room.bounds, 1)) {
                return null;
              }
            }
          }
          return [v_bounds, h_bounds];
        };

        let elbowBuilt = false;
        const thicknesses: number[] = [CORRIDOR_THICK];
        if (isTreeEdge) thicknesses.push(Math.max(40, CORRIDOR_THICK / 2));
        outerElbow: for (const wThick of thicknesses) {
          for (const corner of elbowCells) {
            const segs = buildElbow(corner, wThick, true);
            if (segs) {
              this.corridors.push({ id: corridorId++, from: aId, to: bId, bounds: segs[0] });
              this.corridors.push({ id: corridorId++, from: aId, to: bId, bounds: segs[1] });
              elbowBuilt = true;
              break outerElbow;
            }
          }
        }

        if (!elbowBuilt && isTreeEdge) {
          const segs = buildElbow(elbowCells[0], CORRIDOR_THICK, false);
          if (segs) {
            this.corridors.push({ id: corridorId++, from: aId, to: bId, bounds: segs[0] });
            this.corridors.push({ id: corridorId++, from: aId, to: bId, bounds: segs[1] });
            elbowBuilt = true;
          }
        }

        if (!elbowBuilt && isTreeEdge) {
          console.warn(`[buildMapLayout] tree corridor skipped (both elbow options blocked): rooms ${aId} and ${bId} unreachable — map may be disconnected`);
        }
        continue;
      }

      let blocked = false;
      for (const room of this.rooms) {
        if (room.id === aId || room.id === bId) continue;
        if (rectsOverlap(bounds, room.bounds, 1)) {
          blocked = true;
          break;
        }
      }
      if (blocked) {
        if (!isTreeEdge) continue;
        const halfThick = Math.max(40, CORRIDOR_THICK / 2);
        if (pa.gx === pb.gx && pa.gy !== pb.gy) {
          const top = pa.gy < pb.gy ? a : b;
          const bottom = pa.gy < pb.gy ? b : a;
          bounds = {
            x: top.bounds.x + (ROOM_W - halfThick) / 2,
            y: top.bounds.y + ROOM_H,
            w: halfThick,
            h: bottom.bounds.y - (top.bounds.y + ROOM_H),
          };
        } else if (pa.gy === pb.gy && pa.gx !== pb.gx) {
          const left = pa.gx < pb.gx ? a : b;
          const right = pa.gx < pb.gx ? b : a;
          bounds = {
            x: left.bounds.x + ROOM_W,
            y: left.bounds.y + (ROOM_H - halfThick) / 2,
            w: right.bounds.x - (left.bounds.x + ROOM_W),
            h: halfThick,
          };
        }
        let blockedByNarrow = false;
        for (const room of this.rooms) {
          if (room.id === aId || room.id === bId) continue;
          if (rectsOverlap(bounds, room.bounds, 1)) {
            blockedByNarrow = true;
            break;
          }
        }
        if (blockedByNarrow) {
          console.warn(`[buildMapLayout] tree corridor skipped (narrow still blocked): rooms ${aId} and ${bId} unreachable — map may be disconnected`);
          continue;
        }
      }

      this.corridors.push({ id: corridorId++, from: aId, to: bId, bounds });
    }

    let maxX = 0, maxY = 0;
    for (const r of this.rooms) {
      maxX = Math.max(maxX, r.bounds.x + r.bounds.w);
      maxY = Math.max(maxY, r.bounds.y + r.bounds.h);
    }
    this.worldW = maxX + 80;
    this.worldH = maxY + 80;

    {
      const corridorAdj = new Map<number, number[]>();
      for (const c of this.corridors) {
        if (!corridorAdj.has(c.from)) corridorAdj.set(c.from, []);
        if (!corridorAdj.has(c.to)) corridorAdj.set(c.to, []);
        corridorAdj.get(c.from)!.push(c.to);
        corridorAdj.get(c.to)!.push(c.from);
      }
      const reachable = new Set<number>([0]);
      const stack = [0];
      while (stack.length > 0) {
        const cur = stack.pop()!;
        for (const nb of corridorAdj.get(cur) ?? []) {
          if (!reachable.has(nb)) {
            reachable.add(nb);
            stack.push(nb);
          }
        }
      }
      for (const r of this.rooms) {
        if (!reachable.has(r.id)) {
          console.warn(`[buildMapLayout] room ${r.id} is NOT reachable from start (id 0) — map may be disconnected`);
        }
      }

      const byPair = new Map<string, RoomBounds[]>();
      for (const c of this.corridors) {
        const k = `${Math.min(c.from, c.to)}-${Math.max(c.from, c.to)}`;
        if (!byPair.has(k)) byPair.set(k, []);
        byPair.get(k)!.push(c.bounds);
      }
      for (const [k, segs] of byPair) {
        if (segs.length !== 2) continue;
        const [s1, s2] = segs;
        const overlapX = Math.min(s1.x + s1.w, s2.x + s2.w) - Math.max(s1.x, s2.x);
        const overlapY = Math.min(s1.y + s1.h, s2.y + s2.h) - Math.max(s1.y, s2.y);
        if (overlapX <= 0 || overlapY <= 0) {
          console.warn(
            `[buildMapLayout] L-corridor for rooms ${k} has no real overlap ` +
            `(overlapX=${overlapX}, overlapY=${overlapY}); ` +
            `seg1=${JSON.stringify(s1)} seg2=${JSON.stringify(s2)}`,
          );
        }
      }
    }
  }

  private seededRandom(stream: 'map' | 'event' = 'map'): () => number {
    return () => runRandom.next(stream);
  }

  private fullResetPlayer(charId: string) {
    const char = getCharacter(charId);
    this.energy = char.energy;
    this.ultimateCooldown = this.ultimateShield = this.stealth = this.tripleDash = 0;
    this.ultimateRoom = -1;
    this.stunUntil.clear();
    this.clearTouchInput();
    const hpBonus = this.upgrades.permHpLevel * 10;
    const dmgBonus = 1 + this.upgrades.permDamageLevel * 0.05;
    const startWeaponId = getBaseWeapon(char.startingWeapon).id;
    this.player = {
      x: 0, y: 0,
      hp: char.stats.hp + hpBonus,
      maxHp: char.stats.hp + hpBonus,
      shield: 0,
      maxShield: 0,
      speed: char.stats.speed,
      armor: char.stats.armor,
      critChance: char.stats.critChance,
      facingX: 1, facingY: 0,
      isDashing: false, dashTime: 0, dashCooldown: 0, dashCooldownMax: 1.2,
      xp: 0, level: 1, xpToNext: 55,
      weaponId: startWeaponId,
      fireCooldown: 0, invuln: 0,
      color: char.sprite.color, glow: char.sprite.glow, name: char.name,
      damageMult: dmgBonus,
      speedMult: 1, spreadMult: 1, goldMult: 1,
      pierceBonus: 0, countBonus: 0, lifesteal: 0,
      fireRateMult: 1, projectileSizeBonus: 0, bounceBonus: 0, explosionBonus: 0,
      equipment: { helm: null, chest: null, pants: null, boots: null },
      critDamageMult: 2,
      burnDpsMult: 1,
      poisonDpsMult: 1,
    };
    this.recalcStats();
    this.player.hp = this.player.maxHp;
    for (const cb of this.onWeaponDiscoverCbs) cb(startWeaponId);
  }

  private newMapLayout() {
    this.ultimateRoom = -1;
    this.stunUntil.clear();
    // El mapa depende solo de (semilla, ciclo, nº de mapa): no de los eventos visitados antes.
    runRandom.reseed('map', `layout:${this.cycle}:${this.mapNumber}`);
    this.currentBiome = pickBiomeForMap(this.mapNumber, TOTAL_MAPS, this.seededRandom());
    this.rooms = [];
    this.corridors = [];
    this.buildMapLayout();
    this.initBiomeParticles();
    const start = this.rooms[0].bounds;
    this.player.x = start.x + start.w * 0.35;
    this.player.y = start.y + start.h / 2;

    this.projectiles = [];
    this.enemies = [];
    this.opposingRoster = getCharactersByFaction(
      getCharacter(this.characterId).faction === 'bando_moros' ? 'bando_gitanos' : 'bando_moros',
    );
    this.nextOpponent = 0;
    this.pickups = [];
    this.particles = [];
    this.chests = [];
    this.eventEntities = [];
    this.enemiesToSpawn = [];
    this.spawnTimer = 0;
    this.portal = null;
    this.camera = { x: this.player.x, y: this.player.y, shake: 0 };
    this.nearestWeapon = null;
    this.closestPickup = null;
    this.stackedPickupCount = 0;
    this.nearestChest = null;
    this.closestChestWins = false;
    this.nearestEvent = null;
    this.currentEvent = null;
    this.pendingItemPickup = null;
    this.pendingPickupChoice = false;
    this.challengeFailed = false;
    this.challengeTimer = 0;
    this.nextId = 1;
    this.worldTime = 0;
    this.currentRoomId = 0;
    this.roomCombatActive = false;
    this.roomWave = 0;
    this.roomWaveTotal = COMBAT_WAVES;
    this.inCorridor = false;

    this.initPet();
    this.spawnChest('chest_street', start.x + start.w * 0.65, start.y + start.h / 2, 0);
  }

  private getEquippedPetDef(): PetDef | undefined {
    return this.equippedPetId ? getPet(this.equippedPetId) : undefined;
  }

  private buildSkillContext(): SkillContext {
    const w = getWeapon(this.player.weaponId);
    const setCounts = new Map<string, number>();
    for (const slot of EQUIP_SLOTS) {
      const id = this.player.equipment[slot];
      if (!id) continue;
      const eq = getEquipment(id);
      if (eq.setId) setCounts.set(eq.setId, (setCounts.get(eq.setId) ?? 0) + 1);
    }
    return {
      weaponTags: w.tags ?? [],
      weaponElement: w.element,
      equippedSetIds: Array.from(setCounts.keys()),
      acquiredIds: this.acquiredSkills.map((s) => s.id),
      mapNumber: this.effectiveMapNumber(),
    };
  }

  private buildLootContext(): BuildContext {
    const w = getWeapon(this.player.weaponId);
    const setCounts: Record<string, number> = {};
    for (const slot of EQUIP_SLOTS) {
      const id = this.player.equipment[slot];
      if (!id) continue;
      const eq = getEquipment(id);
      if (eq.setId) setCounts[eq.setId] = (setCounts[eq.setId] ?? 0) + 1;
    }
    return {
      mapNumber: this.effectiveMapNumber(),
      totalMaps: TOTAL_MAPS,
      weaponTags: w.tags ?? [],
      weaponElement: w.element,
      weaponAffixId: w.affixId,
      setCounts,
      petId: this.equippedPetId,
    };
  }

  private buildRunTelemetry(): RunTelemetry {
    const p = this.player;
    const w = getWeapon(p?.weaponId ?? '');
    const petDef = this.getEquippedPetDef();
    const snap = this.enemyDirector.getTelemetrySnapshot();
    const setCounts: Record<string, number> = {};
    if (p) {
      for (const slot of EQUIP_SLOTS) {
        const id = p.equipment[slot];
        if (!id) continue;
        const eq = getEquipment(id);
        if (eq.setId) setCounts[eq.setId] = (setCounts[eq.setId] ?? 0) + 1;
      }
    }
    return {
      mapNumber: this.effectiveMapNumber(),
      totalMaps: TOTAL_MAPS,
      roomsCleared: this.rooms.filter((r) => r.status === 'cleared').length,
      totalKills: this.kills,
      recentKills: snap.recentKills,
      damageTakenRecent: snap.recentDamageTaken,
      damageTakenTotal: this.damageTakenTotal,
      healsUsed: this.healsUsed,
      goldEarned: this.goldEarned,
      bossesDefeated: this.bossesDefeated,
      playerHpRatio: p && p.maxHp > 0 ? p.hp / p.maxHp : 1,
      playerShield: p?.shield ?? 0,
      playerLevel: p?.level ?? 1,
      weaponTags: w?.tags ?? [],
      weaponElement: w?.element,
      weaponAffixId: w?.affixId,
      equippedSets: Object.keys(setCounts),
      equippedPetId: this.equippedPetId,
      petElement: petDef?.effects.find((e) => e.key)?.key,
      ascensionLevel: this.ascensionLevel,
    };
  }

  private directedWeapon(tableId: string): GeneratedWeapon {
    const table = getLootTable(tableId);
    const ctx = this.buildLootContext();
    const { baseId, quality, affixId } = pickDirectedWeapon(table, ctx, this.lootMemory, this.runDirector, this.currentBiome);
    const gw = generateWeapon(baseId, quality, `gen_${this.nextId++}`, affixId);
    registerGenerated(gw);
    return gw;
  }

  private directedEquipment(tableId: string) {
    const table = getLootTable(tableId);
    const ctx = this.buildLootContext();
    const { baseId, quality } = pickDirectedEquipment(table, ctx, this.lootMemory, this.runDirector, this.currentBiome);
    return generateEquipment(baseId, quality, `eq_${this.nextId++}`);
  }

  private directedItem(tableId: string) {
    const table = getLootTable(tableId);
    const ctx = this.buildLootContext();
    const { itemId } = pickDirectedItem(table, ctx, this.lootMemory, this.runDirector);
    return getItem(itemId);
  }

  private initPet() {
    const def = this.getEquippedPetDef();
    if (!def) { this.pet = null; return; }
    this.pet = { x: this.player.x, y: this.player.y, trail: [], timers: {} };
    for (const eff of def.effects) this.pet.timers[eff.kind + (eff.key ?? '')] = 0;
  }

  private initBiomeParticles() {
    this.biomeParticles = [];
    const theme = this.currentBiome?.theme;
    if (!theme) return;
    const count = theme.particleDensity ?? 25;
    for (let i = 0; i < count; i++) {
      this.biomeParticles.push({
        x: runRandom.next('visual') * (this.worldW || 2000),
        y: runRandom.next('visual') * (this.worldH || 2000),
        vx: (runRandom.next('visual') - 0.5) * 18,
        vy: theme.particleType === 'embers'
          ? -25 - runRandom.next('visual') * 25
          : (runRandom.next('visual') - 0.5) * 20,
        size: theme.particleType === 'embers'
          ? 2 + runRandom.next('visual') * 3
          : 2 + runRandom.next('visual') * 2,
        alpha: 0.3 + runRandom.next('visual') * 0.5,
      });
    }
  }

  private updateBiomeParticles(dt: number) {
    const theme = this.currentBiome?.theme;
    if (!theme) return;
    const ww = this.worldW || 2000;
    const wh = this.worldH || 2000;
    for (const p of this.biomeParticles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (theme.particleType === 'embers' && p.y < 0) {
        p.y = wh;
        p.x = runRandom.next('visual') * ww;
      } else {
        if (p.x < 0) p.x = ww;
        if (p.x > ww) p.x = 0;
        if (p.y < 0) p.y = wh;
        if (p.y > wh) p.y = 0;
      }
    }
  }

  private resetRun() {
    this.mapNumber = 1;
    this.cycle = 1;
    this.scoreMultBaseline = 0;
    this.pendingVolleys = [];
    this.runSeed = runRandom.getSeed();
    this.lootMemory.reset();
    this.enemyDirector.reset();
    this.eventDirector.resetRun();
    this.runDirector.resetRun();
    this.runDirector.setAscensionLevel(this.ascensionLevel);
    this.acquiredSkills = [];
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.wave = 0;
    this.ended = null;
    this.damageTakenTotal = 0;
    this.healsUsed = 0;
    this.bossesDefeated = 0;
    this.goldEarned = getAscensionLevel(this.ascensionLevel).startingGoldBonus;
    this.goldGross = this.goldEarned;
    this.pendingSkills = null;
    this.pendingItemPickup = null;
    this.pendingPickupChoice = false;
    this.fullResetPlayer(this.characterId);
    this.newMapLayout();
  }

  private effectiveMapNumber(): number {
    return this.mapNumber + (this.cycle - 1) * TOTAL_MAPS;
  }

  getCycle(): number {
    return this.cycle;
  }

  continueEndless() {
    if (this.ended !== 'victory') return;
    this.cycle += 1;
    this.mapNumber = 1;
    this.ended = null;
    this.pendingItemPickup = null;
    this.pendingPickupChoice = false;
    this.eventDirector.onNextMap();
    this.runDirector.onNextMap();
    this.newMapLayout();
    this.recalcStats();
    this.running = true;
    this.last = performance.now();
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
    audio.resume();
    this.pushStats();
  }

  getEndlessModifierChoices() { return this.runDirector.getEndlessModifierChoices(); }
  getActiveEndlessModifiers() { return this.runDirector.getActiveEndlessModifiers(); }
  applyEndlessModifier(modId: string) { this.runDirector.applyEndlessModifier(modId); }

  abandonRun() {
    if (!this.player || this.ended) return;
    this.endRun('defeat', true);
  }

  private advanceToNextMap() {
    if (this.mapNumber >= TOTAL_MAPS) {
      this.endRun('victory');
      return;
    }
    this.mapNumber += 1;
    this.score += 200 * this.effectiveMapNumber();
    this.pendingItemPickup = null;
    this.pendingPickupChoice = false;
    this.eventDirector.onNextMap();
    this.runDirector.onNextMap();
    this.newMapLayout();
    this.recalcStats();
    this.presentSkillChoice();
  }

  private presentSkillChoice() {
    const choices = pickSkillChoices(3, this.buildSkillContext());
    this.pendingSkills = choices;
    this.running = false;
    for (const cb of this.onLevelUpCbs) cb(choices);
  }

  private comboMultiplier() {
    return 1 + Math.min(4, Math.floor(this.combo / 5) * 0.25);
  }

  private tick = (now: number) => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.tick);
    const realDt = Math.min((now - this.last) / 1000, 0.1);
    this.last = now;
    if (!this.running) {
      // Las pulsaciones hechas en pausa o dentro de un modal no deben ejecutarse al reanudar.
      this.pressedKeys.clear();
      this.clearTouchInput();
      this.render();
      return;
    }
    this.acc += realDt;
    let steps = 0;
    this.beginDamageBatch();
    while (this.acc >= this.fixedDt && steps < 4) {
      if (!this.running || this.ended) break;
      this.update(this.fixedDt);
      this.acc -= this.fixedDt;
      steps++;
    }
    this.endDamageBatch();
    // Sin tope, el tiempo acumulado tras un lag largo aceleraría el juego al recuperarse.
    if (this.acc > this.fixedDt) this.acc = this.fixedDt;
    this.render();
    // React no necesita 60 actualizaciones por segundo: el HUD se refresca ~12 veces por segundo.
    if (now - this.lastStatsPush >= 80) {
      this.lastStatsPush = now;
      this.pushStats();
    }
  };

  private isDown(action: InputAction): boolean {
    const code = this.bindings[action];
    if (code === 'Mouse0') return this.pointer.down;
    return this.keys.has(code);
  }

  private isPressed(action: InputAction): boolean {
    const code = this.bindings[action];
    return this.pressedKeys.has(code) || this.touchActions.has(action);
  }

  private consumeEdges() {
    this.pressedKeys.clear();
    this.touchActions.clear();
  }

  private pollInput(): InputState {
    let mx = 0;
    let my = 0;
    if (this.isDown('moveUp')) my -= 1;
    if (this.isDown('moveDown')) my += 1;
    if (this.isDown('moveLeft')) mx -= 1;
    if (this.isDown('moveRight')) mx += 1;
    if (this.touchMove.active) {
      mx = this.touchMove.x;
      my = this.touchMove.y;
    }
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    const shoot = this.isDown('attack') || this.touchShoot;
    const interact = this.isPressed('interact');

    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const worldX = this.pointer.x - viewW / 2 + this.camera.x;
    const worldY = this.pointer.y - viewH / 2 + this.camera.y;
    const hasAim = this.pointer.down;

    return {
      up: my < 0,
      down: my > 0,
      left: mx < 0,
      right: mx > 0,
      shoot,
      interact,
      aimX: worldX,
      aimY: worldY,
      hasAim,
      moveX: mx,
      moveY: my,
    };
  }

  private update(dt: number) {
    if (this.ended) return;
    this.worldTime += dt;
    this.ultimateCooldown = Math.max(0,this.ultimateCooldown-dt);
    this.stealth = Math.max(0,this.stealth-dt);
    this.energy = Math.min(getCharacter(this.characterId).energy,this.energy+dt*0.25);
    if (this.isPressed('ultimate')) this.activateUltimate();
    this.runDirector.update(this.buildRunTelemetry());
    const input = this.pollInput();
    this.enemyDirector.tick(dt);
    this.updatePlayer(dt, input);
    this.updatePendingVolleys(dt);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateBiomeParticles(dt);
    this.updateRoomFlow(dt);
    this.updatePet(dt);
    this.updateCamera(dt);
    this.handleCombat();
    this.handleInteractables(input);
    this.consumeEdges();
    if (this.comboTimer > 0) {
      this.comboTimer -= dt;
      if (this.comboTimer <= 0) this.combo = 0;
    }
    if (this.camera.shake > 0) this.camera.shake = Math.max(0, this.camera.shake - dt * 8);
  }

  private updatePlayer(dt: number, input: InputState) {
    const p = this.player;
    if (p.invuln > 0) p.invuln -= dt;
    if (p.fireCooldown > 0) p.fireCooldown -= dt;
    if (p.dashCooldown > 0 && !p.isDashing) p.dashCooldown -= dt;

    const dashJustPressed = this.isPressed('dash') || this.tripleDash > 0;
    if (dashJustPressed && (p.dashCooldown <= 0 || this.tripleDash > 0) && !p.isDashing) {
      p.isDashing = true;
      // Si no hay dirección de movimiento, el dash sale hacia donde mira el personaje.
      const fl = Math.hypot(p.facingX, p.facingY) || 1;
      this.dashDirX = p.facingX / fl;
      this.dashDirY = p.facingY / fl;
      p.dashTime = 0.18;
      p.dashCooldown = p.dashCooldownMax;
      p.invuln = Math.max(p.invuln, 0.2);
      audio.play('dash');
      this.burst(p.x, p.y, p.color, 8);
    }

    let speed = p.speed * p.speedMult;
    if (p.isDashing) {
      speed *= 3.2;
      p.dashTime -= dt;
      this.burst(p.x, p.y, p.color, 1);
      if (p.dashTime <= 0) {
        p.isDashing = false;
        if (this.tripleDash > 0) { this.tripleDash--; this.daggerStrike(); }
      }
    }

    let mx = input.moveX;
    let my = input.moveY;
    if (p.isDashing && mx === 0 && my === 0) {
      mx = this.dashDirX;
      my = this.dashDirY;
    }
    if (mx !== 0 || my !== 0) {
      const nx = p.x + mx * speed * dt;
      const ny = p.y + my * speed * dt;
      let pos = clampToWalkable(nx, ny, 14, this.getAccessibleWalkables());
      if (Math.hypot(pos.x - p.x, pos.y - p.y) < 0.01) {
        const onlyX = clampToWalkable(nx, p.y, 14, this.getAccessibleWalkables());
        const onlyY = clampToWalkable(p.x, ny, 14, this.getAccessibleWalkables());
        if (Math.abs(onlyX.x - p.x) > Math.abs(onlyY.y - p.y)) pos = onlyX;
        else pos = onlyY;
      }
      p.x = pos.x;
      p.y = pos.y;
      if (!p.isDashing) {
        p.facingX = mx;
        p.facingY = my;
      }
    }

    let aimDx = p.facingX;
    let aimDy = p.facingY;
    if (input.hasAim) {
      aimDx = input.aimX - p.x;
      aimDy = input.aimY - p.y;
    } else if (input.shoot) {
      const nearest = this.findNearestEnemy(p.x, p.y, 500);
      if (nearest) {
        aimDx = nearest.x - p.x;
        aimDy = nearest.y - p.y;
      }
    }
    const al = Math.hypot(aimDx, aimDy) || 1;
    aimDx /= al;
    aimDy /= al;
    if (input.hasAim || input.shoot) {
      p.facingX = aimDx;
      p.facingY = aimDy;
    }

    if (input.shoot && p.fireCooldown <= 0) {
      this.fireWeapon(p, aimDx, aimDy);
    }

    this.syncCurrentRoom();
    this.updateCorridorState();
  }

  private isPlayerInCorridor(): boolean {
    const p = this.player;
    for (const c of this.corridors) {
      if (rectsOverlapPoint(c.bounds, p.x, p.y, 0)) return true;
    }
    return false;
  }

  private updateCorridorState() {
    this.inCorridor = this.isPlayerInCorridor();
    if (this.inCorridor) {
      this.player.invuln = Math.max(this.player.invuln, 0.15);
      this.projectiles = this.projectiles.filter((pr) => {
        if (pr.owner !== 'enemy') return true;
        for (const c of this.corridors) {
          if (rectsOverlapPoint(c.bounds, pr.x, pr.y, pr.size)) return false;
        }
        return true;
      });
    }
  }

  private getAccessibleWalkables(): RoomBounds[] {
    const result: RoomBounds[] = [];
    const pushUnique = (b: RoomBounds) => {
      if (!result.includes(b)) result.push(b);
    };

    for (const r of this.rooms) {
      if (r.status === 'cleared' || r.status === 'active' || r.id === this.currentRoomId) {
        pushUnique(r.bounds);
      }
    }

    for (const c of this.corridors) {
      const a = this.rooms.find((r) => r.id === c.from)!;
      const b = this.rooms.find((r) => r.id === c.to)!;
      const blocked = a.status === 'active' || b.status === 'active';
      if (blocked) continue;
      if (a.status === 'cleared' || b.status === 'cleared') {
        pushUnique(c.bounds);
        if (a.status === 'cleared') pushUnique(b.bounds);
        if (b.status === 'cleared') pushUnique(a.bounds);
      }
    }

    for (const c of this.corridors) {
      if (rectsOverlapPoint(c.bounds, this.player.x, this.player.y, 0)) {
        pushUnique(c.bounds);
      }
    }

    pushUnique(this.rooms[0].bounds);
    return result;
  }

  private syncCurrentRoom() {
    const p = this.player;
    for (const r of this.rooms) {
      if (rectsOverlapPoint(r.bounds, p.x, p.y, -20)) {
        if (this.currentRoomId !== r.id) {
          this.ultimateRoom = -1;
          this.currentRoomId = r.id;
          r.discovered = true;
          if (this.petRevealBonus() > 0) {
            for (const nbId of r.connections) {
              const nb = this.rooms.find((rr) => rr.id === nbId);
              if (nb) nb.discovered = true;
            }
          }
          if (r.status === 'locked') {
            this.activateRoom(r);
          }
        }
        return;
      }
    }
  }

  private activateRoom(room: RoomNode) {
    this.activeCombatRoomId = room.id;
    room.status = 'active';
    room.discovered = true;
    this.roomCombatActive = false;
    this.roomWave = 0;
    this.currentEvent = null;
    this.challengeFailed = false;
    this.challengeTimer = 0;
    (room as any)._activatedAt = this.worldTime;
    this.enemies = [];
    this.enemiesToSpawn = [];
    this.projectiles = this.projectiles.filter((pr) => pr.owner === 'player');

    if (room.kind === 'start') {
      room.status = 'cleared';
      return;
    }
    if (room.kind === 'treasure') {
      room.status = 'cleared';
      this.spawnChest('chest_armory', room.bounds.x + room.bounds.w / 2, room.bounds.y + room.bounds.h / 2, room.id);
      audio.play('wave_start');
      return;
    }
    if (room.kind === 'event') {
      const evId = room.eventId ?? (room as any).eventId;
      if (!evId) {
        this.roomCombatActive = true;
        this.roomWaveTotal = COMBAT_WAVES;
        this.roomWave = 0;
        this.wave = room.id;
        this.startNextWave(room);
        return;
      }
      const eventDef = EVENT_DEFS.find((e) => e.id === evId);
      if (!eventDef) {
        this.roomCombatActive = true;
        this.roomWaveTotal = COMBAT_WAVES;
        this.roomWave = 0;
        this.wave = room.id;
        this.startNextWave(room);
        return;
      }
      // Cada sala de evento genera su instancia de forma determinista, se visite en el orden que se visite.
      runRandom.reseed('event', `room:${this.cycle}:${this.mapNumber}:${room.id}`);
      const rng = this.seededRandom('event');
      const instance = this.eventDirector.generateInstance(
        evId,
        {
          mapNumber: this.mapNumber,
          directedWeapon: (t) => this.directedWeapon(t),
          directedEquipment: (t) => this.directedEquipment(t),
        },
        rng,
      );
      this.currentEvent = instance;

      if (instance.combatRules) {
        this.roomCombatActive = true;
        this.roomWaveTotal = instance.combatRules.waveCount;
        this.roomWave = 0;
        this.wave = room.id;
        this.challengeFailed = false;
        this.challengeTimer = instance.combatRules.timeLimit ?? 0;
        this.startNextWave(room);
      } else {
        room.status = 'cleared';
        this.eventEntities.push({
          id: this.nextId++,
          x: room.bounds.x + room.bounds.w / 2,
          y: room.bounds.y + room.bounds.h / 2,
          instance,
          active: true,
        });
        audio.play('wave_start');
      }
      return;
    }
    if (room.kind === 'portal') {
      room.status = 'cleared';
      return;
    }
    if (room.kind === 'boss') {
      this.roomCombatActive = true;
      this.roomWaveTotal = 1;
      this.roomWave = 1;
      this.wave = room.id;
      audio.play('wave_start');
      this.queueBossEnemies(room);
      return;
    }
    this.roomCombatActive = true;
    this.roomWaveTotal = COMBAT_WAVES;
    this.roomWave = 0;
    this.wave = room.id;
    this.startNextWave(room);
  }

  private startNextWave(room: RoomNode) {
    this.roomWave += 1;
    audio.play('wave_start');
    this.queueCombatWave(room, this.roomWave);
  }

  private buildDirectorContext(): DirectorContext {
    const p = this.player;
    const w = getWeapon(p.weaponId);
    const room = this.rooms.find((r) => r.id === this.currentRoomId);
    const snap = this.enemyDirector.getTelemetrySnapshot();
    const setCounts: Record<string, number> = {};
    for (const slot of EQUIP_SLOTS) {
      const id = p.equipment[slot];
      if (!id) continue;
      const eq = getEquipment(id);
      if (eq.setId) setCounts[eq.setId] = (setCounts[eq.setId] ?? 0) + 1;
    }
    const roomTime = room && (room as any)._activatedAt != null
      ? this.worldTime - (room as any)._activatedAt
      : 0;
    return {
      mapNumber: this.effectiveMapNumber(),
      roomId: this.currentRoomId,
      totalRunTime: this.worldTime,
      roomTime,
      playerHpRatio: p.maxHp > 0 ? p.hp / p.maxHp : 1,
      playerShield: p.shield,
      playerLevel: p.level,
      playerWeaponId: p.weaponId,
      weaponRarity: w.quality,
      equippedSets: Object.keys(setCounts),
      equippedPetId: this.equippedPetId,
      totalKills: this.kills,
      recentKills: snap.recentKills,
      killRate: snap.recentKills,
      recentDamageTaken: snap.recentDamageTaken,
      nearDeathCount: snap.nearDeathCount,
      gold: this.goldEarned,
      chestsOpened: this.chests.filter((c) => c.opened).length,
      bossesDefeated: this.bossesDefeated,
      roomCleared: false,
    };
  }

  private queueBossEnemies(room: RoomNode) {
    const bossPool = BOSSES.map((b) => ({
      boss: b,
      weight: this.currentBiome?.bossWeights?.[b.id] ?? 1,
    }));
    const totalW = bossPool.reduce((s, x) => s + x.weight, 0);
    let r = runRandom.next('encounter') * totalW;
    let chosenBoss = BOSSES[Math.min(2, Math.floor(room.id / 2)) % BOSSES.length];
    for (const item of bossPool) {
      r -= item.weight;
      if (r <= 0) { chosenBoss = item.boss; break; }
    }

    const ctx = this.buildDirectorContext();
    const adds = this.enemyDirector.generateBossAdds(chosenBoss.id, ctx.mapNumber, this.currentBiome, this.runDirector);
    const intMult = this.runDirector.getAscensionState()?.enemyIntensityMult ?? 1;
    const list: EnemyDef[] = [
      {
        ...chosenBoss,
        // Misma escala por mapa/ciclo que el resto de enemigos (EnemyDirector.scaleEnemy).
        hp: Math.floor(chosenBoss.hp * (1 + room.id * 0.05) * (1 + (ctx.mapNumber - 1) * 0.12) * intMult),
        damage: Math.floor(chosenBoss.damage * (1 + (ctx.mapNumber - 1) * 0.08) * intMult),
      },
      ...adds,
    ];
    this.enemiesToSpawn = list;
    this.spawnTimer = 0.15;
  }

  private queueCombatWave(_room: RoomNode, _waveNum: number) {
    const ctx = this.buildDirectorContext();
    if (this.currentEvent?.combatRules?.isCursed) {
      ctx.mapNumber = Math.min(TOTAL_MAPS, ctx.mapNumber + 3);
    }
    ctx.roomTime = 0;
    const dt = this.fixedDt;
    const list = this.enemyDirector.generateWave(ctx, this.player, dt, this.runDirector, this.currentBiome);
    this.enemiesToSpawn = list;
    this.spawnTimer = 0.2;
  }

  private updateRoomFlow(dt: number) {
    if (this.inCorridor) return;

    if (this.enemiesToSpawn.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const def = this.enemiesToSpawn.shift()!;
        this.spawnEnemyInRoom(def, def.tags.includes('boss') || def.tags.includes('miniboss'));
        this.spawnTimer = 0.3;
      }
    }

    const room = this.rooms.find((r) => r.id === this.activeCombatRoomId);
    if (!room) return;

    if (room.status === 'active') {
      if (this.roomCombatActive) {
        if (this.currentEvent?.combatRules?.timeLimit && !this.challengeFailed) {
          this.challengeTimer -= dt;
          if (this.challengeTimer <= 0) {
            this.challengeFailed = true;
          }
        }

        if (this.enemies.length === 0 && this.enemiesToSpawn.length === 0) {
          if ((room.kind === 'combat' || room.kind === 'event') && this.roomWave < this.roomWaveTotal) {
            this.startNextWave(room);
          } else {
            this.clearRoom(room);
          }
        }
      } else {
        if (this.enemies.length === 0 && this.enemiesToSpawn.length === 0) {
          this.clearRoom(room);
        }
      }
    }
  }

  private recalcStats() {
    const char = getCharacter(this.characterId);
    const hpPerUpgrade = this.upgrades.permHpLevel * 10;
    const permDmg = 1 + this.upgrades.permDamageLevel * 0.05;

    this.player.maxHp = char.stats.hp + hpPerUpgrade;
    this.player.speed = char.stats.speed;
    this.player.armor = char.stats.armor;
    this.player.critChance = char.stats.critChance;
    this.player.critDamageMult = 2;
    this.player.damageMult = permDmg;
    this.player.speedMult = 1;
    this.player.spreadMult = 1;
    this.player.goldMult = 1;
    this.player.pierceBonus = 0;
    this.player.countBonus = 0;
    this.player.lifesteal = 0;
    this.player.fireRateMult = 1;
    this.player.projectileSizeBonus = 0;
    this.player.bounceBonus = 0;
    this.player.explosionBonus = 0;
    this.player.maxShield = 0;
    this.player.dashCooldownMax = 1.2;
    this.player.burnDpsMult = 1;
    this.player.poisonDpsMult = 1;

    const addMods = (mods: Array<{ stat: string; op: string; val: number }>) => {
      for (const m of mods) {
        switch (m.stat) {
          case 'maxHp':
            this.player.maxHp += m.val;
            break;
          case 'armor':
            this.player.armor += m.val;
            break;
          case 'speed':
            if (m.op === 'mult') this.player.speedMult *= (1 + m.val);
            else this.player.speed *= (1 + m.val / 100);
            break;
          case 'speedMult':
            this.player.speedMult *= (1 + m.val);
            break;
          case 'critChance':
            this.player.critChance += m.val;
            break;
          case 'damageMult':
            this.player.damageMult *= (1 + m.val);
            break;
          case 'fireRateMult':
            this.player.fireRateMult *= (1 + m.val);
            break;
          case 'spreadMult':
            this.player.spreadMult = Math.max(0.1, this.player.spreadMult * (1 + m.val));
            break;
          case 'gold_boost':
            this.player.goldMult += m.val;
            break;
          case 'projectileSize':
            if (m.op === 'mult') this.player.projectileSizeBonus += m.val * 10;
            else this.player.projectileSizeBonus += m.val;
            break;
          case 'pierce':
            this.player.pierceBonus += m.val;
            break;
          case 'count':
          case 'countBonus':
            this.player.countBonus += m.val;
            break;
          case 'bounce':
            this.player.bounceBonus += m.val;
            break;
          case 'lifesteal':
            this.player.lifesteal += m.val;
            break;
          case 'dashCooldown':
            this.player.dashCooldownMax = Math.max(0.4, this.player.dashCooldownMax + m.val);
            break;
          case 'shield':
            this.player.maxShield += m.val;
            break;
          case 'explosionRadius':
            this.player.explosionBonus += m.val;
            break;
          case 'critDamageMult':
            this.player.critDamageMult += m.val;
            break;
          case 'burnDpsMult':
            this.player.burnDpsMult *= (1 + m.val);
            break;
          case 'poisonDpsMult':
            this.player.poisonDpsMult *= (1 + m.val);
            break;
        }
      }
    };

    if (char.passive) {
      for (const m of char.passive) {
        const op = m.op === 'add_pct' ? 'mult' : m.op;
        addMods([{ stat: m.stat, op, val: m.value }]);
      }
    }

    for (const skill of this.acquiredSkills) {
      addMods(skill.mods.map((m) => this.skillModToGeneric(m)));
    }

    for (const slot of EQUIP_SLOTS) {
      const id = this.player.equipment[slot];
      if (!id) continue;
      const eq = getEquipment(id);
      addMods(eq.mods.map((m) => ({ stat: m.stat, op: m.op, val: m.value })));
    }

    const setCounts = new Map<string, number>();
    for (const slot of EQUIP_SLOTS) {
      const id = this.player.equipment[slot];
      if (!id) continue;
      const eq = getEquipment(id);
      if (eq.setId) setCounts.set(eq.setId, (setCounts.get(eq.setId) ?? 0) + 1);
    }
    for (const [setId, count] of setCounts) {
      const def = getSetBonusDef(setId);
      if (!def) continue;
      for (const bonus of def.bonuses) {
        if (count >= bonus.pieces) {
          addMods(bonus.mods.map((m) => ({ stat: m.stat, op: m.op, val: m.value })));
          if (bonus.special === 'lethalStrike') this.player.critDamageMult = Math.max(this.player.critDamageMult, 3);
        }
      }
      const w = getWeapon(this.player.weaponId);
      if (count >= 2 && def.synergy) {
        const syn = def.synergy;
        const tagMatch = syn.weaponTags?.some((t) => w.tags.includes(t)) ?? false;
        const affixMatch = syn.affixIds?.some((a) => w.affixId === a) ?? false;
        const elemMatch = syn.element ? w.element === syn.element : false;
        if ((tagMatch || affixMatch || elemMatch) && syn.damageMult) {
          this.player.damageMult *= (1 + syn.damageMult);
        }
      }
      if (count >= 2 && def.counterSynergy) {
        const cs = def.counterSynergy;
        const tagMatch = cs.weaponTags?.some((t) => w.tags.includes(t)) ?? false;
        const affixMatch = cs.affixIds?.some((a) => w.affixId === a) ?? false;
        const elemMatch = cs.element ? w.element === cs.element : false;
        if ((tagMatch || affixMatch || elemMatch) && cs.damageMult) {
          this.player.damageMult *= cs.damageMult;
        }
      }
    }

    const petDef = this.getEquippedPetDef();
    if (petDef) {
      const w = getWeapon(this.player.weaponId);
      for (const b of petStatBoosts(petDef)) {
        let val = b.value;
        if (b.synergyTags && b.synergyTags.length > 0) {
          const match = b.synergyTags.some((t) => w.tags.includes(t) || w.element === t || w.affixId === t);
          if (match) val *= 2;
        }
        addMods([{ stat: b.key, op: b.op, val }]);
      }
    }

    this.applyStatBalance();
  }

  private applyStatBalance() {
    const p = this.player;
    p.maxHp = Math.round(balanceStat('maxHp', p.maxHp));
    p.armor = balanceStat('armor', p.armor);
    p.maxShield = Math.round(balanceStat('shield', p.maxShield));
    p.shield = Math.min(p.shield, p.maxShield);
    p.critChance = balanceStat('critChance', p.critChance);
    p.critDamageMult = balanceStat('critDamageMult', p.critDamageMult);
    p.damageMult = balanceStat('damageMult', p.damageMult);
    p.fireRateMult = balanceStat('fireRateMult', p.fireRateMult);
    p.speedMult = balanceStat('speedMult', p.speedMult);
    p.lifesteal = balanceStat('lifesteal', p.lifesteal);
    p.pierceBonus = Math.round(balanceStat('pierceBonus', p.pierceBonus));
    p.countBonus = Math.round(balanceStat('countBonus', p.countBonus));
    p.bounceBonus = Math.round(balanceStat('bounceBonus', p.bounceBonus));
    p.explosionBonus = Math.round(balanceStat('explosionBonus', p.explosionBonus));
    p.projectileSizeBonus = balanceStat('projectileSizeBonus', p.projectileSizeBonus);
    if (p.hp > p.maxHp) p.hp = p.maxHp;
  }

  private equipItem(itemId: string, slot: EquipSlot): string | null {
    const prev = this.player.equipment[slot];
    this.player.equipment[slot] = itemId;
    this.recalcStats();
    return prev;
  }

  private clearRoom(room: RoomNode) {
    if (this.activeCombatRoomId === room.id) this.activeCombatRoomId = null;
    this.enemyDirector.onRoomCleared();
    room.status = 'cleared';
    this.roomCombatActive = false;
    audio.play('levelup');
    if (room.kind === 'combat') {
      this.spawnChest('chest_street', room.bounds.x + room.bounds.w / 2, room.bounds.y + room.bounds.h / 2, room.id);
      if (runRandom.next('loot') < 0.3) {
        const eq = this.directedEquipment('reward');
        this.spawnPickup(room.bounds.x + room.bounds.w / 2 + 30, room.bounds.y + room.bounds.h / 2 - 20, 'item', eq.color, 0, undefined, eq.genId);
      }
    }
    if (room.kind === 'event') {
      if (this.currentEvent?.combatRules && !this.challengeFailed) {
        this.spawnChest(this.currentEvent.combatRules.rewardChest, room.bounds.x + room.bounds.w / 2, room.bounds.y + room.bounds.h / 2, room.id);
      }
    }
    if (room.kind === 'boss') {
      this.spawnChest('chest_boss', room.bounds.x + room.bounds.w / 2, room.bounds.y + room.bounds.h / 2 - 40, room.id);
      const eq = this.directedEquipment('reward');
      this.spawnPickup(room.bounds.x + room.bounds.w / 2 - 30, room.bounds.y + room.bounds.h / 2 - 60, 'item', eq.color, 0, undefined, eq.genId);
      const isFinal = this.mapNumber >= TOTAL_MAPS;
      this.portal = {
        x: room.bounds.x + room.bounds.w / 2,
        y: room.bounds.y + room.bounds.h / 2,
        active: true,
        kind: isFinal ? 'final' : 'descent',
      };
    }
    this.lootVacuum = true;
  }

  private spawnEnemyInRoom(def: EnemyDef, isBoss = false) {
    const room = this.rooms.find((r) => r.id === this.currentRoomId) ?? this.rooms[0];
    const b = room.bounds;
    const margin = 70;
    let x = b.x + margin + runRandom.next('encounter') * (b.w - margin * 2);
    let y = b.y + margin + runRandom.next('encounter') * (b.h - margin * 2);
    if (Math.hypot(x - this.player.x, y - this.player.y) < 160) {
      x = this.player.x < b.x + b.w / 2 ? b.x + b.w - margin : b.x + margin;
      y = this.player.y < b.y + b.h / 2 ? b.y + b.h - margin : b.y + margin;
    }

    const opponent = this.opposingRoster[this.nextOpponent++ % this.opposingRoster.length];
    this.enemies.push({
      id: this.nextId++,
      defId: def.id,
      characterId: opponent.id,
      weaponId: getBaseWeapon(opponent.startingWeapon).id,
      name: opponent.name,
      x,
      y,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed,
      damage: def.damage,
      size: def.size,
      color: def.color,
      glow: def.glow,
      shape: def.shape,
      score: def.score,
      xp: def.xp,
      aiProfile: def.aiProfile,
      attackRange: def.attackRange,
      attackCooldown: def.attackCooldown,
      attackTimer: 0.5,
      projectile: def.projectile,
      explosionRadius: def.explosionRadius,
      hitFlash: 0,
      spawnAnim: 0.4,
      isBoss: isBoss || def.tags.includes('boss'),
      currentPhase: 0,
      phaseInvuln: 0,
    });
  }

  private fireWeapon(p: PlayerState, dx: number, dy: number) {
    const w = getWeapon(p.weaponId);
    p.fireCooldown = 1 / (w.fireRate * Math.max(0.1, p.fireRateMult));
    if (this.characterId === 'rayo' && this.ultimateRoom === this.currentRoomId) {
      this.daggerStrike();
      if (w.tags?.includes('melee')) p.fireCooldown /= 1.25;
    }
    const baseAngle = Math.atan2(dy, dx);
    const burstN = w.burstCount && w.burstCount > 1 ? w.burstCount : 1;
    const effectiveSpread = w.spread * p.spreadMult;

    this.spawnVolley(p, w, baseAngle, effectiveSpread);
    // Las ráfagas lanzan el resto de disparos con un retardo real entre ellos.
    for (let b = 1; b < burstN; b++) {
      this.pendingVolleys.push({ delay: b * BURST_INTERVAL, angle: baseAngle, spread: effectiveSpread, weaponId: p.weaponId });
    }
    this.muzzleFlash(p.x, p.y, baseAngle, w.color);
    spriteAtlas.spawnEffect(`muzzle_${w.element ?? 'phys'}`, p.x + Math.cos(baseAngle) * 14, p.y + Math.sin(baseAngle) * 14, this.worldTime, baseAngle);
    audio.play(w.sound);
  }

  private updatePendingVolleys(dt: number) {
    if (this.pendingVolleys.length === 0) return;
    const p = this.player;
    const due: typeof this.pendingVolleys = [];
    for (const v of this.pendingVolleys) {
      v.delay -= dt;
      if (v.delay <= 0) due.push(v);
    }
    if (due.length === 0) return;
    this.pendingVolleys = this.pendingVolleys.filter((v) => v.delay > 0);
    for (const v of due) {
      // Si el jugador cambió de arma entre disparos de la ráfaga, la ráfaga se descarta.
      if (v.weaponId !== p.weaponId) continue;
      this.spawnVolley(p, getWeapon(v.weaponId), v.angle, v.spread);
      audio.play(getWeapon(v.weaponId).sound);
    }
  }

  private spawnVolley(p: PlayerState, w: ReturnType<typeof getWeapon>, baseAngle: number, effectiveSpread: number) {
    const count = w.count + p.countBonus;
    const half = (count - 1) / 2;
    for (let i = 0; i < count; i++) {
      const spread =
        (i - half) * effectiveSpread +
        (runRandom.next('combat') - 0.5) * effectiveSpread * 0.3;
      const ang = baseAngle + spread;
      const crit = runRandom.next('combat') < p.critChance;
      const unstableMult = w.unstable ? 0.75 + runRandom.next('combat') : 1;
      const dmg = w.damage * p.damageMult * (crit ? p.critDamageMult : 1) * unstableMult;
      const size = (w.projectileSize + p.projectileSizeBonus + (crit ? 2 : 0)) * (w.sizeMult ?? 1);
      this.projectiles.push({
        id: this.nextId++,
        x: p.x + Math.cos(ang) * 18,
        y: p.y + Math.sin(ang) * 18,
        vx: Math.cos(ang) * w.projectileSpeed,
        vy: Math.sin(ang) * w.projectileSpeed,
        damage: dmg,
        // Si el arma ya es amarilla, el crítico se distingue con un blanco cálido.
        color: crit ? (w.color.toLowerCase() === '#ffe14a' ? '#fffbe0' : '#ffe14a') : w.color,
        size,
        pierce: w.pierce + p.pierceBonus,
        pierced: new Set(),
        life: w.lifetime ?? 1.8,
        owner: 'player',
        sprite: w.baseId,
        _bounceCount: (w.bounceCount ?? 0) + p.bounceBonus,
        _explosionRadius: (w.explosionRadius ?? 0) + p.explosionBonus,
        _lifesteal: w.lifesteal,
        _element: w.element,
        _elementChance: w.elementChance,
        _chain: w.chain,
        _chainChance: w.chainChance,
        _isCrit: crit,
      });
    }
  }

  private updateProjectiles(dt: number) {
    const next: Projectile[] = [];
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;

      const walkables = this.getAccessibleWalkables();
      const containingRoom = walkables.find((b) => rectsOverlapPoint(b, pr.x, pr.y, 0));

      if (pr._bounceCount && pr._bounceCount > 0) {
        // Solo rebota si se dirige hacia la pared: así un disparo hecho junto a un muro, alejándose, no gasta rebotes.
        const bounds = walkables.find((b) => rectsOverlapPoint(b, pr.x, pr.y, pr.size + 40));
        if (bounds) {
          if ((pr.x < bounds.x + 30 && pr.vx < 0) || (pr.x > bounds.x + bounds.w - 30 && pr.vx > 0)) {
            pr.vx = -pr.vx;
            pr.x = Math.max(bounds.x + 30, Math.min(bounds.x + bounds.w - 30, pr.x));
            pr._bounceCount -= 1;
          }
          if ((pr.y < bounds.y + 30 && pr.vy < 0) || (pr.y > bounds.y + bounds.h - 30 && pr.vy > 0)) {
            pr.vy = -pr.vy;
            pr.y = Math.max(bounds.y + 30, Math.min(bounds.y + bounds.h - 30, pr.y));
            pr._bounceCount -= 1;
          }
        }
      }

      if (pr.life <= 0) continue;
      if (pr.x < -200 || pr.y < -200 || pr.x > this.worldW + 200 || pr.y > this.worldH + 200) continue;
      const insideWalkable = containingRoom !== undefined || walkables.some((b) => rectsOverlapPoint(b, pr.x, pr.y, pr.size));
      if (!insideWalkable) {
        if (pr._explosionRadius && pr._explosionRadius > 0) {
          this.explodeAt(pr.x, pr.y, pr._explosionRadius, pr.damage * 0.5, pr.color);
        }
        continue;
      }
      next.push(pr);
    }
    this.projectiles = next;
  }

  private applyProjectileAffix(pr: Projectile, e: EnemyEntity) {
    if (pr._lifesteal && pr._lifesteal > 0) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + pr.damage * pr._lifesteal);
    }
    if (
      pr._element &&
      (pr._elementChance === undefined || runRandom.next('combat') < pr._elementChance)
    ) {
      const elemSyn = pr._element ? this.getElementSynergyMult(pr._element) : 1;
      switch (pr._element) {
        case 'fire':
        case 'radiant':
          e.burnTimer = 3 * elemSyn;
          e.burnDps = Math.max(2, pr.damage * 0.2 * elemSyn) * (1 + (this.player?.burnDpsMult ?? 1) - 1);
          break;
        case 'toxic':
        case 'dark':
          e.poisonTimer = 4 * elemSyn;
          e.poisonDps = Math.max(2, pr.damage * 0.15 * elemSyn) * (1 + (this.player?.poisonDpsMult ?? 1) - 1);
          break;
        case 'bleed':
          e.bleedTimer = 3 * elemSyn;
          e.bleedDps = Math.max(2, pr.damage * 0.12 * elemSyn);
          break;
        case 'ice':
          e.slowTimer = 2.5 * elemSyn;
          break;
        case 'electric':
          break;
      }
    }
    if (pr._isCrit && this.acquiredSkills.some((s) => s.id === 'skill_bleed_crit')) {
      e.bleedTimer = 3;
      e.bleedDps = Math.max(2, pr.damage * 0.12);
    }
    if (
      pr._chain &&
      pr._chain > 0 &&
      (pr._chainChance === undefined || runRandom.next('combat') < pr._chainChance)
    ) {
      let remaining = pr._chain;
      const alreadyHit = new Set<number>([e.id]);
      let sourceX = e.x;
      let sourceY = e.y;
      while (remaining > 0) {
        let best: EnemyEntity | null = null;
        let bestD = 220;
        for (const other of this.enemies) {
          if (other.hp <= 0 || other.dead) continue;
          if (other.phaseInvuln && other.phaseInvuln > 0) continue;
          if (alreadyHit.has(other.id)) continue;
          const dd = Math.hypot(other.x - sourceX, other.y - sourceY);
          if (dd < bestD) { bestD = dd; best = other; }
        }
        if (!best) break;
        best.hp -= pr.damage * 0.5;
        best.hitFlash = 0.1;
        this.burst(best.x, best.y, '#6ef0ff', 4);
        spriteAtlas.spawnArc(sourceX, sourceY, best.x, best.y, this.worldTime);
        spriteAtlas.spawnEffect('tesla_node', best.x, best.y, this.worldTime);
        if (best.hp <= 0) this.killEnemy(best);
        alreadyHit.add(best.id);
        sourceX = best.x;
        sourceY = best.y;
        remaining -= 1;
      }
    }
  }

  private explodeAt(x: number, y: number, radius: number, damage: number, color: string) {
    audio.play('explosion');
    spriteAtlas.spawnExplosion(x, y, radius, this.worldTime);
    this.burst(x, y, color, 16);
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.dead) continue;
      if (e.phaseInvuln && e.phaseInvuln > 0) continue;
      if (Math.hypot(e.x - x, e.y - y) < radius + e.size) {
        e.hp -= damage;
        e.hitFlash = 0.1;
        if (e.hp <= 0) this.killEnemy(e);
      }
    }
    if (Math.hypot(this.player.x - x, this.player.y - y) < radius + 14) {
      this.damagePlayer(damage * 0.3);
    }
  }

  private checkBossPhase(e: EnemyEntity): void {
    const phases = getBossPhases(e.defId);
    if (phases.length === 0) return;
    const hpPct = e.hp / e.maxHp;
    for (let i = phases.length - 1; i >= 0; i--) {
      const ph = phases[i];
      if ((ph.minAscensionLevel ?? 0) > this.ascensionLevel) continue;
      if (hpPct <= ph.hpThreshold && (e.currentPhase ?? 0) < i + 1) {
        e.currentPhase = i + 1;
        if (ph.phaseInvuln) e.phaseInvuln = ph.phaseInvuln;
        if (ph.speedMult) e.speed *= ph.speedMult;
        if (ph.damageMult) e.damage = Math.floor(e.damage * ph.damageMult);
        if (ph.attackCooldownMult) e.attackCooldown *= ph.attackCooldownMult;
        if (ph.colorOverride) e.color = ph.colorOverride;
        if (ph.glowOverride) e.glow = ph.glowOverride;
        if (ph.extraProjectile && e.projectile) {
          e.projectile = {
            speed: e.projectile.speed * (ph.extraProjectile.speed ?? 1),
            size: e.projectile.size * (ph.extraProjectile.size ?? 1),
            color: ph.extraProjectile.color ?? e.projectile.color,
          };
        }
        this.burst(e.x, e.y, e.color, 20);
        this.camera.shake = Math.min(0.8, this.camera.shake + 0.4);
        audio.play('explosion');
        if (ph.adds) {
          for (const add of ph.adds) {
            const def = getEnemy(add.defId);
            if (!def) continue;
            for (let n = 0; n < add.count; n++) {
              this.spawnEnemyInRoom(def, def.tags.includes('boss') || def.tags.includes('miniboss'));
            }
          }
        }
        break;
      }
    }
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    const room = this.rooms.find((r) => r.id === (this.activeCombatRoomId ?? this.currentRoomId));
    for (const e of this.enemies) {
      if (e.dead) continue;
      if (e.spawnAnim > 0) e.spawnAnim -= dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.attackTimer > 0) e.attackTimer -= dt;
      if (e.phaseInvuln && e.phaseInvuln > 0) e.phaseInvuln -= dt;

      if (e.isBoss) this.checkBossPhase(e);

      if (e.burnTimer && e.burnTimer > 0) {
        e.burnTimer -= dt;
        e.hp -= (e.burnDps ?? 0) * dt;
        if (runRandom.next('visual') < dt * 6) this.burst(e.x, e.y, '#ff6a00', 1);
      }
      if (e.poisonTimer && e.poisonTimer > 0) {
        e.poisonTimer -= dt;
        e.hp -= (e.poisonDps ?? 0) * dt;
        if (runRandom.next('visual') < dt * 6) this.burst(e.x, e.y, '#9dff00', 1);
      }
      if (e.bleedTimer && e.bleedTimer > 0) {
        e.bleedTimer -= dt;
        e.hp -= (e.bleedDps ?? 0) * dt;
        if (runRandom.next('visual') < dt * 6) this.burst(e.x, e.y, '#ff2a4b', 1);
      }
      let slowFactor = 1;
      if (e.slowTimer && e.slowTimer > 0) {
        e.slowTimer -= dt;
        slowFactor = 0.5;
      }
      if (e.hp <= 0) { this.killEnemy(e); continue; }

      if (this.stealth > 0 || (this.stunUntil.get(e.id) ?? 0) > this.worldTime) continue;
      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;
      const spd = e.speed * slowFactor;

      if (e.aiProfile === 'chaser') {
        e.x += nx * spd * dt;
        e.y += ny * spd * dt;
      } else if (e.aiProfile === 'ranged_kiter') {
        const ideal = e.attackRange * 0.7;
        if (dist < ideal * 0.6) {
          e.x -= nx * spd * dt;
          e.y -= ny * spd * dt;
        } else if (dist > ideal) {
          e.x += nx * spd * 0.7 * dt;
          e.y += ny * spd * 0.7 * dt;
        } else {
          e.x += -ny * spd * 0.5 * dt;
          e.y += nx * spd * 0.5 * dt;
        }
        if (dist < e.attackRange && e.attackTimer <= 0 && e.projectile) {
          e.attackTimer = e.attackCooldown;
          this.projectiles.push({
            id: this.nextId++,
            x: e.x,
            y: e.y,
            vx: nx * e.projectile.speed,
            vy: ny * e.projectile.speed,
            damage: e.damage,
            color: e.projectile.color,
            size: e.projectile.size,
            pierce: 0,
            pierced: new Set(),
            life: 3,
            owner: 'enemy',
            sprite: e.weaponId,
          });
        }
      } else if (e.aiProfile === 'bomber_rush') {
        e.x += nx * spd * 1.3 * dt;
        e.y += ny * spd * 1.3 * dt;
        if (dist < (e.explosionRadius ?? 50) * 0.5) {
          this.explodeEnemy(e);
          // Cuenta como baja (XP, puntuación, bestiario y botín), no desaparece sin más.
          this.killEnemy(e);
        }
      }

      const minDist = e.size + 14;
      const sepDx = e.x - p.x;
      const sepDy = e.y - p.y;
      const sepDist = Math.hypot(sepDx, sepDy);
      if (sepDist > 0 && sepDist < minDist) {
        const push = minDist - sepDist;
        e.x += (sepDx / sepDist) * push;
        e.y += (sepDy / sepDist) * push;
      }

      if (dist < e.size + 14 && e.attackTimer <= 0 && e.aiProfile !== 'bomber_rush') {
        e.attackTimer = e.attackCooldown;
        this.damagePlayer(e.damage);
      }

      if (room) {
        const b = room.bounds;
        e.x = Math.max(b.x + e.size, Math.min(b.x + b.w - e.size, e.x));
        e.y = Math.max(b.y + e.size, Math.min(b.y + b.h - e.size, e.y));
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0 && !e.dead);
  }

  private explodeEnemy(e: EnemyEntity) {
    const r = e.explosionRadius ?? 60;
    audio.play('explosion');
    this.camera.shake = 0.4;
    spriteAtlas.spawnExplosion(e.x, e.y, r, this.worldTime);
    this.burst(e.x, e.y, e.color, 20);
    const d = Math.hypot(this.player.x - e.x, this.player.y - e.y);
    if (d < r + 14) this.damagePlayer(e.damage);
  }

  private beginDamageBatch() {
    const p = this.player;
    this.damageBatchActive = true;
    this.damageBatchAcceptsHits =
      !this.ended &&
      !this.inCorridor &&
      !this.isPlayerInCorridor() &&
      p.invuln <= 0 &&
      !p.isDashing;
    this.pendingDamageInvuln = 0;
  }

  private endDamageBatch() {
    if (this.pendingDamageInvuln > 0) {
      this.player.invuln = Math.max(this.player.invuln, this.pendingDamageInvuln);
    }
    this.damageBatchActive = false;
    this.damageBatchAcceptsHits = false;
    this.pendingDamageInvuln = 0;
  }

  private activateDamageInvulnerability(duration: number) {
    if (this.damageBatchActive) {
      this.pendingDamageInvuln = Math.max(this.pendingDamageInvuln, duration);
      return;
    }
    this.player.invuln = Math.max(this.player.invuln, duration);
  }

  private damagePlayer(amount: number) {
    const p = this.player;
    if (this.ended) return;
    if (this.inCorridor || this.isPlayerInCorridor()) return;
    if (p.isDashing) return;
    const immune = this.damageBatchActive
      ? !this.damageBatchAcceptsHits
      : p.invuln > 0;
    if (immune) return;
    const ascDmgMult = this.runDirector.getAscensionState()?.enemyDamageMult ?? 1;
    const dmg = Math.max(1, amount * ascDmgMult - p.armor) * (this.assistMode ? 0.75 : 1);

    if (this.ultimateShield > 0) {
      this.ultimateShield--;
      this.activateDamageInvulnerability(0.4);
      this.burst(p.x,p.y,'#00f0ff',10);
      return;
    }
    if (p.shield > 0) {
      p.shield -= 1;
      this.activateDamageInvulnerability(0.4);
      audio.play('hit');
      this.burstJuice(p.x, p.y, '#00f0ff', 10, 1.2, 0.1);
      this.camera.shake = Math.max(this.camera.shake, 0.2);
      return;
    }
    // "Intocable": solo falla si pierdes vida; un golpe absorbido por el escudo no cuenta.
    if (this.currentEvent?.combatRules?.noDamage) {
      this.challengeFailed = true;
    }
    const heavy = dmg > 18;
    const lowThreshold = p.maxHp * 0.25;
    const wasAboveLow = p.hp >= lowThreshold;
    p.hp -= dmg;
    this.damageTakenTotal += dmg;
    this.activateDamageInvulnerability(0.5);
    this.camera.shake = heavy ? 0.55 : 0.35;
    audio.play('hurt');
    this.enemyDirector.onDamageTaken(dmg);
    if (heavy) {
      this.burstJuice(p.x, p.y, '#ff2a4b', 18, 1.3, 0.15);
    } else {
      this.burst(p.x, p.y, '#ff2a4b', 10);
    }
    if (p.hp > 0 && p.hp < lowThreshold) {
      // Solo cuenta como "casi-muerte" al cruzar el umbral, no en cada golpe mientras sigues con poca vida.
      if (wasAboveLow) this.enemyDirector.onNearDeath();
      this.burstJuice(p.x, p.y, '#ff2a4b', 14, 1.8, 0.2);
      this.camera.shake = 0.6;
    }
    if (p.hp <= 0) {
      p.hp = 0;
      this.endRun('defeat');
    }
  }

  private handleCombat() {
    for (const pr of this.projectiles) {
      if (pr.owner !== 'player') continue;
      for (const e of this.enemies) {
        if (e.hp <= 0 || e.dead) continue;
        if (pr.pierced.has(e.id)) continue;
        const d = Math.hypot(pr.x - e.x, pr.y - e.y);
        if (d < e.size + pr.size) {
          if (e.phaseInvuln && e.phaseInvuln > 0) continue;
          e.hp -= pr.damage;
          e.hitFlash = 0.1;
          pr.pierced.add(e.id);
          audio.play('hit');
          const isCrit = pr._isCrit === true;
          if (isCrit) {
            this.burstJuice(pr.x, pr.y, '#ffe14a', 10, 1.3, 0.15);
            this.camera.shake = Math.max(this.camera.shake, 0.15);
          } else {
            this.burst(pr.x, pr.y, pr.color, 4);
          }
          spriteAtlas.spawnEffect(isCrit || pr._isCrit ? 'impact_crit' : `impact_${pr._element ?? 'hit'}`, pr.x, pr.y, this.worldTime);
          this.applyProjectileAffix(pr, e);
          if (e.hp <= 0) this.killEnemy(e);
          if (pr._explosionRadius && pr._explosionRadius > 0) {
            this.explodeAt(pr.x, pr.y, pr._explosionRadius, pr.damage * 0.6, pr.color);
            pr.life = 0;
            break;
          }
          if (pr.pierced.size > pr.pierce) {
            pr.life = 0;
            break;
          }
        }
      }
    }

    const p = this.player;
    for (const pr of this.projectiles) {
      if (pr.owner !== 'enemy') continue;
      const d = Math.hypot(pr.x - p.x, pr.y - p.y);
      if (d < 14 + pr.size) {
        this.damagePlayer(pr.damage);
        pr.life = 0;
      }
    }
    this.projectiles = this.projectiles.filter((pr) => pr.life > 0);
    this.enemies = this.enemies.filter((e) => e.hp > 0 && !e.dead);
  }

  private killEnemy(e: EnemyEntity) {
    if (e.dead) return;
    this.stunUntil.delete(e.id);
    e.dead = true;
    e.hp = 0;
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = 3;
    this.enemyDirector.onKill();
    if (e.isBoss) {
      this.bossesDefeated += 1;
      this.enemyDirector.onBossDefeated();
      this.runDirector.onBossDefeated(e.defId);
    }
    const gain = Math.floor(e.score * this.comboMultiplier());
    this.score += gain;
    const goldDrop = Math.max(1, Math.floor((e.score / 8) * this.petGoldMult() * this.player.goldMult * (this.characterId === 'hechicera_lola' && this.ultimateRoom === this.currentRoomId ? 1.25 : 1)));
    this.goldEarned += goldDrop;
    this.goldGross += goldDrop;
    this.grantXp(Math.round(e.xp * this.petXpMult()));

    audio.play('kill');
    if (e.isBoss) {
      this.burstJuice(e.x, e.y, e.color, 30, 1.5, 0.25);
      this.camera.shake = 0.7;
    } else {
      this.burstJuice(e.x, e.y, e.color, 18, 1.2, 0.1);
    }
    if (this.combo > 0 && this.combo % 5 === 0) {
      this.burstJuice(this.player.x, this.player.y, '#ffe14a', 12, 1.6, 0.2);
      this.camera.shake = Math.max(this.camera.shake, 0.25);
    }
    for (const cb of this.onKillCbs) cb(e.defId, e.characterId);

    if (this.player.lifesteal > 0) {
      this.player.hp = Math.min(
        this.player.maxHp,
        this.player.hp + e.maxHp * this.player.lifesteal * 0.15,
      );
    }

    const luck = 1 + this.petLootLuck();

    if (e.isBoss) {
      const eq = this.directedEquipment('enemy_boss');
      this.spawnPickup(e.x + 20, e.y - 20, 'item', eq.color, 0, undefined, eq.genId);
      const w = this.directedWeapon('enemy_boss');
      this.spawnPickup(e.x, e.y - 12, 'weapon', w.color, 0, w.genId);
      for (const cb of this.onWeaponDiscoverCbs) cb(w.baseId);
      this.spawnPickup(e.x, e.y, 'heal', '#39ff88', 20);
      this.spawnPickup(e.x - 10, e.y + 8, 'shield', '#00f0ff', 1);
      const relic = this.directedItem('enemy_boss');
      this.spawnPickup(e.x - 20, e.y - 20, 'relic', relic.color, 0, undefined, relic.id);
    } else {
      const def = getEnemy(e.defId);
      const isMiniboss = def?.tags.includes('miniboss') ?? false;
      const table = getLootTable(isMiniboss ? 'enemy_miniboss' : 'enemy_normal');
      const cat = rollLootCategory(table, this.runDirector);
      switch (cat) {
        case 'gold':
          // El oro de la baja ya se abonó al jugador.
          break;
        case 'heal':
          if (runRandom.next('loot') < Math.min(.75, .6 * luck)) {
            this.spawnPickup(e.x, e.y, 'heal', '#39ff88', 18);
          }
          break;
        case 'shield':
          this.spawnPickup(e.x - 10, e.y + 8, 'shield', '#00f0ff', 1);
          break;
        case 'weapon': {
          const w = this.directedWeapon(table.id);
          this.spawnPickup(e.x, e.y - 12, 'weapon', w.color, 0, w.genId);
          for (const cb of this.onWeaponDiscoverCbs) cb(w.baseId);
          break;
        }
        case 'equipment': {
          const eq = this.directedEquipment(table.id);
          this.spawnPickup(e.x + 12, e.y - 12, 'item', eq.color, 0, undefined, eq.genId);
          break;
        }
        case 'relic': {
          const it = this.directedItem(table.id);
          this.spawnPickup(e.x - 12, e.y - 12, 'relic', it.color, 0, undefined, it.id);
          break;
        }
        default:
          break;
      }
      if (runRandom.next('loot') < 0.12 * luck) {
        this.spawnPickup(e.x + 10, e.y, 'score', '#ffe14a', 50);
      }
    }
  }

  private grantXp(amount: number) {
    const p = this.player;
    const xpMult = this.runDirector.getAscensionState()?.xpMult ?? 1;
    p.xp += amount * xpMult;
    while (p.xp >= p.xpToNext) {
      p.xp -= p.xpToNext;
      p.level += 1;
      p.xpToNext = Math.floor(55 + p.level * 38);
      const heal = Math.floor(p.maxHp * 0.15);
      p.hp = Math.min(p.maxHp, p.hp + heal);
      const lvGold = Math.max(1, Math.floor((p.level * 8) * this.petGoldMult() * this.player.goldMult));
      this.goldEarned += lvGold;
      this.goldGross += lvGold;
      audio.play('levelup');
      this.burstJuice(p.x, p.y, '#ffe14a', 16, 1.5, 0.15);
      this.burstJuice(p.x, p.y, '#b04dff', 10, 1.8, 0.1);
      this.camera.shake = Math.max(this.camera.shake, 0.3);
    }
  }

  private skillModToGeneric(m: { stat: string; op: string; value: number }): { stat: string; op: string; val: number } {
    const op = m.op === 'add_pct' ? 'mult' : m.op;
    return { stat: m.stat, op, val: m.value };
  }

  private spawnPickup(
    x: number, y: number, kind: PickupEntity['kind'],
    color: string, value: number, weaponId?: string, itemId?: string,
  ) {
    const life = kind === 'item' || kind === 'weapon' || kind === 'relic' ? Number.POSITIVE_INFINITY : 25;
    this.pickups.push({
      id: this.nextId++, x, y, kind, color, value,
      weaponId, itemId,
      bob: runRandom.next('visual') * Math.PI * 2, life,
    });
  }

  private spawnChest(defId: string, x: number, y: number, roomId: number) {
    const def = getChest(defId);
    if (this.chests.some((c) => !c.opened && Math.hypot(c.x - x, c.y - y) < 30)) return;
    this.chests.push({
      id: this.nextId++,
      defId: def.id,
      x,
      y,
      opened: false,
      color: def.color,
      glow: def.glow,
      name: def.name,
      roomId,
    });
  }

  private openChest(chest: ChestEntity) {
    if (chest.opened) return;
    chest.opened = true;
    const def = getChest(chest.defId);
    audio.play('pickup');
    this.burst(chest.x, chest.y, chest.color, 16);

    def.basicLoot.forEach((kind, i) => {
      const ox = (i - 1) * 18;
      if (kind === 'heal' && runRandom.next('loot') < (chest.defId === 'chest_boss' ? .45 : .22)) {
        this.spawnPickup(chest.x + ox, chest.y + 20, 'heal', '#39ff88', 20);
      }
      if (kind === 'score') this.spawnPickup(chest.x + ox, chest.y + 24, 'score', '#ffe14a', 75);
      if (kind === 'shield') this.spawnPickup(chest.x + ox, chest.y + 28, 'shield', '#00f0ff', 1);
    });

    const chestTable =
      chest.defId === 'chest_boss' ? 'chest_legendary'
        : chest.defId === 'chest_armory' ? 'chest_rare'
          : 'chest_common';

    if (runRandom.next('loot') < def.weaponChance) {
      const w = this.directedWeapon(chestTable);
      this.spawnPickup(chest.x, chest.y - 18, 'weapon', w.color, 0, w.genId);
      for (const cb of this.onWeaponDiscoverCbs) cb(w.baseId);
    }
    if (runRandom.next('loot') < (def.highTier ? 0.8 : 0.35)) {
      const eq = this.directedEquipment(chestTable);
      this.spawnPickup(chest.x + 18, chest.y - 6, 'item', eq.color, 0, undefined, eq.genId);
    }
    if (runRandom.next('loot') < (def.highTier ? 0.45 : 0.2)) {
      const relic = this.directedItem(chestTable);
      this.spawnPickup(chest.x - 18, chest.y - 6, 'relic', relic.color, 0, undefined, relic.id);
    }
  }

  private collectConsumable(pk: PickupEntity) {
    const p = this.player;
    if (pk.kind === 'heal') {
      this.healsUsed += 1;
      p.hp = Math.min(p.maxHp, p.hp + pk.value);
      this.burst(pk.x, pk.y, '#39ff88', 6);
      this.camera.shake = Math.max(this.camera.shake, 0.06);
    } else if (pk.kind === 'score') {
      this.score += pk.value;
      this.goldEarned += 5;
      this.goldGross += 5;
      this.burst(pk.x, pk.y, '#ffe14a', 6);
      this.camera.shake = Math.max(this.camera.shake, 0.06);
    } else if (pk.kind === 'shield') {
      if (p.maxShield > 0) p.shield = Math.min(p.maxShield, p.shield + pk.value);
    } else if (pk.kind === 'relic' && pk.itemId) {
      const item = getItem(pk.itemId);
      const prevMax = p.maxHp;
      this.acquiredSkills.push({
        id: item.id, name: item.name, description: item.description, icon: item.icon, rarity: item.rarity,
        mods: item.mods.map((m) => ({ stat: m.stat, op: m.op, value: m.value })),
      });
      this.recalcStats();
      const gained = p.maxHp - prevMax;
      if (gained > 0) p.hp = Math.min(p.maxHp, p.hp + gained);
      this.camera.shake = Math.max(this.camera.shake, 0.1);
    }
    pk.life = 0;
    audio.play('pickup');
    this.burst(pk.x, pk.y, pk.color, 6);
  }

  private isConsumable(pk: PickupEntity): boolean {
    return pk.kind === 'heal' || pk.kind === 'score' || pk.kind === 'shield' || pk.kind === 'relic';
  }

  private updatePickups(dt: number) {
    const p = this.player;
    for (const pk of this.pickups) {
      pk.bob += dt * 3;
      if (Number.isFinite(pk.life)) pk.life -= dt;

      if (this.lootVacuum && this.isConsumable(pk) && pk.life > 0) {
        const dx = p.x - pk.x;
        const dy = p.y - pk.y;
        const d = Math.hypot(dx, dy) || 1;
        const vacuumSpeed = Math.min(1900, 650 + d * 1.6);
        pk.x += (dx / d) * vacuumSpeed * dt;
        pk.y += (dy / d) * vacuumSpeed * dt;
        if (d < 30) this.collectConsumable(pk);
      }
    }
    this.pickups = this.pickups.filter((pk) => pk.life > 0);

    if (this.lootVacuum && !this.pickups.some((pk) => this.isConsumable(pk))) {
      this.lootVacuum = false;
    }
  }

  private handleInteractables(input: InputState) {
    const p = this.player;

    // 1) Consumables (auto-recogida, no requieren [E])
    for (const pk of this.pickups) {
      if (pk.life <= 0) continue;
      if (pk.kind !== 'weapon' && pk.kind !== 'item') {
        if (Math.hypot(pk.x - p.x, pk.y - p.y) < 28) {
          this.collectConsumable(pk);
        }
      }
    }

    // 2) Cofres, eventos y portal más cercanos en este mismo tick
    let bestChest: ChestEntity | null = null;
    let bestChestDist = 52;
    for (const c of this.chests) {
      if (c.opened) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < bestChestDist) {
        bestChestDist = d;
        bestChest = c;
      }
    }
    this.nearestChest = bestChest;

    let bestEvent: InteractiveEventEntity | null = null;
    let bestEventDist = 60;
    for (const ev of this.eventEntities) {
      if (!ev.active) continue;
      const d = Math.hypot(ev.x - p.x, ev.y - p.y);
      if (d < bestEventDist) {
        bestEventDist = d;
        bestEvent = ev;
      }
    }
    this.nearestEvent = bestEvent;

    const portalInRange = !!(
      this.portal?.active &&
      Math.hypot(this.portal.x - p.x, this.portal.y - p.y) < 60
    );

    // 3) Armas y piezas de equipo en rango (48 px para ambos tipos)
    const nearby: Array<{ pk: PickupEntity; dist: number }> = [];
    for (const pk of this.pickups) {
      if (pk.life <= 0) continue;
      if (pk.kind !== 'weapon' && pk.kind !== 'item') continue;
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (d < PICKUP_INTERACT_RADIUS) {
        nearby.push({ pk, dist: d });
      }
    }
    nearby.sort((a, b) => a.dist - b.dist);

    this.stackedPickupCount = nearby.length;
    this.nearestWeapon = nearby.find((n) => n.pk.kind === 'weapon')?.pk ?? null;
    this.closestPickup = nearby[0]?.pk ?? null;
    this.closestChestWins = !!(bestChest && (!nearby[0] || bestChestDist <= nearby[0].dist));

    if (!input.interact) return;

    // 4) Una única acción por pulsación de [E]
    if (portalInRange && this.portal?.active) {
      this.advanceToNextMap();
      this.nearestChest = null;
      this.nearestEvent = null;
      return;
    }

    if (this.nearestEvent) {
      const ev = this.nearestEvent;
      this.running = false;
      for (const cb of this.onEventInteractCbs) {
        cb(ev.instance, (idx) => this.resolveEventOption(ev.id, idx));
      }
      return;
    }

    if (this.nearestChest && this.closestChestWins) {
      this.openChest(this.nearestChest);
      this.nearestChest = null;
      return;
    }

    if (nearby.length === 0 || this.pendingItemPickup || this.pendingPickupChoice) return;

    if (nearby.length >= 2) {
      const entries: NearbyPickupEntry[] = nearby.map(({ pk }) => {
        if (pk.kind === 'weapon') {
          const w = getWeapon(pk.weaponId ?? 'pulse_pistol');
          return {
            id: pk.id,
            kind: 'weapon',
            name: w.name,
            color: w.color,
            rarity: w.quality,
            description: `Daño ${w.damage} · ${w.fireRate}/s · Proy ${w.count}`,
          };
        }
        const eq = getEquipment(pk.itemId ?? EQUIP_SLOTS[0]);
        return {
          id: pk.id,
          kind: 'item',
          name: eq.name,
          color: eq.color,
          rarity: eq.rarity,
          slot: eq.slot,
          setId: eq.setId,
          description: eq.description,
        };
      });
      this.pendingPickupChoice = true;
      this.running = false;
      for (const cb of this.onPickupChoiceCbs) {
        cb(entries, (chosenId) => this.resolvePickupChoice(chosenId));
      }
      return;
    }

    this.interactSinglePickup(nearby[0].pk);
  }

  resolvePickupChoice(pickupId: number | null) {
    this.pendingPickupChoice = false;
    if (pickupId === null) {
      audio.play('button');
      if (!this.ended) {
        this.running = true;
        this.last = performance.now();
      }
      return;
    }
    const pk = this.pickups.find((x) => x.id === pickupId && x.life > 0);
    if (!pk) {
      if (!this.ended) {
        this.running = true;
        this.last = performance.now();
      }
      return;
    }
    this.interactSinglePickup(pk);
    if (!this.pendingItemPickup && !this.ended) {
      this.running = true;
      this.last = performance.now();
    }
  }

  private interactSinglePickup(pk: PickupEntity) {
    const p = this.player;
    if (pk.kind === 'item') {
      const equipId = pk.itemId ?? EQUIP_SLOTS[0];
      const eq = getEquipment(equipId);
      const equipped = this.buildEquippedItemEntries();
      this.pendingItemPickup = { pk };
      this.running = false;
      const lb = this.statLabelMap();
      for (const cb of this.onItemPickupCbs) {
        cb(
          {
            id: equipId, name: eq.name, icon: eq.icon,
            description: eq.description, color: eq.color, rarity: eq.rarity,
            slot: eq.slot, setId: eq.setId,
            mods: eq.mods.map((m) => ({
              stat: m.stat, op: m.op, value: m.value,
              label: `${lb[m.stat] ?? m.stat} ${m.op === 'add' ? (m.value >= 0 ? '+' : '') + m.value : (m.value >= 0 ? '+' : '') + Math.round(m.value * 100) + '%'}`,
            })),
          },
          equipped,
          (slot: EquipSlot | null) => this.resolveItemPickup(equipId, slot),
        );
      }
      return;
    }

    if (pk.kind === 'weapon') {
      const old = p.weaponId;
      const genId = pk.weaponId ?? old;
      const baseId = getWeapon(genId).baseId ?? genId;
      p.weaponId = genId;
      const ow = getWeapon(old);
      const dropPos = clampToWalkable(p.x - 20, p.y, 14, this.getAccessibleWalkables());
      this.spawnPickup(dropPos.x, dropPos.y, 'weapon', ow.color, 0, old);
      pk.life = 0;
      this.pickups = this.pickups.filter((x) => x.life > 0);
      this.nearestWeapon = null;
      audio.play('pickup');
      this.recalcStats();
      for (const cb of this.onWeaponDiscoverCbs) cb(baseId);
    }
  }

  resolveItemPickup(itemId: string, slot: EquipSlot | null) {
    const pending = this.pendingItemPickup;
    this.pendingItemPickup = null;

    if (slot === null) {
      audio.play('button');
    } else {
      const previousId = this.player.equipment[slot];
      this.equipItem(itemId, slot);
      audio.play('pickup');
      if (pending) {
        if (previousId) {
          const prevDef = getEquipment(previousId);
          pending.pk.itemId = previousId;
          pending.pk.color = prevDef.color;
          this.pickupSlotCache.delete(pending.pk);
        } else {
          pending.pk.life = 0;
        }
      }
    }

    if (!this.ended) {
      this.running = true;
      this.last = performance.now();
    }
  }

  private resolveEventOption(eventEntId: number, optionIndex: number | null) {
    const ent = this.eventEntities.find((e) => e.id === eventEntId);
    if (!ent) {
      if (!this.ended) {
        this.running = true;
        this.last = performance.now();
      }
      return;
    }
    this.runDirector.onEventCompleted(ent.instance.id);

    if (optionIndex === null) {
      audio.play('button');
    } else {
      const opt = ent.instance.options![optionIndex];
      if (opt.costGold && this.goldEarned < opt.costGold) {
        audio.play('hurt');
        if (!this.ended) {
          this.running = true;
          this.last = performance.now();
        }
        return;
      }
      if (opt.costHpPct && this.player.hp <= this.player.maxHp * opt.costHpPct) {
        audio.play('hurt');
        if (!this.ended) {
          this.running = true;
          this.last = performance.now();
        }
        return;
      }

      audio.play('levelup');
      ent.active = false;
      if (getEventNpc(ent.instance.id)) ent.departedAt = this.worldTime;

      for (const a of opt.actions) {
        if (a.kind === 'stat_mod') {
          const prevMax = this.player.maxHp;
          this.acquiredSkills.push({
            id: 'event_mod', name: opt.label, description: '', icon: '', rarity: 'common',
            mods: [{ stat: a.stat, op: a.op, value: a.val }],
          });
          this.recalcStats();
          if (a.stat === 'maxHp') {
            const gained = this.player.maxHp - prevMax;
            if (gained > 0) this.player.hp = Math.min(this.player.maxHp, this.player.hp + gained);
          }
        }
        if (a.kind === 'add_gold') { this.goldEarned += a.value; this.goldGross += a.value; }
        if (a.kind === 'lose_gold') this.goldEarned -= a.value;
        if (a.kind === 'heal') {
          this.healsUsed += 1;
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + a.value);
        }
        if (a.kind === 'lose_hp_pct') this.player.hp -= this.player.maxHp * a.value;
        if (a.kind === 'spawn_chest') this.spawnChest(a.chestId, ent.x, ent.y + 40, this.currentRoomId);
        if (a.kind === 'drop_weapon') this.spawnPickup(ent.x - 20, ent.y + 20, 'weapon', a.color, 0, a.weaponGenId);
        if (a.kind === 'drop_equipment') this.spawnPickup(ent.x + 20, ent.y + 20, 'item', a.color, 0, undefined, a.equipGenId);
      }
    }

    if (!this.ended) {
      this.running = true;
      this.last = performance.now();
    }
  }

  private updateParticles(dt: number) {
    for (const pt of this.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.life -= dt;
      pt.vx *= 0.96;
      pt.vy *= 0.96;
    }
    this.particles = this.particles.filter((pt) => pt.life > 0);
  }

  private burst(x: number, y: number, color: string, n: number) {
    for (let i = 0; i < n; i++) {
      const a = runRandom.next('visual') * Math.PI * 2;
      const s = 40 + runRandom.next('visual') * 120;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + runRandom.next('visual') * 0.4,
        maxLife: 0.6,
        color,
        size: 2 + runRandom.next('visual') * 3,
      });
    }
  }

  private muzzleFlash(x: number, y: number, angle: number, color: string) {
    for (let i = 0; i < 4; i++) {
      const a = angle + (runRandom.next('visual') - 0.5) * 0.7;
      const s = 80 + runRandom.next('visual') * 60;
      this.particles.push({
        x: x + Math.cos(angle) * 6,
        y: y + Math.sin(angle) * 6,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.06 + runRandom.next('visual') * 0.04,
        maxLife: 0.12,
        color,
        size: 4 + runRandom.next('visual') * 3,
      });
    }
  }

  private burstJuice(x: number, y: number, color: string, n: number, speedMult = 1, lifeBonus = 0) {
    for (let i = 0; i < n; i++) {
      const a = runRandom.next('visual') * Math.PI * 2;
      const s = (40 + runRandom.next('visual') * 120) * speedMult;
      this.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + runRandom.next('visual') * 0.4 + lifeBonus,
        maxLife: 0.6 + lifeBonus,
        color,
        size: 2.5 + runRandom.next('visual') * 3.5,
      });
    }
  }

  private updateCamera(dt: number) {
    this.camera.x += (this.player.x - this.camera.x) * Math.min(1, dt * 8);
    this.camera.y += (this.player.y - this.camera.y) * Math.min(1, dt * 8);
  }

  private updatePet(dt: number) {
    const def = this.getEquippedPetDef();
    if (!def || !this.pet) return;
    const pet = this.pet;

    const { x, y } = this.player;
    const last = pet.trail[pet.trail.length - 1];
    const moved = last ? Math.hypot(last.x - x, last.y - y) : Infinity;
    if (moved > 220) {
      pet.trail.length = 0;
      pet.x = x;
      pet.y = y + 24;
    }
    if (moved >= 7) {
      pet.trail.push({ x, y });
      if (pet.trail.length > 20) pet.trail.shift();
    }
    let target = { x, y };
    let followDistance = def.stats.followDistance;
    for (let i = pet.trail.length - 1; i >= 0; i--) {
      const point = pet.trail[i];
      const segment = Math.hypot(point.x - target.x, point.y - target.y);
      if (segment >= followDistance) {
        const ratio = followDistance / segment;
        target = { x: target.x + (point.x - target.x) * ratio, y: target.y + (point.y - target.y) * ratio };
        break;
      }
      target = point;
      followDistance -= segment;
    }
    if (pet.trail.length <= 2) target = { x, y: y + 24 };
    pet.x += (target.x - pet.x) * Math.min(1, dt * 12);
    pet.y += (target.y - pet.y) * Math.min(1, dt * 12);

    const inCorridor = this.inCorridor;

    for (const eff of def.effects) {
      const tk = eff.kind + (eff.key ?? '');
      switch (eff.kind) {
        case 'coin_magnet': {
          const radius = eff.radius ?? 220;
          for (const pk of this.pickups) {
            if (pk.kind !== 'score' && pk.kind !== 'heal' && pk.kind !== 'shield') continue;
            const dx = this.player.x - pk.x;
            const dy = this.player.y - pk.y;
            const d = Math.hypot(dx, dy);
            if (d < radius && d > 1) {
              pk.x += (dx / d) * 260 * dt;
              pk.y += (dy / d) * 260 * dt;
            }
          }
          break;
        }
        case 'regen': {
          pet.timers[tk] -= dt;
          if (pet.timers[tk] <= 0) {
            pet.timers[tk] = eff.interval ?? 1;
            this.player.hp = Math.min(this.player.maxHp, this.player.hp + (eff.value ?? 1));
          }
          break;
        }
        case 'auto_fire': {
          if (inCorridor) break;
          pet.timers[tk] -= dt;
          if (pet.timers[tk] <= 0) {
            const target = this.findNearestEnemy(pet.x, pet.y, eff.radius ?? 420);
            if (target) {
              pet.timers[tk] = eff.interval ?? 0.7;
              const dx = target.x - pet.x;
              const dy = target.y - pet.y;
              const d = Math.hypot(dx, dy) || 1;
              this.projectiles.push({
                id: this.nextId++, x: pet.x, y: pet.y,
                vx: (dx / d) * 640, vy: (dy / d) * 640,
                // Escala con el mapa efectivo (también en Endless) y con la mitad de tu bonus de daño: la mascota no se queda atrás.
                damage: (eff.value ?? 8) * (1 + (this.effectiveMapNumber() - 1) * 0.1) * (1 + (this.player.damageMult - 1) * 0.5),
                color: def.color, size: 4, pierce: 0, pierced: new Set(),
                life: 1.4, owner: 'player',
              });
              audio.play('shoot');
            }
          }
          break;
        }
        case 'slow_aura': {
          if (inCorridor) break;
          pet.timers[tk] -= dt;
          if (pet.timers[tk] <= 0) {
            pet.timers[tk] = eff.interval ?? 0.4;
            const radius = eff.radius ?? 160;
            const elemSyn = this.getElementSynergyMult('ice');
            for (const e of this.enemies) {
              if (Math.hypot(e.x - pet.x, e.y - pet.y) < radius) e.slowTimer = Math.max(e.slowTimer ?? 0, 0.8 * elemSyn);
            }
          }
          break;
        }
        case 'apply_status': {
          if (inCorridor) break;
          pet.timers[tk] -= dt;
          if (pet.timers[tk] <= 0) {
            pet.timers[tk] = eff.interval ?? 0.9;
            const radius = eff.radius ?? 150;
            const dps = eff.value ?? 6;
            const elemSyn = eff.key ? this.getElementSynergyMult(eff.key) : 1;
            for (const e of this.enemies) {
              if (Math.hypot(e.x - pet.x, e.y - pet.y) >= radius) continue;
              const elemColor = eff.key === 'fire' ? '#ff6a00' : eff.key === 'toxic' ? '#9dff00' : '#6ef0ff';
              // Nunca se sustituye un efecto más fuerte (p. ej. del arma del jugador) por uno más débil de la mascota.
              if (eff.key === 'fire') {
                e.burnTimer = Math.max(e.burnTimer ?? 0, 3 * elemSyn);
                e.burnDps = Math.max(e.burnDps ?? 0, dps * elemSyn);
              } else if (eff.key === 'toxic') {
                e.poisonTimer = Math.max(e.poisonTimer ?? 0, 4 * elemSyn);
                e.poisonDps = Math.max(e.poisonDps ?? 0, dps * elemSyn);
              } else if (eff.key === 'ice') {
                e.slowTimer = Math.max(e.slowTimer ?? 0, 2 * elemSyn);
              }
              this.burst(e.x, e.y, elemColor, 3);
            }
          }
          break;
        }
        case 'block_projectiles': {
          if (inCorridor) break;
          pet.timers[tk] -= dt;
          if (pet.timers[tk] <= 0) {
            pet.timers[tk] = eff.interval ?? 0.5;
            const radius = eff.radius ?? 90;
            let blocked = false;
            this.projectiles = this.projectiles.filter((pr) => {
              if (pr.owner !== 'enemy') return true;
              if (Math.hypot(pr.x - pet.x, pr.y - pet.y) < radius) { blocked = true; return false; }
              return true;
            });
            if (blocked) this.burst(pet.x, pet.y, def.color, 5);
          }
          break;
        }
        default:
          break;
      }
    }
  }

  private petXpMult(): number {
    const def = this.getEquippedPetDef();
    if (!def) return 1;
    let m = 1;
    for (const e of def.effects) if (e.kind === 'xp_boost') m += e.value ?? 0;
    return m;
  }

  private petGoldMult(): number {
    const def = this.getEquippedPetDef();
    if (!def) return 1;
    let m = 1;
    for (const e of def.effects) if (e.kind === 'gold_boost') m += e.value ?? 0;
    return m;
  }

  private petLootLuck(): number {
    const def = this.getEquippedPetDef();
    if (!def) return 0;
    let b = 0;
    for (const e of def.effects) if (e.kind === 'loot_luck') b += e.value ?? 0;
    return b;
  }

  private petRevealBonus(): number {
    const def = this.getEquippedPetDef();
    if (!def) return 0;
    let b = 0;
    for (const e of def.effects) if (e.kind === 'reveal_map') b += e.value ?? 0;
    return b;
  }

  private findNearestEnemy(x: number, y: number, maxDist: number) {
    let best: EnemyEntity | null = null;
    let bestD = maxDist;
    for (const e of this.enemies) {
      if (e.hp <= 0 || e.dead) continue;
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private endRun(result: 'victory' | 'defeat', silent = false) {
    if (this.ended) return;
    this.ended = result;
    this.running = false;
    const scoreMult = this.runDirector.getAscensionState()?.scoreMult ?? 1;
    // El multiplicador se aplica solo a lo ganado desde el último final (Endless: no se compone ni se pierde).
    const gainedSinceLastEnd = this.score - this.scoreMultBaseline;
    this.score = this.scoreMultBaseline + Math.round(gainedSinceLastEnd * scoreMult);
    this.scoreMultBaseline = this.score;
    if (!silent) audio.play(result === 'victory' ? 'levelup' : 'death');
    const stats = this.getStats();
    for (const cb of this.onEndCbs) cb(result, stats);
  }

  private pushStats() {
    const s = this.getStats();
    for (const cb of this.onStatsCbs) cb(s);
  }

  private pickupWeaponBase(pk: PickupEntity): string {
    let b = this.pickupWeaponCache.get(pk);
    if (b === undefined) {
      b = pk.weaponId ? getWeapon(pk.weaponId).baseId : '';
      this.pickupWeaponCache.set(pk, b);
    }
    return b;
  }

  private pickupSpriteKey(pk: PickupEntity): string | null {
    switch (pk.kind) {
      case 'heal': return 'pickup_heal';
      case 'shield': return 'pickup_shield';
      case 'score': return 'pickup_score';
      case 'weapon': return 'pickup_weapon';
      case 'relic': return 'pickup_relic';
      case 'item': {
        let key = this.pickupSlotCache.get(pk);
        if (!key) {
          const eq = getEquipment(pk.itemId ?? EQUIP_SLOTS[0]);
          const specific = `equip_${eq.setId ?? 'generic'}_${eq.slot}`;
          key = spriteAtlas.hasObject(specific) ? specific : `pickup_item_${eq.slot}`;
          this.pickupSlotCache.set(pk, key);
        }
        return key;
      }
      default: return null;
    }
  }

  private render() {
    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const shakeX = this.camera.shake > 0
      ? (runRandom.next('visual') - 0.5) * this.camera.shake * 14
      : 0;
    const shakeY = this.camera.shake > 0
      ? (runRandom.next('visual') - 0.5) * this.camera.shake * 14
      : 0;
    const camX = this.camera.x - w / 2 + shakeX;
    const camY = this.camera.y - h / 2 + shakeY;

    ctx.fillStyle = '#07090e';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(-camX, -camY);

    this.drawWorld(ctx);

    for (const c of this.chests) {
      this.drawChest(ctx, c);
    }

    for (const ev of this.eventEntities) {
      if (!ev.active && (ev.departedAt === undefined || this.worldTime - ev.departedAt >= 1.2)) continue;
      if (drawEventNpc(ctx, ev.instance.id, ev.x, ev.y, this.worldTime, ev.departedAt)) continue;
      ctx.save();
      ctx.translate(ev.x, ev.y);
      ctx.shadowColor = ev.instance.color;
      ctx.shadowBlur = 18 + Math.sin(this.worldTime * 4) * 6;
      ctx.fillStyle = ev.instance.color;
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#000';
      ctx.font = '16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(ev.instance.icon, 0, 0);
      ctx.restore();
    }

    for (const pk of this.pickups) {
      const by = pk.y + Math.sin(pk.bob) * 4;
      if (pk.kind === 'weapon') {
        const wb = this.pickupWeaponBase(pk);
        if (wb && spriteAtlas.hasWeapon(wb)) {
          spriteAtlas.drawGroundPad(ctx, pk.x, pk.y + 12, pk.color);
          spriteAtlas.drawWeaponIcon(ctx, wb, pk.x, by);
          continue;
        }
      }
      const spriteKey = this.pickupSpriteKey(pk);
      if (spriteKey && spriteAtlas.hasObject(spriteKey)) {
        spriteAtlas.drawGroundPad(ctx, pk.x, pk.y + 12, pk.color);
        spriteAtlas.drawObject(ctx, spriteKey, pk.x, by, this.worldTime + pk.bob * 0.3);
        continue;
      }
      ctx.shadowColor = pk.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = pk.color;
      if (pk.kind === 'weapon') {
        ctx.beginPath();
        ctx.rect(pk.x - 8, by - 8, 16, 16);
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(pk.x, by, 7, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;
    }

    for (const e of this.enemies) {
      const scale = e.spawnAnim > 0 ? 1 - e.spawnAnim * 1.5 : 1;
      const actorScale = e.isBoss ? 1.65 : 1;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(Math.max(0.2, scale), Math.max(0.2, scale));
      ctx.save();
      ctx.scale(actorScale, actorScale);
      const faceX = this.player.x - e.x;
      const faceY = this.player.y - e.y;
      const enemySprite = spriteAtlas.drawCharacter(ctx, e.characterId, e, 0, 0, {
        now: this.worldTime,
        faceX,
        faceY,
        hp: e.hp,
        dead: e.hp <= 0,
        flash: e.hitFlash > 0,
        footOffset: e.size * 0.8 / actorScale,
        trackX: e.x,
        trackY: e.y,
        weaponId: e.weaponId,
        aimAngle: Math.atan2(faceY, faceX),
      });
      ctx.restore();
      if (!enemySprite) {
        ctx.shadowColor = e.glow;
        ctx.shadowBlur = e.isBoss ? 28 : 14;
        ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
        this.drawShape(ctx, e.shape, e.size);
        ctx.shadowBlur = 0;
      }
      {
        const baseOff = e.id * 0.37;
        const count = e.size >= 30 ? 3 : 1;
        for (let k = 0; k < count; k++) {
          const ox = count === 1 ? 0 : (k - 1) * e.size * 0.7;
          if (e.burnTimer && e.burnTimer > 0) spriteAtlas.drawStatus(ctx, 'fire', ox, e.size * 0.45, this.worldTime, baseOff + k * 0.21);
          if (e.poisonTimer && e.poisonTimer > 0) spriteAtlas.drawStatus(ctx, 'poison', ox, e.size * 0.55, this.worldTime, baseOff + k * 0.33);
          if (e.slowTimer && e.slowTimer > 0) spriteAtlas.drawStatus(ctx, 'ice', ox, e.size * 0.8, this.worldTime, baseOff + k * 0.17);
        }
      }
      if (e.hp < e.maxHp || e.isBoss) {
        const bw = e.size * 2;
        const barY = enemySprite ? e.size * 0.8 - 64 * actorScale - 6 : -e.size - 12;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-bw / 2, barY, bw, 4);
        ctx.fillStyle = e.isBoss ? '#ffe14a' : '#ff2a4b';
        ctx.fillRect(-bw / 2, barY, bw * (e.hp / e.maxHp), 4);
      }
      ctx.restore();
    }

    for (const pr of this.projectiles) {
      if (spriteAtlas.drawProjectile(ctx, pr.sprite, pr.x, pr.y, Math.atan2(pr.vy, pr.vx), this.worldTime)) continue;
      ctx.shadowColor = pr.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    const p = this.player;
    const blink = p.invuln > 0 && Math.floor(this.worldTime * 20) % 2 === 0;
    if (this.visWeaponId !== p.weaponId) {
      this.visWeaponId = p.weaponId;
      this.visWeaponBase = getWeapon(p.weaponId).baseId;
    }
    const playerSprite = spriteAtlas.hasCharacter(this.characterId) && spriteAtlas.drawCharacter(ctx, this.characterId, p, p.x, p.y, {
      now: this.worldTime,
      faceX: p.facingX,
      faceY: p.facingY,
      hp: p.hp + p.shield,
      rolling: p.isDashing,
      dead: p.hp <= 0,
      alpha: blink ? 0.4 : 1,
      footOffset: 14,
      weaponId: this.visWeaponBase,
      aimAngle: Math.atan2(p.facingY, p.facingX),
    });
    if (!playerSprite) {
      ctx.save();
      ctx.translate(p.x, p.y);
      const ang = Math.atan2(p.facingY, p.facingX);
      ctx.rotate(ang);
      if (blink) ctx.globalAlpha = 0.4;
      ctx.shadowColor = p.glow;
      ctx.shadowBlur = p.isDashing ? 30 : 16;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.moveTo(16, 0);
      ctx.lineTo(-12, 10);
      ctx.lineTo(-8, 0);
      ctx.lineTo(-12, -10);
      ctx.closePath();
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;
      ctx.restore();
      spriteAtlas.drawHeldWeapon(ctx, this.visWeaponBase, p.x, p.y, Math.atan2(p.facingY, p.facingX), blink ? 0.4 : 1);
    }

    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(0,240,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22 + Math.sin(this.worldTime * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    const petDef = this.getEquippedPetDef();
    if (petDef && this.pet) {
      drawPetSprite(ctx, petDef, this.pet.x, this.pet.y, this.worldTime);
    }

    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;
    spriteAtlas.drawEffects(ctx, this.worldTime);

    const theme = this.currentBiome?.theme;
    if (theme && this.biomeParticles.length > 0 && !this.worldArtId()) {
      ctx.fillStyle = theme.particleColor;
      for (const bp of this.biomeParticles) {
        ctx.globalAlpha = bp.alpha;
        ctx.fillRect(bp.x, bp.y, bp.size, bp.size);
      }
      ctx.globalAlpha = 1;
    }

    if (this.portal?.active && spriteAtlas.drawObject(ctx, `portal_${this.portal.kind}`, this.portal.x, this.portal.y, this.worldTime)) {
      // dibujado con sprite
    } else if (this.portal?.active) {
      const pt = this.portal;
      const pulse = Math.sin(this.worldTime * 3) * 4;
      ctx.save();
      ctx.translate(pt.x, pt.y);
      ctx.shadowColor = pt.kind === 'final' ? '#ffe14a' : '#00f0ff';
      ctx.shadowBlur = 24 + pulse;
      ctx.fillStyle = pt.kind === 'final' ? 'rgba(255,225,74,0.7)' : 'rgba(0,240,255,0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, 28 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#07090e';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      for (let i = 0; i < 8; i++) {
        const a = this.worldTime * 2 + (i / 8) * Math.PI * 2;
        ctx.fillStyle = pt.kind === 'final' ? '#ffe14a' : '#00f0ff';
        ctx.globalAlpha = 0.5 + Math.sin(this.worldTime * 5 + i) * 0.3;
        ctx.fillRect(Math.cos(a) * 12, Math.sin(a) * 12, 3, 3);
      }
      ctx.globalAlpha = 1;
      ctx.restore();
    }

    ctx.fillStyle = '#ffe14a';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    const interactHint = this.touchLayout.matches ? '' : `[${codeLabel(this.bindings.interact)}] `;
    if (this.portal?.active && Math.hypot(this.portal.x - p.x, this.portal.y - p.y) < 60) {
      const lbl = this.portal.kind === 'final' ? 'PORTAL FINAL' : 'DESCENDER';
      ctx.fillText(interactHint + lbl, this.portal.x, this.portal.y - 42);
    } else if (this.nearestEvent) {
      ctx.fillText(interactHint + this.nearestEvent.instance.name.toUpperCase(), this.nearestEvent.x, this.nearestEvent.y - 28);
    } else if (this.nearestChest && this.closestChestWins) {
      ctx.fillText(`${interactHint}ABRIR ${this.nearestChest.name.toUpperCase()}`, this.nearestChest.x, this.nearestChest.y - 28);
    } else if (this.stackedPickupCount >= 2) {
      const targetY = (this.closestPickup?.y ?? p.y) - 22;
      const targetX = this.closestPickup?.x ?? p.x;
      ctx.fillText(`${interactHint}ELEGIR OBJETO (${this.stackedPickupCount})`, targetX, targetY);
    } else if (this.closestPickup?.kind === 'weapon') {
      ctx.fillText(interactHint + 'CAMBIAR ARMA', this.closestPickup.x, this.closestPickup.y - 22);
    } else if (this.closestPickup?.kind === 'item') {
      ctx.fillText(interactHint + 'EQUIPAR OBJETO', this.closestPickup.x, this.closestPickup.y - 22);
    }

    const room = this.rooms.find((r) => r.id === this.currentRoomId);
    if (room?.status === 'cleared' && room.kind !== 'boss') {
      ctx.fillStyle = 'rgba(0,200,255,0.7)';
      for (const c of this.corridors) {
        if (c.from !== room.id && c.to !== room.id) continue;
        const otherId = c.from === room.id ? c.to : c.from;
        const other = this.rooms.find((r) => r.id === otherId);
        if (!other || other.status === 'active') continue;
        const cx = c.bounds.x + c.bounds.w / 2;
        const cy = c.bounds.y + c.bounds.h / 2;
        const lx = Math.max(room.bounds.x + 40, Math.min(room.bounds.x + room.bounds.w - 40, cx));
        const ly = Math.max(room.bounds.y + 40, Math.min(room.bounds.y + room.bounds.h - 40, cy));
        ctx.fillText('↕ PASILLO', lx, ly);
      }
    }

    ctx.restore();

    const grd = ctx.createRadialGradient(w / 2, h / 2, h * 0.2, w / 2, h / 2, h * 0.75);
    grd.addColorStop(0, 'rgba(0,0,0,0)');
    grd.addColorStop(1, theme?.ambientLight ?? 'rgba(0,0,0,0.45)');
    ctx.fillStyle = grd;
    ctx.fillRect(0, 0, w, h);
  }

  private drawChest(ctx: CanvasRenderingContext2D, c: ChestEntity) {
    const spriteIds: Record<string, string> = {
      chest_street: 'chest_common',
      chest_armory: 'chest_rare',
      chest_boss: 'chest_legendary',
      chest_common: 'chest_common',
      chest_rare: 'chest_rare',
      chest_legendary: 'chest_legendary',
    };
    const spriteId = spriteIds[c.defId] ?? c.defId;

    if (
      spriteId &&
      spriteAtlas.drawObject(
        ctx,
        `${spriteId}_${c.opened ? 'open' : 'closed'}`,
        c.x,
        c.y + 12,
        this.worldTime,
      )
    ) {
      return;
    }

    ctx.save();
    ctx.translate(c.x, c.y);
    if (!c.opened) {
      ctx.shadowColor = c.glow;
      ctx.shadowBlur = 16;
      ctx.fillStyle = c.color;
      ctx.fillRect(-16, -12, 32, 24);
      ctx.fillStyle = '#0a0c10';
      ctx.fillRect(-16, -2, 32, 4);
      ctx.fillStyle = '#ffe14a';
      ctx.fillRect(-3, -6, 6, 10);
      ctx.shadowBlur = 0;
    } else {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = '#555';
      ctx.fillRect(-16, -4, 32, 16);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  private worldPresentation() {
    return getWorldPresentation(this.mapNumber);
  }

  private worldArtId(): string | null {
    const wp = this.worldPresentation();
    return spriteAtlas.hasWorld(wp.id) ? wp.id : null;
  }

  private drawWorldArt(ctx: CanvasRenderingContext2D, worldId: string): boolean {
    if (!spriteAtlas.drawWorldSea(ctx, worldId)) return false;
    for (const r of this.rooms) {
      const b = r.bounds;
      const lit = r.discovered || r.status !== 'locked';
      if (!spriteAtlas.drawWorldIsland(ctx, worldId, b, r.id)) return false;
      if (lit && r.kind !== 'portal' && r.kind !== 'boss') {
        spriteAtlas.drawWorldProps(ctx, worldId, b, r.id);
      }
      if (!lit) {
        const isl = spriteAtlas.worldIslandRect(worldId, b);
        if (isl) {
          ctx.fillStyle = 'rgba(7,9,14,0.86)';
          ctx.fillRect(isl.x + 22, isl.y + 22, isl.w - 44, isl.h - 44);
        }
      }
    }
    const allBounds = [...this.rooms.map((r) => r.bounds), ...this.corridors.map((c) => c.bounds)];
    for (const c of this.corridors) {
      const from = this.rooms.find((r) => r.id === c.from)!;
      const to = this.rooms.find((r) => r.id === c.to)!;
      const open = !(from.status === 'active' || to.status === 'active') && (from.status === 'cleared' || to.status === 'cleared');
      const b = c.bounds;
      const others = allBounds.filter((x) => x !== b);
      spriteAtlas.drawWorldBridge(ctx, worldId, b, others);
      if (!open) {
        spriteAtlas.drawWorldGate(ctx, worldId, b, others);
        ctx.fillStyle = 'rgba(255,42,75,0.35)';
        if (b.h > b.w) ctx.fillRect(b.x, b.y + b.h * 0.4, b.w, b.h * 0.2);
        else ctx.fillRect(b.x + b.w * 0.4, b.y, b.w * 0.2, b.h);
      }
    }
    const theme = this.currentBiome?.theme;
    for (const r of this.rooms) {
      const b = r.bounds;
      const lit = r.discovered || r.status !== 'locked';
      let border = 'rgba(100,100,120,0.4)';
      if (r.status === 'active') border = 'rgba(255,85,0,0.75)';
      else if (r.status === 'cleared') border = theme?.wallColor ?? 'rgba(57,255,136,0.45)';
      else if (r.kind === 'boss') border = 'rgba(255,43,214,0.5)';
      else if (r.kind === 'event') border = 'rgba(176,77,255,0.4)';
      ctx.strokeStyle = border;
      ctx.lineWidth = 5;
      ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);
      if (lit && r.kind !== 'portal') {
        ctx.fillStyle = 'rgba(226,232,240,0.35)';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(r.label.toUpperCase(), b.x + 16, b.y + 28);
      }
    }
    return true;
  }

  private drawWorld(ctx: CanvasRenderingContext2D) {
    const artId = this.worldArtId();
    if (artId && this.drawWorldArt(ctx, artId)) return;

    const bt = this.currentBiome?.theme;
    ctx.fillStyle = '#07090e';
    ctx.fillRect(-200, -200, this.worldW + 400, this.worldH + 400);

    for (const c of this.corridors) {
      const from = this.rooms.find((r) => r.id === c.from)!;
      const to = this.rooms.find((r) => r.id === c.to)!;
      const combatLock = from.status === 'active' || to.status === 'active';
      const open = !combatLock && (from.status === 'cleared' || to.status === 'cleared');
      const b = c.bounds;
      const vertical = b.h > b.w;
      ctx.fillStyle = open ? (bt?.corridorColor ?? '#12161f') : '#0b0d12';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = open ? (bt?.wallColor ?? 'rgba(255,204,0,0.35)') : 'rgba(80,80,90,0.4)';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      if (open) {
        ctx.strokeStyle = bt?.primaryColor ?? 'rgba(255,204,0,0.25)';
        ctx.setLineDash([12, 10]);
        ctx.beginPath();
        if (vertical) {
          ctx.moveTo(b.x + b.w / 2, b.y + 8);
          ctx.lineTo(b.x + b.w / 2, b.y + b.h - 8);
        } else {
          ctx.moveTo(b.x + 8, b.y + b.h / 2);
          ctx.lineTo(b.x + b.w - 8, b.y + b.h / 2);
        }
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        ctx.fillStyle = 'rgba(255,42,75,0.35)';
        if (vertical) {
          ctx.fillRect(b.x, b.y + b.h * 0.4, b.w, b.h * 0.2);
        } else {
          ctx.fillRect(b.x + b.w * 0.4, b.y, b.w * 0.2, b.h);
        }
      }
    }

    for (const room of this.rooms) {
      const b = room.bounds;
      const lit = room.discovered || room.status !== 'locked';
      ctx.fillStyle = lit ? (bt?.floorColor ?? '#141722') : '#0c0e14';
      ctx.fillRect(b.x, b.y, b.w, b.h);

      if (lit) {
        ctx.strokeStyle = bt?.primaryColor ?? 'rgba(255,204,0,0.07)';
        ctx.lineWidth = 1;
        for (let gx = b.x; gx < b.x + b.w; gx += 80) {
          ctx.beginPath();
          ctx.moveTo(gx, b.y);
          ctx.lineTo(gx, b.y + b.h);
          ctx.stroke();
        }
        for (let gy = b.y; gy < b.y + b.h; gy += 80) {
          ctx.beginPath();
          ctx.moveTo(b.x, gy);
          ctx.lineTo(b.x + b.w, gy);
          ctx.stroke();
        }
      }

      let border = 'rgba(100,100,120,0.4)';
      if (room.status === 'active') border = 'rgba(255,85,0,0.75)';
      else if (room.status === 'cleared') border = bt?.wallColor ?? 'rgba(57,255,136,0.45)';
      else if (room.kind === 'boss') border = 'rgba(255,43,214,0.5)';
      else if (room.kind === 'event') border = 'rgba(176,77,255,0.4)';
      ctx.strokeStyle = border;
      ctx.lineWidth = 5;
      ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);

      if (lit && room.kind !== 'portal' && room.kind !== 'boss') {
        ctx.fillStyle = bt?.wallFillColor ?? '#1a1e2e';
        const blocks = [
          [b.x + 40, b.y + 40, 90, 60],
          [b.x + b.w - 140, b.y + 40, 100, 70],
          [b.x + 40, b.y + b.h - 110, 110, 70],
          [b.x + b.w - 150, b.y + b.h - 120, 100, 80],
        ];
        for (const [bx, by, bw, bh] of blocks) {
          ctx.fillRect(bx, by, bw, bh);
          ctx.strokeStyle = bt?.primaryColor ?? 'rgba(0,200,255,0.12)';
          ctx.lineWidth = 2;
          ctx.strokeRect(bx, by, bw, bh);
        }
      }

      if (lit && room.kind !== 'portal') {
        ctx.fillStyle = 'rgba(226,232,240,0.35)';
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(room.label.toUpperCase(), b.x + 16, b.y + 28);
      }
    }
  }

  private drawShape(ctx: CanvasRenderingContext2D, shape: string, size: number) {
    ctx.beginPath();
    switch (shape) {
      case 'triangle':
        ctx.moveTo(size, 0);
        ctx.lineTo(-size * 0.7, size * 0.7);
        ctx.lineTo(-size * 0.7, -size * 0.7);
        break;
      case 'square':
        ctx.rect(-size * 0.75, -size * 0.75, size * 1.5, size * 1.5);
        break;
      case 'diamond':
        ctx.moveTo(0, -size);
        ctx.lineTo(size, 0);
        ctx.lineTo(0, size);
        ctx.lineTo(-size, 0);
        break;
      case 'hexagon': {
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI / 3) * i - Math.PI / 6;
          const x = Math.cos(a) * size;
          const y = Math.sin(a) * size;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        break;
      }
      case 'circle_pulse':
      case 'circle':
      default:
        ctx.arc(0, 0, size * 0.85, 0, Math.PI * 2);
        break;
    }
    ctx.closePath();
    ctx.fill();
  }
}

export type { CharacterDef, GeneratedWeapon, ChestDef };
