/**
 * RuleEngine.ts + ConditionEvaluator.ts + EffectExecutor.ts (TDD §1, §9).
 *
 * Motor de reglas genérico: `condition → effect` declarados en JSON.
 * Permite añadir sinergias, resonancias, mutaciones y eventos sin tocar
 * código. El DSL es cerrado y tipado — no hay eval, no hay if por arma.
 *
 * Forma de una regla:
 * {
 *   "id": "...",
 *   "trigger": "combat:entity_killed",      // evento que activa la regla
 *   "condition": { "and": [...] },          // árbol de condiciones
 *   "effect": { "kind": "heal", "value": 5 }
 * }
 */

import type { EventBus } from '../events/EventBus';

// ===== Conditions =====
export type Condition =
  | { op: 'eq'; path: string; value: unknown }
  | { op: 'neq'; path: string; value: unknown }
  | { op: 'gt'; path: string; value: number }
  | { op: 'gte'; path: string; value: number }
  | { op: 'lt'; path: string; value: number }
  | { op: 'lte'; path: string; value: number }
  | { op: 'in'; path: string; values: unknown[] }
  | { op: 'has_tag'; tag: string }
  | { op: 'has_component'; component: string }
  | { op: 'and'; conds: Condition[] }
  | { op: 'or'; conds: Condition[] }
  | { op: 'not'; cond: Condition }
  | { op: 'always' };

export interface RuleContext {
  /** Datos del evento que disparó la regla. */
  event: Record<string, unknown>;
  /** Entidad "sujeto" sobre la que se evalúan paths. */
  subject?: Record<string, unknown>;
  /** Entidad "objetivo" (p.ej. el enemigo muerto en un evento de kill). */
  target?: Record<string, unknown>;
  /** Tags globales (facciones, biomas activos, eventos mundiales...). */
  tags?: Set<string>;
  /** Componentes disponibles del subject (para `has_component`). */
  components?: Set<string>;
}

export class ConditionEvaluator {
  evaluate(cond: Condition, ctx: RuleContext): boolean {
    switch (cond.op) {
      case 'always':
        return true;
      case 'eq':
        return resolvePath(ctx, cond.path) === cond.value;
      case 'neq':
        return resolvePath(ctx, cond.path) !== cond.value;
      case 'gt':
        return (resolvePath(ctx, cond.path) as number) > cond.value;
      case 'gte':
        return (resolvePath(ctx, cond.path) as number) >= cond.value;
      case 'lt':
        return (resolvePath(ctx, cond.path) as number) < cond.value;
      case 'lte':
        return (resolvePath(ctx, cond.path) as number) <= cond.value;
      case 'in':
        return cond.values.includes(resolvePath(ctx, cond.path));
      case 'has_tag':
        return ctx.tags?.has(cond.tag) ?? false;
      case 'has_component':
        return ctx.components?.has(cond.component) ?? false;
      case 'and':
        return cond.conds.every((c) => this.evaluate(c, ctx));
      case 'or':
        return cond.conds.some((c) => this.evaluate(c, ctx));
      case 'not':
        return !this.evaluate(cond.cond, ctx);
    }
  }
}

function resolvePath(ctx: RuleContext, path: string): unknown {
  const parts = path.split('.');
  const root = parts[0];
  let obj: unknown;
  if (root === 'event') obj = ctx.event;
  else if (root === 'subject') obj = ctx.subject;
  else if (root === 'target') obj = ctx.target;
  else return undefined;
  for (let i = 1; i < parts.length; i++) {
    if (obj == null) return undefined;
    obj = (obj as Record<string, unknown>)[parts[i]];
  }
  return obj;
}

// ===== Effects =====
export type Effect =
  | { kind: 'heal'; value: number }
  | { kind: 'damage'; value: number }
  | { kind: 'score'; value: number }
  | { kind: 'xp'; value: number }
  | { kind: 'apply_status'; status: string; duration: number }
  | { kind: 'spawn'; entity: string; count: number }
  | { kind: 'emit'; event: string; payload?: Record<string, unknown> }
  | { kind: 'add_tag'; tag: string }
  | { kind: 'remove_tag'; tag: string }
  | { kind: 'sequence'; effects: Effect[] }
  | { kind: 'noop' };

