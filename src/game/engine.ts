import { getCharacter, type CharacterDef } from '../content/characters';
import {
  getWeapon,
  generateWeapon,
  registerGenerated,
  type GeneratedWeapon,
} from '../content/weapons';
import { BOSSES, getEnemy, type EnemyDef } from '../content/enemies';
import { pickSkillChoices, SKILLS, type SkillDef } from '../content/skills';
import { getChest, type ChestDef } from '../content/chests';
import { getPet, petStatBoosts, type PetDef } from '../content/pets';
import { balanceStat } from '../content/statBalance';
import {
  LootMemory,
  getLootTable,
  rollLootCategory,
  pickDirectedWeapon,
  pickDirectedEquipment,
  type BuildContext,
} from './lootDirector';
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
import { DEFAULT_BINDINGS, type PermanentUpgrades } from './persistence';
import { EnemyDirector, type DirectorContext } from './enemyDirector';
import { EventDirector } from './eventDirector';
import { RunDirector, type RunTelemetry } from './runDirector';
import { pickBiomeForMap, type BiomeDef } from '../content/biomes';

const ROOM_W = 900;
const ROOM_H = 700;
const CORRIDOR_LEN = 320;
const CORRIDOR_THICK = 150;
const COMBAT_WAVES = 3;
const TOTAL_MAPS = 10;

/** Room counts per map (min..max) — tuned for variety without overwhelming. */
const MAP_ROOMS_MIN = 7;
const MAP_ROOMS_MAX = 13;

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
  dash: boolean;
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
  // Union of walkables: if the center is inside ANY rect, allow the move.
  // Do NOT clamp to a single room's inset edges — that blocked room→corridor exits
  // (player was stuck at room.right - radius and never reached the corridor).
  for (const r of walkables) {
    if (rectsOverlapPoint(r, x, y, 0)) {
      return { x, y };
    }
  }
  // Outside the union: project to nearest point inside any walkable (with radius inset).
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
  private projectiles: Projectile[] = [];
  private enemies: EnemyEntity[] = [];
  private pickups: PickupEntity[] = [];
  private particles: Particle[] = [];
  private chests: ChestEntity[] = [];
  private rooms: RoomNode[] = [];
  private corridors: CorridorNode[] = [];
  private currentRoomId = 0;
  private roomCombatActive = false;
  private roomWave = 0;
  private roomWaveTotal = COMBAT_WAVES;
  private inCorridor = false;
  private keys = new Set<string>();
  private pressedKeys = new Set<string>();
  private pointer = { x: 0, y: 0, down: false };
  private touchMove = { x: 0, y: 0, active: false };
  private touchShoot = false;
  private touchDash = false;
  private score = 0;
  private kills = 0;
  private combo = 0;
  private comboTimer = 0;
  private wave = 0;
  private enemiesToSpawn: EnemyDef[] = [];
  private spawnTimer = 0;
  private ended: 'victory' | 'defeat' | null = null;
  private goldEarned = 0;
  private mapNumber = 1;
  private runSeed = 0;
  private portal: PortalEntity | null = null;
  private pendingItemPickup: { pk: PickupEntity } | null = null;
  private equippedPetId: string | null = null;
  private pet: { x: number; y: number; angle: number; timers: Record<string, number> } | null = null;
  private lootMemory = new LootMemory();
  private currentBiome!: BiomeDef;
  private biomeParticles: Array<{ x: number; y: number; vx: number; vy: number; size: number; alpha: number }> = [];
  private enemyDirector = new EnemyDirector();
  private eventDirector = new EventDirector();
  private runDirector = new RunDirector();
  private characterId = 'tariq';
  private pendingSkills: SkillChoice[] | null = null;
  /** Skills acquired this run — reapplied every recalc so they persist and
   *  flow through the global Stat Balance layer like every other source. */
  private acquiredSkills: SkillDef[] = [];
  private onStatsCbs = new Set<(s: GameStats) => void>();
  private onLevelUpCbs = new Set<(choices: SkillChoice[]) => void>();
  private onEndCbs = new Set<(result: 'victory' | 'defeat', stats: GameStats) => void>();
  private onWeaponDiscoverCbs = new Set<(id: string) => void>();
  private onKillCbs = new Set<(id: string) => void>();
  private upgrades: PermanentUpgrades = { permHpLevel: 0, permDamageLevel: 0 };
  private worldTime = 0;
  private nearestWeapon: PickupEntity | null = null;
  private nearestChest: ChestEntity | null = null;
  private eventEntities: InteractiveEventEntity[] = [];
  private nearestEvent: InteractiveEventEntity | null = null;
  private currentEvent: EventInstance | null = null;
  private challengeFailed = false;
  private challengeTimer = 0;
  private onEventInteractCbs = new Set<(instance: EventInstance, callback: (idx: number | null) => void) => void>();
  private onItemPickupCbs = new Set<(item: ItemPickupData, equipped: BuildItemEntry[], callback: (slot: EquipSlot | null) => void) => void>();
  private disposed = false;
  private bindings: KeyBindings = { ...DEFAULT_BINDINGS };
  private worldW = 0;
  private worldH = 0;

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
    this.canvas.addEventListener('pointerdown', this.onPointerDown);
    this.canvas.addEventListener('pointermove', this.onPointerMove);
    this.canvas.addEventListener('pointerup', this.onPointerUp);
    this.canvas.addEventListener('pointercancel', this.onPointerUp);
    // Safety: catch releases that happen outside the canvas (e.g. over overlay UI).
    window.addEventListener('pointerup', this.onWindowPointerUp);
    window.addEventListener('pointercancel', this.onWindowPointerUp);
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    this.pressedKeys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };
  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
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
    // Only clear pointer.down when ALL buttons are released, not on every button-up.
    if (!e || (e.buttons ?? 0) === 0) this.pointer.down = false;
    if (!e || e.button === 0) this.keys.delete('Mouse0');
  };
  private onPointerMove = (e: PointerEvent) => {
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
  };
  /** Window-level release safety: if the mouse comes back up outside the canvas,
   *  we must still reset pointer.down / Mouse0. Otherwise fire input can get stuck. */
  private onWindowPointerUp = (e: PointerEvent) => this.onPointerUp(e);

  setTouchMove(x: number, y: number, active: boolean) {
    this.touchMove = { x, y, active };
  }
  setTouchShoot(v: boolean) {
    this.touchShoot = v;
  }
  setTouchDash(v: boolean) {
    this.touchDash = v;
  }

  setBindings(bindings: KeyBindings) {
    this.bindings = { ...bindings };
  }

  getBindings(): KeyBindings {
    return { ...this.bindings };
  }

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
  onKillRecord(cb: (id: string) => void) {
    this.onKillCbs.add(cb);
    return () => this.onKillCbs.delete(cb);
  }
  onItemPickup(cb: typeof GameEngine.prototype.onItemPickupCbs extends Set<infer F> ? F : never) {
    this.onItemPickupCbs.add(cb);
    return () => this.onItemPickupCbs.delete(cb);
  }
  onEventInteract(cb: typeof GameEngine.prototype.onEventInteractCbs extends Set<infer F> ? F : never) {
    this.onEventInteractCbs.add(cb);
    return () => this.onEventInteractCbs.delete(cb);
  }

  start(characterId: string, upgrades: PermanentUpgrades, bindings?: KeyBindings, petId?: string | null) {
    this.characterId = characterId;
    this.upgrades = upgrades;
    if (bindings) this.bindings = { ...bindings };
    this.equippedPetId = petId ?? null;
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
  }

  resume() {
    if (this.ended || this.pendingSkills) return;
    this.running = true;
    this.last = performance.now();
    if (!this.raf) this.raf = requestAnimationFrame(this.tick);
  }

  togglePause() {
    if (this.running) this.pause();
    else this.resume();
  }

  isRunning() {
    return this.running;
  }

  applySkill(skillId: string) {
    const skill = SKILLS.find((s) => s.id === skillId);
    if (!skill) return;
    // Record the skill and recompute so it goes through the balance layer
    // alongside equipment / sets / pet. Full heal for the maxHp skill preserved.
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
        hp: 0, maxHp: 1, shield: 0, level: 1, xp: 0, xpToNext: 40, dashPct: 1,
        score: 0, wave: 0, kills: 0, combo: 0, multiplier: 1,
        weaponName: '', weaponColor: '#00f0ff',
        boss: null, weaponPrompt: null, chestPrompt: null, portalPrompt: null,
        eventPrompt: null, activeChallenge: null,
        ended: null, goldEarned: 0,
        currentRoomLabel: '', roomsCleared: 0, roomsTotal: 0,
        mapNumber: 1, totalMaps: TOTAL_MAPS,
        biomeName: '', biomeIcon: '', biomeColor: '#00f0ff',
        minimap: null, build: null,
      };
    }
    const w = getWeapon(this.player.weaponId);
    const boss = this.enemies.find((e) => e.isBoss);
    const room = this.rooms.find((r) => r.id === this.currentRoomId);
    const cleared = this.rooms.filter((r) => r.status === 'cleared').length;
    const nw = this.nearestWeapon;
    return {
      hp: this.player.hp,
      maxHp: this.player.maxHp,
      shield: this.player.shield,
      level: this.player.level,
      xp: this.player.xp,
      xpToNext: this.player.xpToNext,
      dashPct: 1 - this.player.dashCooldown / this.player.dashCooldownMax,
      score: this.score,
      wave: this.roomCombatActive ? this.roomWave : this.wave,
      kills: this.kills,
      combo: this.combo,
      multiplier: this.comboMultiplier(),
      weaponName: w.name,
      weaponColor: w.color,
      boss: boss ? { name: boss.name, hp: boss.hp, maxHp: boss.maxHp } : null,
      weaponPrompt: nw ? { name: getWeapon(nw.weaponId ?? 'pulse_pistol').name, color: nw.color } : null,
      chestPrompt: this.nearestChest ? { name: this.nearestChest.name, color: this.nearestChest.color } : null,
      portalPrompt: this.portal?.active ? { kind: this.portal.kind === 'descent' ? 'Descender' : 'Portal final' } : null,
      eventPrompt: this.nearestEvent?.active ? { name: this.nearestEvent.instance.name, color: this.nearestEvent.instance.color } : null,
      activeChallenge: this.currentEvent?.combatRules ? { 
        desc: this.currentEvent.description, 
        failed: this.challengeFailed, 
        time: this.currentEvent.combatRules.timeLimit ? Math.ceil(this.challengeTimer) : undefined 
      } : null,
      ended: this.ended,
      goldEarned: this.goldEarned,
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
      biomeName: this.currentBiome?.name ?? 'Distrito Neón',
      biomeIcon: this.currentBiome?.icon ?? '🏙️',
      biomeColor: this.currentBiome?.theme?.wallColor ?? '#00f0ff',
      minimap: this.buildMinimap(),
      build: this.getBuildStats(),
    };
  }

  private statLabelMap(): Record<string, string> {
    return {
      maxHp: 'HP', armor: 'Armadura', speed: 'Velocidad', critChance: 'Crítico',
      damageMult: 'Daño', fireRateMult: 'Cadencia', projectileSize: 'Tamaño proy.',
      pierce: 'Perforación', count: 'Proyectiles', bounce: 'Rebotes',
      lifesteal: 'Robo de vida', dashCooldown: 'CD Dash', shield: 'Escudo',
      explosionRadius: 'Radio explosión',
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
    /**
     * Procedural graph → grid placement.
     * 1) Generate a random connected graph with 1 start + 1 boss + N optional rooms.
     * 2) Place nodes on a grid with no overlaps.
     * 3) Connect with corridors.
     */
    const rng = this.seededRandom();
    const total = MAP_ROOMS_MIN + Math.floor(rng() * (MAP_ROOMS_MAX - MAP_ROOMS_MIN + 1));

    // Step 1 — build the temporary node list (kind will be re-assigned once
    // we pick the boss position). All non-start nodes start as generic combat.
    const nodes: Array<{ id: number; kind: RoomKind; label: string }> = [];
    nodes.push({ id: 0, kind: 'start', label: 'Entrada' });
    for (let i = 1; i < total; i++) {
      nodes.push({ id: i, kind: 'combat', label: `Calle ${i}` });
    }

    // Spanning tree: ensure every node connects back to start
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

    // Step 1b — choose the boss: farthest leaf from start in the spanning tree.
    // "Leaf" = degree 1 in the tree. If none exists (very small map), pick the
    // farthest node overall. This guarantees the boss is at the end of a route.
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
      // Fallback: farthest node overall (shouldn't happen with total >= 3)
      for (const [id, d] of dist) {
        if (id !== 0 && d > bossDist) { bossDist = d; bossId = id; }
      }
    }
    if (bossId === -1) bossId = total - 1;

    // Assign kinds. Boss goes to bossId; the rest get a mix of treasure / portal / event / combat.
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
        const buildTags = this.buildLootContext().weaponTags;
        const evId = this.eventDirector.pickEvent(this.mapNumber, rng, this.runDirector, buildTags, this.currentBiome);
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

    // Extra edges for branching — never touch the boss room, so it stays a leaf.
    const extraEdges = Math.floor(total * (0.3 + rng() * 0.5));
    for (let e = 0; e < extraEdges; e++) {
      const a = Math.floor(rng() * total);
      const b = Math.floor(rng() * total);
      if (a === b) continue;
      if (a === bossId || b === bossId) continue;
      if (edges.some(([x, y]) => (x === a && y === b) || (x === b && y === a))) continue;
      edges.push([a, b]);
    }

    // Step 2 — grid placement via BFS layers
    this.rooms = [];
    this.corridors = [];
    const cellW = ROOM_W + CORRIDOR_LEN;
    const cellH = ROOM_H + CORRIDOR_LEN;
    const originX = 80;
    const originY = 80;

    // BFS from start: assign (gx, gy) without overlaps
    const placed = new Map<number, { gx: number; gy: number }>();
    const occupied = new Set<string>();
    const key = (gx: number, gy: number) => `${gx},${gy}`;

    // Place start
    placed.set(0, { gx: 0, gy: 0 });
    occupied.add(key(0, 0));

    const adjacency = new Map<number, number[]>();
    for (const [a, b] of edges) {
      if (!adjacency.has(a)) adjacency.set(a, []);
      if (!adjacency.has(b)) adjacency.set(b, []);
      adjacency.get(a)!.push(b);
      adjacency.get(b)!.push(a);
    }

    const queue = [0];
    const visited = new Set<number>([0]);
    const deltas = [[0, -1], [0, 1], [-1, 0], [1, 0]];

    while (queue.length > 0) {
      const current = queue.shift()!;
      const pos = placed.get(current)!;
      const neighbors = adjacency.get(current) ?? [];
      for (const nb of neighbors) {
        if (visited.has(nb)) continue;
        visited.add(nb);
        // try cardinal directions
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
          // try one step further
          for (const [dx, dy] of deltas) {
            const ngx = pos.gx + dx * 2;
            const ngy = pos.gy + dy * 2;
            if (!occupied.has(key(ngx, ngy))) {
              bestGx = ngx;
              bestGy = ngy;
              break;
            }
          }
        }
        placed.set(nb, { gx: bestGx, gy: bestGy });
        occupied.add(key(bestGx, bestGy));
        queue.push(nb);
      }
    }

