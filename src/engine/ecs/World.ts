/**
 * ecs/World.ts — ECS ligero (TDD §3.2 engine/ecs).
 *
 * Implementación pragmática: Entity = id numérico, Component = struct de datos
 * plano, System = función que opera sobre el World filtrando por componentes.
 *
 * Incluye:
 * - ComponentRegistry: registro tipado de definiciones de componentes
 * - World: almacenamiento y consultas (queries)
 */

export type EntityId = number;

export interface ComponentDefinition {
  readonly name: string;
  /** Clona el componente para evitar aliasing accidental entre entidades. */
  clone<T>(src: T): T;
}

/**
 * ComponentRegistry — registro central de tipos de componentes.
 * Cada componente del gameplay debe registrarse aquí antes de usarse.
 */
export class ComponentRegistry {
  private defs = new Map<string, ComponentDefinition>();

  register(def: ComponentDefinition): void {
    if (this.defs.has(def.name)) {
      // Si ya está registrado con la misma definición, omitir silenciosamente
      return;
    }
    this.defs.set(def.name, def);
  }

  get(name: string): ComponentDefinition {
    const def = this.defs.get(name);
    if (!def) throw new Error(`ComponentRegistry: componente "${name}" no registrado`);
    return def;
  }

  has(name: string): boolean {
    return this.defs.has(name);
  }

  list(): string[] {
    return Array.from(this.defs.keys());
  }
}

/**
 * World — contenedor ECS.
 * Almacena componentes por entidad en mapas separados por tipo (SoA ligero).
 */
export class World {
  private nextId: EntityId = 1;
  private alive = new Set<EntityId>();
  private storage = new Map<string, Map<EntityId, unknown>>();
  private tags = new Map<string, EntityId>();
  private groups = new Map<string, Set<EntityId>>();

  constructor(public readonly registry: ComponentRegistry) {}

  createEntity(): EntityId {
    const id = this.nextId++;
    this.alive.add(id);
    return id;
  }

  destroyEntity(id: EntityId): void {
    if (!this.alive.has(id)) return;
    this.alive.delete(id);
    for (const store of this.storage.values()) store.delete(id);
    for (const [, gid] of this.tags) {
      if (gid === id) this.tags.delete([...this.tags.keys()][[...this.tags.values()].indexOf(id)]);
    }
    for (const set of this.groups.values()) set.delete(id);
  }

  isAlive(id: EntityId): boolean {
    return this.alive.has(id);
  }

  entities(): EntityId[] {
    return Array.from(this.alive);
  }

  entityCount(): number {
    return this.alive.size;
  }

  /** Añade un componente a una entidad. */
  addComponent<T>(entity: EntityId, name: string, data: T): void {
    if (!this.alive.has(entity)) throw new Error(`World: entidad ${entity} no existe`);
    const def = this.registry.get(name);
    let store = this.storage.get(name);
    if (!store) {
      store = new Map();
      this.storage.set(name, store);
    }
    store.set(entity, def.clone(data));
  }

  /** Elimina un componente de una entidad. */
  removeComponent(entity: EntityId, name: string): void {
    this.storage.get(name)?.delete(entity);
  }

  /** Obtiene el componente de una entidad, o undefined si no existe. */
  getComponent<T>(entity: EntityId, name: string): T | undefined {
    return this.storage.get(name)?.get(entity) as T | undefined;
  }

  hasComponent(entity: EntityId, name: string): boolean {
    return this.storage.get(name)?.has(entity) ?? false;
  }

  /**
   * Query: devuelve todas las entidades que tienen TODOS los componentes listados.
   */
  query(...componentNames: string[]): EntityId[] {
    if (componentNames.length === 0) return this.entities();
    const first = componentNames[0];
    const firstStore = this.storage.get(first);
    if (!firstStore) return [];
    const result: EntityId[] = [];
    for (const entity of firstStore.keys()) {
      let ok = true;
      for (let i = 1; i < componentNames.length; i++) {
        if (!this.storage.get(componentNames[i])?.has(entity)) {
          ok = false;
          break;
        }
      }
      if (ok) result.push(entity);
    }
    return result;
  }

  /** Iterador de pares (entity, component) para un componente dado. */
  *iter<T>(name: string): IterableIterator<[EntityId, T]> {
    const store = this.storage.get(name);
    if (!store) return;
    for (const [entity, data] of store) {
      yield [entity, data as T];
    }
  }

  // === Etiquetas (entidad única por nombre) ===
  setTag(tag: string, entity: EntityId): void {
    this.tags.set(tag, entity);
  }

  getTag(tag: string): EntityId | undefined {
    return this.tags.get(tag);
  }

  // === Grupos (múltiples entidades con un rol, ej. "enemies") ===
  addToGroup(group: string, entity: EntityId): void {
    let set = this.groups.get(group);
    if (!set) {
      set = new Set();
      this.groups.set(group, set);
    }
    set.add(entity);
  }

  removeFromGroup(group: string, entity: EntityId): void {
    this.groups.get(group)?.delete(entity);
  }

  getGroup(group: string): EntityId[] {
    const set = this.groups.get(group);
    return set ? Array.from(set) : [];
  }

  clear(): void {
    this.alive.clear();
    this.storage.clear();
    this.tags.clear();
    this.groups.clear();
    this.nextId = 1;
  }
}
