import { Router } from 'express';
import { queries, AssetRow } from '../db';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

const MANIFEST_PATH = path.resolve(__dirname, '..', '..', 'public', 'assets', 'manifest.json');

// Rebuild the runtime manifest from all approved assets
router.post('/', (_req, res) => {
  const approved = queries.listByState.all('approved') as AssetRow[];

  const manifest: Record<string, {
    path: string;
    anchor: { x: number; y: number };
    footprint: { w: number; h: number };
    entityType: string;
    slot: string;
    gameCategory?: string;
    gameStats?: {
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
    };
  }> = {};

  const warnings: string[] = [];

  for (const asset of approved) {
    if (!asset.image_path) {
      warnings.push(`${asset.id}: no image_path, skipping`);
      continue;
    }
    if (!asset.entity_type) {
      warnings.push(`${asset.id}: no entity_type binding, skipping`);
      continue;
    }

    manifest[asset.id] = {
      path: asset.image_path,
      anchor: { x: asset.anchor_x, y: asset.anchor_y },
      footprint: { w: asset.grid_w, h: asset.grid_h },
      entityType: asset.entity_type,
      slot: asset.slot,
      gameCategory: asset.game_category || undefined,
      gameStats: {
        name: asset.name,
        prestige: asset.prestige,
        value: asset.value,
        cost: asset.item_cost,
        basePrice: asset.base_price,
        unlockDay: asset.unlock_day,
        unlockLocation: asset.unlock_location,
        capacity: asset.capacity,
        duration: asset.duration,
        travelWeight: asset.travel_weight,
        quality: asset.quality,
      },
    };
  }

  fs.mkdirSync(path.dirname(MANIFEST_PATH), { recursive: true });
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2));

  res.json({
    exported: Object.keys(manifest).length,
    warnings,
    manifestPath: MANIFEST_PATH,
  });
});

// Preview what would be exported without writing
router.get('/preview', (_req, res) => {
  const approved = queries.listByState.all('approved') as AssetRow[];
  res.json({
    count: approved.length,
    assets: approved.map(a => ({
      id: a.id,
      entityType: a.entity_type,
      slot: a.slot,
      hasImage: !!a.image_path,
    })),
  });
});

export default router;
