import { DEFAULT_STORED_DIRS, MIRROR, dirFromVector, resolveDirection } from './direction';
import type {
  ActorDrawOptions,
  AnimMeta,
  AnimName,
  Dir8,
  EffectSpriteMeta,
  ObjectSpriteMeta,
  ProjectileSpriteMeta,
  SpriteManifest,
  SpriteSetMeta,
  WeaponSpriteMeta,
} from './types';

/**
 * SpriteAtlas — carga y dibujo de sprites pixel art.
 *
 * Diseño:
 *  - Todo es opcional: cada método `draw*` devuelve `false` si no hay sprite
 *    para esa entidad y el motor dibuja entonces su primitiva original.
 *  - Solo dibuja: no toca posiciones, colisiones ni estadísticas. El estado de
 *    animación se deduce de lo que el motor ya calcula (posición, vida, dash).
 *  - Píxeles nítidos: sin suavizado y con la posición de los pies encajada a la
 *    rejilla de píxeles del dispositivo.
 */

const MOVE_GRACE_SECONDS = 0.12;

const ANIM_FALLBACK: Record<AnimName, AnimName[]> = {
  idle: [],
  walk: ['idle'],
  roll: ['walk', 'idle'],
  hurt: ['idle'],
  death: ['hurt', 'idle'],
};

interface Clip {
  img: HTMLImageElement;
  fw: number;
  fh: number;
  frames: number;
}

interface LoadedSet {
  meta: SpriteSetMeta;
  clips: Map<string, Clip>; // `${anim}:${dir}`
  dirsByAnim: Map<AnimName, Dir8[]>;
}

interface LoadedStrip<M> {
  meta: M;
  img: HTMLImageElement;
  fw: number;
  fh: number;
  frames: number;
}

interface ActorState {
  anim: AnimName;
  animStart: number;
  lastX: number;
  lastY: number;
  lastMove: number;
  lastHp: number;
  hurtUntil: number;
  dir: Dir8;
}

interface LiveEffect {
  fx: LoadedStrip<EffectSpriteMeta>;
  x: number;
  y: number;
  start: number;
}

function loadImage(url: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = url;
  });
}

export class SpriteAtlas {
  private characters = new Map<string, LoadedSet>();
  private enemies = new Map<string, LoadedSet>();
  private weapons = new Map<string, LoadedStrip<WeaponSpriteMeta>>();
  private projectiles = new Map<string, LoadedStrip<ProjectileSpriteMeta>>();
  private effects = new Map<string, LoadedStrip<EffectSpriteMeta>>();
  private objects = new Map<string, LoadedStrip<ObjectSpriteMeta>>();
  private portraits = new Map<string, { portrait?: string; icon?: string }>();
  private actors = new WeakMap<object, ActorState>();
  private live: LiveEffect[] = [];
  private scratch: HTMLCanvasElement | null = null;
  private loading: Promise<void> | null = null;
  private baseUrl = '';
  private problems: string[] = [];

  /** Carga el manifiesto y todos los recursos declarados. Nunca rechaza: ante cualquier fallo el juego usa el fallback. */
  load(baseUrl = `${import.meta.env.BASE_URL}assets/sprites/`): Promise<void> {
    if (!this.loading) this.loading = this.doLoad(baseUrl);
    return this.loading;
  }

