/**
 * InputManager.ts — lectura de teclado y touch (TDD §3.3 engine/input).
 *
 * Expone un estado normalizado (movimiento, ataque, dash, interact, mapa, pausa)
 * y soporta reconfiguración de controles/teclas en tiempo de ejecución.
 */

import { v2, type Vec2 } from '../utils/math';

export interface KeyBindings {
  moveUp: string[];
  moveDown: string[];
  moveLeft: string[];
  moveRight: string[];
  attack: string[];
  dash: string[];
  interact: string[];
  map: string[];
  pause: string[];
}

export const DEFAULT_KEYBINDINGS: KeyBindings = {
  moveUp: ['KeyW', 'ArrowUp'],
  moveDown: ['KeyS', 'ArrowDown'],
  moveLeft: ['KeyA', 'ArrowLeft'],
  moveRight: ['KeyD', 'ArrowRight'],
  attack: ['Space', 'KeyJ'],
  dash: ['ShiftLeft', 'ShiftRight'],
  interact: ['KeyE'],
  map: ['KeyM'],
  pause: ['KeyP', 'Escape'],
};

const BINDINGS_KEY = 'mvg_keybindings_v1';

export interface InputState {
  move: Vec2; // -1..1 normalizado
  attack: boolean;
  attackPressed: boolean; // flanco de subida
  skill: boolean;
  skillPressed: boolean;
  dash: boolean;
  dashPressed: boolean;
  interact: boolean;
  interactPressed: boolean;
  map: boolean;
  mapPressed: boolean;
  pause: boolean;
  pausePressed: boolean;
  confirm: boolean;
  confirmPressed: boolean;
}

export class InputManager {
  private keys = new Set<string>();
  private prev: Partial<Record<string, boolean>> = {};
  private lastPollTime = -1;
  public bindings: KeyBindings = { ...DEFAULT_KEYBINDINGS };

  // Touch joystick
  private joyActive = false;
  private joyId: number | null = null;
  private joyCenter: Vec2 = v2();
  private joyPos: Vec2 = v2();
  private joyMaxR = 55;

  // Touch botones
  private attackTouchId: number | null = null;
  private skillTouchId: number | null = null;
  private dashTouchId: number | null = null;
  private attackTouch = false;
  private skillTouch = false;
  private dashTouch = false;

  state: InputState = {
    move: v2(),
    attack: false,
    attackPressed: false,
    skill: false,
    skillPressed: false,
    dash: false,
    dashPressed: false,
    interact: false,
    interactPressed: false,
    map: false,
    mapPressed: false,
    pause: false,
    pausePressed: false,
    confirm: false,
    confirmPressed: false,
  };

  constructor() {
    this.loadBindings();
    if (typeof window === 'undefined') return;
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
  }

