/**
 * AudioManager — efectos de sonido mediante archivos externos.
 * Punto central: todo el gameplay sigue llamando a audio.play(id).
 * Carpeta: /assets/sounds/<archivo>. Si el archivo aún no existe,
 * la reproducción falla de forma silenciosa y el juego continúa.
 */

const SOUND_FILES = {
  button: 'button.wav',
  shoot: 'shoot.wav',
  shoot_heavy: 'shoot-heavy.wav',
  hit: 'hit.wav',
  kill: 'kill.wav',
  hurt: 'hurt.wav',
  death: 'death.wav',
  pickup: 'pickup.wav',
  levelup: 'level-up.wav',
  wave_start: 'wave-start.wav',
  dash: 'dash.wav',
  explosion: 'explosion.wav',
} as const;

type SoundId = keyof typeof SOUND_FILES;

/** Máximo de elementos <audio> simultáneos por sonido (se reutilizan en vez de crear uno nuevo por disparo). */
const POOL_SIZE = 5;
/** Intervalo mínimo entre dos reproducciones del mismo sonido (evita saturar con escopetas, explosiones...). */
const MIN_INTERVAL_MS = 35;
const NO_THROTTLE = new Set<string>(['button', 'levelup', 'death', 'wave_start']);

export class AudioManager {
  private volume = 0.7;
  private enabled = true;
  private pools = new Map<string, HTMLAudioElement[]>();
  private lastPlayed = new Map<string, number>();
  private cursor = new Map<string, number>();

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
  }

  getVolume() {
    return this.volume;
  }

  resume() {
    // HTMLAudio no necesita desbloquear AudioContext; se mantiene
    // el método por compatibilidad con las llamadas existentes.
  }

  play(id: string) {
    if (!this.enabled || this.volume <= 0) return;
    const file = (SOUND_FILES as Record<string, string>)[id];
    if (!file) {
      // Clave aún sin archivo asignado o no mapeada — preparada para futuro.
      return;
    }
    try {
      const now = performance.now();
      if (!NO_THROTTLE.has(id) && now - (this.lastPlayed.get(id) ?? -1e9) < MIN_INTERVAL_MS) return;
      this.lastPlayed.set(id, now);

      let pool = this.pools.get(id);
      if (!pool) {
        pool = [];
        this.pools.set(id, pool);
      }
      let el = pool.find((a) => a.paused || a.ended);
      if (!el) {
        if (pool.length < POOL_SIZE) {
          el = new Audio(`${import.meta.env.BASE_URL}assets/sounds/${file}`);
          pool.push(el);
        } else {
          // Pool lleno: se reutiliza el más antiguo en rotación.
          const i = (this.cursor.get(id) ?? 0) % pool.length;
          this.cursor.set(id, i + 1);
          el = pool[i];
        }
      }
      el.volume = this.volume;
      el.currentTime = 0;
      el.play().catch(() => {
        // Archivo ausente o bloqueo de autoplay — fallo silencioso.
      });
    } catch {
      // No romper el juego si la reproducción falla.
    }
  }
}

export const audio = new AudioManager();

// Export auxiliar para documentar el catálogo sin exponer lógica de gameplay.
export const SOUND_CATALOG = SOUND_FILES;
export type { SoundId };