  private async doLoad(base: string): Promise<void> {
    this.baseUrl = base;
    let manifest: SpriteManifest;
    try {
      const res = await fetch(`${base}manifest.json`, { cache: 'no-cache' });
      if (!res.ok) return;
      manifest = (await res.json()) as SpriteManifest;
    } catch {
      return; // sin manifiesto (o no es JSON): modo fallback completo
    }
    if (!manifest || manifest.version !== 1) return;

    const jobs: Promise<void>[] = [];
    for (const [id, meta] of Object.entries(manifest.characters ?? {})) {
      jobs.push(this.loadSet(base, 'character', id, meta).then((s) => void (s && this.characters.set(id, s))));
    }
    for (const [id, meta] of Object.entries(manifest.enemies ?? {})) {
      jobs.push(this.loadSet(base, 'enemy', id, meta).then((s) => void (s && this.enemies.set(id, s))));
    }
    for (const [id, meta] of Object.entries(manifest.weapons ?? {})) {
      jobs.push(this.loadStrip(base, `weapon ${id}`, meta.image, meta.frames ?? 1, meta, this.weapons, id));
    }
    for (const [id, meta] of Object.entries(manifest.projectiles ?? {})) {
      jobs.push(this.loadStrip(base, `projectile ${id}`, meta.image, meta.frames ?? 1, meta, this.projectiles, id));
    }
    for (const [id, meta] of Object.entries(manifest.effects ?? {})) {
      jobs.push(this.loadStrip(base, `effect ${id}`, meta.image, meta.frames, meta, this.effects, id));
    }
    for (const [id, meta] of Object.entries(manifest.objects ?? {})) {
      jobs.push(this.loadStrip(base, `object ${id}`, meta.image, meta.frames ?? 1, meta, this.objects, id));
    }
    for (const [id, p] of Object.entries(manifest.portraits ?? {})) {
      jobs.push(this.loadPortrait(base, id, p));
    }
    await Promise.all(
      jobs.map((j) => j.catch((err) => void this.problems.push(`manifiesto con entrada inválida: ${String(err)}`))),
    );
    if (this.problems.length) {
      console.warn(`[sprites] ${this.problems.length} recurso(s) declarado(s) no utilizable(s):\n- ${this.problems.join('\n- ')}`);
    }
  }

  private async loadSet(base: string, kind: string, id: string, meta: SpriteSetMeta): Promise<LoadedSet | null> {
    const stored = meta.directions ?? [...DEFAULT_STORED_DIRS];
    const set: LoadedSet = { meta, clips: new Map(), dirsByAnim: new Map() };
    const jobs: Promise<void>[] = [];
    for (const [animKey, am] of Object.entries(meta.animations ?? {}) as [AnimName, AnimMeta][]) {
      for (const dir of stored) {
        const url = base + meta.clip.replace('{anim}', animKey).replace('{dir}', dir);
        jobs.push(
          loadImage(url).then((img) => {
            if (!img) return void this.problems.push(`${kind} ${id}: falta ${url}`);
            if (!Number.isInteger(am.frames) || am.frames < 1 || img.width % am.frames !== 0) {
              return void this.problems.push(
                `${kind} ${id}: ${url} mide ${img.width}px y no es divisible entre ${am.frames} frames`,
              );
            }
            set.clips.set(`${animKey}:${dir}`, { img, fw: img.width / am.frames, fh: img.height, frames: am.frames });
            const dirs = set.dirsByAnim.get(animKey) ?? [];
            dirs.push(dir);
            set.dirsByAnim.set(animKey, dirs);
          }),
        );
      }
    }
    await Promise.all(jobs);
    if (!set.dirsByAnim.get('idle')?.length) {
      this.problems.push(`${kind} ${id}: sin animación idle utilizable; se usará el fallback vectorial`);
      return null;
    }
    return set;
  }

  private async loadStrip<M>(
    base: string,
    label: string,
    image: string,
    frames: number,
    meta: M,
    into: Map<string, LoadedStrip<M>>,
    id: string,
  ): Promise<void> {
    const url = base + image;
    const img = await loadImage(url);
    if (!img) return void this.problems.push(`${label}: falta ${url}`);
    if (!Number.isInteger(frames) || frames < 1 || img.width % frames !== 0) {
      return void this.problems.push(`${label}: ${url} mide ${img.width}px y no es divisible entre ${frames} frames`);
    }
    into.set(id, { meta, img, fw: img.width / frames, fh: img.height, frames });
  }

