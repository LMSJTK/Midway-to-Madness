/**
 * Runtime sprite registry — loads asset manifest and provides sprite lookups
 * for the render loop in engine.ts. Falls back gracefully when no sprite exists.
 * Also registers manifest entries as ITEM_DEFINITIONS so editor-created items
 * are available in the game at runtime.
 */

import { registerItem, ITEM_DEFINITIONS, CATEGORY_DEFAULTS, ItemCategory } from './items';
import { registerScenery, Biome } from './scenery';
import { GAME_CONFIG } from './constants';

export interface SpriteAsset {
  image: HTMLImageElement;
  /**
   * Bounds of the actual artwork inside the image. Generated sprites are
   * contain-fitted into a square, so most of the file is transparent padding;
   * measuring the art is what lets the renderer sit it on its lot.
   */
  bounds: { x: number; y: number; w: number; h: number };
  /**
   * Horizontal middle of the artwork's lowest rows — where the object actually
   * meets the ground. Taking the middle of the whole sprite instead puts a
   * ferris wheel's overhanging disc, not its platform, over the lot.
   */
  groundX: number;
  /**
   * Sprite pixel that belongs at the footprint's ground centre, when the editor
   * recorded one. Null means derive it from the artwork bounds.
   */
  anchor: { x: number; y: number } | null;
  footprint: { w: number; h: number };
  entityType: string;
  slot: string;
  loaded: boolean;
}

/**
 * Tightest rectangle containing every pixel with meaningful alpha. Runs once
 * per sprite at load. Falls back to the full image if the canvas can't be read
 * or the image is entirely transparent.
 */
