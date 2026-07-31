/**
 * BestiaryStore.ts — persistencia de bajas del bestiario (TDD Cap. 3, 8).
 *
 * Registra bajas de enemigos acumuladas por tipo para desbloquear información
 * detallada en la UI del menú principal.
 */

const BESTIARY_KEY = 'mvg_bestiary_v1';

export const BestiaryStore = {
  load(): Record<string, number> {
    if (typeof window === 'undefined') return {};
    try {
      const raw = localStorage.getItem(BESTIARY_KEY);
      if (!raw) return {};
      return JSON.parse(raw);
    } catch {
      return {};
    }
  },

  recordKill(enemyId: string): Record<string, number> {
    const data = this.load();
    data[enemyId] = (data[enemyId] ?? 0) + 1;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(BESTIARY_KEY, JSON.stringify(data));
      } catch { /* noop */ }
    }
    return data;
  },
};

// Re-export por compatibilidad
export const BestiaryManager = BestiaryStore;