  private async loadPortrait(base: string, id: string, p: { portrait?: string; icon?: string }) {
    const out: { portrait?: string; icon?: string } = {};
    for (const key of ['portrait', 'icon'] as const) {
      const rel = p[key];
      if (!rel) continue;
      const url = base + rel;
      if (await loadImage(url)) out[key] = url;
      else this.problems.push(`portrait ${id}: falta ${url}`);
    }
    if (out.portrait || out.icon) this.portraits.set(id, out);
  }

  // ───────────────────────── consultas ─────────────────────────

  hasCharacter(id: string) {
    return this.characters.has(id);
  }
  hasEnemy(id: string) {
    return this.enemies.has(id);
  }
  getPortraitUrl(id: string): string | null {
    return this.portraits.get(id)?.portrait ?? null;
  }
  getIconUrl(id: string): string | null {
    return this.portraits.get(id)?.icon ?? null;
  }
  stats() {
    return {
      characters: [...this.characters.keys()],
      enemies: [...this.enemies.keys()],
      weapons: [...this.weapons.keys()],
      projectiles: [...this.projectiles.keys()],
      effects: [...this.effects.keys()],
      objects: [...this.objects.keys()],
      portraits: [...this.portraits.keys()],
      problems: [...this.problems],
    };
  }

  // ───────────────────────── actores ─────────────────────────

  drawCharacter(ctx: CanvasRenderingContext2D, characterId: string, actor: object, x: number, y: number, o: ActorDrawOptions) {
    const set = this.characters.get(characterId);
    return set ? this.drawActor(ctx, set, actor, x, y, o) : false;
  }

  drawEnemy(ctx: CanvasRenderingContext2D, defId: string, actor: object, x: number, y: number, o: ActorDrawOptions) {
    const set = this.enemies.get(defId);
    return set ? this.drawActor(ctx, set, actor, x, y, o) : false;
  }

  private track(set: LoadedSet, key: object, x: number, y: number, o: ActorDrawOptions): ActorState {
    const now = o.now;
    let s = this.actors.get(key);
    if (s && (now < s.animStart || now < s.lastMove)) {
      // El reloj de mundo se reinició (nueva partida): descartar estado de animación obsoleto.
      s = undefined;
    }
    if (!s) {
      s = { anim: 'idle', animStart: now, lastX: x, lastY: y, lastMove: -1e9, lastHp: o.hp, hurtUntil: -1e9, dir: 'down' };
      this.actors.set(key, s);
    }
    // `now` es tiempo de mundo (paso fijo): varios renders entre dos updates ven la misma posición.
    if (Math.abs(x - s.lastX) + Math.abs(y - s.lastY) > 0.01) s.lastMove = now;
    s.lastX = x;
    s.lastY = y;

    if (o.hp < s.lastHp - 1e-6) {
      const h = set.meta.animations.hurt;
      s.hurtUntil = now + (h ? h.frames / h.fps : 0);
    }
    s.lastHp = o.hp;

    s.dir = dirFromVector(o.faceX, o.faceY, s.dir);

    let next: AnimName = 'idle';
    if (o.dead) next = 'death';
    else if (o.rolling) next = 'roll';
    else if (now < s.hurtUntil) next = 'hurt';
    else if (now - s.lastMove < MOVE_GRACE_SECONDS) next = 'walk';
    if (next !== s.anim) {
      s.anim = next;
      s.animStart = now;
    }
    return s;
  }

  private pickClip(set: LoadedSet, anim: AnimName, dir: Dir8) {
    const chain = ANIM_FALLBACK[anim];
    for (let i = -1; i < chain.length; i++) {
      const a = i < 0 ? anim : chain[i];
      const dirs = set.dirsByAnim.get(a);
      if (!dirs?.length) continue;
      const r = resolveDirection(dir, dirs, set.meta.mirror !== false);
      const clip = set.clips.get(`${a}:${r.dir}`);
      if (clip) return { anim: a, clip, flip: r.flip };
    }
    return null;
  }

