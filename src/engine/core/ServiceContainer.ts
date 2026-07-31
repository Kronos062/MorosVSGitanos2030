/**
 * ServiceContainer.ts — DI ligero para el Engine (TDD §3.3).
 *
 * Contenedor de servicios sin frameworks pesados. El engine se auto-alambrará
 * a través de este contenedor; el gameplay obtendrá los servicios por interfaz,
 * nunca por instancia concreta.
 */

export type Factory<T> = (c: ServiceContainer) => T;

export class ServiceContainer {
  private factories = new Map<string, Factory<unknown>>();
  private instances = new Map<string, unknown>();

  register<T>(name: string, factory: Factory<T>): void {
    this.factories.set(name, factory as Factory<unknown>);
  }

  resolve<T>(name: string): T {
    if (this.instances.has(name)) return this.instances.get(name) as T;
    const factory = this.factories.get(name);
    if (!factory) throw new Error(`ServiceContainer: servicio "${name}" no registrado`);
    const instance = factory(this);
    this.instances.set(name, instance);
    return instance as T;
  }

  has(name: string): boolean {
    return this.factories.has(name);
  }

  reset(): void {
    this.instances.clear();
  }
}

// Singleton global del contenedor
export const services = new ServiceContainer();
