/**
 * ArmoryStore.ts — persistencia de descubrimientos de la Armería (TDD Cap. 3, Mejora 2).
 *
 * Registra las armas descubiertas por el jugador al equiparlas o inspeccionarlas
 * por primera vez, guardándolas de forma permanente.
 */

const ARMORY_KEY = 'mvg_armory_v1';

export const ArmoryStore = {
  memoryData: {} as Record<string, boolean>,

  load(): Record<string, boolean> {
    if (typeof window === 'undefined') return this.memoryData;
    try {
      const raw = localStorage.getItem(ARMORY_KEY);
      if (!raw) return this.memoryData;
      return JSON.parse(raw);
    } catch {
      return this.memoryData;
    }
  },

  recordDiscovery(weaponId: string): Record<string, boolean> {
    const data = this.load();
    data[weaponId] = true;
    this.memoryData[weaponId] = true;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(ARMORY_KEY, JSON.stringify(data));
      } catch { /* noop */ }
    }
    return data;
  },

  isDiscovered(weaponId: string): boolean {
    const data = this.load();
    return !!data[weaponId];
  },
};

// Re-export por compatibilidad
export const ArmoryManager = ArmoryStore;