  loadBindings(): void {
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(BINDINGS_KEY);
      if (raw) {
        const loaded = JSON.parse(raw);
        this.bindings = { ...DEFAULT_KEYBINDINGS, ...loaded };
      }
    } catch { /* noop */ }
  }

  saveBindings(): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(BINDINGS_KEY, JSON.stringify(this.bindings));
    } catch { /* noop */ }
  }

  setBinding(action: keyof KeyBindings, primaryCode: string): void {
    this.bindings[action] = [primaryCode];
    this.saveBindings();
  }

  resetBindings(): void {
    this.bindings = JSON.parse(JSON.stringify(DEFAULT_KEYBINDINGS));
    this.saveBindings();
  }

  private onKeyDown = (e: KeyboardEvent) => {
    this.keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
  };

  private onKeyUp = (e: KeyboardEvent) => {
    this.keys.delete(e.code);
  };

  private onBlur = () => {
    this.keys.clear();
  };

  attachTouch(joystickEl: HTMLElement, attackEl: HTMLElement, skillEl: HTMLElement, dashEl?: HTMLElement): void {
    joystickEl.addEventListener('touchstart', this.onJoyStart, { passive: false });
    joystickEl.addEventListener('touchmove', this.onJoyMove, { passive: false });
    joystickEl.addEventListener('touchend', this.onJoyEnd);
    joystickEl.addEventListener('touchcancel', this.onJoyEnd);

    this.bindButton(attackEl, (id) => { this.attackTouchId = id; }, (v) => { this.attackTouch = v; });
    this.bindButton(skillEl, (id) => { this.skillTouchId = id; }, (v) => { this.skillTouch = v; });
    if (dashEl) this.bindButton(dashEl, (id) => { this.dashTouchId = id; }, (v) => { this.dashTouch = v; });
  }

  private bindButton(el: HTMLElement, setId: (id: number | null) => void, setVal: (v: boolean) => void): void {
    el.addEventListener('touchstart', (e) => {
      e.preventDefault();
      const t = e.changedTouches[0];
      setId(t.identifier);
      setVal(true);
    }, { passive: false });
    const end = (e: TouchEvent) => {
      for (const t of Array.from(e.changedTouches)) {
        void t;
        setId(null);
        setVal(false);
      }
    };
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
  }

  private onJoyStart = (e: Event) => {
    const te = e as TouchEvent;
    te.preventDefault();
    const t = te.changedTouches[0];
    const el = te.currentTarget as HTMLElement;
    const rect = el.getBoundingClientRect();
    this.joyActive = true;
    this.joyId = t.identifier;
    this.joyCenter = v2(rect.left + rect.width / 2, rect.top + rect.height / 2);
    this.joyPos = v2(t.clientX, t.clientY);
  };

  private onJoyMove = (e: Event) => {
    const te = e as TouchEvent;
    te.preventDefault();
    for (const t of Array.from(te.changedTouches)) {
      if (t.identifier === this.joyId) this.joyPos = v2(t.clientX, t.clientY);
    }
  };

  private onJoyEnd = (e: Event) => {
    const te = e as TouchEvent;
    for (const t of Array.from(te.changedTouches)) {
      if (t.identifier === this.joyId) {
        this.joyActive = false;
        this.joyId = null;
      }
    }
  };

  private hasKey(codes: string[]): boolean {
    if (!codes) return false;
    return codes.some((code) => this.keys.has(code));
  }

  /** Calcula y devuelve el estado normalizado del frame. Advance edges solo 1 vez por frame. */
  poll(): InputState {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (this.lastPollTime > 0 && Math.abs(now - this.lastPollTime) < 2) {
      return this.state;
    }
    this.lastPollTime = now;

    let mx = 0, my = 0;
    if (this.hasKey(this.bindings.moveUp)) my -= 1;
    if (this.hasKey(this.bindings.moveDown)) my += 1;
    if (this.hasKey(this.bindings.moveLeft)) mx -= 1;
    if (this.hasKey(this.bindings.moveRight)) mx += 1;

    if (this.joyActive) {
      const dx = this.joyPos.x - this.joyCenter.x;
      const dy = this.joyPos.y - this.joyCenter.y;
      const mag = Math.hypot(dx, dy);
      if (mag > 8) {
        const clamped = Math.min(mag, this.joyMaxR);
        mx = (dx / mag) * (clamped / this.joyMaxR);
        my = (dy / mag) * (clamped / this.joyMaxR);
      }
    }

    const mag = Math.hypot(mx, my);
    if (mag > 1) { mx /= mag; my /= mag; }

    const attack = this.hasKey(this.bindings.attack) || this.attackTouch;
    const dash = this.hasKey(this.bindings.dash) || this.dashTouch;
    const interact = this.hasKey(this.bindings.interact) || this.skillTouch;
    const map = this.hasKey(this.bindings.map);
    const pause = this.hasKey(this.bindings.pause);
    const confirm = this.keys.has('Enter') || this.keys.has('Space');

    const prev = this.prev;
    const state: InputState = {
      move: v2(mx, my),
      attack,
      attackPressed: attack && !prev.attack,
      skill: dash,
      skillPressed: dash && !prev.dash,
      dash,
      dashPressed: dash && !prev.dash,
      interact,
      interactPressed: interact && !prev.interact,
      map,
      mapPressed: map && !prev.map,
      pause,
      pausePressed: pause && !prev.pause,
      confirm,
      confirmPressed: confirm && !prev.confirm,
    };

    this.prev = { attack, dash, interact, map, pause, confirm };
    this.state = state;
    return state;
  }

  getJoystickOffset(): Vec2 {
    if (!this.joyActive) return v2();
    const dx = this.joyPos.x - this.joyCenter.x;
    const dy = this.joyPos.y - this.joyCenter.y;
    const mag = Math.hypot(dx, dy);
    if (mag < 1) return v2();
    const clamped = Math.min(mag, this.joyMaxR);
    return v2((dx / mag) * clamped, (dy / mag) * clamped);
  }

  dispose(): void {
    if (typeof window === 'undefined') return;
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
  }
}
