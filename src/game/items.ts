export type ItemCategory = 'kiddie' | 'major' | 'spectacular' | 'food' | 'bathroom' | 'gameStall' | 'shop' | 'performance';

export interface ItemDefinition {
  id: string;
  category: ItemCategory;
  name: string;
  basePrice: number;
  cost: number;
  width: number;
  height: number;
  color: string;
  prestige: number;       // 1-100, influences guest draw distance/weight
  value: number;          // how much the visit changes the relevant stat (hunger, excitement, etc.)
  quality: number;        // durability: patrons before breakdown risk ramps up; for stock items, affects stock capacity
  travelWeight: number;   // weight for travel cost calculation
  unlockDay: number;      // day this becomes available (0 = start)
  unlockLocation?: string; // location ID that must be visited first
  capacity?: number;
  duration?: number;
}

// Category-level defaults for rendering and behavior
export const CATEGORY_DEFAULTS: Record<ItemCategory, { color: string; z: number; travelWeight: number }> = {
  kiddie:       { color: '#f87171', z: 30,  travelWeight: 2 },
  major:        { color: '#fbbf24', z: 50,  travelWeight: 5 },
  spectacular:  { color: '#a78bfa', z: 80,  travelWeight: 10 },
  food:         { color: '#f472b6', z: 20,  travelWeight: 1 },
  bathroom:     { color: '#38bdf8', z: 20,  travelWeight: 1 },
  gameStall:    { color: '#fb923c', z: 25,  travelWeight: 1 },
  shop:         { color: '#f472b6', z: 25,  travelWeight: 1 },
  performance:  { color: '#facc15', z: 40,  travelWeight: 3 },
};

// Categories that use stock (instant-service, inventory-based)
export const STOCK_CATEGORIES: ItemCategory[] = ['food', 'shop'];
// Categories that process guests instantly (no capacity queue)
export const INSTANT_CATEGORIES: ItemCategory[] = ['food', 'bathroom', 'gameStall', 'shop'];

// Dynamic registry — populated with defaults below, extended by manifest at runtime
export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  // --- Starter kiddie rides ---
  teacups: {
    id: 'teacups',
    category: 'kiddie',
    name: 'Teacups',
    basePrice: 2,
    cost: 500,
    width: 50,
    height: 50,
    color: '#fcd34d',
    prestige: 10,
    value: 20,
    quality: 40,
    travelWeight: 2,
    unlockDay: 0,
    capacity: 4,
    duration: 5,
  },
  bumper_cars: {
    id: 'bumper_cars',
    category: 'kiddie',
    name: 'Bumper Cars',
    basePrice: 3,
    cost: 600,
    width: 50,
    height: 50,
    color: '#fcd34d',
    prestige: 15,
    value: 25,
    quality: 30,
    travelWeight: 2,
    unlockDay: 0,
    capacity: 6,
    duration: 5,
  },

  // --- Starter major rides ---
  scrambler: {
    id: 'scrambler',
    category: 'major',
    name: 'Scrambler',
    basePrice: 5,
    cost: 1500,
    width: 75,
    height: 75,
    color: '#ef4444',
    prestige: 30,
    value: 50,
    quality: 50,
    travelWeight: 5,
    unlockDay: 0,
    capacity: 16,
    duration: 8,
  },

  // --- Starter spectacular rides ---
  ferris_wheel: {
    id: 'ferris_wheel',
    category: 'spectacular',
    name: 'Ferris Wheel',
    basePrice: 10,
    cost: 5000,
    width: 100,
    height: 100,
    color: '#a855f7',
    prestige: 60,
    value: 80,
    quality: 60,
    travelWeight: 10,
    unlockDay: 0,
    capacity: 24,
    duration: 12,
  },

  // --- Starter food ---
  hot_dog_stand: {
    id: 'hot_dog_stand',
    category: 'food',
    name: 'Hot Dog Stand',
    basePrice: 5,
    cost: 300,
    width: 50,
    height: 50,
    color: '#10b981',
    prestige: 10,
    value: 50,
    quality: 50,
    travelWeight: 1,
    unlockDay: 0,
  },
  ice_cream_stand: {
    id: 'ice_cream_stand',
    category: 'food',
    name: 'Ice Cream Stand',
    basePrice: 4,
    cost: 350,
    width: 50,
    height: 50,
    color: '#10b981',
    prestige: 15,
    value: 30,
    quality: 40,
    travelWeight: 1,
    unlockDay: 0,
  },

  // --- Starter bathrooms ---
  porta_potty: {
    id: 'porta_potty',
    category: 'bathroom',
    name: 'Porta-Potty',
    basePrice: 0,
    cost: 300,
    width: 50,
    height: 50,
    color: '#3b82f6',
    prestige: 5,
    value: 100,
    quality: 25,
    travelWeight: 1,
    unlockDay: 0,
  },

  // --- Starter game stalls ---
  ring_toss: {
    id: 'ring_toss',
    category: 'gameStall',
    name: 'Ring Toss',
    basePrice: 3,
    cost: 400,
    width: 50,
    height: 50,
    color: '#f97316',
    prestige: 10,
    value: 15,
    quality: 60,
    travelWeight: 1,
    unlockDay: 0,
  },

  // --- Starter shops ---
  souvenir_cart: {
    id: 'souvenir_cart',
    category: 'shop',
    name: 'Souvenir Cart',
    basePrice: 0,
    cost: 600,
    width: 50,
    height: 50,
    color: '#ec4899',
    prestige: 10,
    value: 0,
    quality: 40,
    travelWeight: 1,
    unlockDay: 0,
  },

  // --- Starter performances ---
  juggling_act: {
    id: 'juggling_act',
    category: 'performance',
    name: 'Juggling Act',
    basePrice: 8,
    cost: 2000,
    width: 75,
    height: 75,
    color: '#eab308',
    prestige: 30,
    value: 50,
    quality: 70,
    travelWeight: 3,
    unlockDay: 0,
    capacity: 30,
    duration: 10,
  },

  // --- Unlockable items (examples) ---
  carousel: {
    id: 'carousel',
    category: 'kiddie',
    name: 'Carousel',
    basePrice: 3,
    cost: 800,
    width: 60,
    height: 60,
    color: '#fcd34d',
    prestige: 25,
    value: 30,
    quality: 55,
    travelWeight: 2,
    unlockDay: 3,
    capacity: 8,
    duration: 6,
  },
  roller_coaster: {
    id: 'roller_coaster',
    category: 'spectacular',
    name: 'Roller Coaster',
    basePrice: 15,
    cost: 12000,
    width: 120,
    height: 120,
    color: '#a855f7',
    prestige: 90,
    value: 95,
    quality: 35,
    travelWeight: 10,
    unlockDay: 5,
    unlockLocation: 'loc2',
    capacity: 20,
    duration: 8,
  },
  pizza_oven: {
    id: 'pizza_oven',
    category: 'food',
    name: 'Pizza Oven',
    basePrice: 8,
    cost: 800,
    width: 50,
    height: 50,
    color: '#10b981',
    prestige: 40,
    value: 70,
    quality: 80,
    travelWeight: 1,
    unlockDay: 3,
    unlockLocation: 'loc2',
  },
};

/** Register a new item definition at runtime (from editor manifest) */
export function registerItem(def: ItemDefinition) {
  ITEM_DEFINITIONS[def.id] = def;
}

/** Get all items in a category */
export function getItemsByCategory(category: ItemCategory): ItemDefinition[] {
  return Object.values(ITEM_DEFINITIONS).filter(d => d.category === category);
}