  private drawActor(ctx: CanvasRenderingContext2D, set: LoadedSet, actor: object, x: number, y: number, o: ActorDrawOptions): boolean {
    const st = this.track(set, actor, o.trackX ?? x, o.trackY ?? y, o);
    const pick = this.pickClip(set, st.anim, st.dir);
    if (!pick) return false;

    const { meta } = set;
    const ps = meta.pixelScale ?? 2;
    const am = meta.animations[pick.anim] as AnimMeta;
    const loop = am.loop ?? pick.anim !== 'death';
    let frame = Math.floor(Math.max(0, o.now - st.animStart) * am.fps);
    frame = loop ? frame % pick.clip.frames : Math.min(frame, pick.clip.frames - 1);

    const feetOffset = meta.footOffset ?? o.footOffset ?? 14;
    const feet = this.snap(ctx, x, y + feetOffset);

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha *= o.alpha ?? 1;
    ctx.translate(feet.x, feet.y);

    if (meta.shadow !== false) this.drawShadow(ctx, meta.shadow ?? { w: 14, h: 6 }, ps);

    const socket = o.weaponId !== undefined ? this.socketFor(meta, st.dir, pick.clip.fh) : null;
    const weapon = o.weaponId !== undefined ? this.weapons.get(o.weaponId) : undefined;
    if (weapon && socket?.behind) this.drawWeapon(ctx, weapon, socket, meta, o.aimAngle ?? 0);

    const ax = Math.round((meta.anchor?.x ?? 0.5) * pick.clip.fw);
    const ay = Math.round((meta.anchor?.y ?? 1) * pick.clip.fh);
    ctx.save();
    if (pick.flip) ctx.scale(-1, 1);
    this.blit(ctx, pick.clip, frame, -ax * ps, -ay * ps, ps, !!o.flash);
    ctx.restore();

    if (weapon && socket && !socket.behind) this.drawWeapon(ctx, weapon, socket, meta, o.aimAngle ?? 0);
    ctx.restore();
    return true;
  }

  private socketFor(meta: SpriteSetMeta, dir: Dir8, frameH: number) {
    const direct = meta.weaponSocket?.[dir];
    if (direct) return { x: direct.x, y: direct.y, behind: !!direct.behind };
    const partner = meta.weaponSocket?.[MIRROR[dir]];
    if (partner) return { x: -partner.x, y: partner.y, behind: !!partner.behind };
    return { x: 0, y: -Math.round(frameH * 0.4), behind: dir.startsWith('up') };
  }

  private drawWeapon(
    ctx: CanvasRenderingContext2D,
    w: LoadedStrip<WeaponSpriteMeta>,
    socket: { x: number; y: number },
    actor: SpriteSetMeta,
    angle: number,
  ) {
    const ps = w.meta.pixelScale ?? actor.pixelScale ?? 2;
    ctx.save();
    ctx.translate(socket.x * (actor.pixelScale ?? 2), socket.y * (actor.pixelScale ?? 2));
    ctx.rotate(angle);
    if (Math.abs(angle) > Math.PI / 2) ctx.scale(1, -1); // mantener el arma "boca arriba" al apuntar a la izquierda
    const frame = w.frames > 1 ? Math.floor(performance.now() / 1000 * (w.meta.fps ?? 8)) % w.frames : 0;
    ctx.drawImage(w.img, frame * w.fw, 0, w.fw, w.fh, -w.meta.grip.x * ps, -w.meta.grip.y * ps, w.fw * ps, w.fh * ps);
    ctx.restore();
  }

