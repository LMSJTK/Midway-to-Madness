import { ITEM_DEFINITIONS, STOCK_CATEGORIES } from './items';
import { Biome, SceneryItem, generateScenery } from './scenery';
import { GAME_CONFIG } from './constants';

export type Phase = 'MAP' | 'BIDDING' | 'SETUP' | 'OPERATION' | 'TEARDOWN' | 'SUMMARY';
export type SimSpeed = 'normal' | 'fast' | 'ultra';

/**
 * Applied once, to the whole simulation step. Everything downstream — the
 * clock, guest needs, movement, ride timers — runs off that single scaled dt,
 * so 2x really is twice the day.
 */
export const SIM_SPEED_MULTIPLIERS: Record<SimSpeed, number> = { normal: 1, fast: 2, ultra: 4 };
export const SIM_SPEED_LABELS: Record<SimSpeed, string> = { normal: '1x', fast: '2x', ultra: '4x' };

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

export type StaffRole = 'maintenance' | 'sanitation';

/**
 * Where a staff member works. `roam` is the old free-for-all: take the nearest
 * job anywhere on the lot. `ride` posts a mechanic to one kind of attraction —
 * they ignore everything else and wait at it between breakdowns. `zone` keeps
 * a worker inside a circle, which spreads a crew out instead of letting them
 * all chase the same job.
 */
export type StaffAssignment =
  | { kind: 'roam' }
  | { kind: 'ride'; itemDefId: string }
  | { kind: 'zone'; x: number; y: number; radius: number };

export interface StaffRecord {
  id: string;
  role: StaffRole;
  name: string;
  assignment: StaffAssignment;
}

export const STAFF_HIRE_COST: Record<StaffRole, number> = { maintenance: 500, sanitation: 300 };

export const ZONE_RADIUS_DEFAULT = 300;
export const ZONE_RADIUS_MIN = 120;
export const ZONE_RADIUS_MAX = 700;

/**
 * A mechanic posted to one ride keeps it in better shape: each dedicated
 * mechanic raises the patrons it serves before breakdown risk starts to ramp.
 * Capped so stacking a whole crew on one ride isn't the dominant strategy.
 */
export const DEDICATED_MECHANIC_QUALITY_BONUS = 0.25;
export const DEDICATED_MECHANIC_MAX_STACK = 2;

const STAFF_NAMES = [
  'Dale', 'Marty', 'Rosa', 'Gus', 'Pearl', 'Ike', 'Vera', 'Otis',
  'Lu', 'Hank', 'Cass', 'Ray', 'Bea', 'Nan', 'Sal', 'Web',
];

/** True when a point falls inside a zone assignment. */
export function withinZone(zone: { x: number; y: number; radius: number }, x: number, y: number): boolean {
  const dx = x - zone.x;
  const dy = y - zone.y;
  return dx * dx + dy * dy <= zone.radius * zone.radius;
}

/** Short human-readable form of an assignment, for panels and tooltips. */
export function describeAssignment(assignment: StaffAssignment, itemName?: string): string {
  switch (assignment.kind) {
    case 'ride': return `Posted to ${itemName ?? assignment.itemDefId}`;
    case 'zone': return `Zone, ${Math.round(assignment.radius)} radius`;
    default: return 'Free roam';
  }
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
  queue: number[];       // entity IDs of guests waiting in line
}

export class StateManager {
  public state = {
    money: 15000,
    day: 1,
    time: GAME_CONFIG.DAY_START,
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
    staff: [] as StaffRecord[],
    placedItems: [] as PlacedItem[],
    sceneryItems: [] as SceneryItem[],
    priceOverrides: {} as Record<string, number>,
    simSpeed: 'normal' as SimSpeed,
    selectedGuestId: null as number | null,
    selectedItemId: null as string | null,
    selectedStaffId: null as string | null,
    stats: {
      guestsToday: 0,
      revenueToday: 0,
      expensesToday: 0,
    }
  };

