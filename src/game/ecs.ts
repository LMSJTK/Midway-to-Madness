export type Entity = number;

export class World {
  private nextEntityId = 0;
  public entities: Set<Entity> = new Set();
  public components: Map<string, Map<Entity, any>> = new Map();

  createEntity(): Entity {
    const id = this.nextEntityId++;
    this.entities.add(id);
    return id;
  }

  destroyEntity(entity: Entity) {
    this.entities.delete(entity);
    for (const map of this.components.values()) {
      map.delete(entity);
    }
  }

  addComponent<T>(entity: Entity, componentName: string, data: T) {
    if (!this.components.has(componentName)) {
      this.components.set(componentName, new Map());
    }
    this.components.get(componentName)!.set(entity, data);
  }

  getComponent<T>(entity: Entity, componentName: string): T | undefined {
    return this.components.get(componentName)?.get(entity) as T | undefined;
  }

  hasComponent(entity: Entity, componentName: string): boolean {
    return this.components.get(componentName)?.has(entity) || false;
  }

  getEntitiesWith(componentNames: string[]): Entity[] {
    const result: Entity[] = [];
    for (const entity of this.entities) {
      if (componentNames.every(name => this.hasComponent(entity, name))) {
        result.push(entity);
      }
    }
    return result;
  }

  clear() {
    this.entities.clear();
    this.components.clear();
    this.nextEntityId = 0;
  }
}
