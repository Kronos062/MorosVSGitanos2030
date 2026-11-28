/* ======================================================================
 * eventDirector.ts — Data-driven Event Director.
 * ----------------------------------------------------------------------
 * Decides if a room is an event, which event appears, and generates the
 * specific instance (with generic actions) for the engine to execute.
 * Entirely data-driven. Adds progression and anti-repetition rules.
 * ==================================================================== */

import type { EventInstance, EventOption } from './types';
import type { RunDirector } from './runDirector';
import type { BiomeDef } from '../content/biomes';
import { EVENT_NPCS } from './sprites/eventNpcs';

export type EventType = 'altar' | 'merchant' | 'cursed' | 'shrine' | 'challenge' | 'mystery';

export interface EventDef {
  id: string;
  name: string;
  type: EventType;
  description: string;
  icon: string;
  color: string;
  baseWeight: number;
  minMap: number;
  maxMap: number;
  maxPerRun: number;
  maxPerMap: number;
}

export const EVENT_DEFS: EventDef[] = [
  { id: 'altar_sangre', name: EVENT_NPCS.altar_sangre.name, type: 'altar', description: EVENT_NPCS.altar_sangre.dialogue, icon: '', color: '#ff2a4b', baseWeight: 100, minMap: 2, maxMap: 10, maxPerRun: 5, maxPerMap: 1 },
  { id: 'merchant_bot', name: EVENT_NPCS.merchant_bot.name, type: 'merchant', description: EVENT_NPCS.merchant_bot.dialogue, icon: '', color: '#b989ea', baseWeight: 80, minMap: 1, maxMap: 8, maxPerRun: 4, maxPerMap: 1 },
  { id: 'cursed_arena', name: 'Sala Maldita', type: 'cursed', description: 'Aura opresiva. Sobrevive a la emboscada letal.', icon: '☠️', color: '#b04dff', baseWeight: 40, minMap: 3, maxMap: 10, maxPerRun: 3, maxPerMap: 1 },
  { id: 'shrine_light', name: EVENT_NPCS.shrine_light.name, type: 'shrine', description: EVENT_NPCS.shrine_light.dialogue, icon: '', color: '#8bdf91', baseWeight: 60, minMap: 1, maxMap: 10, maxPerRun: 3, maxPerMap: 1 },
  { id: 'challenge_time', name: 'Desafío: Contrarreloj', type: 'challenge', description: 'Acaba con todos antes de que expire el tiempo.', icon: '⏱️', color: '#ff8800', baseWeight: 50, minMap: 2, maxMap: 10, maxPerRun: 3, maxPerMap: 1 },
  { id: 'challenge_nodamage', name: 'Desafío: Intocable', type: 'challenge', description: 'Sobrevive a la sala sin perder vida (el escudo absorbe golpes sin fallar).', icon: '🛡️', color: '#ff8800', baseWeight: 50, minMap: 3, maxMap: 10, maxPerRun: 3, maxPerMap: 1 },
  { id: 'mystery_roulette', name: 'Anomalía Cuántica', type: 'mystery', description: 'Una distorsión. ¿Te atreves a manipularla?', icon: '🌀', color: '#ff2bd6', baseWeight: 30, minMap: 1, maxMap: 10, maxPerRun: 3, maxPerMap: 1 },
];

export interface EventGenCtx {
  mapNumber: number;
  directedWeapon: (tableId: string) => any;
  directedEquipment: (tableId: string) => any;
}

