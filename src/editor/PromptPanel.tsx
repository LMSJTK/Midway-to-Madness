import React, { useState } from 'react';
import { generateApi, assetsApi, AssetRecord } from './api';
import { ITEM_DEFINITIONS, ItemCategory } from '../game/items';

const CATEGORIES = [
  { value: 'ride', label: 'Ride' },
  { value: 'stall', label: 'Stall' },
  { value: 'guest', label: 'Guest' },
  { value: 'staff', label: 'Staff' },
  { value: 'trash', label: 'Trash' },
  { value: 'prop', label: 'Prop' },
  { value: 'terrain', label: 'Terrain' },
  { value: 'ui', label: 'UI' },
];

const CATEGORY_ORDER: ItemCategory[] = ['kiddie', 'major', 'spectacular', 'food', 'bathroom', 'gameStall', 'shop', 'performance'];
const CATEGORY_LABELS: Record<ItemCategory, string> = {
  kiddie: 'Kiddie Rides',
  major: 'Major Rides',
  spectacular: 'Spectacular',
  food: 'Food',
  bathroom: 'Bathrooms',
  gameStall: 'Game Stalls',
  shop: 'Shops',
  performance: 'Performances',
};

const SLOTS = ['base_idle', 'base_active', 'broken_state', 'base_dirty', 'icon_small'];

interface Props {
  onAssetCreated: (asset: AssetRecord) => void;
  currentAsset: AssetRecord | null;
}

export function PromptPanel({ onAssetCreated, currentAsset }: Props) {
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('stall');
  const [entityType, setEntityType] = useState('');
  const [slot, setSlot] = useState('base_idle');
  const [gridW, setGridW] = useState(1);
  const [gridH, setGridH] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const assetId = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '') || 'unnamed';

  async function handleGenerate() {
    if (!description.trim() || !name.trim()) return;
    setGenerating(true);
    setError(null);

    try {
      // Generate image
      const result = await generateApi.generate(description, category, assetId, gridW, gridH);

      // Create asset record in DB
      const asset = await assetsApi.create({
        id: assetId,
        name: name.trim(),
        category,
        prompt: result.prompt,
        model: result.model,
        entity_type: entityType || null,
        slot,
        grid_w: gridW,
        grid_h: gridH,
        image_path: result.imagePath,
      });

      onAssetCreated(asset);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3 p-4 bg-zinc-800 rounded-lg">
      <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">Generate Asset</h2>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">Name</span>
        <input
          type="text"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="Hot Dog Stand"
          className="bg-zinc-700 text-white text-sm rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-amber-500"
        />
        <span className="text-xs text-zinc-500">ID: {assetId}</span>
      </label>

      <label className="flex flex-col gap-1">
        <span className="text-xs text-zinc-400">Description (what you want to see)</span>
        <textarea
          value={description}
          onChange={e => setDescription(e.target.value)}
          placeholder="hot dog stand with red and yellow striped awning, mustard bottles on counter"
          rows={3}
          className="bg-zinc-700 text-white text-sm rounded px-2 py-1.5 outline-none focus:ring-1 focus:ring-amber-500 resize-none"
        />
      </label>

      <div className="text-xs text-zinc-500 bg-zinc-900 rounded p-2">
        Prompt prefix: <em>"Isometric 2:1 dimetric projection, top-left lighting, carnival style, transparent background..."</em>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Category</span>
          <select
            value={category}
            onChange={e => setCategory(e.target.value)}
            className="bg-zinc-700 text-white text-sm rounded px-2 py-1.5"
          >
            {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Entity Binding</span>
          <select
            value={entityType}
            onChange={e => setEntityType(e.target.value)}
            className="bg-zinc-700 text-white text-sm rounded px-2 py-1.5"
          >
            <option value="">(none)</option>
            {CATEGORY_ORDER.map(cat => {
              const items = Object.values(ITEM_DEFINITIONS).filter(d => d.category === cat);
              if (items.length === 0) return null;
              return (
                <optgroup key={cat} label={CATEGORY_LABELS[cat]}>
                  {items.map(item => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </optgroup>
              );
            })}
          </select>
        </label>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Slot</span>
          <select
            value={slot}
            onChange={e => setSlot(e.target.value)}
            className="bg-zinc-700 text-white text-sm rounded px-2 py-1.5"
          >
            {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Grid W</span>
          <input
            type="number"
            min={1}
            max={4}
            value={gridW}
            onChange={e => setGridW(Number(e.target.value))}
            className="bg-zinc-700 text-white text-sm rounded px-2 py-1.5"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Grid H</span>
          <input
            type="number"
            min={1}
            max={4}
            value={gridH}
            onChange={e => setGridH(Number(e.target.value))}
            className="bg-zinc-700 text-white text-sm rounded px-2 py-1.5"
          />
        </label>
      </div>

      {error && (
        <div className="text-red-400 text-xs bg-red-900/30 rounded p-2">{error}</div>
      )}

      <button
        onClick={handleGenerate}
        disabled={generating || !description.trim() || !name.trim()}
        className="bg-amber-600 hover:bg-amber-500 disabled:bg-zinc-600 disabled:text-zinc-400 text-white font-bold text-sm rounded px-4 py-2 transition-colors"
      >
        {generating ? 'Generating...' : 'Generate'}
      </button>
    </div>
  );
}
