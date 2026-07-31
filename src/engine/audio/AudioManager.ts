/**
 * AudioManager.ts — audio procedural del motor (TDD §3.3 engine/audio).
 *
 * Sintetiza SFX con Web Audio API (sin assets externos). Los sistemas emiten
 * eventos `PLAY_SOUND` con un id; este manager los interpreta y toca el
 * sonido correspondiente. Los sonidos son data-driven: se registran
 * definiciones y el manager las sintetiza.
 */

export interface SoundDef {
  id: string;
  synth: (ctx: AudioContext, master: GainNode) => void;
}

export class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private sounds = new Map<string, SoundDef>();
  private muted = false;
  private volume = 0.3;

  register(def: SoundDef): void {
    this.sounds.set(def.id, def);
  }

  private ensure(): void {
    if (this.ctx) return;
    if (typeof window === 'undefined') return;
    try {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.master.connect(this.ctx.destination);
    } catch {
      // sin audio
    }
  }

  resume(): void {
    this.ensure();
    if (this.ctx?.state === 'suspended') this.ctx.resume();
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : this.volume;
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master && !this.muted) this.master.gain.value = v;
  }

  play(id: string): void {
    this.ensure();
    if (!this.ctx || !this.master) return;
    const def = this.sounds.get(id);
    if (!def) return;
    try {
      def.synth(this.ctx, this.master);
    } catch (e) {
      console.warn(`AudioManager: error sintetizando "${id}"`, e);
    }
  }

  /** Helpers comunes usados por el gameplay. */
  static synthShoot(ctx: AudioContext, master: GainNode): void {
    playTone(ctx, master, 880, 0.07, 'square', 0.15, 220);
  }
  static synthHit(ctx: AudioContext, master: GainNode): void {
    playTone(ctx, master, 440, 0.08, 'square', 0.18, 880);
  }
  static synthKill(ctx: AudioContext, master: GainNode): void {
    playTone(ctx, master, 660, 0.12, 'square', 0.2, 1320);
    setTimeout(() => playTone(ctx, master, 990, 0.1, 'square', 0.15, 1980), 40);
  }
  static synthHurt(ctx: AudioContext, master: GainNode): void {
    playTone(ctx, master, 110, 0.25, 'sawtooth', 0.3, 55);
    playNoise(ctx, master, 0.2, 0.25, 400);
  }
  static synthPickup(ctx: AudioContext, master: GainNode): void {
    playTone(ctx, master, 880, 0.08, 'triangle', 0.2, 1760);
    setTimeout(() => playTone(ctx, master, 1320, 0.1, 'triangle', 0.2, 1760), 60);
  }
  static synthLevelUp(ctx: AudioContext, master: GainNode): void {
    [660, 880, 1320, 1760].forEach((f, i) =>
      setTimeout(() => playTone(ctx, master, f, 0.15, 'triangle', 0.25), i * 80)
    );
  }
  static synthDash(ctx: AudioContext, master: GainNode): void {
    playNoise(ctx, master, 0.12, 0.15, 2000);
    playTone(ctx, master, 440, 0.1, 'sine', 0.1, 880);
  }
  static synthExplosion(ctx: AudioContext, master: GainNode): void {
    playNoise(ctx, master, 0.4, 0.35, 500);
    playTone(ctx, master, 80, 0.4, 'sawtooth', 0.3, 30);
  }
  static synthButton(ctx: AudioContext, master: GainNode): void {
    playTone(ctx, master, 1100, 0.05, 'square', 0.1, 1650);
  }
}

function playTone(
  ctx: AudioContext,
  master: GainNode,
  freq: number,
  dur: number,
  type: OscillatorType,
  vol: number,
  sweep?: number
): void {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, ctx.currentTime);
  if (sweep !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), ctx.currentTime + dur);
  }
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  osc.connect(gain);
  gain.connect(master);
  osc.start();
  osc.stop(ctx.currentTime + dur);
}

function playNoise(
  ctx: AudioContext,
  master: GainNode,
  dur: number,
  vol: number,
  filterFreq: number
): void {
  const bufSize = ctx.sampleRate * dur;
  const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = filterFreq;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(vol, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(master);
  src.start();
}