  private drawShadow(ctx: CanvasRenderingContext2D, sh: { w: number; h: number }, ps: number) {
    const row = Math.max(1, Math.round(sh.h / 3)) * ps;
    const wide = Math.round(sh.w) * ps;
    const narrow = Math.round(sh.w * 0.6) * ps;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-Math.round(narrow / 2), -row * 2, narrow, row);
    ctx.fillRect(-Math.round(wide / 2), -row, wide, row);
    ctx.fillRect(-Math.round(narrow / 2), 0, narrow, row);
  }

  // ───────────────────────── proyectiles y efectos ─────────────────────────

  drawProjectile(ctx: CanvasRenderingContext2D, key: string | undefined, x: number, y: number, angle: number, now: number): boolean {
    const p = key ? this.projectiles.get(key) : undefined;
    if (!p) return false;
    const ps = p.meta.pixelScale ?? 2;
    const frame = p.frames > 1 ? Math.floor(now * (p.meta.fps ?? 12)) % p.frames : 0;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(x, y);
    if (p.meta.rotate !== false) ctx.rotate(angle);
    ctx.drawImage(p.img, frame * p.fw, 0, p.fw, p.fh, -(p.fw * ps) / 2, -(p.fh * ps) / 2, p.fw * ps, p.fh * ps);
    ctx.restore();
    return true;
  }

  /** URL de la imagen de un objeto del mundo (para usarla desde la interfaz), o null si no está declarado. */
  getObjectUrl(key: string): string | null {
    const o = this.objects.get(key);
    return o ? this.baseUrl + o.meta.image : null;
  }

  hasWeapon(id: string): boolean {
    return this.weapons.has(id);
  }

  /**
   * Arma en mano cuando el personaje se dibuja con su forma vectorial (aún sin sprite de personaje).
   * Se coloca para que su boca quede ~20 px por delante del centro, cerca del punto donde nacen las balas (18 px).
   */
  drawHeldWeapon(ctx: CanvasRenderingContext2D, weaponId: string, x: number, y: number, angle: number, alpha = 1): boolean {
    const w = this.weapons.get(weaponId);
    if (!w) return false;
    const ps = w.meta.pixelScale ?? 2;
    const hold = Math.max(-4, Math.min(8, 20 - (w.meta.muzzle ?? 8) * ps));
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.globalAlpha *= alpha;
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.translate(hold, 0);
    if (Math.abs(angle) > Math.PI / 2) ctx.scale(1, -1); // boca arriba al apuntar a la izquierda
    ctx.drawImage(w.img, 0, 0, w.fw, w.fh, -w.meta.grip.x * ps, -w.meta.grip.y * ps, w.fw * ps, w.fh * ps);
    ctx.restore();
    return true;
  }

  /** Icono del arma (mirando a la derecha) centrado en (x, y): para armas en el suelo. */
  drawWeaponIcon(ctx: CanvasRenderingContext2D, weaponId: string, x: number, y: number): boolean {
    const w = this.weapons.get(weaponId);
    if (!w) return false;
    const ps = w.meta.pixelScale ?? 2;
    const p = this.snap(ctx, x, y);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(w.img, 0, 0, w.fw, w.fh, p.x - Math.round(w.fw / 2) * ps, p.y - Math.round(w.fh / 2) * ps, w.fw * ps, w.fh * ps);
    ctx.restore();
    return true;
  }

  hasObject(key: string): boolean {
    return this.objects.has(key);
  }

  /**
   * Base plana del color indicado bajo un pickup (elipse escalonada, sin desenfoque).
   * Conserva la información de rareza que antes daba el brillo de color del círculo.
   */
  drawGroundPad(ctx: CanvasRenderingContext2D, x: number, y: number, color: string) {
    const p = this.snap(ctx, x, y);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.32;
    ctx.fillRect(-12, -3, 24, 2);
    ctx.fillRect(-16, -1, 32, 2);
    ctx.fillRect(-12, 1, 24, 2);
    ctx.globalAlpha = 0.6;
    ctx.fillRect(-6, -2, 12, 2);
    ctx.fillRect(-10, 0, 20, 2);
    ctx.restore();
  }

  /**
   * Dibuja un objeto del mundo (cofre, portal…). Devuelve false si no hay sprite y el motor usa su primitiva.
   * (x, y) es el punto donde se ancla el frame (por defecto, centro-abajo).
   */
  drawObject(ctx: CanvasRenderingContext2D, key: string, x: number, y: number, now: number): boolean {
    const o = this.objects.get(key);
    if (!o) return false;
    const ps = o.meta.pixelScale ?? 2;
    const a = o.meta.anchor ?? { x: 0.5, y: 1 };
    const fps = o.meta.fps ?? 8;
    const frame = o.frames > 1 ? Math.floor(Math.max(0, now) * fps) % o.frames : 0;
    const p = this.snap(ctx, x, y);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(p.x, p.y);
    if (o.meta.shadow) this.drawShadow(ctx, o.meta.shadow, ps);
    ctx.drawImage(
      o.img, frame * o.fw, 0, o.fw, o.fh,
      -Math.round(a.x * o.fw) * ps, -Math.round(a.y * o.fh) * ps, o.fw * ps, o.fh * ps,
    );
    ctx.restore();
    return true;
  }

  /** Lanza un efecto de una sola reproducción (explosión, impacto…). No hace nada si no hay sprite. */
  spawnEffect(name: string, x: number, y: number, now: number) {
    const fx = this.effects.get(name);
    if (fx) this.live.push({ fx, x, y, start: now });
  }

  drawEffects(ctx: CanvasRenderingContext2D, now: number) {
    if (!this.live.length) return;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    this.live = this.live.filter((e) => {
      const frame = Math.floor(Math.max(0, now - e.start) * e.fx.meta.fps);
      if (now < e.start || frame >= e.fx.frames) return false; // terminó, o el reloj de mundo se reinició
      const ps = e.fx.meta.pixelScale ?? 2;
      const a = e.fx.meta.anchor ?? { x: 0.5, y: 0.5 };
      const p = this.snap(ctx, e.x, e.y);
      ctx.drawImage(
        e.fx.img, frame * e.fx.fw, 0, e.fx.fw, e.fx.fh,
        p.x - Math.round(a.x * e.fx.fw) * ps, p.y - Math.round(a.y * e.fx.fh) * ps, e.fx.fw * ps, e.fx.fh * ps,
      );
      return true;
    });
    ctx.restore();
  }

  // ───────────────────────── utilidades ─────────────────────────

  /** Encaja un punto (coords locales actuales) a la rejilla de píxeles del dispositivo. */
  private snap(ctx: CanvasRenderingContext2D, x: number, y: number) {
    const m = ctx.getTransform();
    if (!m.a || !m.d) return { x, y };
    return {
      x: (Math.round(m.a * x + m.e) - m.e) / m.a,
      y: (Math.round(m.d * y + m.f) - m.f) / m.d,
    };
  }

  private blit(ctx: CanvasRenderingContext2D, c: Clip, frame: number, dx: number, dy: number, ps: number, flash: boolean) {
    const sx = frame * c.fw;
    if (!flash) {
      ctx.drawImage(c.img, sx, 0, c.fw, c.fh, dx, dy, c.fw * ps, c.fh * ps);
      return;
    }
    // Destello blanco conservando la silueta (source-atop sobre un lienzo auxiliar).
    const cv = (this.scratch ??= document.createElement('canvas'));
    if (cv.width < c.fw) cv.width = c.fw;
    if (cv.height < c.fh) cv.height = c.fh;
    const sc = cv.getContext('2d') as CanvasRenderingContext2D;
    sc.clearRect(0, 0, cv.width, cv.height);
    sc.globalCompositeOperation = 'source-over';
    sc.drawImage(c.img, sx, 0, c.fw, c.fh, 0, 0, c.fw, c.fh);
    sc.globalCompositeOperation = 'source-atop';
    sc.fillStyle = '#ffffff';
    sc.fillRect(0, 0, c.fw, c.fh);
    ctx.drawImage(cv, 0, 0, c.fw, c.fh, dx, dy, c.fw * ps, c.fh * ps);
  }
}

export const spriteAtlas = new SpriteAtlas();
