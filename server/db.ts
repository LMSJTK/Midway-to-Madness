import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

// Reconstruct __dirname for ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.resolve(__dirname, '..', 'assets.db');

const db = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS assets (
    id          TEXT PRIMARY KEY,
    name        TEXT NOT NULL,
    category    TEXT NOT NULL CHECK(category IN ('ride','stall','guest','staff','trash','prop','terrain','ui')),
    state       TEXT NOT NULL DEFAULT 'draft' CHECK(state IN ('draft','review','approved','deprecated')),
    prompt      TEXT,
    negative_prompt TEXT,
    model       TEXT,
    seed        TEXT,
    grid_w      INTEGER NOT NULL DEFAULT 1,
    grid_h      INTEGER NOT NULL DEFAULT 1,
    anchor_x    INTEGER NOT NULL DEFAULT 0,
    anchor_y    INTEGER NOT NULL DEFAULT 0,
    entity_type TEXT,
    slot        TEXT NOT NULL DEFAULT 'base_idle',
    image_path  TEXT,
    created_at  TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at  TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Add game-stat columns for named buildings (safe to re-run on existing DBs)
const gameStatCols: [string, string][] = [
  ['prestige',       'INTEGER NOT NULL DEFAULT 10'],
  ['value',          'INTEGER NOT NULL DEFAULT 20'],
  ['item_cost',      'INTEGER NOT NULL DEFAULT 500'],
  ['base_price',     'INTEGER NOT NULL DEFAULT 5'],
  ['unlock_day',     'INTEGER NOT NULL DEFAULT 0'],
  ['unlock_location','TEXT'],
  ['capacity',       'INTEGER'],
  ['duration',       'INTEGER'],
  ['travel_weight',  'INTEGER NOT NULL DEFAULT 1'],
  ['quality',        'INTEGER NOT NULL DEFAULT 50'],
  ['game_category',  'TEXT'],
];
for (const [col, def] of gameStatCols) {
  try { db.exec(`ALTER TABLE assets ADD COLUMN ${col} ${def}`); } catch { /* already exists */ }
}

export interface AssetRow {
  id: string;
  name: string;
  category: string;
  state: string;
  prompt: string | null;
  negative_prompt: string | null;
  model: string | null;
  seed: string | null;
  grid_w: number;
  grid_h: number;
  anchor_x: number;
  anchor_y: number;
  entity_type: string | null;
  slot: string;
  image_path: string | null;
  created_at: string;
  updated_at: string;
  // Game stats for named buildings
  prestige: number;
  value: number;
  item_cost: number;
  base_price: number;
  unlock_day: number;
  unlock_location: string | null;
  capacity: number | null;
  duration: number | null;
  travel_weight: number;
  quality: number;
  game_category: string | null; // ItemCategory for game behavior (kiddie, food, etc.)
}

export const queries = {
  listAll: db.prepare('SELECT * FROM assets ORDER BY updated_at DESC'),
  getById: db.prepare('SELECT * FROM assets WHERE id = ?'),
  listByCategory: db.prepare('SELECT * FROM assets WHERE category = ? ORDER BY updated_at DESC'),
  listByState: db.prepare('SELECT * FROM assets WHERE state = ? ORDER BY updated_at DESC'),
  listApprovedForEntity: db.prepare('SELECT * FROM assets WHERE entity_type = ? AND state = \'approved\' ORDER BY slot'),

  insert: db.prepare(`
    INSERT INTO assets (id, name, category, state, prompt, negative_prompt, model, seed,
                        grid_w, grid_h, anchor_x, anchor_y, entity_type, slot, image_path,
                        prestige, value, item_cost, base_price, unlock_day, unlock_location,
                        capacity, duration, travel_weight, quality, game_category)
    VALUES (@id, @name, @category, @state, @prompt, @negative_prompt, @model, @seed,
            @grid_w, @grid_h, @anchor_x, @anchor_y, @entity_type, @slot, @image_path,
            @prestige, @value, @item_cost, @base_price, @unlock_day, @unlock_location,
            @capacity, @duration, @travel_weight, @quality, @game_category)
  `),

  update: db.prepare(`
    UPDATE assets SET
      name = @name, category = @category, state = @state,
      prompt = @prompt, negative_prompt = @negative_prompt, model = @model, seed = @seed,
      grid_w = @grid_w, grid_h = @grid_h, anchor_x = @anchor_x, anchor_y = @anchor_y,
      entity_type = @entity_type, slot = @slot, image_path = @image_path,
      prestige = @prestige, value = @value, item_cost = @item_cost, base_price = @base_price,
      unlock_day = @unlock_day, unlock_location = @unlock_location,
      capacity = @capacity, duration = @duration, travel_weight = @travel_weight, quality = @quality, game_category = @game_category,
      updated_at = datetime('now')
    WHERE id = @id
  `),

  updateAnchor: db.prepare(`
    UPDATE assets SET anchor_x = @anchor_x, anchor_y = @anchor_y, updated_at = datetime('now')
    WHERE id = @id
  `),

  updateState: db.prepare(`
    UPDATE assets SET state = @state, updated_at = datetime('now')
    WHERE id = @id
  `),

  delete: db.prepare('DELETE FROM assets WHERE id = ?'),
};

export default db;