/** Fisher–Yates con el RNG de la partida: determinista e idéntico en todos los navegadores. */
function shuffle<T>(arr: T[], rng: () => number): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export class EventDirector {
  private runCounts = new Map<string, number>();
  private mapCounts = new Map<string, number>();
  /** Tipos de evento elegidos, en orden: el último evita repetir tipo consecutivo. */
  private typeHistory: string[] = [];
  private eventsThisMap = 0;

  resetRun() {
    this.runCounts.clear();
    this.mapCounts.clear();
    this.typeHistory = [];
    this.eventsThisMap = 0;
  }

  /** Deshace una elección de pickEvent cuando la sala acaba siendo de combate y el evento no llega a aparecer. */
  cancelEvent(id: string | undefined) {
    if (!id) return;
    const def = EVENT_DEFS.find((e) => e.id === id);
    const dec = (m: Map<string, number>) => {
      const n = (m.get(id) ?? 0) - 1;
      if (n > 0) m.set(id, n); else m.delete(id);
    };
    dec(this.runCounts);
    dec(this.mapCounts);
    this.eventsThisMap = Math.max(0, this.eventsThisMap - 1);
    if (def) {
      const idx = this.typeHistory.lastIndexOf(def.type);
      if (idx !== -1) this.typeHistory.splice(idx, 1);
    }
  }

  onNextMap() {
    this.mapCounts.clear();
    this.eventsThisMap = 0;
  }

  rollRoomIsEvent(mapNumber: number, rng: () => number): boolean {
    if (this.eventsThisMap >= 2) return false;
    const chance = 0.12 + mapNumber * 0.02;
    return rng() < chance;
  }

  pickEvent(map: number, rng: () => number, runDirector?: RunDirector, buildTags: string[] = [], biome?: BiomeDef): string | null {
    const available = EVENT_DEFS.filter(e => {
      if (map < e.minMap || map > e.maxMap) return false;
      if ((this.runCounts.get(e.id) ?? 0) >= e.maxPerRun) return false;
      if ((this.mapCounts.get(e.id) ?? 0) >= e.maxPerMap) return false;
      if (e.type === this.typeHistory[this.typeHistory.length - 1]) return false; // Prevent consecutive same types
      return true;
    });

    if (available.length === 0) return null;

    const pool = available.map(e => {
      let w = e.baseWeight;
      // Map progression weighting
      if (e.type === 'merchant') w *= Math.max(0.2, 1 - (map - 1) * 0.1);
      if (e.type === 'cursed') w *= 0.5 + (map - 1) * 0.15;
      if (e.type === 'altar') w *= 0.8 + (map - 1) * 0.1;
      if (runDirector) {
        w *= runDirector.getEventWeightMult(e, buildTags, biome);
      }
      return { def: e, weight: w };
    });

    const total = pool.reduce((s, p) => s + p.weight, 0);
    let r = rng() * total;
    let chosen = pool[0].def;
    for (const p of pool) {
      r -= p.weight;
      if (r <= 0) { chosen = p.def; break; }
    }

    this.runCounts.set(chosen.id, (this.runCounts.get(chosen.id) ?? 0) + 1);
    this.mapCounts.set(chosen.id, (this.mapCounts.get(chosen.id) ?? 0) + 1);
    this.typeHistory.push(chosen.type);
    this.eventsThisMap++;

    return chosen.id;
  }

  generateInstance(id: string, ctx: EventGenCtx, rng: () => number): EventInstance {
    const def = EVENT_DEFS.find(e => e.id === id)!;
    
    if (def.type === 'altar') {
      const opts: EventOption[] = [
        {
          label: 'Pacto de Sangre', description: '+30% Daño. Pierdes vida igual al 20% de tu vida máxima', color: '#ff2a4b', costHpPct: 0.2,
          actions: [{ kind: 'stat_mod', stat: 'damageMult', op: 'mult', val: 0.3 }, { kind: 'lose_hp_pct', value: 0.2 }]
        },
        {
          label: 'Pacto de Furia', description: '+1 Proyectil, dispersión a la mitad. Pierdes vida igual al 10% de tu vida máxima', color: '#ff8800', costHpPct: 0.1,
          actions: [{ kind: 'stat_mod', stat: 'countBonus', op: 'add', val: 1 }, { kind: 'stat_mod', stat: 'spreadMult', op: 'mult', val: 0.5 }, { kind: 'lose_hp_pct', value: 0.1 }]
        },
        {
          label: 'Pacto de Plomo', description: '+4 Armadura, -15% Velocidad. Pierdes vida igual al 5% de tu vida máxima', color: '#94a3b8', costHpPct: 0.05,
          actions: [{ kind: 'stat_mod', stat: 'armor', op: 'add', val: 4 }, { kind: 'stat_mod', stat: 'speedMult', op: 'mult', val: -0.15 }, { kind: 'lose_hp_pct', value: 0.05 }]
        }
      ];
      // Randomize which 2 options appear
      shuffle(opts, rng);
      return { ...def, options: opts.slice(0, 2) };
    }
    
    if (def.type === 'merchant') {
      const w1 = ctx.directedWeapon('reward');
      const w2 = ctx.directedEquipment('reward');
      const cost1 = 150 + ctx.mapNumber * 20;
      const cost2 = 120 + ctx.mapNumber * 15;
      
      return {
        ...def,
        options: [
          {
            label: `Comprar Arma`, description: w1.name, color: w1.color, costGold: cost1,
            actions: [{ kind: 'lose_gold', value: cost1 }, { kind: 'drop_weapon', weaponGenId: w1.genId, baseId: w1.baseId, color: w1.color }]
          },
          {
            label: `Comprar Equipo`, description: w2.name, color: w2.color, costGold: cost2,
            actions: [{ kind: 'lose_gold', value: cost2 }, { kind: 'drop_equipment', equipGenId: w2.genId, color: w2.color }]
          },
          {
            label: 'Comprar Curación', description: 'Restaura 50 HP', color: '#39ff88', costGold: 60,
            actions: [{ kind: 'lose_gold', value: 60 }, { kind: 'heal', value: 50 }]
          }
        ]
      };
    }
    
    if (def.type === 'cursed') {
      return {
        ...def,
        combatRules: { isCursed: true, rewardChest: 'chest_boss', waveCount: 4 }
      };
    }

    if (def.type === 'challenge') {
      const isTime = id === 'challenge_time';
      return {
        ...def,
        combatRules: { 
          isCursed: false, 
          timeLimit: isTime ? 45 : undefined, 
          noDamage: !isTime, 
          rewardChest: isTime ? 'chest_armory' : 'chest_boss', 
          waveCount: 3 
        }
      };
    }
    
    if (def.type === 'shrine') {
      const opts: EventOption[] = [
        { label: 'Bendición de Vida', description: '+30 HP Máximo', color: '#39ff88', actions: [{ kind: 'stat_mod', stat: 'maxHp', op: 'add', val: 30 }] },
        { label: 'Bendición de Rapidez', description: '+15% Velocidad', color: '#00f0ff', actions: [{ kind: 'stat_mod', stat: 'speedMult', op: 'mult', val: 0.15 }] },
        { label: 'Bendición de Precisión', description: '+15% Crítico', color: '#ffe14a', actions: [{ kind: 'stat_mod', stat: 'critChance', op: 'add', val: 0.15 }] },
      ];
      shuffle(opts, rng);
      return { ...def, options: opts.slice(0, 2) };
    }
    
    if (def.type === 'mystery') {
      return {
        ...def,
        options: [
          { 
            label: 'Apostar 60 Monedas', description: '50% doble o nada.', color: '#ffe14a', costGold: 60, 
            actions: [{ kind: 'lose_gold', value: 60 }, { kind: 'add_gold', value: rng() > 0.5 ? 120 : 0 }] 
          },
          { 
            label: 'Ruleta de Sangre', description: 'Pierdes vida igual al 10% de tu vida máxima a cambio de algo aleatorio.', color: '#b04dff', costHpPct: 0.1, 
            actions: [
              { kind: 'lose_hp_pct', value: 0.1 }, 
              rng() > 0.5 ? { kind: 'stat_mod', stat: 'damageMult', op: 'mult', val: 0.25 } : { kind: 'add_gold', value: 100 }
            ] 
          }
        ]
      };
    }

    return { ...def };
  }
}