// BFS placement can produce negative grid coordinates (rooms to the
    // north/west of the start). If we translated those directly to world
    // coordinates the world bounds (worldW/worldH computed below as
    // `max(x + w)`) would be wrong for the whole left/top half of the map,
    // and updateProjectiles would cull every player projectile fired in
    // those rooms (its bounds check uses `pr.x < -200` and
    // `pr.x > worldW + 200`).
    //
    // Fix: shift all placed coordinates so the minimum is 0. This keeps the
    // relative layout and connections intact, and makes world bounds valid
    // regardless of the BFS expansion direction.
    let minGx = Infinity, minGy = Infinity;
    for (const pos of placed.values()) {
      if (pos.gx < minGx) minGx = pos.gx;
      if (pos.gy < minGy) minGy = pos.gy;
    }
    if (!Number.isFinite(minGx)) { minGx = 0; minGy = 0; }

    // Build rooms from placed nodes
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
      });
    }

    // Build corridors from edges
    let corridorId = 1000;
    for (const [aId, bId] of edges) {
      const a = this.rooms.find((r) => r.id === aId)!;
      const b = this.rooms.find((r) => r.id === bId)!;

      const pa = placed.get(aId)!;
      const pb = placed.get(bId)!;

      let bounds: RoomBounds;
      if (pa.gx === pb.gx && pa.gy !== pb.gy) {
        const top = pa.gy < pb.gy ? a : b;
        bounds = {
          x: top.bounds.x + (ROOM_W - CORRIDOR_THICK) / 2,
          y: top.bounds.y + ROOM_H,
          w: CORRIDOR_THICK, h: CORRIDOR_LEN,
        };
      } else if (pa.gy === pb.gy && pa.gx !== pb.gx) {
        const left = pa.gx < pb.gx ? a : b;
        bounds = {
          x: left.bounds.x + ROOM_W,
          y: left.bounds.y + (ROOM_H - CORRIDOR_THICK) / 2,
          w: CORRIDOR_LEN, h: CORRIDOR_THICK,
        };
      } else {
        continue;
      }

      for (const room of this.rooms) {
        if (room.id === aId || room.id === bId) continue;
        if (rectsOverlap(bounds, room.bounds, -1)) continue; // just skip, don't crash
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
  }

  private seededRandom(): () => number {
    // Per-run seed (fresh at run start) combined with per-map offset.
    // Guarantees a different layout every new run while remaining
    // deterministic within a given map, so re-computations are stable.
    let s = ((this.runSeed || 1) ^ (this.mapNumber * 2654435761)) >>> 0;
    if (s === 0) s = 1;
    return () => {
      s = (s * 16807) % 2147483647;
      return (s - 1) / 2147483646;
    };
  }

  private fullResetPlayer(charId: string) {
    const char = getCharacter(charId);
    const hpBonus = this.upgrades.permHpLevel * 10;
    const dmgBonus = 1 + this.upgrades.permDamageLevel * 0.05;
    this.player = {
      x: 0, y: 0,
      hp: char.stats.hp + hpBonus,
      maxHp: char.stats.hp + hpBonus,
      shield: 0,
      speed: char.stats.speed,
      armor: char.stats.armor,
      critChance: char.stats.critChance,
      facingX: 1, facingY: 0,
      isDashing: false, dashTime: 0, dashCooldown: 0, dashCooldownMax: 1.2,
      xp: 0, level: 1, xpToNext: 40,
      weaponId: 'pulse_pistol',
      fireCooldown: 0, invuln: 0,
      color: char.sprite.color, glow: char.sprite.glow, name: char.name,
      damageMult: dmgBonus,
      speedMult: 1, pierceBonus: 0, countBonus: 0, lifesteal: 0,
      fireRateMult: 1, projectileSizeBonus: 0, bounceBonus: 0, explosionBonus: 0,
      equipment: { helm: null, chest: null, pants: null, boots: null },
      critDamageMult: 2,
    };
    this.recalcStats();
    for (const cb of this.onWeaponDiscoverCbs) cb('pulse_pistol');
  }

  private newMapLayout() {
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
    this.pickups = [];
    this.particles = [];
    this.chests = [];
    this.eventEntities = [];
    this.enemiesToSpawn = [];
    this.spawnTimer = 0;
    this.portal = null;
    this.camera = { x: this.player.x, y: this.player.y, shake: 0 };
    this.nearestWeapon = null;
    this.nearestChest = null;
    this.nearestEvent = null;
    this.currentEvent = null;
    this.challengeFailed = false;
    this.challengeTimer = 0;
    this.nextId = 1;
    this.worldTime = 0;
    this.currentRoomId = 0;
    this.roomCombatActive = false;
    this.roomWave = 0;
    this.roomWaveTotal = COMBAT_WAVES;
    this.inCorridor = false;

    // (Re)spawn the equipped pet next to the player for the new map.
    this.initPet();

    this.spawnChest('chest_street', start.x + start.w * 0.65, start.y + start.h / 2, 0);
  }

  private getEquippedPetDef(): PetDef | undefined {
    return this.equippedPetId ? getPet(this.equippedPetId) : undefined;
  }

  /** Snapshot of the current build for the Loot Director (data-only). */
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
      mapNumber: this.mapNumber,
      totalMaps: TOTAL_MAPS,
      weaponTags: w.tags ?? [],
      weaponElement: w.element,
      weaponAffixId: w.affixId,
      setCounts,
      petId: this.equippedPetId,
    };
  }

  /** Telemetry snapshot for the Global Run Director. */
  private buildRunTelemetry(): RunTelemetry {
    const p = this.player;
    const w = getWeapon(p?.weaponId ?? '');
    const petDef = this.getEquippedPetDef();
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
      mapNumber: this.mapNumber,
      totalMaps: TOTAL_MAPS,
      roomsCleared: this.rooms.filter((r) => r.status === 'cleared').length,
      totalKills: this.kills,
      recentKills: this.enemyDirector.getIntensity(),
      damageTakenRecent: 0,
      damageTakenTotal: 0,
      healsUsed: 0,
      goldEarned: this.goldEarned,
      bossesDefeated: 0,
      playerHpRatio: p && p.maxHp > 0 ? p.hp / p.maxHp : 1,
      playerShield: p?.shield ?? 0,
      playerLevel: p?.level ?? 1,
      weaponTags: w?.tags ?? [],
      weaponElement: w?.element,
      weaponAffixId: w?.affixId,
      equippedSets: Object.keys(setCounts),
      equippedPetId: this.equippedPetId,
      petElement: petDef?.effects.find((e) => e.key)?.key,
    };
  }

  /** Director-driven weapon generation for a given loot-table source. */
  private directedWeapon(tableId: string): GeneratedWeapon {
    const table = getLootTable(tableId);
    const ctx = this.buildLootContext();
    const { baseId, quality, affixId } = pickDirectedWeapon(table, ctx, this.lootMemory, this.runDirector, this.currentBiome);
    const gw = generateWeapon(baseId, quality, `gen_${this.nextId++}`, affixId);
    registerGenerated(gw);
    return gw;
  }

  /** Director-driven equipment generation for a given loot-table source. */
  private directedEquipment(tableId: string) {
    const table = getLootTable(tableId);
    const ctx = this.buildLootContext();
    const { baseId, quality } = pickDirectedEquipment(table, ctx, this.lootMemory, this.runDirector, this.currentBiome);
    return generateEquipment(baseId, quality, `eq_${this.nextId++}`);
  }

  private initPet() {
    const def = this.getEquippedPetDef();
    if (!def) { this.pet = null; return; }
    this.pet = { x: this.player.x, y: this.player.y, angle: 0, timers: {} };
    for (const eff of def.effects) this.pet.timers[eff.kind + (eff.key ?? '')] = 0;
  }

  private initBiomeParticles() {
    this.biomeParticles = [];
    const theme = this.currentBiome?.theme;
    if (!theme) return;
    const count = theme.particleDensity ?? 25;
    for (let i = 0; i < count; i++) {
      this.biomeParticles.push({
        x: Math.random() * (this.worldW || 2000),
        y: Math.random() * (this.worldH || 2000),
        vx: (Math.random() - 0.5) * 18,
        vy: theme.particleType === 'embers' ? -25 - Math.random() * 25 : (Math.random() - 0.5) * 20,
        size: theme.particleType === 'embers' ? 2 + Math.random() * 3 : 2 + Math.random() * 2,
        alpha: 0.3 + Math.random() * 0.5,
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
        p.x = Math.random() * ww;
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
    // Fresh random seed for this run — every new run gets a distinct layout.
    this.runSeed = (Math.floor(Math.random() * 2147483646) + 1) >>> 0;
    // Fresh Loot Director memory so anti-dup state doesn't leak between runs.
    this.lootMemory.reset();
    // Fresh Enemy Director state so intensity/memory doesn't leak between runs.
    this.enemyDirector.reset();
    this.eventDirector.resetRun();
    this.runDirector.resetRun();
    // Fresh skill list for the new run.
    this.acquiredSkills = [];
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.wave = 0;
    this.ended = null;
    this.goldEarned = 0;
    this.pendingSkills = null;
    this.pendingItemPickup = null;
    this.fullResetPlayer(this.characterId);
    this.newMapLayout();
  }

  private advanceToNextMap() {
    if (this.mapNumber >= TOTAL_MAPS) {
      this.endRun('victory');
      return;
    }
    this.mapNumber += 1;
    this.score += 200 * this.mapNumber;
    // Keep player state, rebuild the map. All ground items disappear on descent.
    this.pendingItemPickup = null;
    this.eventDirector.onNextMap();
    this.runDirector.onNextMap();
    this.newMapLayout();
    this.recalcStats();
    if (!this.running) {
      this.running = true;
      this.last = performance.now();
    }
    this.pushStats();
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
      this.render();
      return;
    }
    this.acc += realDt;
    let steps = 0;
    while (this.acc >= this.fixedDt && steps < 4) {
      this.update(this.fixedDt);
      this.acc -= this.fixedDt;
      steps++;
    }
    this.render();
    this.pushStats();
  };

  private isDown(action: InputAction): boolean {
    const code = this.bindings[action];
    if (code === 'Mouse0') return this.pointer.down;
    return this.keys.has(code);
  }

  /** Edge-triggered: true only on the first frame the binding went down. */
  private isPressed(action: InputAction): boolean {
    const code = this.bindings[action];
    return this.pressedKeys.has(code);
  }

  private consumeEdges() {
    this.pressedKeys.clear();
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
    const dash = this.isDown('dash') || this.touchDash;
    const interact = this.isPressed('interact');

    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const worldX = this.pointer.x - viewW / 2 + this.camera.x;
    const worldY = this.pointer.y - viewH / 2 + this.camera.y;
    // Only use pointer world-aim when the pointer is actually pressed.
    // Otherwise the last pointer position (possibly (0,0) or stale after a room
    // transition) makes the weapon aim into empty space and effectively stop
    // hitting anything — the reported "weapon stops firing" regression when
    // entering rooms from top/side doors.
    const hasAim = this.pointer.down;

    return {
      up: my < 0,
      down: my > 0,
      left: mx < 0,
      right: mx > 0,
      shoot,
      dash,
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
    this.runDirector.update(this.buildRunTelemetry(), dt);
    const input = this.pollInput();
    this.updatePlayer(dt, input);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateBiomeParticles(dt);
    this.updateRoomFlow(dt);
    this.updatePet(dt);
    this.updateCamera(dt);
    this.handleCombat();
    this.handlePickups(input);
    this.handleChests(input);
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

    // Dash: use edge detection so it fires exactly once per press
    const dashJustPressed = this.isPressed('dash');
    if (dashJustPressed && p.dashCooldown <= 0 && !p.isDashing) {
      p.isDashing = true;
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
      if (p.dashTime <= 0) p.isDashing = false;
    }

    let mx = input.moveX;
    let my = input.moveY;
    if (mx !== 0 || my !== 0) {
      const nx = p.x + mx * speed * dt;
      const ny = p.y + my * speed * dt;
      // try full move, then axis separate for sliding along walls
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

    // aim
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
      // on mousedown the virtual Mouse0 key stays in pressedKeys until consumeEdges,
      // so isDown stays true but isPressed would be consumed. We don't need to consume
      // it here because attack is designed as continuous (auto-fire).
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
    // Transition zone: no combat pressure. Reuse invuln flag while inside.
    if (this.inCorridor) {
      this.player.invuln = Math.max(this.player.invuln, 0.15);
      // strip enemy projectiles that enter the corridor
      this.projectiles = this.projectiles.filter((pr) => {
        if (pr.owner !== 'enemy') return true;
        for (const c of this.corridors) {
          if (rectsOverlapPoint(c.bounds, pr.x, pr.y, pr.size)) return false;
        }
        return true;
      });
    }
  }

  /** Walkables: rooms + corridors. Exits stay closed while a room is in active combat. */
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
      // Door rule: no leaving/entering through a room mid-combat.
      const blocked = a.status === 'active' || b.status === 'active';
      if (blocked) continue;
      if (a.status === 'cleared' || b.status === 'cleared') {
        pushUnique(c.bounds);
        // Cleared side may enter the other room (locked or cleared).
        if (a.status === 'cleared') pushUnique(b.bounds);
        if (b.status === 'cleared') pushUnique(a.bounds);
      }
    }

    // Finish a corridor transit even if a room just turned active.
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
    // Corridors are not rooms — do not start combat there.
    if (this.isPlayerInCorridor()) return;

    for (const r of this.rooms) {
      if (rectsOverlapPoint(r.bounds, p.x, p.y, -20)) {
        if (this.currentRoomId !== r.id) {
          this.currentRoomId = r.id;
          r.discovered = true;
          // Pet reveal_map effect: also reveal connected neighbour rooms.
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
    room.status = 'active';
    room.discovered = true;
    this.roomCombatActive = false;
    this.roomWave = 0;
    // Record activation time so the director's context can measure room duration.
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
      const rng = this.seededRandom();
      const instance = this.eventDirector.generateInstance(
        (room as any).eventId,
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
        // Interactive event: mark room cleared of combat, spawn interaction point
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
    // Normal combat: 3 consecutive waves
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
      mapNumber: this.mapNumber,
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
      recentKills: this.enemyDirector.getIntensity(),
      killRate: this.enemyDirector.getIntensity(),
      recentDamageTaken: 0,
      nearDeathCount: 0,
      gold: this.goldEarned,
      chestsOpened: this.chests.filter((c) => c.opened).length,
      bossesDefeated: 0,
      roomCleared: false,
    };
  }

  private queueBossEnemies(room: RoomNode) {
    // Biome weighted boss selection
    const bossPool = BOSSES.map((b) => ({
      boss: b,
      weight: this.currentBiome?.bossWeights?.[b.id] ?? 1,
    }));
    const totalW = bossPool.reduce((s, x) => s + x.weight, 0);
    let r = Math.random() * totalW;
    let chosenBoss = BOSSES[Math.min(2, Math.floor(room.id / 2)) % BOSSES.length];
    for (const item of bossPool) {
      r -= item.weight;
      if (r <= 0) { chosenBoss = item.boss; break; }
    }

    const ctx = this.buildDirectorContext();
    const adds = this.enemyDirector.generateBossAdds(chosenBoss.id, ctx.mapNumber, this.currentBiome);
    const list: EnemyDef[] = [
      { ...chosenBoss, hp: Math.floor(chosenBoss.hp * (1 + room.id * 0.05)) },
      ...adds,
    ];
    this.enemiesToSpawn = list;
    this.spawnTimer = 0.15;
  }

  private queueCombatWave(_room: RoomNode, _waveNum: number) {
    const ctx = this.buildDirectorContext();
    if (this.currentEvent?.combatRules?.isCursed) {
      // Simulate later map progression for cursed rooms
      ctx.mapNumber = Math.min(TOTAL_MAPS, ctx.mapNumber + 3);
    }
    ctx.roomTime = 0;
    const dt = this.fixedDt;
    const list = this.enemyDirector.generateWave(ctx, this.player, dt, this.runDirector, this.currentBiome);
    this.enemiesToSpawn = list;
    this.spawnTimer = 0.2;
  }

  private updateRoomFlow(dt: number) {
    // Never spawn while the player is in a corridor transition.
    if (this.inCorridor) return;

    if (this.enemiesToSpawn.length > 0) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const def = this.enemiesToSpawn.shift()!;
        this.spawnEnemyInRoom(def, def.tags.includes('boss') || def.tags.includes('miniboss'));
        this.spawnTimer = 0.3;
      }
    }

    const room = this.rooms.find((r) => r.id === this.currentRoomId);
    if (!room) return;

    if (this.roomCombatActive && room.status === 'active') {
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
    }
  }

  /** Centralized stat calculation: base + equipment + set bonuses. */
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
    this.player.pierceBonus = 0;
    this.player.countBonus = 0;
    this.player.lifesteal = 0;
    this.player.fireRateMult = 1;
    this.player.projectileSizeBonus = 0;
    this.player.bounceBonus = 0;
    this.player.explosionBonus = 0;

    const addMods = (mods: Array<{ stat: string; op: string; val: number }>) => {
      for (const m of mods) {
        switch (m.stat) {
          case 'maxHp': this.player.maxHp += m.val; this.player.hp = Math.min(this.player.maxHp, this.player.hp + (m.val > 0 ? m.val : 0)); break;
          case 'armor': this.player.armor += m.val; break;
          case 'speed': if (m.op === 'mult') this.player.speedMult *= (1 + m.val); else this.player.speed *= (1 + m.val / 100); break;
          case 'speedMult': this.player.speedMult *= (1 + m.val); break;
          case 'critChance': this.player.critChance += m.val; break;
          case 'damageMult': this.player.damageMult *= (1 + m.val); break;
          case 'fireRateMult': this.player.fireRateMult *= (1 + m.val); break;
          case 'projectileSize': if (m.op === 'mult') this.player.projectileSizeBonus += m.val * 10; else this.player.projectileSizeBonus += m.val; break;
          case 'pierce': this.player.pierceBonus += m.val; break;
          case 'count': this.player.countBonus += m.val; break;
          case 'bounce': this.player.bounceBonus += m.val; break;
          case 'lifesteal': this.player.lifesteal += m.val; break;
          case 'dashCooldown': this.player.dashCooldownMax = Math.max(0.4, 1.2 + m.val); break;
          case 'shield': this.player.shield += m.val; break;
          case 'explosionRadius': this.player.explosionBonus += m.val; break;
        }
      }
    };

    // Skills acquired this run (persist across recompute, flow through balance).
    for (const skill of this.acquiredSkills) {
      addMods(skill.mods.map((m) => this.skillModToGeneric(m)));
    }

    // Apply equipment piece mods
    for (const slot of EQUIP_SLOTS) {
      const id = this.player.equipment[slot];
      if (!id) continue;
      const eq = getEquipment(id);
      addMods(eq.mods.map((m) => ({ stat: m.stat, op: m.op, val: m.value })));
    }

    // Set bonuses
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
          if (bonus.special === 'lethalStrike') this.player.critDamageMult = 3;
        }
      }
      // Weapon synergy: if the equipped weapon matches the set's synergy
      // criteria (tag / affix / element), apply the bonus damage. Requires
      // at least 2 pieces so it feels like a build commitment. Data-driven.
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
      // Counter-synergy: soft penalty when the weapon conflicts with the set.
      // Never prohibitive (damageMult > 0), just reduced efficiency.
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

    // Pet passive stat_boost effects (data-driven). Synergy tags optionally
    // scale the bonus if the equipped weapon matches.
    const petDef = this.getEquippedPetDef();
    if (petDef) {
      const w = getWeapon(this.player.weaponId);
      for (const b of petStatBoosts(petDef)) {
        let val = b.value;
        if (b.synergyTags && b.synergyTags.length > 0) {
          const match = b.synergyTags.some((t) => w.tags.includes(t) || w.element === t || w.affixId === t);
          if (match) val *= 2; // synergy doubles the boost
        }
        addMods([{ stat: b.key, op: b.op, val }]);
      }
    }

    // ---- GLOBAL STAT BALANCE LAYER ----
    // Every final player stat passes through the data-driven balance system
    // (soft caps + diminishing returns + hard caps). This is the ONLY place
    // stats are capped. Stats without a balance entry pass through unchanged.
    this.applyStatBalance();
  }

  /** Final pass: run each accumulated stat through the global balance curves. */
  private applyStatBalance() {
    const p = this.player;
    p.maxHp = Math.round(balanceStat('maxHp', p.maxHp));
    p.armor = balanceStat('armor', p.armor);
    p.shield = Math.round(balanceStat('shield', p.shield));
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
    // Clamp current hp to (possibly newly capped) maxHp.
    if (p.hp > p.maxHp) p.hp = p.maxHp;
  }

  private equipItem(itemId: string, slot: EquipSlot): string | null {
    const prev = this.player.equipment[slot];
    this.player.equipment[slot] = itemId;
    this.recalcStats();
    return prev;
  }

  private clearRoom(room: RoomNode) {
    this.enemyDirector.onRoomCleared();
    room.status = 'cleared';
    this.roomCombatActive = false;
    audio.play('levelup');
    // chest reward on combat clear
    if (room.kind === 'combat') {
      this.spawnChest('chest_street', room.bounds.x + room.bounds.w / 2, room.bounds.y + room.bounds.h / 2, room.id);
      if (Math.random() < 0.3) {
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
      // Boss killed → open a descent portal (or final portal on map 10)
      const isFinal = this.mapNumber >= TOTAL_MAPS;
      this.portal = {
        x: room.bounds.x + room.bounds.w / 2,
        y: room.bounds.y + room.bounds.h / 2,
        active: true,
        kind: isFinal ? 'final' : 'descent',
      };
    }
  }

  private spawnEnemyInRoom(def: EnemyDef, isBoss = false) {
    const room = this.rooms.find((r) => r.id === this.currentRoomId) ?? this.rooms[0];
    const b = room.bounds;
    const margin = 70;
    let x = b.x + margin + Math.random() * (b.w - margin * 2);
    let y = b.y + margin + Math.random() * (b.h - margin * 2);
    if (Math.hypot(x - this.player.x, y - this.player.y) < 160) {
      x = this.player.x < b.x + b.w / 2 ? b.x + b.w - margin : b.x + margin;
      y = this.player.y < b.y + b.h / 2 ? b.y + b.h - margin : b.y + margin;
    }

    this.enemies.push({
      id: this.nextId++,
      defId: def.id,
      name: def.name,
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
    });
  }

  private fireWeapon(p: PlayerState, dx: number, dy: number) {
    const w = getWeapon(p.weaponId);
    const rateMult = Math.max(0.1, 1 + (p.fireRateMult - 1));
    p.fireCooldown = 1 / (w.fireRate * rateMult);
    const count = w.count + p.countBonus;
    const baseAngle = Math.atan2(dy, dx);
    const half = (count - 1) / 2;
    const burstN = w.burstCount && w.burstCount > 1 ? w.burstCount : 1;

    for (let b = 0; b < burstN; b++) {
      const burstDelay = (b / burstN) * 0.03; // tiny micro-delay for visual burst
      for (let i = 0; i < count; i++) {
        const spread = (i - half) * w.spread + (Math.random() - 0.5) * w.spread * 0.3;
        const ang = baseAngle + spread;
        const crit = Math.random() < p.critChance;
        // "Unstable" affix: erratic damage between -25% and +75%.
        const unstableMult = w.unstable ? 0.75 + Math.random() * 1.0 : 1;
        const dmg = w.damage * p.damageMult * (crit ? 2 : 1) * unstableMult;
        const size = (w.projectileSize + p.projectileSizeBonus + (crit ? 2 : 0)) * (w.sizeMult ?? 1);
        this.projectiles.push({
          id: this.nextId++,
          x: p.x + Math.cos(ang) * 18,
          y: p.y + Math.sin(ang) * 18 + burstDelay * 30 * b,
          vx: Math.cos(ang) * w.projectileSpeed,
          vy: Math.sin(ang) * w.projectileSpeed,
          damage: dmg,
          color: crit ? '#ffe14a' : w.color,
          size,
          pierce: w.pierce + p.pierceBonus,
          pierced: new Set(),
          life: w.lifetime ?? 1.8,
          owner: 'player',
          _bounceCount: (w.bounceCount ?? 0) + p.bounceBonus,
          _explosionRadius: (w.explosionRadius ?? 0) + p.explosionBonus,
          // Affix carry-over (weapon-local; independent from item lifesteal).
          _lifesteal: w.lifesteal,
          _element: w.element,
          _elementChance: w.elementChance,
          _chain: w.chain,
          _chainChance: w.chainChance,
        });
      }
    }
    audio.play(w.sound);
  }

  private updateProjectiles(dt: number) {
    const next: Projectile[] = [];
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;

      // Bounce off world edges
      if (pr._bounceCount && pr._bounceCount > 0) {
        if (pr.x < 30 || pr.x > this.worldW - 30) {
          pr.vx = -pr.vx;
          pr.x = Math.max(30, Math.min(this.worldW - 30, pr.x));
          pr._bounceCount -= 1;
        }
        if (pr.y < 30 || pr.y > this.worldH - 30) {
          pr.vy = -pr.vy;
          pr.y = Math.max(30, Math.min(this.worldH - 30, pr.y));
          pr._bounceCount -= 1;
        }
        // explosion on last bounce or wall exit
        if (pr._bounceCount <= 0) {
          if (pr._explosionRadius && pr._explosionRadius > 0) {
            this.explodeAt(pr.x, pr.y, pr._explosionRadius, pr.damage * 0.5, pr.color);
          }
          continue;
        }
      }

      if (pr.life <= 0) continue;
      if (pr.x < -200 || pr.y < -200 || pr.x > this.worldW + 200 || pr.y > this.worldH + 200) continue;
      next.push(pr);
    }
    this.projectiles = next;
  }

  /** Applies weapon-affix effects when a player projectile hits an enemy. */
  private applyProjectileAffix(pr: Projectile, e: EnemyEntity) {
    // Weapon-local lifesteal (independent from item lifesteal).
    if (pr._lifesteal && pr._lifesteal > 0) {
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + pr.damage * pr._lifesteal);
    }
    // Elemental status
    if (pr._element && (pr._elementChance === undefined || Math.random() < pr._elementChance)) {
      switch (pr._element) {
        case 'fire':
        case 'radiant':
          e.burnTimer = 3;
          e.burnDps = Math.max(2, pr.damage * 0.2);
          break;
        case 'toxic':
        case 'dark':
          e.poisonTimer = 4;
          e.poisonDps = Math.max(2, pr.damage * 0.15);
          break;
        case 'ice':
          e.slowTimer = 2.5;
          break;
        case 'electric':
          break; // chaining handled below
      }
    }
    // Chain lightning
    if (pr._chain && pr._chain > 0 && (pr._chainChance === undefined || Math.random() < pr._chainChance)) {
      let remaining = pr._chain;
      const alreadyHit = new Set<number>([e.id]);
      let sourceX = e.x;
      let sourceY = e.y;
      while (remaining > 0) {
        let best: EnemyEntity | null = null;
        let bestD = 220;
        for (const other of this.enemies) {
          if (alreadyHit.has(other.id)) continue;
          const dd = Math.hypot(other.x - sourceX, other.y - sourceY);
          if (dd < bestD) { bestD = dd; best = other; }
        }
        if (!best) break;
        best.hp -= pr.damage * 0.5;
        best.hitFlash = 0.1;
        this.burst(best.x, best.y, '#6ef0ff', 4);
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
    this.burst(x, y, color, 16);
    for (const e of this.enemies) {
      if (Math.hypot(e.x - x, e.y - y) < radius + e.size) {
        e.hp -= damage;
        e.hitFlash = 0.1;
      }
    }
    if (Math.hypot(this.player.x - x, this.player.y - y) < radius + 14) {
      this.damagePlayer(damage * 0.3);
    }
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    const room = this.rooms.find((r) => r.id === this.currentRoomId);
    for (const e of this.enemies) {
      if (e.spawnAnim > 0) e.spawnAnim -= dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.attackTimer > 0) e.attackTimer -= dt;

      // Affix damage-over-time / control status ticking (engine-generic).
      if (e.burnTimer && e.burnTimer > 0) {
        e.burnTimer -= dt;
        e.hp -= (e.burnDps ?? 0) * dt;
        if (Math.random() < dt * 6) this.burst(e.x, e.y, '#ff6a00', 1);
      }
      if (e.poisonTimer && e.poisonTimer > 0) {
        e.poisonTimer -= dt;
        e.hp -= (e.poisonDps ?? 0) * dt;
        if (Math.random() < dt * 6) this.burst(e.x, e.y, '#9dff00', 1);
      }
      let slowFactor = 1;
      if (e.slowTimer && e.slowTimer > 0) {
        e.slowTimer -= dt;
        slowFactor = 0.5;
      }
      if (e.hp <= 0) { this.killEnemy(e); continue; }

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
          });
        }
      } else if (e.aiProfile === 'bomber_rush') {
        e.x += nx * spd * 1.3 * dt;
        e.y += ny * spd * 1.3 * dt;
        if (dist < (e.explosionRadius ?? 50) * 0.5) {
          this.explodeEnemy(e);
          e.hp = 0;
        }
      }

      if (dist < e.size + 14 && e.attackTimer <= 0 && e.aiProfile !== 'bomber_rush') {
        e.attackTimer = e.attackCooldown;
        this.damagePlayer(e.damage);
      }

      // keep enemies in their combat room — never in corridors
      if (room) {
        const b = room.bounds;
        e.x = Math.max(b.x + e.size, Math.min(b.x + b.w - e.size, e.x));
        e.y = Math.max(b.y + e.size, Math.min(b.y + b.h - e.size, e.y));
      }
    }
    this.enemies = this.enemies.filter((e) => e.hp > 0);
  }

  private explodeEnemy(e: EnemyEntity) {
    const r = e.explosionRadius ?? 60;
    audio.play('explosion');
    this.camera.shake = 0.4;
    this.burst(e.x, e.y, e.color, 20);
    const d = Math.hypot(this.player.x - e.x, this.player.y - e.y);
    if (d < r + 14) this.damagePlayer(e.damage);
  }

  private damagePlayer(amount: number) {
    const p = this.player;
    // Corridors are safe transition zones (also covered by invuln while inside).
    if (this.inCorridor || this.isPlayerInCorridor()) return;
    if (p.invuln > 0 || p.isDashing) return;
    const dmg = Math.max(1, amount - p.armor);

    if (this.currentEvent?.combatRules?.noDamage) {
      this.challengeFailed = true;
    }

    if (p.shield > 0) {
      p.shield -= 1;
      p.invuln = 0.4;
      audio.play('hit');
      this.burst(p.x, p.y, '#00f0ff', 6);
      return;
    }
    p.hp -= dmg;
    p.invuln = 0.5;
    this.camera.shake = 0.35;
    audio.play('hurt');
    this.enemyDirector.onDamageTaken(dmg);
    this.burst(p.x, p.y, '#ff2a4b', 10);
    if (p.hp <= 0) {
      p.hp = 0;
      this.endRun('defeat');
    }
  }

  private handleCombat() {
    for (const pr of this.projectiles) {
      if (pr.owner !== 'player') continue;
      for (const e of this.enemies) {
        if (pr.pierced.has(e.id)) continue;
        const d = Math.hypot(pr.x - e.x, pr.y - e.y);
        if (d < e.size + pr.size) {
          e.hp -= pr.damage;
          e.hitFlash = 0.1;
          pr.pierced.add(e.id);
          audio.play('hit');
          this.burst(pr.x, pr.y, pr.color, 4);
          this.applyProjectileAffix(pr, e);
          if (e.hp <= 0) this.killEnemy(e);
          // explosion on first hit if projectile has it
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
  }

  private killEnemy(e: EnemyEntity) {
    e.hp = 0;
    this.kills += 1;
    this.combo += 1;
    this.comboTimer = 3;
    this.enemyDirector.onKill();
    if (e.isBoss) {
      this.enemyDirector.onBossDefeated();
      this.runDirector.onBossDefeated(e.defId);
    }
    const gain = Math.floor(e.score * this.comboMultiplier());
    this.score += gain;
    this.goldEarned += Math.max(1, Math.floor((e.score / 8) * this.petGoldMult()));
    this.grantXp(Math.round(e.xp * this.petXpMult()));

    audio.play('kill');
    this.burst(e.x, e.y, e.color, 14);
    this.camera.shake = Math.min(0.6, this.camera.shake + (e.isBoss ? 0.5 : 0.15));
    for (const cb of this.onKillCbs) cb(e.defId);

    if (this.player.lifesteal > 0) {
      this.player.hp = Math.min(
        this.player.maxHp,
        this.player.hp + e.maxHp * this.player.lifesteal * 0.15,
      );
    }

    // --- Loot Director: source-based tables decide the drops. ---
    // Bosses use a rich table (guaranteed weapon + equipment); miniboss and
    // normal enemies use their own tables. Pet loot_luck still nudges chances.
    const luck = 1 + this.petLootLuck();

    if (e.isBoss) {
      // Bosses always give strong, interesting rewards (Rule 5).
      const eq = this.directedEquipment('enemy_boss');
      this.spawnPickup(e.x + 20, e.y - 20, 'item', eq.color, 0, undefined, eq.genId);
      const w = this.directedWeapon('enemy_boss');
      this.spawnPickup(e.x, e.y - 12, 'weapon', w.color, 0, w.genId);
      for (const cb of this.onWeaponDiscoverCbs) cb(w.baseId);
      this.spawnPickup(e.x, e.y, 'heal', '#39ff88', 20);
      this.spawnPickup(e.x - 10, e.y + 8, 'shield', '#00f0ff', 1);
    } else {
      const def = getEnemy(e.defId);
      const isMiniboss = def?.tags.includes('miniboss') ?? false;
      const table = getLootTable(isMiniboss ? 'enemy_miniboss' : 'enemy_normal');
      // Category roll decides the single main drop for this kill.
      const cat = rollLootCategory(table, this.runDirector);
      switch (cat) {
        case 'gold':
        case 'heal':
          if (Math.random() < 0.85 * luck) this.spawnPickup(e.x, e.y, 'heal', '#39ff88', 20);
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
        default:
          break;
      }
      // Small independent chance for bonus coins on top (feels lively).
      if (Math.random() < 0.12 * luck) this.spawnPickup(e.x + 10, e.y, 'score', '#ffe14a', 50);
    }
  }

  private grantXp(amount: number) {
    const p = this.player;
    p.xp += amount;
    while (p.xp >= p.xpToNext) {
      p.xp -= p.xpToNext;
      p.level += 1;
      p.xpToNext = Math.floor(40 + p.level * 25);
      p.hp = Math.min(p.maxHp, p.hp + 15);
      audio.play('levelup');
      const choices = pickSkillChoices(3);
      this.pendingSkills = choices;
      this.running = false;
      for (const cb of this.onLevelUpCbs) cb(choices);
    }
  }

/** Normalizes a skill mod into the generic { stat, op, val } shape used by recalc.
   *  Skill stat names map onto engine stat names; 'add_pct' behaves like a mult. */
  private skillModToGeneric(m: { stat: string; op: string; value: number }): { stat: string; op: string; val: number } {
    // Skills use 'speedMult'/'damageMult' etc. and 'pierce'/'count'/'shield'.
    const op = m.op === 'add_pct' ? 'mult' : m.op;
    return { stat: m.stat, op, val: m.value };
  }

  private spawnPickup(
    x: number, y: number, kind: PickupEntity['kind'],
    color: string, value: number, weaponId?: string, itemId?: string,
  ) {
    // Weapons and equipment persist for the whole map; consumables have a timer.
    const life = kind === 'item' || kind === 'weapon' ? Number.POSITIVE_INFINITY : 25;
    this.pickups.push({
      id: this.nextId++, x, y, kind, color, value,
      weaponId, itemId,
      bob: Math.random() * Math.PI * 2, life,
    });
  }

  private spawnChest(defId: string, x: number, y: number, roomId: number) {
    const def = getChest(defId);
    // avoid duplicate unopened chest in same spot
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
      if (kind === 'heal') this.spawnPickup(chest.x + ox, chest.y + 20, 'heal', '#39ff88', 25);
      if (kind === 'score') this.spawnPickup(chest.x + ox, chest.y + 24, 'score', '#ffe14a', 75);
      if (kind === 'shield') this.spawnPickup(chest.x + ox, chest.y + 28, 'shield', '#00f0ff', 1);
    });

    // Loot Director: map the chest type to its own loot table (Rule 3).
    const chestTable =
      chest.defId === 'chest_boss' ? 'chest_legendary'
      : chest.defId === 'chest_armory' ? 'chest_rare'
      : 'chest_common';

    if (Math.random() < def.weaponChance) {
      const w = this.directedWeapon(chestTable);
      this.spawnPickup(chest.x, chest.y - 18, 'weapon', w.color, 0, w.genId);
      for (const cb of this.onWeaponDiscoverCbs) cb(w.baseId);
    }
    // Equipment drop chance from chest
    if (Math.random() < (def.highTier ? 0.8 : 0.35)) {
      const eq = this.directedEquipment(chestTable);
      this.spawnPickup(chest.x + 18, chest.y - 6, 'item', eq.color, 0, undefined, eq.genId);
    }
  }

  private updatePickups(dt: number) {
    for (const pk of this.pickups) {
      pk.bob += dt * 3;
      // Only consumables decay. Weapons and equipment persist until picked up
      // or the map ends.
      if (Number.isFinite(pk.life)) pk.life -= dt;
    }
    this.pickups = this.pickups.filter((pk) => pk.life > 0);
  }

  private handlePickups(input: InputState) {
    const p = this.player;
    this.nearestWeapon = null;
    let bestDist = 48;
    for (const pk of this.pickups) {
      if (pk.life <= 0) continue;
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (pk.kind === 'weapon' && d < bestDist) {
        bestDist = d;
        this.nearestWeapon = pk;
      }
      if (d < 28 && pk.kind === 'item') {
        if (input.interact && !this.nearestChest && !this.pendingItemPickup) {
          const equipId = pk.itemId ?? EQUIP_SLOTS[0];
          const eq = getEquipment(equipId);
          const equipped = this.buildEquippedItemEntries();
          // Do NOT destroy the pickup here: the user may cancel, in which case
          // the item must remain on the ground. Store a reference so the
          // resolver knows what to swap / discard.
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
        }
        continue;
      }
      if (d < 28 && pk.kind !== 'weapon' && pk.kind !== 'item') {
        if (pk.kind === 'heal') {
          p.hp = Math.min(p.maxHp, p.hp + pk.value);
        } else if (pk.kind === 'score') {
          this.score += pk.value;
          this.goldEarned += 5;
        } else if (pk.kind === 'shield') {
          p.shield += pk.value;
        }
        pk.life = 0;
        audio.play('pickup');
        this.burst(pk.x, pk.y, pk.color, 6);
      }
    }
    if (this.nearestWeapon && input.interact && !this.nearestChest) {
      const old = p.weaponId;
      p.weaponId = this.nearestWeapon.weaponId ?? old;
      const ow = getWeapon(old);
      this.spawnPickup(p.x - 20, p.y, 'weapon', ow.color, 0, old);
      this.nearestWeapon.life = 0;
      this.nearestWeapon = null;
      audio.play('pickup');
      // Re-evaluate stats so set→weapon synergies update to the new weapon.
      this.recalcStats();
      for (const cb of this.onWeaponDiscoverCbs) cb(p.weaponId);
    }
  }

  resolveItemPickup(itemId: string, slot: EquipSlot | null) {
    const pending = this.pendingItemPickup;
    this.pendingItemPickup = null;

    if (slot === null) {
      // User cancelled → keep the pickup on the ground exactly as it was.
      audio.play('button');
    } else {
      // Equip the new one. If a previous piece was in that slot, drop it on
      // the ground at the picked-up item's position with all its properties.
      const previousId = this.player.equipment[slot];
      this.equipItem(itemId, slot);
      audio.play('pickup');
      if (pending) {
        if (previousId) {
          const prevDef = getEquipment(previousId);
          // Reuse the pickup in-place, keeping the DISPLACED piece's exact id
          // (genId → preserves its quality, set and all properties).
          pending.pk.itemId = previousId;
          pending.pk.color = prevDef.color;
          // Keep life = Infinity for equipment (already set by spawnPickup).
        } else {
          // No previous piece → the pickup is consumed.
          pending.pk.life = 0;
        }
      }
    }

    if (!this.ended) {
      this.running = true;
      this.last = performance.now();
    }
  }

  private handleChests(input: InputState) {
    const p = this.player;
    this.nearestChest = null;
    let best = 52;
    for (const c of this.chests) {
      if (c.opened) continue;
      const d = Math.hypot(c.x - p.x, c.y - p.y);
      if (d < best) {
        best = d;
        this.nearestChest = c;
      }
    }
    // Portal interaction
    if (this.portal?.active) {
      const pd = Math.hypot(this.portal.x - p.x, this.portal.y - p.y);
      if (pd < 60 && input.interact) {
        if (this.portal.kind === 'final') {
          this.advanceToNextMap(); // triggers endRun('victory') inside
        } else {
          this.advanceToNextMap();
        }
        this.nearestChest = null;
        this.nearestEvent = null;
        return;
      }
    }

    // Event interaction
    this.nearestEvent = null;
    let bestEv = 60;
    for (const ev of this.eventEntities) {
      if (!ev.active) continue;
      const d = Math.hypot(ev.x - p.x, ev.y - p.y);
      if (d < bestEv) {
        bestEv = d;
        this.nearestEvent = ev;
      }
    }
    if (this.nearestEvent && input.interact) {
      this.running = false;
      for (const cb of this.onEventInteractCbs) {
        cb(this.nearestEvent.instance, (idx) => this.resolveEventOption(this.nearestEvent!.id, idx));
      }
      return;
    }

    if (this.nearestChest && input.interact) {
      this.openChest(this.nearestChest);
      this.nearestChest = null;
    }
  }

  private resolveEventOption(eventEntId: number, optionIndex: number | null) {
    const ent = this.eventEntities.find(e => e.id === eventEntId);
    if (!ent) return;
    this.runDirector.onEventCompleted(ent.instance.id);
    
    if (optionIndex === null) {
      audio.play('button');
    } else {
      const opt = ent.instance.options![optionIndex];
      if (opt.costGold && this.goldEarned < opt.costGold) {
        audio.play('hurt');
        return;
      }
      if (opt.costHpPct && this.player.hp <= this.player.maxHp * opt.costHpPct) {
        audio.play('hurt');
        return;
      }
      
      audio.play('levelup');
      ent.active = false;
      
      for (const a of opt.actions) {
        if (a.kind === 'stat_mod') {
           this.acquiredSkills.push({
             id: 'event_mod', name: 'Evento', description: '', icon: '', rarity: 'common',
             mods: [{ stat: a.stat, op: a.op, value: a.val }]
           });
           this.recalcStats();
        }
        if (a.kind === 'add_gold') this.goldEarned += a.value;
        if (a.kind === 'lose_gold') this.goldEarned -= a.value;
        if (a.kind === 'heal') this.player.hp = Math.min(this.player.maxHp, this.player.hp + a.value);
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
      const a = Math.random() * Math.PI * 2;
      const s = 40 + Math.random() * 120;
      this.particles.push({
        x,
        y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.25 + Math.random() * 0.4,
        maxLife: 0.6,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }

  private updateCamera(dt: number) {
    this.camera.x += (this.player.x - this.camera.x) * Math.min(1, dt * 8);
    this.camera.y += (this.player.y - this.camera.y) * Math.min(1, dt * 8);
  }

  /* --------------------------------------------------------------
   * PET SYSTEM — fully generic, driven by PetDef.effects[].
   * Adding a new pet requires no engine changes.
   * ------------------------------------------------------------ */
  private updatePet(dt: number) {
    const def = this.getEquippedPetDef();
    if (!def || !this.pet) return;
    const pet = this.pet;

    // Orbit around the player.
    pet.angle += def.stats.orbitSpeed * dt;
    const r = def.stats.orbitRadius;
    const targetX = this.player.x + Math.cos(pet.angle) * r;
    const targetY = this.player.y + Math.sin(pet.angle) * r;
    pet.x += (targetX - pet.x) * Math.min(1, dt * 10);
    pet.y += (targetY - pet.y) * Math.min(1, dt * 10);

    // Skip active combat effects while transitioning corridors.
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
                damage: (eff.value ?? 8) * (1 + (this.mapNumber - 1) * 0.1),
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
            for (const e of this.enemies) {
              if (Math.hypot(e.x - pet.x, e.y - pet.y) < radius) e.slowTimer = 0.8;
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
            for (const e of this.enemies) {
              if (Math.hypot(e.x - pet.x, e.y - pet.y) >= radius) continue;
              if (eff.key === 'fire') { e.burnTimer = 3; e.burnDps = dps; }
              else if (eff.key === 'toxic') { e.poisonTimer = 4; e.poisonDps = dps; }
              else if (eff.key === 'ice') { e.slowTimer = 2; }
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
        // coin/loot/xp/gold/reveal/stat_boost are passive: handled where relevant.
        default:
          break;
      }
    }
  }

  /** Multiplier applied to XP gains from the equipped pet (data-driven). */
  private petXpMult(): number {
    const def = this.getEquippedPetDef();
    if (!def) return 1;
    let m = 1;
    for (const e of def.effects) if (e.kind === 'xp_boost') m += e.value ?? 0;
    return m;
  }

  /** Multiplier applied to gold gains from the equipped pet. */
  private petGoldMult(): number {
    const def = this.getEquippedPetDef();
    if (!def) return 1;
    let m = 1;
    for (const e of def.effects) if (e.kind === 'gold_boost') m += e.value ?? 0;
    return m;
  }

  /** Extra drop-chance bonus from the equipped pet (loot_luck). */
  private petLootLuck(): number {
    const def = this.getEquippedPetDef();
    if (!def) return 0;
    let b = 0;
    for (const e of def.effects) if (e.kind === 'loot_luck') b += e.value ?? 0;
    return b;
  }

  /** Extra minimap reveal radius factor from the equipped pet. */
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
      const d = Math.hypot(e.x - x, e.y - y);
      if (d < bestD) {
        bestD = d;
        best = e;
      }
    }
    return best;
  }

  private endRun(result: 'victory' | 'defeat') {
    if (this.ended) return;
    this.ended = result;
    this.running = false;
    audio.play(result === 'victory' ? 'levelup' : 'death');
    const stats = this.getStats();
    for (const cb of this.onEndCbs) cb(result, stats);
  }

  private pushStats() {
    const s = this.getStats();
    for (const cb of this.onStatsCbs) cb(s);
  }

  private render() {
    const ctx = this.ctx;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const shakeX = this.camera.shake > 0 ? (Math.random() - 0.5) * this.camera.shake * 14 : 0;
    const shakeY = this.camera.shake > 0 ? (Math.random() - 0.5) * this.camera.shake * 14 : 0;
    const camX = this.camera.x - w / 2 + shakeX;
    const camY = this.camera.y - h / 2 + shakeY;

    ctx.fillStyle = '#07090e';
    ctx.fillRect(0, 0, w, h);

    ctx.save();
    ctx.translate(-camX, -camY);

    this.drawWorld(ctx);

    // chests
    for (const c of this.chests) {
      this.drawChest(ctx, c);
    }

    // events
    for (const ev of this.eventEntities) {
      if (!ev.active) continue;
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

    // pickups
    for (const pk of this.pickups) {
      const by = pk.y + Math.sin(pk.bob) * 4;
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

    // enemies
    for (const e of this.enemies) {
      const scale = e.spawnAnim > 0 ? 1 - e.spawnAnim * 1.5 : 1;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.scale(Math.max(0.2, scale), Math.max(0.2, scale));
      ctx.shadowColor = e.glow;
      ctx.shadowBlur = e.isBoss ? 28 : 14;
      ctx.fillStyle = e.hitFlash > 0 ? '#ffffff' : e.color;
      this.drawShape(ctx, e.shape, e.size);
      ctx.shadowBlur = 0;
      if (e.hp < e.maxHp || e.isBoss) {
        const bw = e.size * 2;
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.fillRect(-bw / 2, -e.size - 12, bw, 4);
        ctx.fillStyle = e.isBoss ? '#ffe14a' : '#ff2a4b';
        ctx.fillRect(-bw / 2, -e.size - 12, bw * (e.hp / e.maxHp), 4);
      }
      ctx.restore();
    }

    // projectiles
    for (const pr of this.projectiles) {
      ctx.shadowColor = pr.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = pr.color;
      ctx.beginPath();
      ctx.arc(pr.x, pr.y, pr.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }

    // player
    const p = this.player;
    ctx.save();
    ctx.translate(p.x, p.y);
    const ang = Math.atan2(p.facingY, p.facingX);
    ctx.rotate(ang);
    if (p.invuln > 0 && Math.floor(this.worldTime * 20) % 2 === 0) {
      ctx.globalAlpha = 0.4;
    }
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

    if (p.shield > 0) {
      ctx.strokeStyle = 'rgba(0,240,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 22 + Math.sin(this.worldTime * 4) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Equipped pet (orbiting companion).
    const petDef = this.getEquippedPetDef();
    if (petDef && this.pet) {
      const ps = petDef.stats.size;
      ctx.save();
      ctx.translate(this.pet.x, this.pet.y);
      ctx.shadowColor = petDef.color;
      ctx.shadowBlur = 14;
      ctx.fillStyle = petDef.color;
      ctx.beginPath();
      ctx.arc(0, 0, ps, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.font = `${ps * 1.6}px monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(petDef.icon, 0, 1);
      ctx.textBaseline = 'alphabetic';
      ctx.restore();
    }

    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    // Ambient biome particles
    const theme = this.currentBiome?.theme;
    if (theme && this.biomeParticles.length > 0) {
      ctx.fillStyle = theme.particleColor;
      for (const bp of this.biomeParticles) {
        ctx.globalAlpha = bp.alpha;
        ctx.fillRect(bp.x, bp.y, bp.size, bp.size);
      }
      ctx.globalAlpha = 1;
    }

    // Portal entity drawing
    if (this.portal?.active) {
      const pt = this.portal;
      const pulse = Math.sin(this.worldTime * 3) * 4;
      ctx.save();
      ctx.translate(pt.x, pt.y);
      // outer glow
      ctx.shadowColor = pt.kind === 'final' ? '#ffe14a' : '#00f0ff';
      ctx.shadowBlur = 24 + pulse;
      ctx.fillStyle = pt.kind === 'final' ? 'rgba(255,225,74,0.7)' : 'rgba(0,240,255,0.6)';
      ctx.beginPath();
      ctx.arc(0, 0, 28 + pulse, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      // inner dark
      ctx.fillStyle = '#07090e';
      ctx.beginPath();
      ctx.arc(0, 0, 16, 0, Math.PI * 2);
      ctx.fill();
      // swirling particles
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
    if (this.portal?.active) {
      const lbl = this.portal.kind === 'final' ? 'PORTAL FINAL' : 'DESCENDER';
      ctx.fillText(`[E] ${lbl}`, this.portal.x, this.portal.y - 42);
    } else if (this.nearestChest) {
      ctx.fillText(`[E] ABRIR ${this.nearestChest.name.toUpperCase()}`, this.nearestChest.x, this.nearestChest.y - 28);
    } else if (this.nearestWeapon) {
      ctx.fillText('[E] CAMBIAR ARMA', this.nearestWeapon.x, this.nearestWeapon.y - 22);
    }

    // exit hints toward open corridors
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
        // place label near the room edge facing the corridor
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

  private drawWorld(ctx: CanvasRenderingContext2D) {
    const bt = this.currentBiome?.theme;
    // dark void
    ctx.fillStyle = '#07090e';
    ctx.fillRect(-200, -200, this.worldW + 400, this.worldH + 400);

    // corridors first
    for (const c of this.corridors) {
      const from = this.rooms.find((r) => r.id === c.from)!;
      const to = this.rooms.find((r) => r.id === c.to)!;
      const combatLock = from.status === 'active' || to.status === 'active';
      const open =
        !combatLock && (from.status === 'cleared' || to.status === 'cleared');
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

    // rooms
    for (const room of this.rooms) {
      const b = room.bounds;
      const lit = room.discovered || room.status !== 'locked';
      ctx.fillStyle = lit ? (bt?.floorColor ?? '#141722') : '#0c0e14';
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // grid
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

      // border color
      let border = 'rgba(100,100,120,0.4)';
      if (room.status === 'active') border = 'rgba(255,85,0,0.75)';
      else if (room.status === 'cleared') border = bt?.wallColor ?? 'rgba(57,255,136,0.45)';
      else if (room.kind === 'boss') border = 'rgba(255,43,214,0.5)';
      else if (room.kind === 'event') border = 'rgba(176,77,255,0.4)';
      ctx.strokeStyle = border;
      ctx.lineWidth = 5;
      ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);

      // decoration blocks
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

      // label — skip for portal rooms (empty feeling)
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
