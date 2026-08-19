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

export class AudioManager {
  private volume = 0.7;
  private enabled = true;

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
      const el = new Audio(`/assets/sounds/${file}`);
      el.volume = this.volume;
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
