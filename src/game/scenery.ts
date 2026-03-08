/**
 * Biome and scenery system — decorative props that auto-spawn based on location.
 * Scenery is purely visual; it doesn't interact with the guest AI or economy.
 */

// Biome types that locations can be tagged with
export type Biome = 'meadow' | 'desert' | 'urban' | 'forest' | 'coastal';

// Visual config per biome: ground color, side colors, accent features
export const BIOME_CONFIG: Record<Biome, {
  groundColor: string;    // top face of the base block
  sideColor: string;      // side faces (slightly different for variety)
  accentColor: string;    // dirt path or accent stripe color
  entranceColor: string;  // entrance pad color
}> = {
  meadow:  { groundColor: '#4ade80', sideColor: '#65a30d', accentColor: '#d4a574', entranceColor: '#9ca3af' },
  desert:  { groundColor: '#e7c98a', sideColor: '#b8963e', accentColor: '#c2956b', entranceColor: '#a1a1aa' },
  urban:   { groundColor: '#94a3b8', sideColor: '#64748b', accentColor: '#71717a', entranceColor: '#6b7280' },
  forest:  { groundColor: '#22c55e', sideColor: '#15803d', accentColor: '#92400e', entranceColor: '#78716c' },
  coastal: { groundColor: '#86efac', sideColor: '#4ade80', accentColor: '#fcd34d', entranceColor: '#d1d5db' },
};

// A placed scenery object (decorative, non-interactive)
export interface SceneryItem {
  id: string;
  defId: string;        // key into SCENERY_DEFINITIONS
  x: number;
  y: number;
  width: number;
  height: number;
}

// Definition for a scenery type (tree, rock, bench, etc.)
export interface SceneryDefinition {
  id: string;
  name: string;
  biomes: Biome[];       // which biomes this can appear in
  width: number;
  height: number;
  color: string;         // fallback block color
  z: number;             // fallback block height
  frequency: number;     // relative spawn weight (higher = more common)
}

// Built-in scenery definitions — more can be loaded from the manifest
export const SCENERY_DEFINITIONS: Record<string, SceneryDefinition> = {
  oak_tree: {
    id: 'oak_tree', name: 'Oak Tree', biomes: ['meadow', 'forest'],
    width: 30, height: 30, color: '#166534', z: 40, frequency: 5,
  },
  pine_tree: {
    id: 'pine_tree', name: 'Pine Tree', biomes: ['forest'],
    width: 25, height: 25, color: '#14532d', z: 50, frequency: 6,
  },
  palm_tree: {
    id: 'palm_tree', name: 'Palm Tree', biomes: ['coastal', 'desert'],
    width: 25, height: 25, color: '#15803d', z: 45, frequency: 4,
  },
  bush: {
    id: 'bush', name: 'Bush', biomes: ['meadow', 'forest', 'coastal'],
    width: 20, height: 20, color: '#22c55e', z: 12, frequency: 8,
  },
  rock: {
    id: 'rock', name: 'Rock', biomes: ['desert', 'forest', 'coastal', 'meadow'],
    width: 20, height: 20, color: '#78716c', z: 10, frequency: 4,
  },
  cactus: {
    id: 'cactus', name: 'Cactus', biomes: ['desert'],
    width: 15, height: 15, color: '#4d7c0f', z: 25, frequency: 5,
  },
  bench: {
    id: 'bench', name: 'Park Bench', biomes: ['urban', 'meadow'],
    width: 25, height: 15, color: '#92400e', z: 8, frequency: 3,
  },
  lamp_post: {
    id: 'lamp_post', name: 'Lamp Post', biomes: ['urban'],
    width: 10, height: 10, color: '#374151', z: 35, frequency: 4,
  },
  flower_patch: {
    id: 'flower_patch', name: 'Flower Patch', biomes: ['meadow', 'coastal'],
    width: 25, height: 25, color: '#f472b6', z: 5, frequency: 6,
  },
  trash_can: {
    id: 'trash_can', name: 'Trash Can', biomes: ['urban', 'meadow', 'coastal'],
    width: 10, height: 10, color: '#525252', z: 12, frequency: 3,
  },
  sand_dune: {
    id: 'sand_dune', name: 'Sand Dune', biomes: ['desert', 'coastal'],
    width: 40, height: 30, color: '#d4a574', z: 8, frequency: 3,
  },
  fire_hydrant: {
    id: 'fire_hydrant', name: 'Fire Hydrant', biomes: ['urban'],
    width: 8, height: 8, color: '#dc2626', z: 10, frequency: 2,
  },
};

