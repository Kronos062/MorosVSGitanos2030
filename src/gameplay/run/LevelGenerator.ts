/**
 * LevelGenerator.ts — generación procedural del mapa lineal continuo (TDD §7).
 *
 * Genera un mapa espacial compuesto por nodos interconectados (Salas, Pasillos,
 * Salas de Tesoro, Sala de Jefe). El jugador recorre físicamente los pasillos
 * entre sala y sala sin teletransporte ni descargas de mundo.
 */

import type { ContentRepository } from '@/engine/content/ContentRepository';
import type { MapNodeType } from '../components';

export interface MapNodeDef {
  index: number;
  type: MapNodeType;
  roomId: string;
  biomeId: string;
  difficulty: number;
  level: number;
  bounds: { x: number; y: number; w: number; h: number };
  entryDoor: { x: number; y: number; w: number; h: number };
  exitDoor: { x: number; y: number; w: number; h: number };
  waves: Array<{ enemies: Array<{ id: string; count: number }>; pacing: string }>;
  pickupPool: string[];
  chestSpawns?: Array<{ x: number; y: number; chestId: string }>;
}

export interface MapPlan {
  nodes: MapNodeDef[];
  totalWidth: number;
  totalHeight: number;
}

export class LevelGenerator {
  constructor(
    private content: ContentRepository,
    private readonly levelsPerRun = 10
  ) {}

  /** Genera el mapa continuo completo de la Run con nodos interconectados. */
  generateMap(seed: number): MapPlan {
    let s = seed >>> 0;
    const rnd = () => {
      s = (s + 0x6d2b79f5) >>> 0;
      let r = s;
      r = Math.imul(r ^ (r >>> 15), r | 1);
      r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
      return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
    };

    const biomes = this.content.all<{ id: string; waveDifficulty: number }>('biomes');
    const rooms = this.content.all<{
      id: string; width: number; height: number;
      waves: Array<{ enemies: Array<{ id: string; count: number }>; pacing: string }>;
      pickupPool: string[];
      chestSpawns?: Array<{ x: number; y: number; chestId: string }>;
    }>('rooms');

    if (rooms.length === 0 || biomes.length === 0) {
      throw new Error('LevelGenerator: faltan rooms o biomes en el content');
    }

    const nodes: MapNodeDef[] = [];
    let currentX = 0;
    let nodeIndex = 0;
    let maxHeight = 800;

    for (let lvl = 1; lvl <= this.levelsPerRun; lvl++) {
      const biome = biomes[Math.floor(rnd() * biomes.length)];
      const roomBase = rooms[Math.floor(rnd() * rooms.length)];
      const difficulty = (1 + (lvl - 1) * 0.18) * biome.waveDifficulty;

      let type: MapNodeType = 'room';
      if (lvl === 5) type = 'treasure';
      else if (lvl === this.levelsPerRun) type = 'boss';

      const rWidth = roomBase.width ?? 1280;
      const rHeight = roomBase.height ?? 800;
      maxHeight = Math.max(maxHeight, rHeight);

      const doorH = 80;
      const doorW = 16;
      const doorY = Math.floor(rHeight / 2 - doorH / 2);

      // Nodo de Sala
      const roomNode: MapNodeDef = {
        index: nodeIndex++,
        type,
        roomId: roomBase.id,
        biomeId: biome.id,
        difficulty,
        level: lvl,
        bounds: { x: currentX, y: 0, w: rWidth, h: rHeight },
        entryDoor: { x: currentX, y: doorY, w: doorW, h: doorH },
        exitDoor: { x: currentX + rWidth - doorW, y: doorY, w: doorW, h: doorH },
        waves: roomBase.waves ?? [{ enemies: [{ id: 'grunt', count: 3 }], pacing: 'normal' }],
        pickupPool: roomBase.pickupPool ?? ['heal', 'score'],
        chestSpawns: roomBase.chestSpawns?.map((cs) => ({
          x: currentX + cs.x,
          y: cs.y,
          chestId: cs.chestId,
        })),
      };
      nodes.push(roomNode);
      currentX += rWidth;

      // Nodo de Pasillo conector (si no es la última sala)
      if (lvl < this.levelsPerRun) {
        const corrW = 400;
        const corrH = 200;
        const corrY = Math.floor(rHeight / 2 - corrH / 2);

        const corridorNode: MapNodeDef = {
          index: nodeIndex++,
          type: 'corridor',
          roomId: 'corridor_gen',
          biomeId: biome.id,
          difficulty: 1.0,
          level: lvl,
          bounds: { x: currentX, y: corrY, w: corrW, h: corrH },
          entryDoor: { x: currentX, y: doorY, w: doorW, h: doorH },
          exitDoor: { x: currentX + corrW - doorW, y: doorY, w: doorW, h: doorH },
          waves: [],
          pickupPool: [],
        };
        nodes.push(corridorNode);
        currentX += corrW;
      }
    }

    return {
      nodes,
      totalWidth: currentX,
      totalHeight: maxHeight,
    };
  }
}
