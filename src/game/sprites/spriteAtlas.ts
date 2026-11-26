import { DEFAULT_STORED_DIRS, MIRROR, dirFromVector, resolveDirection } from './direction';
import type {
  ActorDrawOptions,
  AnimMeta,
  AnimName,
  Dir8,
  EffectSpriteMeta,
  ObjectSpriteMeta,
  PortraitMeta,
  ProjectileSpriteMeta,
  ShoreDir,
  SpriteManifest,
  SpriteSetMeta,
  WeaponSpriteMeta,
  WorldPropMeta,
  WorldSpriteMeta,
} from './types';

/**
 * SpriteAtlas — carga y dibujo de sprites pixel art (actores, objetos,
 * armas, proyectiles, efectos de Fase 5 y mundos de Fase 6).
 *
 * Todo es opcional: cada método `draw*` devuelve `false` si no hay sprite
 * para esa entidad y el motor dibuja entonces su primitiva original.
 */

const MOVE_GRACE_SECONDS = 0.12;
const ARC_DURATION_SECONDS = 0.2;

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
  clips: Map<string, Clip>;
  dirsByAnim: Map<AnimName, Dir8[]>;
}

interface LoadedStrip<M> {
  meta: M;
  img: HTMLImageElement;
  fw: number;
  fh: number;
  frames: number;
}

interface LoadedWorldProp {
  img: HTMLImageElement;
  fx: number;
  fy: number;
}

interface LoadedWorld {
  ps: number;
  tile: number;
  mx: number;
  my: number;
  main: HTMLImageElement[];
  worn: HTMLImageElement[];
  detail: HTMLImageElement[];
  sea: HTMLImageElement[];
  shore: Record<ShoreDir, HTMLImageElement>;
  bridge?: {
    ew: HTMLImageElement[];
    ns: HTMLImageElement[];
    railN: HTMLImageElement;
    railW: HTMLImageElement;
    railE: HTMLImageElement;
    fascia: HTMLImageElement;
    pile: HTMLImageElement;
    gateH: HTMLImageElement;
    gateV: HTMLImageElement;
  };
  cornerTop: LoadedWorldProp[];
  cornerBottom: LoadedWorldProp[];
  edge: LoadedWorldProp[];
}

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
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
  angle?: number;
}

interface LiveArc {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  start: number;
  seed: number;
}

