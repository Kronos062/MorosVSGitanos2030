/**
 * RelicSystem.ts — gestión de reliquias equipadas (TDD Cap. 8).
 *
 * Mantiene la lista de reliquias equipadas en la Run y evalúa sus triggers
 * periódicos o basados en eventos (daño, kills, oleada).
 */

import type { System, SystemContext } from '@/engine/core/GameLoop';
import type { World, EntityId } from '@/engine/ecs/World';
import type { EventBus } from '@/engine/events/EventBus';
import type { ContentRepository } from '@/engine/content/ContentRepository';
import type { RuleEngine } from '@/engine/rules/RuleEngine';
import { EventTypes } from '@/gameplay/events/GameEventTypes';
import type { Health, Shield, Weapon } from '../components';

export interface RelicDef {
  id: string;
  name: string;
  rarity: string;
  category: string;
  description: string;
  trigger: string;
  condition: import('@/engine/rules/RuleEngine').Condition;
  effect: import('@/engine/rules/RuleEngine').Effect;
}

export class RelicSystem implements System {
  readonly name = 'Relic';
  readonly phase = 'fixed';
  readonly priority = 28;

  equippedRelics: string[] = [];
  private tickTimer = 0;

  constructor(
    private world: World,
    private events: EventBus,
    private content: ContentRepository,
    private ruleEngine: RuleEngine
  ) {
    // Escuchar cuando se equipa una reliquia
    events.on<{ relicId: string }>(EventTypes.RELIC_EQUIPPED, (e) => {
      this.equipRelic(e.relicId);
    });
  }

  equipRelic(relicId: string): void {
    const def = this.content.get<RelicDef>('relics', relicId);
    if (!def) return;
    if (!this.equippedRelics.includes(relicId)) {
      this.equippedRelics.push(relicId);
      // Registrar la regla de la reliquia en el RuleEngine
      this.ruleEngine.addRule({
        id: `relic_${relicId}_${Date.now()}`,
        trigger: def.trigger,
        condition: def.condition,
        effect: def.effect,
      });

      const playerEnt = this.world.getTag('player');
      if (playerEnt !== undefined) {
        this.events.emit(EventTypes.FLOAT_TEXT, {
          target: playerEnt,
          text: `RELIQUIA: ${def.name.toUpperCase()}`,
          color: '#b04dff',
        });
        this.events.emit(EventTypes.PLAY_SOUND, { id: 'levelup' });
      }
    }
  }

  update(ctx: SystemContext): void {
    const dt = ctx.time.fixedDt;
    this.tickTimer += dt;

    // Disparar evento de tick cada 1 segundo para reliquias periódicas
    if (this.tickTimer >= 1.0) {
      this.tickTimer -= 1.0;
      const playerEnt = this.world.getTag('player');
      if (playerEnt !== undefined) {
        const h = this.world.getComponent<Health>(playerEnt, 'Health');
        this.events.emit('tick:1s', {
          subject: { hp: h?.current ?? 0, maxHp: h?.max ?? 100 },
        });
      }
    }
  }
}
