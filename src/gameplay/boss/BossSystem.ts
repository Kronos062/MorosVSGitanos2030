/**
 * BossSystem.ts — gestión FSM data-driven para Bosses con fases (TDD §6).
 *
 * Reutiliza las mismas entidades y componentes que los enemigos normales,
 * pero evalúa los umbrales de vida (100%, 60%, 30%) declarados en bosses.json.
 */

import type { System, SystemContext } from '@/engine/core/GameLoop';
import type { World, EntityId } from '@/engine/ecs/World';
import type { EventBus } from '@/engine/events/EventBus';
import type { ContentRepository } from '@/engine/content/ContentRepository';
import { EventTypes } from '@/gameplay/events/GameEventTypes';
import type { Health, Combat, Enemy, Position } from '../components';

export interface BossDef {
  id: string;
  name: string;
  enemyId: string;
  phases: Array<{
    phase: number;
    hpThresholdPct: number;
    attackCooldown: number;
    speed: number;
    behavior: string;
    color: string;
  }>;
}

export interface BossComponent {
  bossId: string;
  currentPhase: number;
}

export const BossComponentDef = {
  name: 'Boss',
  clone: <T>(src: T): T => ({ ...(src as object) } as T),
};

export class BossSystem implements System {
  readonly name = 'Boss';
  readonly phase = 'fixed';
  readonly priority = 35;

  constructor(
    private world: World,
    private events: EventBus,
    private content: ContentRepository
  ) {}

  update(ctx: SystemContext): void {
    for (const [ent, boss] of this.world.iter<BossComponent>('Boss')) {
      const health = this.world.getComponent<Health>(ent, 'Health');
      const combat = this.world.getComponent<Combat>(ent, 'Combat');
      const enemy = this.world.getComponent<Enemy>(ent, 'Enemy');
      if (!health || !combat || !enemy) continue;

      const def = this.content.get<BossDef>('bosses', boss.bossId);
      if (!def) continue;

      const hpPct = health.current / health.max;
      // Encontrar la fase correspondiente al porcentaje de HP actual
      let targetPhase = 1;
      for (const p of def.phases) {
        if (hpPct <= p.hpThresholdPct) {
          targetPhase = p.phase;
        }
      }

      if (targetPhase !== boss.currentPhase) {
        boss.currentPhase = targetPhase;
        const phaseData = def.phases.find((p) => p.phase === targetPhase);
        if (phaseData) {
          combat.attackCooldown = phaseData.attackCooldown;
          enemy.color = phaseData.color;
          (enemy as unknown as { speed: number }).speed = phaseData.speed;

          // Notificar cambio de fase vía EventBus
          this.events.emit(EventTypes.BOSS_PHASE_CHANGED, {
            bossEntity: ent,
            phase: targetPhase,
            name: def.name,
          });
          this.events.emit(EventTypes.SCREEN_SHAKE, { intensity: 12, time: 0.3 });
          this.events.emit(EventTypes.PLAY_SOUND, { id: 'levelup' });

          const pos = this.world.getComponent<Position>(ent, 'Position');
          if (pos) {
            this.events.emit(EventTypes.PARTICLE_BURST, {
              pos, count: 35, color: phaseData.color, speed: [120, 280],
              life: [0.4, 0.8], size: [4, 8], glow: true,
            });
            this.events.emit(EventTypes.FLOAT_TEXT, {
              target: ent, text: `FASE ${targetPhase}!`, color: phaseData.color,
            });
          }
        }
      }
    }
  }
}