function measureArtwork(image: HTMLImageElement): {
  bounds: { x: number; y: number; w: number; h: number };
  groundX: number;
} {
  const full = { x: 0, y: 0, w: image.width, h: image.height };
  const fallback = { bounds: full, groundX: image.width / 2 };
  if (!image.width || !image.height) return fallback;

  try {
    const canvas = document.createElement('canvas');
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return fallback;
    ctx.drawImage(image, 0, 0);
    const { data } = ctx.getImageData(0, 0, image.width, image.height);

    let minX = image.width, minY = image.height, maxX = -1, maxY = -1;
    // Ignore near-transparent fringe left behind by background removal.
    const cutoff = 12;
    for (let y = 0; y < image.height; y++) {
      for (let x = 0; x < image.width; x++) {
        if (data[(y * image.width + x) * 4 + 3] <= cutoff) continue;
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxX < minX || maxY < minY) return fallback;
    const bounds = { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };

    // The base is whatever is drawn in the bottom sliver of the artwork.
    const sliceRows = Math.max(3, Math.round(bounds.h * 0.12));
    let baseMin = image.width;
    let baseMax = -1;
    for (let y = maxY; y > maxY - sliceRows && y >= minY; y--) {
      for (let x = minX; x <= maxX; x++) {
        if (data[(y * image.width + x) * 4 + 3] <= cutoff) continue;
        if (x < baseMin) baseMin = x;
        if (x > baseMax) baseMax = x;
      }
    }
    const groundX = baseMax >= baseMin ? (baseMin + baseMax) / 2 : bounds.x + bounds.w / 2;

    return { bounds, groundX };
  } catch {
    return fallback; // tainted canvas or no DOM
  }
}

export interface ManifestGameStats {
  name: string;
  prestige: number;
  value: number;
  cost: number;
  basePrice: number;
  unlockDay: number;
  unlockLocation: string | null;
  capacity: number | null;
  duration: number | null;
  travelWeight: number;
  quality: number;
}

export interface ManifestEntry {
  path: string;
  anchor: { x: number; y: number };
  footprint: { w: number; h: number };
  entityType: string;
  slot: string;
  gameCategory?: string; // ItemCategory for behavior (kiddie, food, etc.)
  biomes?: string[];    // biome tags for scenery props
  gameStats?: ManifestGameStats;
}

export type AssetManifest = Record<string, ManifestEntry>;

class SpriteRegistry {
  private assets: Map<string, SpriteAsset> = new Map();
  private loaded = false;
  public guestPortraits: string[] = [];

  /** Build a lookup key from entity type + slot */
  private key(entityType: string, slot: string): string {
    return `${entityType}:${slot}`;
  }

  /** Load the asset manifest and preload all sprite images */
  async load(): Promise<void> {
    if (this.loaded) return;

    try {
      const resp = await fetch('/assets/manifest.json');
      if (!resp.ok) {
        console.log('No asset manifest found — using primitive rendering');
        return;
      }

      const manifest: AssetManifest = await resp.json();

      const loadPromises = Object.entries(manifest).map(([id, entry]) => {
        return new Promise<void>((resolve) => {
          const img = new Image();
          img.onload = () => {
            const explicit = entry.anchor && (entry.anchor.x || entry.anchor.y) ? entry.anchor : null;
            const measured = measureArtwork(img);
            const asset: SpriteAsset = {
              image: img,
              bounds: measured.bounds,
              groundX: measured.groundX,
              anchor: explicit,
              footprint: entry.footprint,
              entityType: entry.entityType,
              slot: entry.slot,
              loaded: true,
            };
            this.assets.set(this.key(entry.entityType, entry.slot), asset);
            // Also index by asset ID for direct lookups
            this.assets.set(id, asset);
            resolve();
          };
          img.onerror = () => {
            console.warn(`Failed to load sprite: ${entry.path}`);
            resolve(); // Don't block on missing sprites
          };
          img.src = entry.path;
        });
      });

      await Promise.all(loadPromises);

      // Register manifest entries as ITEM_DEFINITIONS (only base_idle slots with gameStats)
      for (const [id, entry] of Object.entries(manifest)) {
        if (entry.slot !== 'base_idle' || !entry.gameStats || !entry.entityType) continue;
        // Don't overwrite hardcoded definitions — entity_type is the item def ID
        const defId = entry.entityType;
        if (ITEM_DEFINITIONS[defId]) continue;

        // Use explicit gameCategory if set, fall back to entityType for older manifests
        const category = (entry.gameCategory || entry.entityType) as ItemCategory;
        const catDefaults = CATEGORY_DEFAULTS[category];
        const gs = entry.gameStats;
        if (!catDefaults) continue; // skip if category is not a valid ItemCategory

        registerItem({
          id: defId,
          category,
          name: gs.name,
          basePrice: gs.basePrice,
          cost: gs.cost,
          width: entry.footprint.w * GAME_CONFIG.CELL,
          height: entry.footprint.h * GAME_CONFIG.CELL,
          color: catDefaults?.color ?? '#fff',
          prestige: gs.prestige,
          value: gs.value,
          quality: gs.quality,
          travelWeight: gs.travelWeight,
          unlockDay: gs.unlockDay,
          unlockLocation: gs.unlockLocation ?? undefined,
          capacity: gs.capacity ?? undefined,
          duration: gs.duration ?? undefined,
        });
      }

      // Register manifest entries as scenery definitions (prop/terrain with biomes)
      for (const [id, entry] of Object.entries(manifest)) {
        if (entry.slot !== 'base_idle' || !entry.biomes || entry.biomes.length === 0) continue;
        registerScenery({
          id: entry.entityType || id,
          name: entry.gameStats?.name || id,
          biomes: entry.biomes as Biome[],
          width: entry.footprint.w * GAME_CONFIG.CELL,
          height: entry.footprint.h * GAME_CONFIG.CELL,
          color: '#888',
          z: 15,
          frequency: 4,
        });
      }

      // Collect guest portrait image paths
      for (const [_id, entry] of Object.entries(manifest)) {
        if (entry.entityType === 'guest_portrait' && entry.path) {
          this.guestPortraits.push(entry.path);
        }
      }

      this.loaded = true;
      console.log(`Sprite registry loaded: ${this.assets.size} assets, ${this.guestPortraits.length} portraits`);
    } catch {
      console.log('Asset manifest not available — using primitive rendering');
    }
  }

  /** Look up a sprite for a given entity type and slot. Returns undefined if none exists. */
  get(entityType: string, slot: string): SpriteAsset | undefined {
    return this.assets.get(this.key(entityType, slot));
  }

  /** Check if any sprites are loaded at all */
  get hasSprites(): boolean {
    return this.assets.size > 0;
  }
}

export const spriteRegistry = new SpriteRegistry();
