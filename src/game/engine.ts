import { getCharacter, type CharacterDef } from '../content/characters';
import { getWeapon, WEAPONS, type WeaponDef } from '../content/weapons';
import { ENEMIES, BOSSES, type EnemyDef } from '../content/enemies';
import { pickSkillChoices, SKILLS, type SkillDef } from '../content/skills';
import { getChest, type ChestDef } from '../content/chests';
import type {
  ChestEntity,
  CorridorNode,
  EnemyEntity,
  GameStats,
  KeyBindings,
  MinimapData,
  Particle,
  PickupEntity,
  PlayerState,
  Projectile,
  RoomBounds,
  RoomKind,
  RoomNode,
  SkillChoice,
} from './types';
import { audio } from './audio';
import { DEFAULT_BINDINGS, type PermanentUpgrades } from './persistence';

const ROOM_W = 900;
const ROOM_H = 700;
const CORRIDOR_LEN = 320;
const CORRIDOR_THICK = 150;
const COMBAT_WAVES = 3;

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
  private characterId = 'tariq';
  private pendingSkills: SkillChoice[] | null = null;
  private onStatsCbs = new Set<(s: GameStats) => void>();
  private onLevelUpCbs = new Set<(choices: SkillChoice[]) => void>();
  private onEndCbs = new Set<(result: 'victory' | 'defeat', stats: GameStats) => void>();
  private onWeaponDiscoverCbs = new Set<(id: string) => void>();
  private onKillCbs = new Set<(id: string) => void>();
  private upgrades: PermanentUpgrades = { permHpLevel: 0, permDamageLevel: 0 };
  private worldTime = 0;
  private nearestWeapon: PickupEntity | null = null;
  private nearestChest: ChestEntity | null = null;
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
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
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
    this.canvas.setPointerCapture(e.pointerId);
  };
  private onPointerMove = (e: PointerEvent) => {
    this.pointer.x = e.clientX;
    this.pointer.y = e.clientY;
  };
  private onPointerUp = () => {
    this.pointer.down = false;
  };

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

  start(characterId: string, upgrades: PermanentUpgrades, bindings?: KeyBindings) {
    this.characterId = characterId;
    this.upgrades = upgrades;
    if (bindings) this.bindings = { ...bindings };
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
    this.applySkillMods(skill);
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
        boss: null, weaponPrompt: null, chestPrompt: null,
        ended: null, goldEarned: 0,
        currentRoomLabel: '', roomsCleared: 0, roomsTotal: 0,
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
      weaponPrompt: nw
        ? { name: getWeapon(nw.weaponId ?? 'pistol').name, color: nw.color }
        : null,
      chestPrompt: this.nearestChest
        ? { name: this.nearestChest.name, color: this.nearestChest.color }
        : null,
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
      minimap: this.buildMinimap(),
      build: this.getBuildStats(),
    };
  }

  private getBuildStats() {
    const p = this.player;
    const w = getWeapon(p.weaponId);
    const nw = this.nearestWeapon;
    return {
      name: p.name,
      color: p.color,
      hp: p.hp,
      maxHp: p.maxHp,
      shield: p.shield,
      speed: p.speed,
      armor: p.armor,
      critChance: p.critChance,
      damageMult: p.damageMult,
      speedMult: p.speedMult,
      pierceBonus: p.pierceBonus,
      countBonus: p.countBonus,
      lifesteal: p.lifesteal,
      level: p.level,
      xp: p.xp,
      xpToNext: p.xpToNext,
      weaponId: p.weaponId,
      weaponName: w.name,
      weaponColor: w.color,
      weaponRarity: w.rarity,
      weaponDamage: w.damage,
      weaponFireRate: w.fireRate,
      weaponCount: w.count,
      weaponPierce: w.pierce,
      weaponSpread: w.spread,
      weaponTags: w.tags,
      hasNearbyWeapon: !!nw,
      nearbyWeaponName: nw ? getWeapon(nw.weaponId ?? 'pistol').name : undefined,
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
    };
  }

  private buildMapLayout() {
    /**
     * Grid nodes (cardinal only) + branch at Nexo:
     *
     *              (1,0) Calle Alta
     *                   │
     * (0,1) Entrada ─ (1,1) Nexo ─ (2,1) Calle ─ (3,1) Jefe
     *                   │
     *              (1,2) Botín
     */
    const cellW = ROOM_W + CORRIDOR_LEN;
    const cellH = ROOM_H + CORRIDOR_LEN;
    const originX = 80;
    const originY = 80;

    type Def = { id: number; kind: RoomKind; label: string; gx: number; gy: number };
    const defs: Def[] = [
      { id: 0, kind: 'start', label: 'Entrada', gx: 0, gy: 1 },
      { id: 1, kind: 'combat', label: 'Nexo', gx: 1, gy: 1 },
      { id: 2, kind: 'combat', label: 'Calle Alta', gx: 1, gy: 0 },
      { id: 3, kind: 'treasure', label: 'Botín', gx: 1, gy: 2 },
      { id: 4, kind: 'combat', label: 'Calle', gx: 2, gy: 1 },
      { id: 5, kind: 'boss', label: 'Jefe', gx: 3, gy: 1 },
    ];

    // Cardinal edges only (no diagonals)
    const edges: Array<[number, number]> = [
      [0, 1], // Entrada — Nexo
      [1, 2], // Nexo — Calle Alta (rama)
      [1, 3], // Nexo — Botín (rama)
      [1, 4], // Nexo — Calle (ruta principal)
      [4, 5], // Calle — Jefe
    ];

    this.rooms = [];
    this.corridors = [];

    for (const d of defs) {
      const bounds: RoomBounds = {
        x: originX + d.gx * cellW,
        y: originY + d.gy * cellH,
        w: ROOM_W,
        h: ROOM_H,
      };
      // overlap guard against any already placed room
      for (const other of this.rooms) {
        if (rectsOverlap(bounds, other.bounds, 8)) {
          throw new Error(`Room layout overlap: ${d.id} vs ${other.id}`);
        }
      }
      this.rooms.push({
        id: d.id,
        kind: d.kind,
        bounds,
        status: d.id === 0 ? 'cleared' : 'locked',
        discovered: d.id === 0,
        connections: [],
        label: d.label,
      });
    }

    let corridorId = 1000;
    for (const [aId, bId] of edges) {
      const a = this.rooms.find((r) => r.id === aId)!;
      const b = this.rooms.find((r) => r.id === bId)!;
      a.connections.push(bId);
      b.connections.push(aId);

      const da = defs.find((d) => d.id === aId)!;
      const db = defs.find((d) => d.id === bId)!;
      let bounds: RoomBounds;

      if (da.gx === db.gx && da.gy !== db.gy) {
        // vertical corridor
        const top = da.gy < db.gy ? a : b;
        bounds = {
          x: top.bounds.x + (ROOM_W - CORRIDOR_THICK) / 2,
          y: top.bounds.y + ROOM_H,
          w: CORRIDOR_THICK,
          h: CORRIDOR_LEN,
        };
      } else if (da.gy === db.gy && da.gx !== db.gx) {
        // horizontal corridor
        const left = da.gx < db.gx ? a : b;
        bounds = {
          x: left.bounds.x + ROOM_W,
          y: left.bounds.y + (ROOM_H - CORRIDOR_THICK) / 2,
          w: CORRIDOR_LEN,
          h: CORRIDOR_THICK,
        };
      } else {
        continue;
      }

      // corridors must not overlap room interiors (endpoints touch edges only)
      for (const room of this.rooms) {
        if (room.id === aId || room.id === bId) continue;
        if (rectsOverlap(bounds, room.bounds, -1)) {
          throw new Error(`Corridor overlaps room ${room.id}`);
        }
      }

      this.corridors.push({
        id: corridorId++,
        from: aId,
        to: bId,
        bounds,
      });
    }

    let maxX = 0;
    let maxY = 0;
    for (const r of this.rooms) {
      maxX = Math.max(maxX, r.bounds.x + r.bounds.w);
      maxY = Math.max(maxY, r.bounds.y + r.bounds.h);
    }
    this.worldW = maxX + 80;
    this.worldH = maxY + 80;
  }

  private resetRun() {
    const char = getCharacter(this.characterId);
    const hpBonus = this.upgrades.permHpLevel * 10;
    const dmgBonus = 1 + this.upgrades.permDamageLevel * 0.05;
    this.buildMapLayout();
    const start = this.rooms[0].bounds;
    this.player = {
      x: start.x + start.w * 0.35,
      y: start.y + start.h / 2,
      hp: char.stats.hp + hpBonus,
      maxHp: char.stats.hp + hpBonus,
      shield: 0,
      speed: char.stats.speed,
      armor: char.stats.armor,
      critChance: char.stats.critChance,
      facingX: 1,
      facingY: 0,
      isDashing: false,
      dashTime: 0,
      dashCooldown: 0,
      dashCooldownMax: 1.2,
      xp: 0,
      level: 1,
      xpToNext: 40,
      weaponId: char.startingWeapon,
      fireCooldown: 0,
      invuln: 0,
      color: char.sprite.color,
      glow: char.sprite.glow,
      name: char.name,
      damageMult: dmgBonus,
      speedMult: 1,
      pierceBonus: 0,
      countBonus: 0,
      lifesteal: 0,
    };
    this.projectiles = [];
    this.enemies = [];
    this.pickups = [];
    this.particles = [];
    this.chests = [];
    this.score = 0;
    this.kills = 0;
    this.combo = 0;
    this.comboTimer = 0;
    this.wave = 0;
    this.enemiesToSpawn = [];
    this.spawnTimer = 0;
    this.ended = null;
    this.goldEarned = 0;
    this.pendingSkills = null;
    this.camera = { x: this.player.x, y: this.player.y, shake: 0 };
    this.nearestWeapon = null;
    this.nearestChest = null;
    this.nextId = 1;
    this.worldTime = 0;
    this.currentRoomId = 0;
    this.roomCombatActive = false;
    this.roomWave = 0;
    this.roomWaveTotal = COMBAT_WAVES;
    this.inCorridor = false;
    // starter chest in start room
    this.spawnChest('chest_street', start.x + start.w * 0.65, start.y + start.h / 2, 0);
    for (const cb of this.onWeaponDiscoverCbs) cb(char.startingWeapon);
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

  private isDown(action: keyof KeyBindings): boolean {
    const code = this.bindings[action];
    if (this.keys.has(code)) return true;
    // allow both shifts for dash default convenience
    if (action === 'dash' && (this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'))) {
      if (code === 'ShiftLeft' || code === 'ShiftRight') return true;
    }
    // arrows always as secondary move
    if (action === 'up' && this.keys.has('ArrowUp')) return true;
    if (action === 'down' && this.keys.has('ArrowDown')) return true;
    if (action === 'left' && this.keys.has('ArrowLeft')) return true;
    if (action === 'right' && this.keys.has('ArrowRight')) return true;
    return false;
  }

  private pollInput(): InputState {
    let mx = 0;
    let my = 0;
    if (this.isDown('up')) my -= 1;
    if (this.isDown('down')) my += 1;
    if (this.isDown('left')) mx -= 1;
    if (this.isDown('right')) mx += 1;
    if (this.touchMove.active) {
      mx = this.touchMove.x;
      my = this.touchMove.y;
    }
    const len = Math.hypot(mx, my);
    if (len > 1) {
      mx /= len;
      my /= len;
    }
    const shoot = this.isDown('shoot') || this.pointer.down || this.touchShoot;
    const dash = this.isDown('dash') || this.touchDash;
    const interact = this.isDown('interact');

    const viewW = window.innerWidth;
    const viewH = window.innerHeight;
    const worldX = this.pointer.x - viewW / 2 + this.camera.x;
    const worldY = this.pointer.y - viewH / 2 + this.camera.y;
    const hasAim = this.pointer.down || this.isDown('shoot');

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
    const input = this.pollInput();
    this.updatePlayer(dt, input);
    this.updateProjectiles(dt);
    this.updateEnemies(dt);
    this.updatePickups(dt);
    this.updateParticles(dt);
    this.updateRoomFlow(dt);
    this.updateCamera(dt);
    this.handleCombat();
    this.handlePickups(input);
    this.handleChests(input);
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

    if (input.dash && p.dashCooldown <= 0 && !p.isDashing) {
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

  private queueBossEnemies(room: RoomNode) {
    const n = room.id;
    const list: EnemyDef[] = [];
    const boss = BOSSES[Math.min(2, Math.floor(n / 2)) % BOSSES.length];
    list.push({
      ...boss,
      hp: Math.floor(boss.hp * (1 + n * 0.05)),
    });
    for (let i = 0; i < 4; i++) {
      const def = ENEMIES[Math.floor(Math.random() * Math.min(5, ENEMIES.length))];
      list.push({
        ...def,
        hp: Math.floor(def.hp * (1 + n * 0.1)),
        damage: Math.floor(def.damage * (1 + n * 0.06)),
      });
    }
    this.enemiesToSpawn = list;
    this.spawnTimer = 0.15;
  }

  private queueCombatWave(room: RoomNode, waveNum: number) {
    const n = room.id;
    const list: EnemyDef[] = [];
    // Smaller packs per wave; difficulty scales with room id and wave index
    const budget = 3 + n + waveNum;
    const pool = ENEMIES.filter((e) => {
      if (n < 2 && waveNum < 2) return e.tags.includes('basic') || e.tags.includes('swarm') || e.id === 'shooter';
      if (n < 4) return !e.tags.includes('miniboss') && !e.tags.includes('boss');
      return !e.tags.includes('boss');
    });
    for (let i = 0; i < budget; i++) {
      const def = pool[Math.floor(Math.random() * pool.length)] ?? ENEMIES[0];
      list.push({
        ...def,
        hp: Math.floor(def.hp * (1 + (n - 1) * 0.1 + (waveNum - 1) * 0.08)),
        damage: Math.floor(def.damage * (1 + (n - 1) * 0.06 + (waveNum - 1) * 0.05)),
        speed: def.speed * (1 + (n - 1) * 0.02 + (waveNum - 1) * 0.02),
        score: Math.floor(def.score * (1 + (n - 1) * 0.08 + (waveNum - 1) * 0.05)),
      });
      if (def.tags.includes('swarm') && Math.random() < 0.45) {
        list.push({
          ...def,
          hp: Math.floor(def.hp * (1 + (n - 1) * 0.08)),
        });
      }
    }
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
      if (this.enemies.length === 0 && this.enemiesToSpawn.length === 0) {
        if (room.kind === 'combat' && this.roomWave < this.roomWaveTotal) {
          this.startNextWave(room);
        } else {
          this.clearRoom(room);
        }
      }
    }
  }

  private clearRoom(room: RoomNode) {
    room.status = 'cleared';
    this.roomCombatActive = false;
    audio.play('levelup');
    // chest reward on combat clear
    if (room.kind === 'combat') {
      this.spawnChest(
        'chest_street',
        room.bounds.x + room.bounds.w / 2,
        room.bounds.y + room.bounds.h / 2,
        room.id,
      );
    }
    if (room.kind === 'boss') {
      this.spawnChest(
        'chest_boss',
        room.bounds.x + room.bounds.w / 2,
        room.bounds.y + room.bounds.h / 2 - 40,
        room.id,
      );
      setTimeout(() => {
        if (!this.ended && room.status === 'cleared') this.endRun('victory');
      }, 1500);
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
    p.fireCooldown = 1 / w.fireRate;
    const count = w.count + p.countBonus;
    const baseAngle = Math.atan2(dy, dx);
    const half = (count - 1) / 2;
    for (let i = 0; i < count; i++) {
      const spread = (i - half) * w.spread + (Math.random() - 0.5) * w.spread * 0.3;
      const ang = baseAngle + spread;
      const crit = Math.random() < p.critChance;
      const dmg = w.damage * p.damageMult * (crit ? 2 : 1);
      this.projectiles.push({
        id: this.nextId++,
        x: p.x + Math.cos(ang) * 18,
        y: p.y + Math.sin(ang) * 18,
        vx: Math.cos(ang) * w.projectileSpeed,
        vy: Math.sin(ang) * w.projectileSpeed,
        damage: dmg,
        color: crit ? '#ffe14a' : w.color,
        size: w.projectileSize + (crit ? 2 : 0),
        pierce: w.pierce + p.pierceBonus,
        pierced: new Set(),
        life: 1.8,
        owner: 'player',
      });
    }
    audio.play(w.sound);
  }

  private updateProjectiles(dt: number) {
    const next: Projectile[] = [];
    for (const pr of this.projectiles) {
      pr.x += pr.vx * dt;
      pr.y += pr.vy * dt;
      pr.life -= dt;
      if (pr.life <= 0) continue;
      if (pr.x < -100 || pr.y < -100 || pr.x > this.worldW + 100 || pr.y > this.worldH + 100) continue;
      next.push(pr);
    }
    this.projectiles = next;
  }

  private updateEnemies(dt: number) {
    const p = this.player;
    const room = this.rooms.find((r) => r.id === this.currentRoomId);
    for (const e of this.enemies) {
      if (e.spawnAnim > 0) e.spawnAnim -= dt;
      if (e.hitFlash > 0) e.hitFlash -= dt;
      if (e.attackTimer > 0) e.attackTimer -= dt;

      const dx = p.x - e.x;
      const dy = p.y - e.y;
      const dist = Math.hypot(dx, dy) || 1;
      const nx = dx / dist;
      const ny = dy / dist;

      if (e.aiProfile === 'chaser') {
        e.x += nx * e.speed * dt;
        e.y += ny * e.speed * dt;
      } else if (e.aiProfile === 'ranged_kiter') {
        const ideal = e.attackRange * 0.7;
        if (dist < ideal * 0.6) {
          e.x -= nx * e.speed * dt;
          e.y -= ny * e.speed * dt;
        } else if (dist > ideal) {
          e.x += nx * e.speed * 0.7 * dt;
          e.y += ny * e.speed * 0.7 * dt;
        } else {
          e.x += -ny * e.speed * 0.5 * dt;
          e.y += nx * e.speed * 0.5 * dt;
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
        e.x += nx * e.speed * 1.3 * dt;
        e.y += ny * e.speed * 1.3 * dt;
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
          if (e.hp <= 0) this.killEnemy(e);
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
    const gain = Math.floor(e.score * this.comboMultiplier());
    this.score += gain;
    this.goldEarned += Math.max(1, Math.floor(e.score / 8));
    this.grantXp(e.xp);
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

    // Normal enemies: basic loot only. Bosses may still drop weapons.
    if (Math.random() < 0.14 || e.isBoss) {
      this.spawnPickup(e.x, e.y, 'heal', '#39ff88', 20);
    }
    if (Math.random() < 0.12) {
      this.spawnPickup(e.x + 10, e.y, 'score', '#ffe14a', 50);
    }
    if (Math.random() < 0.06 || e.isBoss) {
      this.spawnPickup(e.x - 10, e.y + 8, 'shield', '#00f0ff', 1);
    }
    if (e.isBoss && Math.random() < 0.9) {
      const w = this.pickWeapon(true);
      this.spawnPickup(e.x, e.y - 12, 'weapon', w.color, 0, w.id);
      for (const cb of this.onWeaponDiscoverCbs) cb(w.id);
    }
  }

  private pickWeapon(highTier: boolean): WeaponDef {
    if (highTier) {
      const pool = WEAPONS.filter((w) =>
        ['rare', 'epic', 'legendary'].includes(w.rarity),
      );
      return pool[Math.floor(Math.random() * pool.length)] ?? WEAPONS[0];
    }
    return WEAPONS[Math.floor(Math.random() * WEAPONS.length)];
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

  private applySkillMods(skill: SkillDef) {
    const p = this.player;
    for (const m of skill.mods) {
      if (m.stat === 'damageMult') p.damageMult += m.value;
      if (m.stat === 'speedMult') p.speedMult += m.value;
      if (m.stat === 'pierce') p.pierceBonus += m.value;
      if (m.stat === 'shield') p.shield += m.value;
      if (m.stat === 'critChance') p.critChance += m.value;
      if (m.stat === 'lifesteal') p.lifesteal += m.value;
      if (m.stat === 'maxHp') {
        p.maxHp += m.value;
        p.hp = p.maxHp;
      }
      if (m.stat === 'count') p.countBonus += m.value;
    }
  }

  private spawnPickup(
    x: number,
    y: number,
    kind: PickupEntity['kind'],
    color: string,
    value: number,
    weaponId?: string,
  ) {
    this.pickups.push({
      id: this.nextId++,
      x,
      y,
      kind,
      color,
      value,
      weaponId,
      bob: Math.random() * Math.PI * 2,
      life: 25,
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

    // basic loot from content
    def.basicLoot.forEach((kind, i) => {
      const ox = (i - 1) * 18;
      if (kind === 'heal') this.spawnPickup(chest.x + ox, chest.y + 20, 'heal', '#39ff88', 25);
      if (kind === 'score') this.spawnPickup(chest.x + ox, chest.y + 24, 'score', '#ffe14a', 75);
      if (kind === 'shield') this.spawnPickup(chest.x + ox, chest.y + 28, 'shield', '#00f0ff', 1);
    });

    if (Math.random() < def.weaponChance) {
      const w = this.pickWeapon(def.highTier);
      this.spawnPickup(chest.x, chest.y - 18, 'weapon', w.color, 0, w.id);
      for (const cb of this.onWeaponDiscoverCbs) cb(w.id);
    }
  }

  private updatePickups(dt: number) {
    for (const pk of this.pickups) {
      pk.bob += dt * 3;
      pk.life -= dt;
    }
    this.pickups = this.pickups.filter((pk) => pk.life > 0);
  }

  private handlePickups(input: InputState) {
    const p = this.player;
    this.nearestWeapon = null;
    let bestDist = 48;
    for (const pk of this.pickups) {
      const d = Math.hypot(pk.x - p.x, pk.y - p.y);
      if (pk.kind === 'weapon' && d < bestDist) {
        bestDist = d;
        this.nearestWeapon = pk;
      }
      if (d < 28 && pk.kind !== 'weapon') {
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
      for (const cb of this.onWeaponDiscoverCbs) cb(p.weaponId);
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
    if (this.nearestChest && input.interact) {
      this.openChest(this.nearestChest);
      this.nearestChest = null;
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

    for (const pt of this.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x, pt.y, pt.size, pt.size);
    }
    ctx.globalAlpha = 1;

    ctx.fillStyle = '#ffe14a';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    if (this.nearestChest) {
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
    grd.addColorStop(1, 'rgba(0,0,0,0.45)');
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
      ctx.fillStyle = open ? '#12161f' : '#0b0d12';
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.strokeStyle = open ? 'rgba(255,204,0,0.35)' : 'rgba(80,80,90,0.4)';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x, b.y, b.w, b.h);
      if (open) {
        ctx.strokeStyle = 'rgba(255,204,0,0.25)';
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
      ctx.fillStyle = lit ? '#141722' : '#0c0e14';
      ctx.fillRect(b.x, b.y, b.w, b.h);

      // grid
      if (lit) {
        ctx.strokeStyle = 'rgba(255,204,0,0.07)';
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

      // border by status
      let border = 'rgba(100,100,120,0.4)';
      if (room.status === 'active') border = 'rgba(255,85,0,0.75)';
      else if (room.status === 'cleared') border = 'rgba(57,255,136,0.45)';
      else if (room.kind === 'boss') border = 'rgba(255,43,214,0.5)';
      ctx.strokeStyle = border;
      ctx.lineWidth = 5;
      ctx.strokeRect(b.x + 3, b.y + 3, b.w - 6, b.h - 6);

      // decoration blocks
      if (lit) {
        ctx.fillStyle = '#1a1e2e';
        const blocks = [
          [b.x + 40, b.y + 40, 90, 60],
          [b.x + b.w - 140, b.y + 40, 100, 70],
          [b.x + 40, b.y + b.h - 110, 110, 70],
          [b.x + b.w - 150, b.y + b.h - 120, 100, 80],
        ];
        for (const [bx, by, bw, bh] of blocks) {
          ctx.fillRect(bx, by, bw, bh);
          ctx.strokeStyle = 'rgba(0,200,255,0.12)';
          ctx.lineWidth = 2;
          ctx.strokeRect(bx, by, bw, bh);
        }
      }

      // label
      if (lit) {
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

export type { CharacterDef, WeaponDef, ChestDef };
