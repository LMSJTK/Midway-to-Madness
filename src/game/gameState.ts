import { ITEM_DEFINITIONS } from './items';

export type Phase = 'MAP' | 'BIDDING' | 'SETUP' | 'OPERATION' | 'TEARDOWN' | 'SUMMARY';

export interface Location {
  id: string;
  name: string;
  type: string;
  distance: number;
  fee: number;
  expectedGuests: number;
  revenueShare: number; // e.g., 0.2 means 20% to city
}

export const LOCATIONS: Location[] = [
  { id: 'loc1', name: 'Smallville Fair', type: 'Local', distance: 50, fee: 500, expectedGuests: 200, revenueShare: 0.1 },
  { id: 'loc2', name: 'County Jamboree', type: 'County', distance: 150, fee: 2000, expectedGuests: 800, revenueShare: 0.2 },
  { id: 'loc3', name: 'State Expo', type: 'State', distance: 400, fee: 8000, expectedGuests: 3000, revenueShare: 0.3 },
];

export interface Inventory {
  kiddieRides: number;
  majorRides: number;
  spectacularRides: number;
  foodStalls: number;
  bathrooms: number;
}

export interface Staff {
  maintenance: number;
  sanitation: number;
}

export interface PlacedItem {
  id: string;
  type: string;
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
  stock: number;
  isBroken: boolean;
  condition: number;
}

export class StateManager {
  public state = {
    money: 15000,
    day: 1,
    time: 8, // 8.0 to 22.0 (8 AM to 10 PM)
    phase: 'MAP' as Phase,
    currentLocation: null as Location | null,
    inventory: {
      kiddieRides: 2,
      majorRides: 1,
      spectacularRides: 0,
      foodStalls: 2,
      bathrooms: 1,
    } as Inventory,
    staff: {
      maintenance: 0,
      sanitation: 0,
    } as Staff,
    placedItems: [] as PlacedItem[],
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

  placeItem(itemType: string, x: number, y: number): boolean {
    const def = ITEM_DEFINITIONS[itemType];
    if (!def) return false;

    // Check inventory
    let inventoryKey: keyof Inventory | null = null;
    if (itemType === 'kiddie') inventoryKey = 'kiddieRides';
    if (itemType === 'major') inventoryKey = 'majorRides';
    if (itemType === 'spectacular') inventoryKey = 'spectacularRides';
    if (itemType === 'food') inventoryKey = 'foodStalls';
    if (itemType === 'bathroom') inventoryKey = 'bathrooms';

    if (inventoryKey && this.state.inventory[inventoryKey] > 0) {
      this.state.inventory[inventoryKey]--;
      
      const newItem: PlacedItem = {
        id: Math.random().toString(36).substr(2, 9),
        type: itemType,
        x,
        y,
        width: def.width,
        height: def.height,
        built: false,
        buildTimeRemaining: 3,
        ticketPrice: def.basePrice,
        basePrice: def.basePrice,
        excitement: def.excitement || 0,
        capacity: def.capacity || 0,
        currentRiders: 0,
        duration: def.duration || 0,
        timer: 0,
        revenueToday: 0,
        customersToday: 0,
        stock: itemType === 'food' ? 100 : 0,
        isBroken: false,
        condition: 100,
      };
      
      this.state.placedItems.push(newItem);
      this.notify();
      return true;
    }
    return false;
  }
}

export const gameStateManager = new StateManager();
