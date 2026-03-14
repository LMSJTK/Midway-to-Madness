export type Entity = number;

export interface Position { x: number; y: number; }
export interface Velocity { vx: number; vy: number; }
export interface Renderable { type: 'guest' | 'ride' | 'stall' | 'staff' | 'trash'; color: string; size: number; }
export interface Guest { money: number; initialMoney: number; hunger: number; bladder: number; excitement: number; targetId: string | null; state: 'wandering' | 'walking' | 'queued' | 'riding' | 'eating' | 'leaving'; timer: number; arrivalTime: number; portraitIndex: number; maxWaitTolerance: number; }
export interface StaffMember { type: 'maintenance' | 'sanitation'; targetId: string | number | null; state: 'wandering' | 'walking' | 'working'; timer: number; }
export interface Trash {}

export interface ComponentRegistry {
  Position: Position;
  Velocity: Velocity;
  Renderable: Renderable;
  Guest: Guest;
  Staff: StaffMember;
  Trash: Trash;
}

export class World {
  private nextEntityId = 0;
  public entities: Set<Entity> = new Set();
  public components: Map<keyof ComponentRegistry, Map<Entity, any>> = new Map();

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

  addComponent<K extends keyof ComponentRegistry>(entity: Entity, componentName: K, data: ComponentRegistry[K]) {
    if (!this.components.has(componentName)) {
      this.components.set(componentName, new Map());
    }
    this.components.get(componentName)!.set(entity, data);
  }

  getComponent<K extends keyof ComponentRegistry>(entity: Entity, componentName: K): ComponentRegistry[K] | undefined {
    return this.components.get(componentName)?.get(entity) as ComponentRegistry[K] | undefined;
  }

  hasComponent<K extends keyof ComponentRegistry>(entity: Entity, componentName: K): boolean {
    return this.components.get(componentName)?.has(entity) || false;
  }

  getEntitiesWith(componentNames: (keyof ComponentRegistry)[]): Entity[] {
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
