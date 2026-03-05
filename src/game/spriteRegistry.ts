/**
 * Runtime sprite registry — loads asset manifest and provides sprite lookups
 * for the render loop in engine.ts. Falls back gracefully when no sprite exists.
 */

export interface SpriteAsset {
  image: HTMLImageElement;
  anchor: { x: number; y: number };
  footprint: { w: number; h: number };
  entityType: string;
  slot: string;
  loaded: boolean;
}

export interface ManifestEntry {
  path: string;
  anchor: { x: number; y: number };
  footprint: { w: number; h: number };
  entityType: string;
  slot: string;
}

export type AssetManifest = Record<string, ManifestEntry>;

class SpriteRegistry {
  private assets: Map<string, SpriteAsset> = new Map();
  private loaded = false;

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
            const asset: SpriteAsset = {
              image: img,
              anchor: entry.anchor,
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
      this.loaded = true;
      console.log(`Sprite registry loaded: ${this.assets.size} assets`);
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
