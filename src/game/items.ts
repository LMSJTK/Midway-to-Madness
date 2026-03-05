export interface ItemDefinition {
  type: string;
  name: string;
  basePrice: number;
  cost: number;
  width: number;
  height: number;
  color: string;
  capacity?: number;
  duration?: number;
  excitement?: number;
}

export const ITEM_DEFINITIONS: Record<string, ItemDefinition> = {
  kiddie: {
    type: 'ride',
    name: 'Kiddie Ride',
    basePrice: 2,
    cost: 500,
    width: 50,
    height: 50,
    color: '#fcd34d',
    capacity: 4,
    duration: 5,
    excitement: 30,
  },
  major: {
    type: 'ride',
    name: 'Major Attraction',
    basePrice: 5,
    cost: 1500,
    width: 75,
    height: 75,
    color: '#ef4444',
    capacity: 16,
    duration: 8,
    excitement: 60,
  },
  spectacular: {
    type: 'ride',
    name: 'Spectacular Ride',
    basePrice: 10,
    cost: 5000,
    width: 100,
    height: 100,
    color: '#a855f7',
    capacity: 24,
    duration: 12,
    excitement: 90,
  },
  food: {
    type: 'food',
    name: 'Food Stall',
    basePrice: 5,
    cost: 300,
    width: 50,
    height: 50,
    color: '#10b981',
  },
  bathroom: {
    type: 'bathroom',
    name: 'Bathroom',
    basePrice: 0,
    cost: 300,
    width: 50,
    height: 50,
    color: '#3b82f6',
  },
  gameStall: {
    type: 'gameStall',
    name: 'Game Stall',
    basePrice: 3,
    cost: 400,
    width: 50,
    height: 50,
    color: '#f97316',
    excitement: 15,
  },
  shop: {
    type: 'shop',
    name: 'Gift Shop',
    basePrice: 0,
    cost: 600,
    width: 50,
    height: 50,
    color: '#ec4899',
  },
  performance: {
    type: 'performance',
    name: 'Live Performance',
    basePrice: 8,
    cost: 2000,
    width: 75,
    height: 75,
    color: '#eab308',
    capacity: 30,
    duration: 10,
    excitement: 50,
  },
};
