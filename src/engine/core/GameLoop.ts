/**
 * SystemScheduler.ts + GameLoop.ts — ciclo de juego (TDD §3.4).
 *
 * El scheduler mantiene dos listas: sistemas de lógica fija (fixed step)
 * y sistemas de render (paso variable interpolado). El GameLoop aplica
 * el patrón "fixed-step simulation + variable render" para que la física
 * y el combate no dependan del framerate del navegador.
 */

import type { World } from '../ecs/World';
import type { EventBus } from '../events/EventBus';

export interface SystemContext {
  world: World;
  events: EventBus;
  time: {
    /** Segundos transcurridos totales. */
    elapsed: number;
    /** Delta de la simulación (fijo). */
    fixedDt: number;
    /** Alpha de interpolación para render (0..1). */
    alpha: number;
    /** Delta real de frame (variable). */
    frameDt: number;
    /** Escala de tiempo global (hit-stop, slow-mo). */
    timeScale: number;
  };
}

export interface System {
  /** Nombre único para debug / ordenación. */
  readonly name: string;
  /** Fase: 'fixed' corre a paso fijo, 'render' cada frame. */
  readonly phase: 'fixed' | 'render';
  /** Prioridad (menor = corre antes). Default 0. */
  readonly priority?: number;
  /** Habilitado dinámicamente (para pausa, menús, etc.). */
  enabled?: boolean;
  update(ctx: SystemContext): void;
}

export class SystemScheduler {
  private fixed: System[] = [];
  private render: System[] = [];

  add(system: System): void {
    (system.phase === 'fixed' ? this.fixed : this.render).push(system);
    this.sort();
  }

  remove(name: string): void {
    this.fixed = this.fixed.filter((s) => s.name !== name);
    this.render = this.render.filter((s) => s.name !== name);
  }

  private sort(): void {
    const byPriority = (a: System, b: System) => (a.priority ?? 0) - (b.priority ?? 0);
    this.fixed.sort(byPriority);
    this.render.sort(byPriority);
  }

  runFixed(ctx: SystemContext): void {
    for (const sys of this.fixed) {
      if (sys.enabled === false) continue;
      sys.update(ctx);
    }
  }

  runRender(ctx: SystemContext): void {
    for (const sys of this.render) {
      if (sys.enabled === false) continue;
      sys.update(ctx);
    }
  }

  list(): System[] {
    return [...this.fixed, ...this.render];
  }
}

/**
 * GameLoop — bucle principal usando requestAnimationFrame.
 * Implementa timestep fijo acumulando tiempo y corriendo N pasos lógicos
 * por frame; el render se interpola con alpha.
 */
export interface GameLoopOptions {
  fixedHz?: number; // default 60
  maxStepsPerFrame?: number; // default 4 (evita espiral de la muerte)
}

export class GameLoop {
  private rafId = 0;
  private running = false;
  private lastTime = 0;
  private accumulator = 0;
  private elapsed = 0;
  private readonly fixedDt: number;
  private readonly maxSteps: number;
  private _timeScale = 1;

  constructor(
    private readonly scheduler: SystemScheduler,
    private readonly ctx: SystemContext,
    opts: GameLoopOptions = {}
  ) {
    const hz = opts.fixedHz ?? 60;
    this.fixedDt = 1 / hz;
    this.maxSteps = opts.maxStepsPerFrame ?? 4;
    this.ctx.time.fixedDt = this.fixedDt;
  }

  set timeScale(v: number) {
    this._timeScale = Math.max(0, v);
  }
  get timeScale(): number {
    return this._timeScale;
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.lastTime = performance.now();
    this.accumulator = 0;
    this.rafId = requestAnimationFrame(this.tick);
  }

  stop(): void {
    this.running = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = 0;
  }

  isRunning(): boolean {
    return this.running;
  }

  /** Permite correr un solo paso fijo (útil para tests). */
  stepFixed(): void {
    this.ctx.time.elapsed += this.fixedDt;
    this.ctx.time.frameDt = this.fixedDt;
    this.scheduler.runFixed(this.ctx);
    this.ctx.events.flush();
  }

  private tick = (now: number): void => {
    if (!this.running) return;
    const realDt = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    const scaledDt = realDt * this._timeScale;
    this.accumulator += scaledDt;

    let steps = 0;
    while (this.accumulator >= this.fixedDt && steps < this.maxSteps) {
      this.elapsed += this.fixedDt;
      this.ctx.time.elapsed = this.elapsed;
      this.ctx.time.frameDt = this.fixedDt;
      this.ctx.time.timeScale = this._timeScale;
      this.scheduler.runFixed(this.ctx);
      this.accumulator -= this.fixedDt;
      steps++;
    }

    // Alpha de interpolación para render
    this.ctx.time.alpha = this.accumulator / this.fixedDt;
    this.ctx.time.frameDt = realDt;
    this.scheduler.runRender(this.ctx);

    // Flush de eventos encolados durante el frame
    this.ctx.events.flush();

    this.rafId = requestAnimationFrame(this.tick);
  };
}
