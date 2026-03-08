import { Router } from 'express';
import { queries, AssetRow } from '../db';
import path from 'path';
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const router = Router();

// List all assets, optionally filtered by category or state
router.get('/', (req, res) => {
  const { category, state } = req.query;
  let rows: AssetRow[];
  if (category) {
    rows = queries.listByCategory.all(category) as AssetRow[];
  } else if (state) {
    rows = queries.listByState.all(state) as AssetRow[];
  } else {
    rows = queries.listAll.all() as AssetRow[];
  }
  res.json(rows);
});

// Get single asset by ID
router.get('/:id', (req, res) => {
  const row = queries.getById.get(req.params.id) as AssetRow | undefined;
  if (!row) return res.status(404).json({ error: 'Asset not found' });
  res.json(row);
});

// Create a new asset
router.post('/', (req, res) => {
  const asset = req.body;
  if (!asset.id || !asset.name || !asset.category) {
    return res.status(400).json({ error: 'id, name, and category are required' });
  }

  const existing = queries.getById.get(asset.id);
  if (existing) {
    return res.status(409).json({ error: 'Asset with this ID already exists' });
  }

  queries.insert.run({
    id: asset.id,
    name: asset.name,
    category: asset.category,
    state: asset.state || 'draft',
    prompt: asset.prompt || null,
    negative_prompt: asset.negative_prompt || null,
    model: asset.model || null,
    seed: asset.seed || null,
    grid_w: asset.grid_w ?? 1,
    grid_h: asset.grid_h ?? 1,
    anchor_x: asset.anchor_x ?? 0,
    anchor_y: asset.anchor_y ?? 0,
    entity_type: asset.entity_type || null,
    slot: asset.slot || 'base_idle',
    image_path: asset.image_path || null,
    prestige: asset.prestige ?? 10,
    value: asset.value ?? 20,
    item_cost: asset.item_cost ?? 500,
    base_price: asset.base_price ?? 5,
    unlock_day: asset.unlock_day ?? 0,
    unlock_location: asset.unlock_location || null,
    capacity: asset.capacity ?? null,
    duration: asset.duration ?? null,
    travel_weight: asset.travel_weight ?? 1,
    quality: asset.quality ?? 50,
    game_category: asset.game_category || null,
    biomes: asset.biomes || null,
  });

  const created = queries.getById.get(asset.id) as AssetRow;
  res.status(201).json(created);
});

// Update an asset
router.put('/:id', (req, res) => {
  const existing = queries.getById.get(req.params.id) as AssetRow | undefined;
  if (!existing) return res.status(404).json({ error: 'Asset not found' });

  const asset = { ...existing, ...req.body, id: req.params.id };
  queries.update.run(asset);

  const updated = queries.getById.get(req.params.id) as AssetRow;
  res.json(updated);
});

// Update just the anchor point (used by the canvas click tool)
router.patch('/:id/anchor', (req, res) => {
  const { anchor_x, anchor_y } = req.body;
  if (anchor_x == null || anchor_y == null) {
    return res.status(400).json({ error: 'anchor_x and anchor_y are required' });
  }

  const existing = queries.getById.get(req.params.id) as AssetRow | undefined;
  if (!existing) return res.status(404).json({ error: 'Asset not found' });

  queries.updateAnchor.run({ id: req.params.id, anchor_x, anchor_y });
  const updated = queries.getById.get(req.params.id) as AssetRow;
  res.json(updated);
});

// Update just the state (draft -> review -> approved)
router.patch('/:id/state', (req, res) => {
  const { state } = req.body;
  const validStates = ['draft', 'review', 'approved', 'deprecated'];
  if (!validStates.includes(state)) {
    return res.status(400).json({ error: `state must be one of: ${validStates.join(', ')}` });
  }

  const existing = queries.getById.get(req.params.id) as AssetRow | undefined;
  if (!existing) return res.status(404).json({ error: 'Asset not found' });

  queries.updateState.run({ id: req.params.id, state });
  const updated = queries.getById.get(req.params.id) as AssetRow;
  res.json(updated);
});

// Delete an asset
router.delete('/:id', (req, res) => {
  const existing = queries.getById.get(req.params.id) as AssetRow | undefined;
  if (!existing) return res.status(404).json({ error: 'Asset not found' });

  queries.delete.run(req.params.id);
  res.json({ deleted: true });
});

export default router;