  private listeners: Set<() => void> = new Set();

  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    // Returns void deliberately: this is used directly as a useEffect cleanup,
    // which must not return a value.
    return () => { this.listeners.delete(listener); };
  }

  notify() {
    this.listeners.forEach(l => l());
  }

  update(newState: Partial<typeof this.state>) {
    this.state = { ...this.state, ...newState };
    this.notify();
  }

  resetDay() {
    this.state.time = GAME_CONFIG.DAY_START;
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

  /** How many of a role are on the payroll. */
  staffCount(role: StaffRole): number {
    return this.state.staff.filter(s => s.role === role).length;
  }

  hireStaff(role: StaffRole) {
    const cost = STAFF_HIRE_COST[role];
    if (this.state.money < cost) return;

    const taken = new Set(this.state.staff.map(s => s.name));
    const name = STAFF_NAMES.find(n => !taken.has(n)) ?? `Hand ${this.state.staff.length + 1}`;
    const record: StaffRecord = {
      id: Math.random().toString(36).slice(2, 11),
      role,
      name,
      assignment: { kind: 'roam' },
    };

    this.update({
      staff: [...this.state.staff, record],
      money: this.state.money - cost,
      stats: { ...this.state.stats, expensesToday: this.state.stats.expensesToday + cost },
    });
  }

  setStaffAssignment(staffId: string, assignment: StaffAssignment) {
    this.update({
      staff: this.state.staff.map(s => (s.id === staffId ? { ...s, assignment } : s)),
    });
  }

  /** Number of mechanics posted to a given attraction type. */
  dedicatedMechanics(itemDefId: string): number {
    return this.state.staff.filter(
      s => s.role === 'maintenance' && s.assignment.kind === 'ride' && s.assignment.itemDefId === itemDefId,
    ).length;
  }

  /** Record money going out so the day summary can show a real net. */
  spend(amount: number) {
    this.update({
      money: this.state.money - amount,
      stats: { ...this.state.stats, expensesToday: this.state.stats.expensesToday + amount },
    });
  }

  /** Sign the contract for a location and remember that we played there. */
  signContract(location: Location, cost: number) {
    const visitedLocations = this.state.visitedLocations.includes(location.id)
      ? this.state.visitedLocations
      : [...this.state.visitedLocations, location.id];

    this.update({
      money: this.state.money - cost,
      stats: { ...this.state.stats, expensesToday: this.state.stats.expensesToday + cost },
      currentLocation: location,
      visitedLocations,
      phase: 'SETUP',
    });
    this.generateScenery();
  }

  /**
   * Whether a footprint fits: inside the lot, clear of everything already
   * placed, and clear of the entrance so arrivals aren't walled in.
   */
  canPlaceItem(itemDefId: string, x: number, y: number): boolean {
    const def = ITEM_DEFINITIONS[itemDefId];
    if (!def) return false;
    if ((this.state.inventory[itemDefId] || 0) <= 0) return false;

    if (x < 0 || y < 0 || x + def.width > GAME_CONFIG.MAP_WIDTH || y + def.height > GAME_CONFIG.MAP_HEIGHT) {
      return false;
    }

    const overlaps = (ox: number, oy: number, ow: number, oh: number) =>
      x < ox + ow && x + def.width > ox && y < oy + oh && y + def.height > oy;

    if (this.state.placedItems.some(i => overlaps(i.x, i.y, i.width, i.height))) return false;

    // Keep the strip in front of the gate walkable.
    const gate = { x: GAME_CONFIG.ENTRANCE_X - 60, y: GAME_CONFIG.MAP_HEIGHT - 60, w: 120, h: 60 };
    if (overlaps(gate.x, gate.y, gate.w, gate.h)) return false;

    return true;
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
    if (!def || !this.canPlaceItem(itemDefId, x, y)) return false;

    const count = this.state.inventory[itemDefId] || 0;

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
      queue: [],
    };

    // Clear decorative props the ride would otherwise sit on top of.
    this.state.sceneryItems = this.state.sceneryItems.filter(s =>
      !(x < s.x + s.width && x + def.width > s.x && y < s.y + s.height && y + def.height > s.y)
    );

    this.state.placedItems.push(newItem);
    this.notify();
    return true;
  }
}

export const gameStateManager = new StateManager();
