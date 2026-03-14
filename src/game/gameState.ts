import { ITEM_DEFINITIONS, STOCK_CATEGORIES } from './items';
import { Biome, SceneryItem, generateScenery } from './scenery';

export type Phase = 'MAP' | 'BIDDING' | 'SETUP' | 'OPERATION' | 'TEARDOWN' | 'SUMMARY';
export type SimSpeed = 'normal' | 'fast';
export const SIM_SPEED_MULTIPLIERS: Record<SimSpeed, number> = { normal: 0.5, fast: 1 };

export interface Location {
  id: string;
  name: string;
  type: string;
  distance: number;
  fee: number;
  expectedGuests: number;
  revenueShare: number;
  biome: Biome;
}

export const LOCATIONS: Location[] = [
  { id: 'loc1', name: 'Smallville Fair', type: 'Local', distance: 50, fee: 500, expectedGuests: 200, revenueShare: 0.1, biome: 'meadow' },
  { id: 'loc2', name: 'County Jamboree', type: 'County', distance: 150, fee: 2000, expectedGuests: 800, revenueShare: 0.2, biome: 'forest' },
  { id: 'loc3', name: 'State Expo', type: 'State', distance: 400, fee: 8000, expectedGuests: 3000, revenueShare: 0.3, biome: 'urban' },
];

export interface Staff {
  maintenance: number;
  sanitation: number;
}

export interface PlacedItem {
  id: string;
  itemDefId: string;     // key into ITEM_DEFINITIONS
  type: string;          // category, kept for quick behavior checks
  x: number;
  y: number;
  width: number;
  height: number;
  built: boolean;
  buildTimeRemaining: number;
  ticketPrice: number;
  basePrice: number;
  excitement: number;
  capacity: number;
  currentRiders: number;
  duration: number;
  timer: number;
  revenueToday: number;
  customersToday: number;
  patronsServed: number; // total patrons served today, drives quality-based breakdown
  stock: number;
  isBroken: boolean;
  condition: number;
}

export class StateManager {
  public state = {
    money: 15000,
    day: 1,
    time: 8,
    phase: 'MAP' as Phase,
    currentLocation: null as Location | null,
    // Dynamic inventory: keys are item definition IDs, values are counts
    inventory: {
      teacups: 1,
      bumper_cars: 1,
      scrambler: 1,
      hot_dog_stand: 2,
      porta_potty: 1,
    } as Record<string, number>,
    visitedLocations: [] as string[],
    staff: {
      maintenance: 0,
      sanitation: 0,
    } as Staff,
    placedItems: [] as PlacedItem[],
    sceneryItems: [] as SceneryItem[],
    priceOverrides: {} as Record<string, number>,
    simSpeed: 'normal' as SimSpeed,
    selectedGuestId: null as number | null,
    selectedItemId: null as string | null,
    stats: {
      guestsToday: 0,
      revenueToday: 0,
      expensesToday: 0,
    }
  };

  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  notify() {
    this.listeners.forEach(l => l());
  }

  update(newState: Partial<typeof this.state>) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  resetDay() {
    this.state.time = 8;
    this.state.stats = {
      guestsToday: 0,
      revenueToday: 0,
      expensesToday: 0,
    };
    this.notify();
  }

  /** Check if a specific item is unlocked based on day and visited locations */
  isItemUnlocked(itemId: string): boolean {
    const def = ITEM_DEFINITIONS[itemId];
    if (!def) return false;
    if (this.state.day < def.unlockDay) return false;
    if (def.unlockLocation && !this.state.visitedLocations.includes(def.unlockLocation)) return false;
    return true;
  }

  /** Generate scenery for the current location's biome */
  generateScenery() {
    const loc = this.state.currentLocation;
    if (!loc) return;
    // Use a seed based on location ID for deterministic scenery per location
    const seed = loc.id.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0);
    this.state.sceneryItems = generateScenery(loc.biome, seed);
    this.notify();
  }

  setGlobalPrice(itemDefId: string, price: number) {
    const clampedPrice = Math.max(0, price);
    this.state.priceOverrides = { ...this.state.priceOverrides, [itemDefId]: clampedPrice };
    this.state.placedItems = this.state.placedItems.map(item =>
      item.itemDefId === itemDefId ? { ...item, ticketPrice: clampedPrice } : item
    );
    this.notify();
  }

  placeItem(itemDefId: string, x: number, y: number): boolean {
    const def = ITEM_DEFINITIONS[itemDefId];
    if (!def) return false;

    const count = this.state.inventory[itemDefId] || 0;
    if (count <= 0) return false;

    this.state.inventory = {
      ...this.state.inventory,
      [itemDefId]: count - 1,
    };

    const newItem: PlacedItem = {
      id: Math.random().toString(36).substr(2, 9),
      itemDefId,
      type: def.category,
      x,
      y,
      width: def.width,
      height: def.height,
      built: true,
      buildTimeRemaining: 0,
      ticketPrice: this.state.priceOverrides[itemDefId] ?? def.basePrice,
      basePrice: def.basePrice,
      excitement: def.value || 0,
      capacity: def.capacity || 0,
      currentRiders: 0,
      duration: def.duration || 0,
      timer: 0,
      revenueToday: 0,
      customersToday: 0,
      patronsServed: 0,
      stock: STOCK_CATEGORIES.includes(def.category) ? Math.round(50 + def.quality * 1.5) : 0,
      isBroken: false,
      condition: 100,
    };

    this.state.placedItems.push(newItem);
    this.notify();
    return true;
  }
}

export const gameStateManager = new StateManager();
