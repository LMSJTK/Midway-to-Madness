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
  }
};
