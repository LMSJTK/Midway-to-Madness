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
}

export const queries = {
  listAll: db.prepare('SELECT * FROM assets ORDER BY updated_at DESC'),
  getById: db.prepare('SELECT * FROM assets WHERE id = ?'),
  listByCategory: db.prepare('SELECT * FROM assets WHERE category = ? ORDER BY updated_at DESC'),
  listByState: db.prepare('SELECT * FROM assets WHERE state = ? ORDER BY updated_at DESC'),
  listApprovedForEntity: db.prepare('SELECT * FROM assets WHERE entity_type = ? AND state = \'approved\' ORDER BY slot'),

  insert: db.prepare(`
    INSERT INTO assets (id, name, category, state, prompt, negative_prompt, model, seed,
                        grid_w, grid_h, anchor_x, anchor_y, entity_type, slot, image_path)
    VALUES (@id, @name, @category, @state, @prompt, @negative_prompt, @model, @seed,
            @grid_w, @grid_h, @anchor_x, @anchor_y, @entity_type, @slot, @image_path)
  `),

  update: db.prepare(`
    UPDATE assets SET
      name = @name, category = @category, state = @state,
      prompt = @prompt, negative_prompt = @negative_prompt, model = @model, seed = @seed,
      grid_w = @grid_w, grid_h = @grid_h, anchor_x = @anchor_x, anchor_y = @anchor_y,
      entity_type = @entity_type, slot = @slot, image_path = @image_path,
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
