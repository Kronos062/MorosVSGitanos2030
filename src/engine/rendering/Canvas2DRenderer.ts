/**
 * Canvas2DRenderer.ts — implementación de IRenderer sobre Canvas 2D (TDD §3.5).
 *
 * Interpreta los RenderCommands. En el futuro podrá reemplazarse por
 * WebGLRenderer sin que ningún System tenga que cambiar.
 */

import type {
  IRenderer,
  RenderCommand,
  CameraState,
  CircleCmd,
  RectCmd,
  LineCmd,
  PolygonCmd,
  TextCmd,
  SpriteCmd,
} from './IRenderer';
import { lerp } from '../utils/math';

export class Canvas2DRenderer implements IRenderer {
  private ctx: CanvasRenderingContext2D;
  private dpr = 1;
  private camera: CameraState = { x: 0, y: 0, zoom: 1 };
  private targetCamera: CameraState = { x: 0, y: 0, zoom: 1 };
  private shakeIntensity = 0;
  private shakeTime = 0;
  public viewWidth: number;
  public viewHeight: number;
  public readonly worldWidth: number;
  public readonly worldHeight: number;

  constructor(
    private readonly canvas: HTMLCanvasElement,
    worldWidth: number,
    worldHeight: number
  ) {
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error('Canvas2DRenderer: no se pudo obtener contexto 2D');
    this.ctx = ctx;
    this.worldWidth = worldWidth;
    this.worldHeight = worldHeight;
    this.viewWidth = window.innerWidth;
    this.viewHeight = window.innerHeight;
    this.resize(this.viewWidth, this.viewHeight);
  }

  setCamera(camera: CameraState): void {
    this.targetCamera = { ...camera };
  }

  setShake(intensity: number, time: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = Math.max(this.shakeTime, time);
  }

  resize(width: number, height: number): void {
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.viewWidth = width;
    this.viewHeight = height;
    this.canvas.width = Math.floor(width * this.dpr);
    this.canvas.height = Math.floor(height * this.dpr);
    this.canvas.style.width = width + 'px';
    this.canvas.style.height = height + 'px';
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
  }

  beginFrame(): void {
    // Cámara con easing
    this.camera.x = lerp(this.camera.x, this.targetCamera.x, 0.15);
    this.camera.y = lerp(this.camera.y, this.targetCamera.y, 0.15);
    this.camera.zoom = lerp(this.camera.zoom, this.targetCamera.zoom, 0.15);

    // Fondo
    const g = this.ctx.createRadialGradient(
      this.viewWidth / 2,
      this.viewHeight / 2,
      0,
      this.viewWidth / 2,
      this.viewHeight / 2,
      Math.max(this.viewWidth, this.viewHeight) * 0.7
    );
    g.addColorStop(0, '#0d1228');
    g.addColorStop(1, '#05060d');
    this.ctx.fillStyle = g;
    this.ctx.fillRect(0, 0, this.viewWidth, this.viewHeight);
  }

  draw(commands: RenderCommand[]): void {
    // Ordenar por layer
    const sorted = commands
      .slice()
      .sort((a, b) => (a.layer ?? 0) - (b.layer ?? 0));

    // Shake
    let shakeX = 0;
    let shakeY = 0;
    if (this.shakeTime > 0) {
      const i = this.shakeIntensity * (this.shakeTime / 0.3);
      shakeX = (Math.random() - 0.5) * i * 2;
      shakeY = (Math.random() - 0.5) * i * 2;
    }

    // Escala para ajustar mundo a viewport
    const scale = Math.min(this.viewWidth / this.worldWidth, this.viewHeight / this.worldHeight) * 0.92;

    this.ctx.save();
    this.ctx.translate(this.viewWidth / 2 + shakeX, this.viewHeight / 2 + shakeY);
    this.ctx.scale(scale * this.camera.zoom, scale * this.camera.zoom);
    this.ctx.translate(-this.camera.x, -this.camera.y);

    for (const cmd of sorted) this.drawCmd(cmd);

    this.ctx.restore();
  }

  private applyGlow(cmd: RenderCommand): void {
    if (cmd.glow && cmd.glowColor) {
      this.ctx.shadowColor = cmd.glowColor;
      this.ctx.shadowBlur = cmd.glow;
    } else {
      this.ctx.shadowBlur = 0;
    }
    this.ctx.globalAlpha = cmd.alpha ?? 1;
  }

  private clearGlow(): void {
    this.ctx.shadowBlur = 0;
    this.ctx.globalAlpha = 1;
  }

