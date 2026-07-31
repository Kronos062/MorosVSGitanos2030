/**
 * ParticleSystem.ts — sistema de partículas optimizado con ObjectPool (TDD §3.3, §7, Fase 6).
 *
 * Utiliza ObjectPool para reciclar componentes de partículas sin causar
 * pausas de Garbage Collector durante explosiones masivas de combate.
 */

import type { World, EntityId } from '../ecs/World';
import type { EventBus } from '../events/EventBus';
import type { Vec2 } from '../utils/math';
import { EventTypes } from '@/gameplay/events/GameEventTypes';
import { ObjectPool } from '../ecs/ObjectPool';

export interface ParticleBurstEvent {
  pos: Vec2;
  count: number;
  color: string;
  speed?: [number, number];
  life?: [number, number];
  size?: [number, number];
  gravity?: number;
  glow?: boolean;
  spread?: number;
  direction?: Vec2;
}

export interface ParticleComponent {
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  gravity: number;
  glow: boolean;
}

export interface PositionComponent {
  x: number;
  y: number;
}

export const ParticleComponentDef = {
  name: 'Particle',
  clone: <T>(src: T): T => ({ ...(src as object) } as T),
};

export const PositionComponentDef = {
  name: 'Position',
  clone: <T>(src: T): T => ({ ...(src as object) } as T),
};

export class ParticleSystem {
  private particlePool: ObjectPool<ParticleComponent>;

  constructor(private world: World, private events: EventBus) {
    this.particlePool = new ObjectPool<ParticleComponent>(
      () => ({
        vx: 0, vy: 0, life: 0, maxLife: 0, size: 0, color: '#fff', gravity: 0, glow: false,
      }),
      (p) => {
        p.vx = 0; p.vy = 0; p.life = 0; p.maxLife = 0; p.size = 0; p.color = '#fff'; p.gravity = 0; p.glow = false;
      },
      64
    );

    this.events.on<ParticleBurstEvent>(EventTypes.PARTICLE_BURST, (e) => this.burst(e));
  }

  private burst(e: ParticleBurstEvent): void {
    const [sMin, sMax] = e.speed ?? [50, 200];
    const [lMin, lMax] = e.life ?? [0.3, 0.7];
    const [szMin, szMax] = e.size ?? [2, 5];
    const spread = e.spread ?? Math.PI * 2;
    const baseAngle = e.direction ? Math.atan2(e.direction.y, e.direction.x) : 0;

    for (let i = 0; i < e.count; i++) {
      const angle = baseAngle + (Math.random() - 0.5) * spread;
      const speed = sMin + Math.random() * (sMax - sMin);
      const life = lMin + Math.random() * (lMax - lMin);
      const size = szMin + Math.random() * (szMax - szMin);

      const particle = this.particlePool.acquire();
      particle.vx = Math.cos(angle) * speed;
      particle.vy = Math.sin(angle) * speed;
      particle.life = life;
      particle.maxLife = life;
      particle.size = size;
      particle.color = e.color;
      particle.gravity = e.gravity ?? 0;
      particle.glow = e.glow ?? false;

      const ent = this.world.createEntity();
      this.world.addComponent<PositionComponent>(ent, 'Position', { x: e.pos.x, y: e.pos.y });
      this.world.addComponent<ParticleComponent>(ent, 'Particle', particle);
    }
  }

  update(dt: number): void {
    const toKill: EntityId[] = [];
    for (const [ent, p] of this.world.iter<ParticleComponent>('Particle')) {
      const pos = this.world.getComponent<PositionComponent>(ent, 'Position');
      if (!pos) {
        toKill.push(ent);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx *= 0.96;
      p.vy *= 0.96;
      pos.x += p.vx * dt;
      pos.y += p.vy * dt;
      p.life -= dt;
      if (p.life <= 0) {
        this.particlePool.release(p);
        toKill.push(ent);
      }
    }
    for (const ent of toKill) this.world.destroyEntity(ent);
  }
}
