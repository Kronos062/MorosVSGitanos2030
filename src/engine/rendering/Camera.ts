/**
 * Camera.ts — sistema de cámara y temblor de pantalla desacoplado (TDD §3.3 engine/rendering).
 *
 * Mantiene la posición, zoom, seguimiento con lerp y decaimiento del temblor de pantalla (screen shake).
 * Pura matemática de renderizado 2D, agnóstica de cualquier juego.
 */

import { lerp, type Vec2, v2 } from '../utils/math';

export interface CameraState {
  x: number;
  y: number;
  zoom: number;
}

export class Camera {
  public x = 0;
  public y = 0;
  public zoom = 1;

  private targetX = 0;
  private targetY = 0;
  private targetZoom = 1;

  private shakeIntensity = 0;
  private shakeTime = 0;

  constructor(initialX = 0, initialY = 0, initialZoom = 1) {
    this.x = initialX;
    this.y = initialY;
    this.zoom = initialZoom;
    this.targetX = initialX;
    this.targetY = initialY;
    this.targetZoom = initialZoom;
  }

  setTarget(x: number, y: number, zoom = 1): void {
    this.targetX = x;
    this.targetY = y;
    this.targetZoom = zoom;
  }

  setPosition(x: number, y: number, zoom = 1): void {
    this.x = x;
    this.y = y;
    this.zoom = zoom;
    this.targetX = x;
    this.targetY = y;
    this.targetZoom = zoom;
  }

  addShake(intensity: number, duration: number): void {
    this.shakeIntensity = Math.max(this.shakeIntensity, intensity);
    this.shakeTime = Math.max(this.shakeTime, duration);
  }

  update(dt: number, lerpFactor = 0.15): void {
    this.x = lerp(this.x, this.targetX, lerpFactor);
    this.y = lerp(this.y, this.targetY, lerpFactor);
    this.zoom = lerp(this.zoom, this.targetZoom, lerpFactor);

    if (this.shakeTime > 0) {
      this.shakeTime -= dt;
      if (this.shakeTime <= 0) {
        this.shakeTime = 0;
        this.shakeIntensity = 0;
      }
    }
  }

  getShakeOffset(): Vec2 {
    if (this.shakeTime <= 0) return v2(0, 0);
    const factor = this.shakeIntensity * (this.shakeTime / 0.3);
    return v2(
      (Math.random() - 0.5) * factor * 2,
      (Math.random() - 0.5) * factor * 2
    );
  }

  getState(): CameraState {
    return { x: this.x, y: this.y, zoom: this.zoom };
  }
}
