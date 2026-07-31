/**
 * WorldEventSystem.ts — eventos mundiales y modificadores globales (TDD §10).
 *
 * Aplica modificadores globales de la Run (Lluvia Ácida, Luna Neón, Fiebre de Créditos)
 * cargados de events.json.
 */

import type { System, SystemContext } from '@/engine/core/GameLoop';
import type { EventBus } from '@/engine/events/EventBus';
import type { ContentRepository } from '@/engine/content/ContentRepository';
import { EventTypes } from '@/engine/events/EventBus';

export interface WorldEventDef {
  id: string;
  name: string;
  description: string;
  duration: number;
  mods: Array<{ stat: string; op: 'mul' | 'add'; value: number }>;
  color: string;
}

export class WorldEventSystem implements System {
  readonly name = 'WorldEvent';
  readonly phase = 'fixed';
  readonly priority = 5;

  activeEvent: WorldEventDef | null = null;
  eventTimer = 0;

  constructor(
    private events: EventBus,
    private content: ContentRepository
  ) {}

  triggerEvent(eventId: string): void {
    const def = this.content.get<WorldEventDef>('events', eventId);
    if (!def) return;
    this.activeEvent = def;
    this.eventTimer = def.duration;

    this.events.emit(EventTypes.WORLD_EVENT_ACTIVATED, { event: def });
    this.events.emit(EventTypes.SCREEN_SHAKE, { intensity: 10, time: 0.25 });
    this.events.emit(EventTypes.PLAY_SOUND, { id: 'wave_start' });
  }

  update(ctx: SystemContext): void {
    if (!this.activeEvent) return;

    this.eventTimer -= ctx.time.fixedDt;
    if (this.eventTimer <= 0) {
      this.activeEvent = null;
      this.eventTimer = 0;
    }
  }
}