/** Register a new scenery definition at runtime (from editor manifest) */
export function registerScenery(def: SceneryDefinition) {
  SCENERY_DEFINITIONS[def.id] = def;
}

/** Get all scenery definitions that can appear in a given biome */
export function getSceneryForBiome(biome: Biome): SceneryDefinition[] {
  return Object.values(SCENERY_DEFINITIONS).filter(d => d.biomes.includes(biome));
}

/**
 * Generate scenery items for a location based on its biome.
 * Places props around the edges and corners, avoiding the central play area
 * and the entrance zone.
 */
export function generateScenery(biome: Biome, seed?: number): SceneryItem[] {
  const available = getSceneryForBiome(biome);
  if (available.length === 0) return [];

  // Simple seeded random for deterministic placement per location
  let s = seed ?? Math.floor(Math.random() * 100000);
  function rand() {
    s = (s * 1664525 + 1013904223) & 0x7fffffff;
    return s / 0x7fffffff;
  }

  // Build a weighted pool
  const pool: SceneryDefinition[] = [];
  for (const def of available) {
    for (let i = 0; i < def.frequency; i++) pool.push(def);
  }

  const items: SceneryItem[] = [];
  const placed: { x: number; y: number; w: number; h: number }[] = [];

  // Define placement zones (edges of the 800x600 world, avoiding central play area)
  // The play area is roughly 100-700 x 50-530. We scatter props around the margins.
  const zones = [
    // Top edge
    { xMin: 0, xMax: 800, yMin: 0, yMax: 80 },
    // Bottom edge (but leave entrance at 350-450, 580-600)
    { xMin: 0, xMax: 300, yMin: 520, yMax: 600 },
    { xMin: 500, xMax: 800, yMin: 520, yMax: 600 },
    // Left edge
    { xMin: 0, xMax: 80, yMin: 80, yMax: 520 },
    // Right edge
    { xMin: 720, xMax: 800, yMin: 80, yMax: 520 },
    // Scatter a few in the interior (sparse, won't collide with rides due to collision check)
    { xMin: 100, xMax: 700, yMin: 80, yMax: 520 },
  ];

  const targetCount = 15 + Math.floor(rand() * 10); // 15-24 props

  for (let attempt = 0; attempt < targetCount * 5 && items.length < targetCount; attempt++) {
    const def = pool[Math.floor(rand() * pool.length)];
    const zone = zones[Math.floor(rand() * zones.length)];

    const x = zone.xMin + rand() * (zone.xMax - zone.xMin - def.width);
    const y = zone.yMin + rand() * (zone.yMax - zone.yMin - def.height);

    // Skip if overlapping entrance area (350-450, 570-600)
    if (x + def.width > 340 && x < 460 && y + def.height > 560) continue;

    // Check collision with already placed scenery
    const overlaps = placed.some(p =>
      x < p.x + p.w && x + def.width > p.x &&
      y < p.y + p.h && y + def.height > p.y
    );
    if (overlaps) continue;

    placed.push({ x, y, w: def.width, h: def.height });
    items.push({
      id: `scenery_${items.length}`,
      defId: def.id,
      x: Math.round(x),
      y: Math.round(y),
      width: def.width,
      height: def.height,
    });
  }

  return items;
}