  private drawCmd(cmd: RenderCommand): void {
    this.applyGlow(cmd);
    switch (cmd.kind) {
      case 'rect':
        this.drawRect(cmd);
        break;
      case 'circle':
        this.drawCircle(cmd);
        break;
      case 'line':
        this.drawLine(cmd);
        break;
      case 'polygon':
        this.drawPolygon(cmd);
        break;
      case 'text':
        this.drawText(cmd);
        break;
      case 'sprite':
        this.drawSprite(cmd);
        break;
    }
    this.clearGlow();
  }

  private drawRect(c: RectCmd): void {
    this.ctx.save();
    this.ctx.translate(c.x, c.y);
    if (c.rotation) this.ctx.rotate(c.rotation);
    if (c.scale && c.scale !== 1) this.ctx.scale(c.scale, c.scale);
    this.ctx.fillStyle = c.color;
    this.ctx.fillRect(-c.w / 2, -c.h / 2, c.w, c.h);
    if (c.outline) {
      this.ctx.strokeStyle = c.outline.color;
      this.ctx.lineWidth = c.outline.width;
      this.ctx.strokeRect(-c.w / 2, -c.h / 2, c.w, c.h);
    }
    this.ctx.restore();
  }

  private drawCircle(c: CircleCmd): void {
    this.ctx.save();
    this.ctx.translate(c.x, c.y);
    if (c.scale && c.scale !== 1) this.ctx.scale(c.scale, c.scale);
    this.ctx.fillStyle = c.color;
    this.ctx.beginPath();
    this.ctx.arc(0, 0, c.radius, 0, Math.PI * 2);
    this.ctx.fill();
    if (c.outline) {
      this.ctx.strokeStyle = c.outline.color;
      this.ctx.lineWidth = c.outline.width;
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawLine(c: LineCmd): void {
    this.ctx.strokeStyle = c.color;
    this.ctx.lineWidth = c.width;
    this.ctx.beginPath();
    this.ctx.moveTo(c.x, c.y);
    this.ctx.lineTo(c.x2, c.y2);
    this.ctx.stroke();
  }

  private drawPolygon(c: PolygonCmd): void {
    if (c.points.length < 2) return;
    this.ctx.save();
    this.ctx.translate(c.x, c.y);
    if (c.rotation) this.ctx.rotate(c.rotation);
    if (c.scale && c.scale !== 1) this.ctx.scale(c.scale, c.scale);
    this.ctx.beginPath();
    this.ctx.moveTo(c.points[0].x, c.points[0].y);
    for (let i = 1; i < c.points.length; i++) {
      this.ctx.lineTo(c.points[i].x, c.points[i].y);
    }
    this.ctx.closePath();
    this.ctx.fillStyle = c.color;
    this.ctx.fill();
    if (c.outline) {
      this.ctx.strokeStyle = c.outline.color;
      this.ctx.lineWidth = c.outline.width;
      this.ctx.stroke();
    }
    this.ctx.restore();
  }

  private drawText(c: TextCmd): void {
    this.ctx.save();
    this.ctx.translate(c.x, c.y);
    if (c.rotation) this.ctx.rotate(c.rotation);
    this.ctx.font = c.font ?? 'bold 14px monospace';
    this.ctx.textAlign = c.align ?? 'center';
    this.ctx.textBaseline = c.baseline ?? 'middle';
    if (c.outline) {
      this.ctx.strokeStyle = c.outline.color;
      this.ctx.lineWidth = c.outline.width;
      this.ctx.strokeText(c.text, 0, 0);
    }
    this.ctx.fillStyle = c.color;
    this.ctx.fillText(c.text, 0, 0);
    this.ctx.restore();
  }

  private drawSprite(c: SpriteCmd): void {
    this.ctx.save();
    this.ctx.translate(c.x, c.y);
    if (c.rotation) this.ctx.rotate(c.rotation);
    if (c.scale && c.scale !== 1) this.ctx.scale(c.scale, c.scale);
    const sx = c.srcRect?.x ?? 0;
    const sy = c.srcRect?.y ?? 0;
    const sw = c.srcRect?.w ?? c.image.width;
    const sh = c.srcRect?.h ?? c.image.height;
    this.ctx.drawImage(
      c.image,
      sx, sy, sw, sh,
      -c.dstW / 2, -c.dstH / 2, c.dstW, c.dstH
    );
    this.ctx.restore();
  }

  endFrame(): void {
    // Decaer shake
    if (this.shakeTime > 0) {
      this.shakeTime -= 1 / 60;
      if (this.shakeTime < 0) {
        this.shakeTime = 0;
        this.shakeIntensity = 0;
      }
    }
  }
}
