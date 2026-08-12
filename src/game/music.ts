export type MusicContext = 'menu' | 'run' | 'boss';

export const MENU_TRACKS: { id: string; label: string; file: string }[] = [
  { id: 'menu1', label: 'Pista 1', file: 'MvG2023_Menu1.mp3' },
  { id: 'menu2', label: 'Pista 2', file: 'MvG2023_Menu2.mp3' },
];

const RUN_TRACK = 'MvG2023_Run.mp3';
const BOSS_TRACK = 'MvG2023_BossFight.mp3';
const CROSSFADE_MS = 600;

class MusicManager {
  private volume = 0.7;
  private selectedMenuTrackId = 'menu1';
  private current: HTMLAudioElement | null = null;
  private currentKey: string | null = null;
  private fadeInterval: number | null = null;

  setVolume(v: number) {
    this.volume = Math.max(0, Math.min(1, v));
    if (this.current && !this.fadeInterval) {
      this.current.volume = this.volume;
    }
  }

  setMenuTrack(id: string) {
    const prevId = this.selectedMenuTrackId;
    this.selectedMenuTrackId = id;
    // If we are currently playing the menu music, trigger transition to the new menu track immediately.
    const playingMenu = MENU_TRACKS.some(t => t.file === this.currentKey);
    if (playingMenu && prevId !== id) {
      this.playContext('menu');
    }
  }

  playContext(context: MusicContext) {
    const file = context === 'boss' ? BOSS_TRACK
      : context === 'run' ? RUN_TRACK
      : MENU_TRACKS.find(t => t.id === this.selectedMenuTrackId)?.file ?? MENU_TRACKS[0].file;

    if (this.currentKey === file) return;
    this.crossfadeTo(file);
  }

  private crossfadeTo(file: string) {
    if (this.fadeInterval) {
      clearInterval(this.fadeInterval);
      this.fadeInterval = null;
    }

    const next = new Audio(`/assets/music/${file}`);
    next.loop = true;
    next.volume = 0;

    // Play next and catch autoplay blocks. Keep current/currentKey assigned
    // even if autoplay rejects so a later user gesture can resume the same track.
    next.play().catch(() => {});

    const prev = this.current;
    this.current = next;
    this.currentKey = file;

    const start = Date.now();
    const targetVolume = this.volume;
    const initialPrevVolume = prev ? prev.volume : 0;

    this.fadeInterval = window.setInterval(() => {
      const elapsed = Date.now() - start;
      const progress = Math.min(1, elapsed / CROSSFADE_MS);

      if (this.current === next) {
        next.volume = targetVolume * progress;
      }
      if (prev) {
        prev.volume = initialPrevVolume * (1 - progress);
      }

      if (progress >= 1) {
        if (this.fadeInterval) {
          clearInterval(this.fadeInterval);
          this.fadeInterval = null;
        }
        if (prev) {
          prev.pause();
          prev.src = ''; // help garbage collection
        }
        if (this.current === next) {
          next.volume = this.volume;
        }
      }
    }, 16);
  }

  resume() {
    this.current?.play().catch(() => {});
  }
}

export const music = new MusicManager();