export interface EffectContext extends RuleContext {
  applyEffect: (effect: Effect, ctx: EffectContext) => void;
}

/**
 * EffectExecutor — delegado. El engine expone una interfaz de ejecución
 * pero la lógica concreta la inyecta el gameplay (que sí conoce el World).
 * Esto mantiene el engine agnóstico.
 */
export class EffectExecutor {
  private handlers = new Map<string, (effect: Effect, ctx: EffectContext) => void>();
  public events?: EventBus;

  setEvents(events: EventBus): void {
    this.events = events;
  }

  /** Registra un handler para un tipo de efecto. */
  register(kind: string, handler: (effect: Effect, ctx: EffectContext) => void): void {
    this.handlers.set(kind, handler);
  }

  execute(effect: Effect, ctx: EffectContext): void {
    if (effect.kind === 'sequence') {
      for (const sub of effect.effects) this.execute(sub, ctx);
      return;
    }
    if (effect.kind === 'noop') return;
    if (effect.kind === 'emit') {
      if (this.events) {
        this.events.emit(effect.event, effect.payload);
      }
      return;
    }
    const handler = this.handlers.get(effect.kind);
    if (!handler) {
      console.warn(`EffectExecutor: efecto "${effect.kind}" no registrado`);
      return;
    }
    handler(effect, ctx);
  }
}

// ===== Rule + RuleEngine =====
export interface Rule {
  id: string;
  trigger: string;
  condition: Condition;
  effect: Effect;
  /** Si true, la regla sólo se dispara una vez por Run. */
  once?: boolean;
  /** Si está presente, cooldown mínimo entre disparos (segundos). */
  cooldown?: number;
}

export class RuleEngine {
  private rules: Rule[] = [];
  private unsubs: Array<() => void> = [];
  private onceFired = new Set<string>();
  private lastFired = new Map<string, number>();
  private evaluator: ConditionEvaluator;

  constructor(
    private readonly events: EventBus,
    private readonly executor: EffectExecutor,
    evaluator?: ConditionEvaluator
  ) {
    this.evaluator = evaluator ?? new ConditionEvaluator();
    this.executor.setEvents(this.events);
  }

  loadRules(rules: Rule[]): void {
    this.rules = rules;
    this.rewire();
  }

  addRule(rule: Rule): void {
    this.rules.push(rule);
    this.rewire();
  }

  private rewire(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
    // Agrupar por trigger
    const byTrigger = new Map<string, Rule[]>();
    for (const r of this.rules) {
      let arr = byTrigger.get(r.trigger);
      if (!arr) {
        arr = [];
        byTrigger.set(r.trigger, arr);
      }
      arr.push(r);
    }
    for (const [trigger, list] of byTrigger) {
      const unsub = this.events.on(trigger, (payload: unknown) => {
        const event = (payload as Record<string, unknown>) ?? {};
        this.evaluateRules(list, event);
      });
      this.unsubs.push(unsub);
    }
  }

  private evaluateRules(list: Rule[], event: Record<string, unknown>): void {
    const now = performance.now() / 1000;
    for (const rule of list) {
      if (rule.once && this.onceFired.has(rule.id)) continue;
      if (rule.cooldown) {
        const last = this.lastFired.get(rule.id) ?? -Infinity;
        if (now - last < rule.cooldown) continue;
      }
      const ctx: RuleContext = {
        event,
        subject: event.subject as Record<string, unknown> | undefined,
        target: event.target as Record<string, unknown> | undefined,
        tags: event.tags as Set<string> | undefined,
        components: event.components as Set<string> | undefined,
      };
      if (!this.evaluator.evaluate(rule.condition, ctx)) continue;
      const effectCtx: EffectContext = {
        ...ctx,
        applyEffect: (eff, c) => this.executor.execute(eff, c),
      };
      this.executor.execute(rule.effect, effectCtx);
      if (rule.once) this.onceFired.add(rule.id);
      if (rule.cooldown) this.lastFired.set(rule.id, now);
    }
  }

  reset(): void {
    this.onceFired.clear();
    this.lastFired.clear();
  }

  clear(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
    this.rules = [];
    this.reset();
  }
}
