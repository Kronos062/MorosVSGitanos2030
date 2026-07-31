/**
 * ShopSystem.ts — tienda de mejoras permanentes (TDD Cap. 3, 8).
 *
 * Utiliza LocalApiClient para consumir el oro ganado en las Runs y
 * comprar modificadores de stats permanentes.
 */

import { LocalApiClient, type PlayerProfile } from '@/gameplay/persistence/ApiClient';

export interface UpgradesState {
  permHpLevel: number;
  permDamageLevel: number;
  permSpeedLevel: number;
  permGoldLevel: number;
}

const UPGRADES_KEY = 'mvg_permanent_upgrades_v1';

export class ShopSystem {
  private api = new LocalApiClient();

  async getUpgrades(): Promise<UpgradesState> {
    if (typeof window === 'undefined') return { permHpLevel: 0, permDamageLevel: 0, permSpeedLevel: 0, permGoldLevel: 0 };
    try {
      const raw = localStorage.getItem(UPGRADES_KEY);
      if (!raw) return { permHpLevel: 0, permDamageLevel: 0, permSpeedLevel: 0, permGoldLevel: 0 };
      return JSON.parse(raw);
    } catch {
      return { permHpLevel: 0, permDamageLevel: 0, permSpeedLevel: 0, permGoldLevel: 0 };
    }
  }

  async saveUpgrades(upgrades: UpgradesState): Promise<void> {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(UPGRADES_KEY, JSON.stringify(upgrades));
    } catch { /* noop */ }
  }

  getCost(level: number): number {
    return Math.floor(100 * Math.pow(1.5, level));
  }

  async buyUpgrade(playerId: string, stat: keyof UpgradesState): Promise<{ success: boolean; profile?: PlayerProfile; upgrades?: UpgradesState }> {
    const profile = await this.api.getProfile(playerId);
    const upgrades = await this.getUpgrades();
    const currentLevel = upgrades[stat];
    const cost = this.getCost(currentLevel);

    if (profile.gold >= cost) {
      profile.gold -= cost;
      upgrades[stat] += 1;
      await this.api.saveProfile(profile);
      await this.saveUpgrades(upgrades);
      return { success: true, profile, upgrades };
    }
    return { success: false, profile, upgrades };
  }
}