function hash2d(a: number, b: number): number {
  let h = Math.imul(a | 0, 374761393) ^ Math.imul(b | 0, 668265263);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function pickTile<T>(list: readonly T[], r: number): T {
  return list[Math.min(list.length - 1, Math.floor(r * list.length))];
}

function overlapsAny(box: Rect, obstacles: readonly Rect[]): boolean {
  for (const o of obstacles) {
    if (box.x < o.x + o.w - 0.5 && box.x + box.w > o.x + 0.5 && box.y < o.y + o.h - 0.5 && box.y + box.h > o.y + 0.5) {
      return true;
    }
  }
  return false;
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
  private worlds = new Map<string, LoadedWorld>();
  private portraits = new Map<string, { portrait?: string; icon?: string }>();
  private portraitIdles = new Map<string, LoadedStrip<AnimMeta>>();
  private actors = new WeakMap<object, ActorState>();
  private live: LiveEffect[] = [];
  private arcs: LiveArc[] = [];
  private arcSeed = 1;
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
      return;
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
      if (p.idle) jobs.push(this.loadStrip(base, `portrait idle ${id}`, p.idle.image, p.idle.frames, p.idle, this.portraitIdles, id));
    }
    for (const [id, meta] of Object.entries(manifest.worlds ?? {})) {
      jobs.push(this.loadWorld(base, id, meta));
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
      for (const dir of am.directions ?? stored) {
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

  private async loadPortrait(base: string, id: string, p: PortraitMeta) {
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

  private async loadWorld(base: string, id: string, meta: WorldSpriteMeta) {
    const tile = meta.tile ?? 32;
    const ps = meta.pixelScale ?? 2;
    const loadOne = async (rel: string, checkTile = false): Promise<HTMLImageElement> => {
      const img = await loadImage(base + rel);
      if (!img) throw new Error(`world ${id}: falta ${base + rel}`);
      if (checkTile && (img.width !== tile || img.height !== tile)) {
        throw new Error(`world ${id}: ${rel} debe medir ${tile}×${tile} y mide ${img.width}×${img.height}`);
      }
      return img;
    };
    const loadList = (list?: string[], checkTile = false) =>
      Promise.all((list ?? []).map((rel) => loadOne(rel, checkTile)));
    const loadProps = (list?: WorldPropMeta[]) =>
      Promise.all((list ?? []).map(async (p) => ({ img: await loadOne(p.image), fx: p.foot[0], fy: p.foot[1] })));

    const [main, worn, detail, sea] = await Promise.all([
      loadList(meta.floor?.main, true),
      loadList(meta.floor?.worn, true),
      loadList(meta.floor?.detail, true),
      loadList(meta.sea, true),
    ]);
    if (!main.length || !sea.length) throw new Error(`world ${id}: faltan suelos o mar`);

    const shoreKeys: ShoreDir[] = ['n', 'e', 's', 'w', 'nw', 'ne', 'sw', 'se'];
    const shoreImgs = await Promise.all(shoreKeys.map((k) => loadOne(meta.shore[k], true)));
    const shore = {} as Record<ShoreDir, HTMLImageElement>;
    shoreKeys.forEach((k, idx) => { shore[k] = shoreImgs[idx]; });

    let bridge: LoadedWorld['bridge'];
    if (meta.bridge) {
      const b = meta.bridge;
      const [ew, ns, railN, railW, railE, fascia, pile, gateH, gateV] = await Promise.all([
        loadList(b.ew, true),
        loadList(b.ns, true),
        loadOne(b.railN),
        loadOne(b.railW),
        loadOne(b.railE),
        loadOne(b.fascia),
        loadOne(b.pile),
        loadOne(b.gateH),
        loadOne(b.gateV),
      ]);
      if (!ew.length || !ns.length) throw new Error(`world ${id}: faltan tablones del puente`);
      bridge = { ew, ns, railN, railW, railE, fascia, pile, gateH, gateV };
    }

    const [cornerTop, cornerBottom, edge] = await Promise.all([
      loadProps(meta.props?.cornerTop),
      loadProps(meta.props?.cornerBottom),
      loadProps(meta.props?.edge),
    ]);

    this.worlds.set(id, {
      ps,
      tile,
      mx: meta.islandMargin.x * ps,
      my: meta.islandMargin.y * ps,
      main,
      worn,
      detail,
      sea,
      shore,
      bridge,
      cornerTop,
      cornerBottom,
      edge,
    });
  }

  // ───────────────────────── consultas ─────────────────────────

  hasCharacter(id: string) { return this.characters.has(id); }
  hasEnemy(id: string) { return this.enemies.has(id); }
  getPortraitUrl(id: string): string | null { return this.portraits.get(id)?.portrait ?? null; }
  getIconUrl(id: string): string | null { return this.portraits.get(id)?.icon ?? null; }
  getPortraitIdle(id: string) {
    const preview = this.portraitIdles.get(id);
    if (preview) return { url: preview.img.src, frames: preview.frames, fps: preview.meta.fps };
    const actor = this.characters.get(id);
    const idle = actor && this.pickClip(actor, 'idle', 'down');
    if (!actor || !idle) return null;
    return { url: idle.clip.img.src, frames: idle.clip.frames, fps: actor.meta.animations.idle?.fps ?? 6 };
  }
  hasWorld(id: string): boolean { return this.worlds.has(id); }

  worldIslandRect(id: string, bounds: Rect): Rect | null {
    const w = this.worlds.get(id);
    return w ? { x: bounds.x - w.mx, y: bounds.y - w.my, w: bounds.w + 2 * w.mx, h: bounds.h + 2 * w.my } : null;
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
      worlds: [...this.worlds.keys()],
      problems: [...this.problems],
      liveEffects: this.live.map((e) => e.fx.meta.image),
      liveArcs: this.arcs.length,
    };
  }

  // ───────────────────────── mundos (Fase 6) ─────────────────────────

  private visible(ctx: CanvasRenderingContext2D) {
    const m = ctx.getTransform();
    if (!m.a || !m.d) return { x0: -1e9, x1: 1e9, y0: -1e9, y1: 1e9 };
    return {
      x0: -m.e / m.a,
      x1: (ctx.canvas.width - m.e) / m.a,
      y0: -m.f / m.d,
      y1: (ctx.canvas.height - m.f) / m.d,
    };
  }

  private snapRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): Rect {
    const m = ctx.getTransform();
    if (!m.a || !m.d) return { x, y, w, h };
    const x0 = Math.round(m.a * x + m.e);
    const x1 = Math.round(m.a * (x + w) + m.e);
    const y0 = Math.round(m.d * y + m.f);
    const y1 = Math.round(m.d * (y + h) + m.f);
    return {
      x: (x0 - m.e) / m.a,
      y: (y0 - m.f) / m.d,
      w: (x1 - x0) / m.a,
      h: (y1 - y0) / m.d,
    };
  }

  drawWorldSea(ctx: CanvasRenderingContext2D, worldId: string): boolean {
    const w = this.worlds.get(worldId);
    if (!w) return false;
    const step = w.tile * w.ps;
    const vis = this.visible(ctx);
    const c0 = Math.floor(vis.x0 / step);
    const c1 = Math.floor(vis.x1 / step);
    const r0 = Math.floor(vis.y0 / step);
    const r1 = Math.floor(vis.y1 / step);
    if ((c1 - c0 + 1) * (r1 - r0 + 1) > 4000) return false;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (let ry = r0; ry <= r1; ry++) {
      for (let cx = c0; cx <= c1; cx++) {
        const sr = this.snapRect(ctx, cx * step, ry * step, step, step);
        ctx.drawImage(pickTile(w.sea, hash2d(cx * 7 + 1, ry * 13 + 5)), 0, 0, w.tile, w.tile, sr.x, sr.y, sr.w, sr.h);
      }
    }
    ctx.restore();
    return true;
  }

  drawWorldIsland(ctx: CanvasRenderingContext2D, worldId: string, bounds: Rect, roomId: number): boolean {
    const w = this.worlds.get(worldId);
    const rect = w && this.worldIslandRect(worldId, bounds);
    if (!w || !rect) return false;
    const step = w.tile * w.ps;
    const cols = Math.round(rect.w / step);
    const rows = Math.round(rect.h / step);
    if (Math.abs(cols * step - rect.w) > 0.5 || Math.abs(rows * step - rect.h) > 0.5 || cols < 3 || rows < 3) {
      return false;
    }
    const vis = this.visible(ctx);
    if (rect.x > vis.x1 || rect.x + rect.w < vis.x0 || rect.y > vis.y1 || rect.y + rect.h < vis.y0) return true;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tx = rect.x + c * step;
        const ty = rect.y + r * step;
        if (tx > vis.x1 || tx + step < vis.x0 || ty > vis.y1 || ty + step < vis.y0) continue;
        const n = r === 0;
        const s = r === rows - 1;
        const west = c === 0;
        const e = c === cols - 1;
        let tileImg: HTMLImageElement;
        if (n || s || west || e) {
          const sk = `${n ? 'n' : s ? 's' : ''}${west ? 'w' : e ? 'e' : ''}` as ShoreDir;
          tileImg = w.shore[sk];
        } else {
          const p = hash2d(roomId * 977 + c * 31, r * 57 + 11);
          const v = hash2d(c * 3 + roomId, r * 5 + 7);
          tileImg = p < 0.12 && w.detail.length
            ? pickTile(w.detail, v)
            : p < 0.24 && w.worn.length
              ? pickTile(w.worn, v)
              : pickTile(w.main, v);
        }
        const sr = this.snapRect(ctx, tx, ty, step, step);
        ctx.drawImage(tileImg, 0, 0, w.tile, w.tile, sr.x, sr.y, sr.w, sr.h);
      }
    }
    ctx.restore();
    return true;
  }

  drawWorldProps(ctx: CanvasRenderingContext2D, worldId: string, bounds: Rect, roomId: number) {
    const w = this.worlds.get(worldId);
    if (!w) return;
    const vis = this.visible(ctx);
    if (bounds.x > vis.x1 + 200 || bounds.x + bounds.w < vis.x0 - 200 || bounds.y > vis.y1 + 300 || bounds.y + bounds.h < vis.y0 - 200) {
      return;
    }
    const anchors: Array<[LoadedWorldProp[], number, number, number]> = [
      [w.cornerTop, bounds.x + 92, bounds.y + 150, 1],
      [w.cornerTop, bounds.x + bounds.w - 92, bounds.y + 150, 2],
      [w.cornerBottom, bounds.x + 96, bounds.y + bounds.h - 56, 3],
      [w.cornerBottom, bounds.x + bounds.w - 96, bounds.y + bounds.h - 56, 4],
      [w.edge, bounds.x + bounds.w * 0.28, bounds.y + 54, 5],
      [w.edge, bounds.x + bounds.w * 0.72, bounds.y + 54, 6],
      [w.edge, bounds.x + bounds.w * 0.28, bounds.y + bounds.h - 40, 7],
      [w.edge, bounds.x + bounds.w * 0.72, bounds.y + bounds.h - 40, 8],
    ];
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    for (const [pool, ax, ay, idx] of anchors) {
      if (!pool.length) continue;
      const prop = pickTile(pool, hash2d(roomId * 131 + idx, idx * 17 + 3));
      const sr = this.snapRect(ctx, ax - prop.fx * w.ps, ay - prop.fy * w.ps, prop.img.width * w.ps, prop.img.height * w.ps);
      ctx.drawImage(prop.img, 0, 0, prop.img.width, prop.img.height, sr.x, sr.y, sr.w, sr.h);
    }
    ctx.restore();
  }

  drawWorldBridge(ctx: CanvasRenderingContext2D, worldId: string, bounds: Rect, obstacles: readonly Rect[]): boolean {
    const w = this.worlds.get(worldId);
    const br = w?.bridge;
    if (!w || !br) return false;
    const ps = w.ps;
    const step = w.tile * ps;
    const vert = bounds.h > bounds.w;
    const vis = this.visible(ctx);
    if (bounds.x > vis.x1 + 200 || bounds.x + bounds.w < vis.x0 - 200 || bounds.y > vis.y1 + 200 || bounds.y + bounds.h < vis.y0 - 200) {
      return true;
    }
    const drawPiece = (img: HTMLImageElement, dx: number, dy: number, sw: number, sh: number) => {
      const sr = this.snapRect(ctx, dx, dy, sw * ps, sh * ps);
      ctx.drawImage(img, 0, 0, sw, sh, sr.x, sr.y, sr.w, sr.h);
    };

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = 'rgba(29,34,54,0.251)';
    if (vert) {
      const shBox = { x: bounds.x + bounds.w, y: bounds.y + 4 * ps, w: 5 * ps, h: bounds.h - 4 * ps };
      if (!overlapsAny(shBox, obstacles)) {
        const sr = this.snapRect(ctx, shBox.x, shBox.y, shBox.w, shBox.h);
        ctx.fillRect(sr.x, sr.y, sr.w, sr.h);
      }
      for (let py = bounds.y + 24 * ps; py < bounds.y + bounds.h - 20 * ps; py += 100) {
        for (const px of [bounds.x - 18 * ps, bounds.x + bounds.w]) {
          const box = { x: px, y: py, w: 18 * ps, h: 28 * ps };
          if (!overlapsAny(box, obstacles)) drawPiece(br.pile, box.x, box.y, 18, 28);
        }
      }
    } else {
      for (let px = bounds.x; px < bounds.x + bounds.w; px += step) {
        const pw = Math.min(step, bounds.x + bounds.w - px);
        const shBox = { x: px, y: bounds.y + bounds.h + 8 * ps, w: pw, h: 5 * ps };
        if (!overlapsAny(shBox, obstacles)) {
          const sr = this.snapRect(ctx, shBox.x, shBox.y, shBox.w, shBox.h);
          ctx.fillRect(sr.x, sr.y, sr.w, sr.h);
        }
      }
      for (let px = bounds.x + 60; px < bounds.x + bounds.w - 40; px += 100) {
        const box = { x: px - 9 * ps, y: bounds.y + bounds.h + 4 * ps, w: 18 * ps, h: 28 * ps };
        if (!overlapsAny(box, obstacles)) drawPiece(br.pile, box.x, box.y, 18, 28);
      }
    }

    const clipRect = this.snapRect(ctx, bounds.x, bounds.y, bounds.w, bounds.h);
    ctx.save();
    ctx.beginPath();
    ctx.rect(clipRect.x, clipRect.y, clipRect.w, clipRect.h);
    ctx.clip();
    const planks = vert ? br.ns : br.ew;
    for (let ty = Math.floor(bounds.y / step); ty * step < bounds.y + bounds.h; ty++) {
      for (let tx = Math.floor(bounds.x / step); tx * step < bounds.x + bounds.w; tx++) {
        const sr = this.snapRect(ctx, tx * step, ty * step, step, step);
        ctx.drawImage(pickTile(planks, hash2d(tx * 3 + 1, ty * 5 + 2)), 0, 0, w.tile, w.tile, sr.x, sr.y, sr.w, sr.h);
      }
    }
    ctx.restore();

    if (vert) {
      for (let py = bounds.y; py < bounds.y + bounds.h; py += step) {
        const sh = Math.min(step, bounds.y + bounds.h - py) / ps;
        const left = { x: bounds.x - 12 * ps, y: py, w: 12 * ps, h: sh * ps };
        if (!overlapsAny(left, obstacles)) drawPiece(br.railW, left.x, left.y, 12, sh);
        const right = { x: bounds.x + bounds.w, y: py, w: 12 * ps, h: sh * ps };
        if (!overlapsAny(right, obstacles)) drawPiece(br.railE, right.x, right.y, 12, sh);
      }
    } else {
      for (let px = bounds.x; px < bounds.x + bounds.w; px += step) {
        const sw = Math.min(step, bounds.x + bounds.w - px) / ps;
        const top = { x: px, y: bounds.y - 20 * ps, w: sw * ps, h: 20 * ps };
        if (!overlapsAny(top, obstacles)) drawPiece(br.railN, top.x, top.y, sw, 20);
        const bot = { x: px, y: bounds.y + bounds.h, w: sw * ps, h: 8 * ps };
        if (!overlapsAny(bot, obstacles)) drawPiece(br.fascia, bot.x, bot.y, sw, 8);
      }
    }
    ctx.restore();
    return true;
  }

  drawWorldGate(ctx: CanvasRenderingContext2D, worldId: string, bounds: Rect, obstacles: readonly Rect[]) {
    const w = this.worlds.get(worldId);
    const br = w?.bridge;
    if (!w || !br) return;
    const ps = w.ps;
    const step = w.tile * ps;
    const vert = bounds.h > bounds.w;
    const vis = this.visible(ctx);
    if (bounds.x > vis.x1 + 200 || bounds.x + bounds.w < vis.x0 - 200 || bounds.y > vis.y1 + 200 || bounds.y + bounds.h < vis.y0 - 200) {
      return;
    }
    const drawSlice = (img: HTMLImageElement, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number) => {
      const sr = this.snapRect(ctx, dx, dy, sw * ps, sh * ps);
      ctx.drawImage(img, sx, sy, sw, sh, sr.x, sr.y, sr.w, sr.h);
    };

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    if (vert) {
      for (const gy of [bounds.y + 8 * ps, bounds.y + bounds.h - 38 * ps]) {
        if (overlapsAny({ x: bounds.x - 4, y: gy, w: bounds.w + 8, h: 30 * ps }, obstacles)) continue;
        for (let gx = bounds.x; gx < bounds.x + bounds.w; gx += step) {
          drawSlice(br.gateH, 0, 0, Math.min(step, bounds.x + bounds.w - gx) / ps, 30, gx, gy);
        }
        for (const gx of [bounds.x - 2 * ps, bounds.x + bounds.w - 3 * ps]) {
          drawSlice(br.gateH, 30, 0, 2, 30, gx, gy);
          drawSlice(br.gateH, 0, 0, 3, 30, gx + 2 * ps, gy);
        }
      }
    } else {
      for (const gx of [bounds.x + 8 * ps, bounds.x + bounds.w - 8 * ps - 16 * ps]) {
        if (overlapsAny({ x: gx, y: bounds.y - 4, w: 16 * ps, h: bounds.h + 8 }, obstacles)) continue;
        for (let gy = bounds.y; gy < bounds.y + bounds.h; gy += step) {
          drawSlice(br.gateV, 0, 0, 16, Math.min(step, bounds.y + bounds.h - gy) / ps, gx, gy);
        }
        for (const gy of [bounds.y - 2 * ps, bounds.y + bounds.h - 3 * ps]) {
          drawSlice(br.gateV, 0, 30, 16, 2, gx, gy);
          drawSlice(br.gateV, 0, 0, 16, 3, gx, gy + 2 * ps);
        }
      }
    }
    ctx.restore();
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
      s = undefined;
    }
    if (!s) {
      s = { anim: 'idle', animStart: now, lastX: x, lastY: y, lastMove: -1e9, lastHp: o.hp, hurtUntil: -1e9, dir: 'down' };
      this.actors.set(key, s);
    }
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
    if (Math.abs(angle) > Math.PI / 2) ctx.scale(1, -1);
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

  // ───────────────────────── proyectiles, objetos y efectos ─────────────────────────

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

  getObjectUrl(key: string): string | null {
    const o = this.objects.get(key);
    return o ? this.baseUrl + o.meta.image : null;
  }

  hasWeapon(id: string): boolean {
    return this.weapons.has(id);
  }

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
    if (Math.abs(angle) > Math.PI / 2) ctx.scale(1, -1);
    ctx.drawImage(w.img, 0, 0, w.fw, w.fh, -w.meta.grip.x * ps, -w.meta.grip.y * ps, w.fw * ps, w.fh * ps);
    ctx.restore();
    return true;
  }

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

  spawnEffect(name: string, x: number, y: number, now: number, angle?: number) {
    const fx = this.effects.get(name);
    if (!fx || fx.meta.loop) return;
    if (this.live.length > 160) this.live.shift();
    this.live.push({ fx, x, y, start: now, angle });
  }

  hasEffect(name: string): boolean {
    return this.effects.has(name);
  }

  spawnExplosion(x: number, y: number, radius: number, now: number) {
    const size = radius <= 55 ? 's' : radius <= 80 ? 'm' : radius <= 105 ? 'l' : 'xl';
    const key = this.effects.has(`explosion_${size}`) ? `explosion_${size}` : 'explosion';
    this.spawnEffect(key, x, y, now);
  }

  spawnArc(x1: number, y1: number, x2: number, y2: number, now: number) {
    if (!this.effects.has('tesla_node')) return;
    if (this.arcs.length > 40) this.arcs.shift();
    this.arcs.push({ x1, y1, x2, y2, start: now, seed: this.arcSeed++ });
  }

  drawStatus(ctx: CanvasRenderingContext2D, status: string, x: number, y: number, now: number, offset = 0): boolean {
    const fx = this.effects.get(`status_${status}`);
    if (!fx) return false;
    const ps = fx.meta.pixelScale ?? 2;
    const a = fx.meta.anchor ?? { x: 0.5, y: 0.5 };
    const frame = Math.floor(Math.max(0, now + offset) * fx.meta.fps) % fx.frames;
    const p = this.snap(ctx, x, y);
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
      fx.img, frame * fx.fw, 0, fx.fw, fx.fh,
      p.x - Math.round(a.x * fx.fw) * ps, p.y - Math.round(a.y * fx.fh) * ps, fx.fw * ps, fx.fh * ps,
    );
    ctx.restore();
    return true;
  }

  drawEffects(ctx: CanvasRenderingContext2D, now: number) {
    if (this.live.length) {
      ctx.save();
      ctx.imageSmoothingEnabled = false;
      this.live = this.live.filter((e) => {
        const frame = Math.floor(Math.max(0, now - e.start) * e.fx.meta.fps);
        if (now < e.start || frame >= e.fx.frames) return false;
        const ps = e.fx.meta.pixelScale ?? 2;
        const a = e.fx.meta.anchor ?? { x: 0.5, y: 0.5 };
        const p = this.snap(ctx, e.x, e.y);
        const dx = -Math.round(a.x * e.fx.fw) * ps;
        const dy = -Math.round(a.y * e.fx.fh) * ps;
        if (e.angle === undefined) {
          ctx.drawImage(e.fx.img, frame * e.fx.fw, 0, e.fx.fw, e.fx.fh, p.x + dx, p.y + dy, e.fx.fw * ps, e.fx.fh * ps);
        } else {
          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(e.angle);
          ctx.drawImage(e.fx.img, frame * e.fx.fw, 0, e.fx.fw, e.fx.fh, dx, dy, e.fx.fw * ps, e.fx.fh * ps);
          ctx.restore();
        }
        return true;
      });
      ctx.restore();
    }
    this.drawArcs(ctx, now);
  }

  private drawArcs(ctx: CanvasRenderingContext2D, now: number) {
    if (!this.arcs.length) return;
    this.arcs = this.arcs.filter((a) => now >= a.start && now - a.start < ARC_DURATION_SECONDS);
    if (!this.arcs.length) return;

    const tick = Math.floor(now * 30);
    ctx.save();
    for (const arc of this.arcs) {
      const t = (now - arc.start) / ARC_DURATION_SECONDS;
      const dx = arc.x2 - arc.x1;
      const dy = arc.y2 - arc.y1;
      const dist = Math.hypot(dx, dy);
      if (dist < 2) continue;
      const nx = -dy / dist;
      const ny = dx / dist;
      const segs = Math.max(2, Math.round(dist / 10));
      const pts: Array<{ x: number; y: number }> = [];
      for (let i = 0; i <= segs; i++) {
        const u = i / segs;
        const jitter = i === 0 || i === segs ? 0 : (hash2d(arc.seed * 31 + i, tick) - 0.5) * 16 * (1 - t * 0.5);
        pts.push({ x: arc.x1 + dx * u + nx * jitter, y: arc.y1 + dy * u + ny * jitter });
      }
      const stroke = (color: string, width: number) => {
        ctx.fillStyle = color;
        for (let i = 0; i < pts.length - 1; i++) {
          const steps = Math.max(1, Math.ceil(Math.hypot(pts[i + 1].x - pts[i].x, pts[i + 1].y - pts[i].y) / 2));
          for (let j = 0; j <= steps; j++) {
            const p = this.snap(
              ctx,
              pts[i].x + ((pts[i + 1].x - pts[i].x) * j) / steps,
              pts[i].y + ((pts[i + 1].y - pts[i].y) * j) / steps,
            );
            ctx.fillRect(Math.round(p.x / 2) * 2 - width / 2, Math.round(p.y / 2) * 2 - width / 2, width, width);
          }
        }
      };
      ctx.globalAlpha = t > 0.6 ? 1 - (t - 0.6) / 0.4 : 1;
      stroke('#3aa0d8', 6);
      stroke('#6ef0ff', 4);
      stroke('#ffffff', 2);
    }
    ctx.restore();
  }

  // ───────────────────────── utilidades ─────────────────────────

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
