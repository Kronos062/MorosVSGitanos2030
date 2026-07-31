/**
 * LegacySystem.ts — gestión de legados y marcas históricas (TDD §9, Fase 4).
 *
 * Registra y valida marcas acumuladas (como "Primera Sangre" o "Maestro de la Oleada")
 * declaradas en legacies.json utilizando el RuleEngine.
 */

import type { System, SystemContext } from '@/engine/core/GameLoop';
import type { World } from '@/engine/ecs/World';
import type { EventBus } from '@/engine/events/EventBus';
import type { ContentRepository } from '@/engine/content/ContentRepository';
import type { RuleEngine } from '@/engine/rules/RuleEngine';
import { EventTypes } from '@/gameplay/events/GameEventTypes';

export interface LegacyDef {
  id: string;
  name: string;
  description: string;
  trigger: string;
  condition: import('@/engine/rules/RuleEngine').Condition;
  effect: import('@/engine/rules/RuleEngine').Effect;
}

const LEGACIES_KEY = 'mvg_unlocked_legacies_v1';

export class LegacySystem implements System {
  readonly name = 'Legacy';
  readonly phase = 'fixed';
  readonly priority = 29;

  unlockedLegacies = new Set<string>();

  constructor(
    private world: World,
    private events: EventBus,
    private content: ContentRepository,
    private ruleEngine: RuleEngine
  ) {
    this.loadUnlocked();
    this.registerLegacyRules();
  }

  private loadUnlocked(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(LEGACIES_KEY);
      if (raw) {
        const list = JSON.parse(raw) as string[];
        for (const id of list) this.unlockedLegacies.add(id);
      }
    } catch { /* noop */ }
  }

  private saveUnlocked(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(LEGACIES_KEY, JSON.stringify(Array.from(this.unlockedLegacies)));
    } catch { /* noop */ }
  }

  private registerLegacyRules(): void {
    const legacies = this.content.all<LegacyDef>('legacies');
    for (const leg of legacies) {
      this.ruleEngine.addRule({
        id: `legacy_${leg.id}`,
        trigger: leg.trigger,
        condition: leg.condition,
        effect: {
          kind: 'sequence',
          effects: [
            leg.effect,
            { kind: 'emit', event: EventTypes.LEGACY_THRESHOLD_REACHED, payload: { legacy: leg } },
          ],
        },
        once: true,
      });
    }

    this.events.on<{ legacy: LegacyDef }>(EventTypes.LEGACY_THRESHOLD_REACHED, (e) => {
      if (!this.unlockedLegacies.has(e.legacy.id)) {
        this.unlockedLegacies.add(e.legacy.id);
        this.saveUnlocked();

        const playerEnt = this.world.getTag('player');
        if (playerEnt !== undefined) {
          this.events.emit(EventTypes.FLOAT_TEXT, {
            target: playerEnt,
            text: `¡LEGADO: ${e.legacy.name.toUpperCase()}!`,
            color: '#ffe14a',
          });
          this.events.emit(EventTypes.PLAY_SOUND, { id: 'levelup' });
        }
      }
    });
  }

  update(): void {
    // Las reglas se evalúan vía eventos en el RuleEngine
  }
}
