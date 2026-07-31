/**
 * RadarSystem.ts — cálculo de posiciones para el radar/minimapa táctico y mapa global (TDD §3.3, §7).
 *
 * Mantiene la representación del mapa táctico minimizado para el HUD y el mapa global completo
 * de todas las salas y pasillos conectores que se abre pulsando 'M'.
 */

import type { System, SystemContext } from '@/engine/core/GameLoop';
import type { World, EntityId } from '@/engine/ecs/World';
import type { InputState } from '@/engine/input/InputManager';
import type { Position, Door, MapNode, MapNodeType } from '../components';
import type { ChestComponent } from './ChestSystem';

export interface RadarDot {
  x: number; // 0..1 relativo al nodo activo
  y: number; // 0..1 relativo al nodo activo
  kind: 'player' | 'enemy' | 'boss' | 'chest' | 'door';
}

export interface GlobalMapNode {
  index: number;
  type: MapNodeType;
  level: number;
  status: 'unvisited' | 'active' | 'cleared';
  bounds: { x: number; y: number; w: number; h: number };
}

export interface RadarData {
  dots: RadarDot[];
  roomRatio: number;
  globalNodes: GlobalMapNode[];
  playerGlobalPos: { x: number; y: number } | null;
  activeNodeIndex: number;
  mapOpened: boolean;
}

export class RadarSystem implements System {
  readonly name = 'Radar';
  readonly phase = 'render';
  readonly priority = 98;

  radarData: RadarData = {
    dots: [],
    roomRatio: 1.6,
    globalNodes: [],
    playerGlobalPos: null,
    activeNodeIndex: 0,
    mapOpened: false,
  };

  constructor(private getInput?: () => InputState) {}

  update(ctx: SystemContext): void {
    if (this.getInput) {
      const input = this.getInput();
      if (input.mapPressed) {
        this.radarData.mapOpened = !this.radarData.mapOpened;
      }
    }

    const playerEnt = ctx.world.getTag('player');
    const pPos = playerEnt !== undefined ? ctx.world.getComponent<Position>(playerEnt, 'Position') : null;

    // Recopilar todos los nodos del mapa global
    const globalNodes: GlobalMapNode[] = [];
    let activeNode: MapNode | null = null;

    for (const [, node] of ctx.world.iter<MapNode>('MapNode')) {
      globalNodes.push({
        index: node.index,
        type: node.type,
        level: node.level,
        status: node.status,
        bounds: node.bounds,
      });

      if (pPos) {
        const b = node.bounds;
        if (pPos.x >= b.x - 20 && pPos.x <= b.x + b.w + 20 &&
            pPos.y >= b.y - 20 && pPos.y <= b.y + b.h + 20) {
          activeNode = node;
        }
      }
    }

    globalNodes.sort((a, b) => a.index - b.index);

    if (!activeNode) {
      for (const [, node] of ctx.world.iter<MapNode>('MapNode')) {
        if (node.status === 'active') { activeNode = node; break; }
      }
    }

    if (!activeNode) {
      for (const [, node] of ctx.world.iter<MapNode>('MapNode')) {
        activeNode = node;
        break;
      }
    }

    if (!activeNode) return;

    const b = activeNode.bounds;
    const rW = b.w;
    const rH = b.h;
    const dots: RadarDot[] = [];

    // Jugador
    if (pPos) {
      dots.push({
        x: Math.max(0, Math.min(1, (pPos.x - b.x) / rW)),
        y: Math.max(0, Math.min(1, (pPos.y - b.y) / rH)),
        kind: 'player',
      });
    }

    // Puertas del nodo
    if (activeNode.exitDoorEnt) {
      const d = ctx.world.getComponent<Door>(activeNode.exitDoorEnt, 'Door');
      if (d) {
        dots.push({
          x: Math.max(0, Math.min(1, (d.x + d.w / 2 - b.x) / rW)),
          y: Math.max(0, Math.min(1, (d.y + d.h / 2 - b.y) / rH)),
          kind: 'door',
        });
      }
    }

    // Cofres en el nodo activo
    for (const ent of ctx.world.getGroup('chests')) {
      const pos = ctx.world.getComponent<Position>(ent, 'Position');
      const chest = ctx.world.getComponent<ChestComponent>(ent, 'Chest');
      if (pos && chest && !chest.opened) {
        if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) {
          dots.push({
            x: Math.max(0, Math.min(1, (pos.x - b.x) / rW)),
            y: Math.max(0, Math.min(1, (pos.y - b.y) / rH)),
            kind: 'chest',
          });
        }
      }
    }

    // Enemigos & Bosses en el nodo activo
    for (const ent of ctx.world.getGroup('enemies')) {
      const pos = ctx.world.getComponent<Position>(ent, 'Position');
      if (!pos) continue;
      if (pos.x >= b.x && pos.x <= b.x + b.w && pos.y >= b.y && pos.y <= b.y + b.h) {
        const isBoss = ctx.world.hasComponent(ent, 'Boss');
        dots.push({
          x: Math.max(0, Math.min(1, (pos.x - b.x) / rW)),
          y: Math.max(0, Math.min(1, (pos.y - b.y) / rH)),
          kind: isBoss ? 'boss' : 'enemy',
        });
      }
    }

    this.radarData = {
      dots,
      roomRatio: rW / rH,
      globalNodes,
      playerGlobalPos: pPos ? { x: pPos.x, y: pPos.y } : null,
      activeNodeIndex: activeNode.index,
      mapOpened: this.radarData.mapOpened,
    };
  }
}
