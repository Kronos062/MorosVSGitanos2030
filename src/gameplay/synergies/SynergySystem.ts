/**
 * SynergySystem.ts — evaluación automática de sinergias y resonancias (TDD Cap. 9).
 *
 * Requisito estricto del TDD Cap 9.17: "No será necesario programarlas manualmente una por una."
 * El sistema evalúa declarativamente las reglas en synergies.json y resonances.json
 * contra las armas equipadas, reliquias y mascotas del jugador.
 */

import type { System, SystemContext } from '@/engine/core/GameLoop';
import type { World } from '@/engine/ecs/World';
import type { EventBus } from '@/engine/events/EventBus';
import type { ContentRepository } from '@/engine/content/ContentRepository';
import { EventTypes } from '@/gameplay/events/GameEventTypes';
import type { Weapon, Pet } from '../components';

export interface SynergyRequirement {
  kind: 'weapon_tag' | 'relic_category' | 'has_pet';
  tag?: string;
  category?: string;
  petId?: string;
}

export interface SynergyDef {
  id: string;
  name: string;
  description: string;
  requires: SynergyRequirement[];
  effect: { kind: string; stat?: string; value?: number };
}

export interface ResonanceDef {
  id: string;
  name: string;
  description: string;
  requires: SynergyRequirement[];
  effect: { kind: string; event?: string; payload?: Record<string, unknown>; stat?: string; value?: number };
}

export class SynergySystem implements System {
  readonly name = 'Synergy';
  readonly phase = 'fixed';
  readonly priority = 90;

  activeSynergies = new Set<string>();
  activeResonances = new Set<string>();

  constructor(
    private world: World,
    private events: EventBus,
    private content: ContentRepository
  ) {}

  update(ctx: SystemContext): void {
    const playerEnt = this.world.getTag('player');
    if (playerEnt === undefined) return;

    const weapon = this.world.getComponent<Weapon>(playerEnt, 'Weapon');
    if (!weapon) return;

    // Obtener tags del arma
    const weaponTags: string[] = (weapon as unknown as { tags?: string[] }).tags ?? ['basic'];

    // Evaluar Sinergias
    const synergies = this.content.all<SynergyDef>('synergies');
    for (const syn of synergies) {
      if (this.evalRequirements(syn.requires, weaponTags)) {
        if (!this.activeSynergies.has(syn.id)) {
          this.activeSynergies.add(syn.id);
          this.events.emit(EventTypes.SYNERGY_UNLOCKED, { synergy: syn });
          this.events.emit(EventTypes.FLOAT_TEXT, {
            target: playerEnt,
            text: `¡SINERGIA: ${syn.name.toUpperCase()}!`,
            color: '#ffe14a',
          });
          this.events.emit(EventTypes.PLAY_SOUND, { id: 'levelup' });
        }
      } else {
        this.activeSynergies.delete(syn.id);
      }
    }

    // Evaluar Resonancias
    const resonances = this.content.all<ResonanceDef>('resonances');
    for (const res of resonances) {
      if (this.evalRequirements(res.requires, weaponTags)) {
        if (!this.activeResonances.has(res.id)) {
          this.activeResonances.add(res.id);
          this.events.emit(EventTypes.RESONANCE_TRIGGERED, { resonance: res });
          this.events.emit(EventTypes.FLOAT_TEXT, {
            target: playerEnt,
            text: `¡RESONANCIA: ${res.name.toUpperCase()}!`,
            color: '#b04dff',
          });
          this.events.emit(EventTypes.PLAY_SOUND, { id: 'levelup' });
        }
      } else {
        this.activeResonances.delete(res.id);
      }
    }

    void ctx;
  }

  private evalRequirements(reqs: SynergyRequirement[], weaponTags: string[]): boolean {
    for (const r of reqs) {
      if (r.kind === 'weapon_tag' && r.tag) {
        if (!weaponTags.includes(r.tag)) return false;
      } else if (r.kind === 'has_pet' && r.petId) {
        let found = false;
        for (const petEnt of this.world.getGroup('pets')) {
          const p = this.world.getComponent<Pet>(petEnt, 'Pet');
          if (p && p.id === r.petId) { found = true; break; }
        }
        if (!found) return false;
      }
    }
    return true;
  }
}
