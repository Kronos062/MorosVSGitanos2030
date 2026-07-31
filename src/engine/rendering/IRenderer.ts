/**
 * IRenderer.ts — interfaz del renderer (TDD §3.5).
 *
 * Ningún sistema de gameplay llama al Canvas2DRenderingContext directamente:
 * todos emiten RenderCommands que el IRenderer interpreta. Esto permite
 * migrar a WebGL en el futuro sin tocar CombatSystem, MovementSystem, etc.
 */

import type { Vec2 } from '../utils/math';

export type RenderCommandKind =
  | 'rect'
  | 'circle'
  | 'line'
  | 'polygon'
  | 'text'
  | 'sprite';

export interface BaseCmd {
  kind: RenderCommandKind;
  x: number;
  y: number;
  rotation?: number;
  scale?: number;
  layer?: number; // menor = dibujado antes
  glow?: number; // radio de blur
  glowColor?: string;
  alpha?: number;
}

export interface RectCmd extends BaseCmd {
  kind: 'rect';
  w: number;
  h: number;
  color: string;
  outline?: { color: string; width: number };
}

export interface CircleCmd extends BaseCmd {
  kind: 'circle';
  radius: number;
  color: string;
  outline?: { color: string; width: number };
}

export interface LineCmd extends BaseCmd {
  kind: 'line';
  x2: number;
  y2: number;
  color: string;
  width: number;
}

export interface PolygonCmd extends BaseCmd {
  kind: 'polygon';
  points: Vec2[];
  color: string;
  outline?: { color: string; width: number };
}

export interface TextCmd extends BaseCmd {
  kind: 'text';
  text: string;
  font?: string;
  color: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  outline?: { color: string; width: number };
}

export interface SpriteCmd extends BaseCmd {
  kind: 'sprite';
  image: HTMLImageElement | HTMLCanvasElement;
  srcRect?: { x: number; y: number; w: number; h: number };
  dstW: number;
  dstH: number;
}

export type RenderCommand =
  | RectCmd
  | CircleCmd
  | LineCmd
  | PolygonCmd
  | TextCmd
  | SpriteCmd;

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

/**
 * IRenderer — contrato que cumple cualquier implementación (Canvas2D, WebGL).
 */
export interface IRenderer {
  /** Tamaño lógico del viewport (no el tamaño físico del canvas). */
  readonly viewWidth: number;
  readonly viewHeight: number;
  /** Tamaño del mundo en unidades de juego. */
  readonly worldWidth: number;
  readonly worldHeight: number;

  setCamera(camera: CameraState): void;
  setShake(intensity: number, time: number): void;

  /** Limpia el frame y prepara para dibujar. */
  beginFrame(): void;
  /** Acepta una lista de comandos y los dibuja ordenados por layer. */
  draw(commands: RenderCommand[]): void;
  /** Finaliza el frame. */
  endFrame(): void;

  /** Redimensiona el viewport. */
  resize(width: number, height: number): void;
}
