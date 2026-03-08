/**
 * API client for the asset engine backend.
 * All editor UI components use these functions to talk to the Express server.
 */

export interface AssetRecord {
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
  game_category: string | null;
  biomes: string | null; // comma-separated biome tags for scenery
}

const API_BASE = '/api';

async function request<T>(url: string, options?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${url}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!resp.ok) {
    const err = await resp.json().catch(() => ({ error: resp.statusText }));
    throw new Error(err.error || resp.statusText);
  }
  return resp.json();
}

// Assets CRUD
export const assetsApi = {
  list(params?: { category?: string; state?: string }): Promise<AssetRecord[]> {
    const qs = new URLSearchParams(params as Record<string, string>).toString();
    return request(`/assets${qs ? '?' + qs : ''}`);
  },

  get(id: string): Promise<AssetRecord> {
    return request(`/assets/${id}`);
  },

  create(asset: Partial<AssetRecord> & { id: string; name: string; category: string }): Promise<AssetRecord> {
    return request('/assets', { method: 'POST', body: JSON.stringify(asset) });
  },

  update(id: string, data: Partial<AssetRecord>): Promise<AssetRecord> {
    return request(`/assets/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  },

  setAnchor(id: string, anchor_x: number, anchor_y: number): Promise<AssetRecord> {
    return request(`/assets/${id}/anchor`, {
      method: 'PATCH',
      body: JSON.stringify({ anchor_x, anchor_y }),
    });
  },

  setState(id: string, state: string): Promise<AssetRecord> {
    return request(`/assets/${id}/state`, {
      method: 'PATCH',
      body: JSON.stringify({ state }),
    });
  },

  delete(id: string): Promise<{ deleted: boolean }> {
    return request(`/assets/${id}`, { method: 'DELETE' });
  },
};

// AI Generation
export const generateApi = {
  generate(description: string, category: string, assetId: string, gridW = 1, gridH = 1): Promise<{
    prompt: string;
    imagePath: string;
    model: string;
    size: { width: number; height: number };
  }> {
    return request('/generate', {
      method: 'POST',
      body: JSON.stringify({ description, category, assetId, gridW, gridH }),
    });
  },
};

// Export
export const exportApi = {
  exportManifest(): Promise<{ exported: number; warnings: string[] }> {
    return request('/export', { method: 'POST' });
  },

  preview(): Promise<{ count: number; assets: { id: string; entityType: string; slot: string; hasImage: boolean }[] }> {
    return request('/export/preview');
  },
};
