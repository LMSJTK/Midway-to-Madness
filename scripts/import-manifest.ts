/**
 * Bring public/assets/manifest.json back into assets.db.
 *
 * The manifest is what the game loads, but the editor rebuilds it from the
 * approved rows in the database. If artwork reaches the manifest without a
 * matching row — hand-edited, or carried over from another machine — then the
 * next "Export to Game" quietly drops it. Running this makes the round trip
 * safe again. Re-running is harmless: existing rows are updated in place.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db, { queries, AssetRow, ASSET_CATEGORIES } from '../server/db.ts';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST = path.resolve(__dirname, '..', 'public', 'assets', 'manifest.json');

if (!fs.existsSync(MANIFEST)) {
  console.error(`No manifest at ${MANIFEST}`);
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(MANIFEST, 'utf8')) as Record<string, any>;

/** Sprites live under assets/sprites/<category>/, which is where the editor put them. */
function categoryFromPath(p: string): string {
  const part = p.split('/')[2] ?? '';
  return (ASSET_CATEGORIES as readonly string[]).includes(part) ? part : 'stall';
}

let created = 0;
let updated = 0;
const missing: string[] = [];

for (const [id, entry] of Object.entries(manifest)) {
  const file = path.resolve(__dirname, '..', 'public', entry.path);
  if (!fs.existsSync(file)) missing.push(`${id} -> ${entry.path}`);

  const stats = entry.gameStats ?? {};
  const row = {
    id,
    name: stats.name ?? id,
    category: categoryFromPath(entry.path),
    state: 'approved',
    prompt: null,
    negative_prompt: null,
    model: null,
    seed: null,
    grid_w: entry.footprint?.w ?? 1,
    grid_h: entry.footprint?.h ?? 1,
    anchor_x: entry.anchor?.x ?? 0,
    anchor_y: entry.anchor?.y ?? 0,
    entity_type: entry.entityType ?? null,
    slot: entry.slot ?? 'base_idle',
    image_path: entry.path,
    prestige: stats.prestige ?? 10,
    value: stats.value ?? 20,
    item_cost: stats.cost ?? 500,
    base_price: stats.basePrice ?? 5,
    unlock_day: stats.unlockDay ?? 0,
    unlock_location: stats.unlockLocation ?? null,
    capacity: stats.capacity ?? null,
    duration: stats.duration ?? null,
    travel_weight: stats.travelWeight ?? 1,
    quality: stats.quality ?? 50,
    game_category: entry.gameCategory ?? null,
    biomes: Array.isArray(entry.biomes) ? entry.biomes.join(',') : null,
  };

  const existing = queries.getById.get(id) as AssetRow | undefined;
  if (existing) {
    queries.update.run(row);
    updated++;
  } else {
    queries.insert.run(row);
    created++;
  }
}

const approved = (db.prepare("SELECT COUNT(*) n FROM assets WHERE state = 'approved'").get() as { n: number }).n;
console.log(`Imported ${Object.keys(manifest).length} manifest entries: ${created} added, ${updated} updated.`);
console.log(`Approved assets now in the database: ${approved}`);
if (missing.length) {
  console.log(`\nWarning — manifest points at files that are not on disk:`);
  for (const m of missing) console.log(`  ${m}`);
}
