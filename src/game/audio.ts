export class AudioManager {
  private ctx: AudioContext | null = null;
  private volume = 0.7;
  private enabled = true;

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  getVolume() {
    return this.volume;
  }

  private ensure() {
    if (!this.ctx) {
      this.ctx = new AudioContext();
    }
    if (this.ctx.state === 'suspended') {
      void this.ctx.resume();
    }
    return this.ctx;
  }

  resume() {
    this.ensure();
  }

  play(id: string) {
    if (!this.enabled || this.volume <= 0) return;
    try {
      const ctx = this.ensure();
      const t = ctx.currentTime;
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      gain.gain.value = this.volume * 0.25;

      const osc = ctx.createOscillator();
      const g2 = ctx.createGain();
      g2.connect(gain);

      switch (id) {
        case 'shoot':
          osc.type = 'square';
          osc.frequency.setValueAtTime(880, t);
          osc.frequency.exponentialRampToValueAtTime(220, t + 0.08);
          g2.gain.setValueAtTime(0.3, t);
          g2.gain.exponentialRampToValueAtTime(0.001, t + 0.08);
          osc.connect(g2);
          osc.start(t);
          osc.stop(t + 0.09);
          break;
        case 'shoot_heavy':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(180, t);
          osc.frequency.exponentialRampToValueAtTime(60, t + 0.15);
          g2.gain.setValueAtTime(0.4, t);
          g2.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
          osc.connect(g2);
          osc.start(t);
          osc.stop(t + 0.16);
          break;
        case 'hit':
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(400, t);
          osc.frequency.exponentialRampToValueAtTime(100, t + 0.06);
          g2.gain.setValueAtTime(0.25, t);
          g2.gain.exponentialRampToValueAtTime(0.001, t + 0.06);
          osc.connect(g2);
          osc.start(t);
          osc.stop(t + 0.07);
          break;
        case 'kill':
          osc.type = 'square';
          osc.frequency.setValueAtTime(300, t);
          osc.frequency.exponentialRampToValueAtTime(80, t + 0.2);
          g2.gain.setValueAtTime(0.35, t);
          g2.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
          osc.connect(g2);
          osc.start(t);
          osc.stop(t + 0.21);
          break;
        case 'hurt':
        case 'death':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(150, t);
          osc.frequency.exponentialRampToValueAtTime(40, t + 0.25);
          g2.gain.setValueAtTime(0.4, t);
          g2.gain.exponentialRampToValueAtTime(0.001, t + 0.25);
          osc.connect(g2);
          osc.start(t);
          osc.stop(t + 0.26);
          break;
        case 'pickup':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(520, t);
          osc.frequency.exponentialRampToValueAtTime(880, t + 0.12);
          g2.gain.setValueAtTime(0.3, t);
          g2.gain.exponentialRampToValueAtTime(0.001, t + 0.12);
          osc.connect(g2);
          osc.start(t);
          osc.stop(t + 0.13);
          break;
        case 'levelup':
        case 'wave_start':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(440, t);
          osc.frequency.setValueAtTime(554, t + 0.08);
          osc.frequency.setValueAtTime(659, t + 0.16);
          g2.gain.setValueAtTime(0.3, t);
          g2.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
          osc.connect(g2);
          osc.start(t);
          osc.stop(t + 0.36);
          break;
        case 'dash':
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(200, t);
          osc.frequency.exponentialRampToValueAtTime(600, t + 0.1);
          g2.gain.setValueAtTime(0.2, t);
          g2.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
          osc.connect(g2);
          osc.start(t);
          osc.stop(t + 0.11);
          break;
        case 'explosion':
          osc.type = 'sawtooth';
          osc.frequency.setValueAtTime(100, t);
          osc.frequency.exponentialRampToValueAtTime(30, t + 0.3);
          g2.gain.setValueAtTime(0.5, t);
          g2.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
          osc.connect(g2);
          osc.start(t);
          osc.stop(t + 0.31);
          break;
        case 'button':
          osc.type = 'sine';
          osc.frequency.setValueAtTime(660, t);
          g2.gain.setValueAtTime(0.15, t);
          g2.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
          osc.connect(g2);
          osc.start(t);
          osc.stop(t + 0.06);
          break;
        default:
          osc.disconnect();
          break;
      }
    } catch {
      // ignore audio errors
    }
  }
}

export const audio = new AudioManager();
