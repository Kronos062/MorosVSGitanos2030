import { describe, it, expect } from 'vitest';
import {
  ConditionEvaluator, EffectExecutor, RuleEngine,
  type Condition, type Effect, type Rule, type RuleContext,
} from '@/engine/rules/RuleEngine';
import { EventBus, EventTypes } from '@/engine/events/EventBus';

describe('ConditionEvaluator', () => {
  const eval_ = new ConditionEvaluator();

  it('eq, neq, gt, lt, gte, lte', () => {
    const ctx: RuleContext = { event: { combo: 5, wave: 3 }, subject: { hp: 10 } };
    expect(eval_.evaluate({ op: 'eq', path: 'event.combo', value: 5 }, ctx)).toBe(true);
    expect(eval_.evaluate({ op: 'neq', path: 'event.combo', value: 6 }, ctx)).toBe(true);
    expect(eval_.evaluate({ op: 'gt', path: 'event.combo', value: 4 }, ctx)).toBe(true);
    expect(eval_.evaluate({ op: 'gte', path: 'event.combo', value: 5 }, ctx)).toBe(true);
    expect(eval_.evaluate({ op: 'lt', path: 'event.wave', value: 5 }, ctx)).toBe(true);
    expect(eval_.evaluate({ op: 'lte', path: 'event.wave', value: 3 }, ctx)).toBe(true);
  });

  it('in', () => {
    const ctx: RuleContext = { event: { kind: 'fire' } };
    expect(eval_.evaluate({ op: 'in', path: 'event.kind', values: ['fire', 'ice'] }, ctx)).toBe(true);
    expect(eval_.evaluate({ op: 'in', path: 'event.kind', values: ['water'] }, ctx)).toBe(false);
  });

  it('has_tag y has_component', () => {
    const ctx: RuleContext = {
      event: {},
      tags: new Set(['fire', 'elite']),
      components: new Set(['Weapon', 'Health']),
    };
    expect(eval_.evaluate({ op: 'has_tag', tag: 'fire' }, ctx)).toBe(true);
    expect(eval_.evaluate({ op: 'has_tag', tag: 'ice' }, ctx)).toBe(false);
    expect(eval_.evaluate({ op: 'has_component', component: 'Weapon' }, ctx)).toBe(true);
  });

  it('and / or / not', () => {
    const ctx: RuleContext = { event: { a: 1, b: 2 } };
    const c1: Condition = { op: 'eq', path: 'event.a', value: 1 };
    const c2: Condition = { op: 'eq', path: 'event.b', value: 2 };
    const c3: Condition = { op: 'eq', path: 'event.b', value: 99 };
    expect(eval_.evaluate({ op: 'and', conds: [c1, c2] }, ctx)).toBe(true);
    expect(eval_.evaluate({ op: 'and', conds: [c1, c3] }, ctx)).toBe(false);
    expect(eval_.evaluate({ op: 'or', conds: [c1, c3] }, ctx)).toBe(true);
    expect(eval_.evaluate({ op: 'not', cond: c3 }, ctx)).toBe(true);
  });

  it('always', () => {
    expect(new ConditionEvaluator().evaluate({ op: 'always' }, { event: {} })).toBe(true);
  });
});

describe('RuleEngine', () => {
  it('dispara efectos cuando la condición se cumple', () => {
    const events = new EventBus();
    const executor = new EffectExecutor();
    const healed: number[] = [];
    executor.register('heal', (eff) => {
      if (eff.kind === 'heal') healed.push(eff.value);
    });
    const engine = new RuleEngine(events, executor);

    const rule: Rule = {
      id: 'r1',
      trigger: EventTypes.ENTITY_KILLED,
      condition: { op: 'gte', path: 'event.combo', value: 3 },
      effect: { kind: 'heal', value: 10 },
    };
    engine.loadRules([rule]);

    events.emit(EventTypes.ENTITY_KILLED, { combo: 2 }); // no dispara
    events.emit(EventTypes.ENTITY_KILLED, { combo: 5 }); // dispara
    events.emit(EventTypes.ENTITY_KILLED, { combo: 10 }); // dispara
    expect(healed).toEqual([10, 10]);
  });

  it('once: sólo se dispara una vez', () => {
    const events = new EventBus();
    const executor = new EffectExecutor();
    let count = 0;
    executor.register('score', () => { count++; });
    const engine = new RuleEngine(events, executor);
    engine.loadRules([{
      id: 'r2', trigger: 'test',
      condition: { op: 'always' },
      effect: { kind: 'score', value: 1 },
      once: true,
    }]);
    events.emit('test', {});
    events.emit('test', {});
    events.emit('test', {});
    expect(count).toBe(1);
  });

  it('cooldown: limita la frecuencia', async () => {
    const events = new EventBus();
    const executor = new EffectExecutor();
    let count = 0;
    executor.register('score', () => { count++; });
    const engine = new RuleEngine(events, executor);
    engine.loadRules([{
      id: 'r3', trigger: 'test',
      condition: { op: 'always' },
      effect: { kind: 'score', value: 1 },
      cooldown: 0.5,
    }]);
    events.emit('test', {});
    events.emit('test', {});
    events.emit('test', {});
    expect(count).toBe(1);
    await new Promise((r) => setTimeout(r, 550));
    events.emit('test', {});
    expect(count).toBe(2);
  });

  it('sequence ejecuta varios efectos', () => {
    const events = new EventBus();
    const executor = new EffectExecutor();
    const log: string[] = [];
    executor.register('heal', (e) => { if (e.kind === 'heal') log.push('heal:' + e.value); });
    executor.register('score', (e) => { if (e.kind === 'score') log.push('score:' + e.value); });
    const engine = new RuleEngine(events, executor);
    const eff: Effect = {
      kind: 'sequence',
      effects: [
        { kind: 'heal', value: 5 },
        { kind: 'score', value: 10 },
      ],
    };
    engine.loadRules([{ id: 'r4', trigger: 'x', condition: { op: 'always' }, effect: eff }]);
    events.emit('x', {});
    expect(log).toEqual(['heal:5', 'score:10']);
  });

  it('emit envía un evento nuevo al bus', () => {
    const events = new EventBus();
    const executor = new EffectExecutor();
    const engine = new RuleEngine(events, executor);
    const received: number[] = [];
    events.on<{ amount: number }>('relic:bonus', (e) => received.push(e.amount));
    engine.loadRules([{
      id: 'r5', trigger: 'trigger',
      condition: { op: 'always' },
      effect: { kind: 'emit', event: 'relic:bonus', payload: { amount: 42 } },
    }]);
    events.emit('trigger', {});
    expect(received).toEqual([42]);
  });
});
