import React, { useState } from 'react';
import { AssetRecord, assetsApi, exportApi } from './api';
import { ITEM_DEFINITIONS, ItemCategory } from '../game/items';
import type { Biome } from '../game/scenery';
import { SCENERY_DEFINITIONS } from '../game/scenery';

const ALL_BIOMES: Biome[] = ['meadow', 'desert', 'urban', 'forest', 'coastal'];

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

// Special sentinel for the "new entity" option
const NEW_ENTITY_SENTINEL = '__new__';

interface Props {
  asset: AssetRecord | null;
  onAssetUpdated: (asset: AssetRecord) => void;
}

export function MetadataForm({ asset, onAssetUpdated }: Props) {
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState<{ exported: number; warnings: string[] } | null>(null);

  if (!asset) {
    return (
      <div className="p-4 bg-zinc-800 rounded-lg text-zinc-500 text-sm">
        Generate or select an asset to edit its metadata.
      </div>
    );
  }

  // Determine if current entity_type is an existing ITEM_DEFINITION or a custom/new one
  const isExistingEntity = asset.entity_type ? (!!ITEM_DEFINITIONS[asset.entity_type] || !!SCENERY_DEFINITIONS[asset.entity_type]) : false;
  const isNewEntity = asset.entity_type && !isExistingEntity;

  async function handleStateChange(newState: string) {
    if (!asset) return;
    setSaving(true);
    try {
      const updated = await assetsApi.setState(asset.id, newState);
      onAssetUpdated(updated);
    } catch (err: any) {
      console.error('Failed to update state:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleFieldChange(field: string, value: string | number | null) {
    if (!asset) return;
    setSaving(true);
    try {
      const updated = await assetsApi.update(asset.id, { [field]: value });
      onAssetUpdated(updated);
    } catch (err: any) {
      console.error('Failed to update:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleEntityBindingChange(selectValue: string) {
    if (!asset) return;
    if (selectValue === NEW_ENTITY_SENTINEL) {
      // Set entity_type to the asset's own ID (creates a new entity)
      setSaving(true);
      try {
        const updated = await assetsApi.update(asset.id, { entity_type: asset.id });
        onAssetUpdated(updated);
      } catch (err: any) {
        console.error('Failed to update:', err);
      } finally {
        setSaving(false);
      }
    } else {
      handleFieldChange('entity_type', selectValue || null);
    }
  }

  async function handleExport() {
    setExporting(true);
    setExportResult(null);
    try {
      const result = await exportApi.exportManifest();
      setExportResult(result);
    } catch (err: any) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  const stateColors: Record<string, string> = {
    draft: 'bg-zinc-600',
    review: 'bg-amber-600',
    approved: 'bg-emerald-600',
    deprecated: 'bg-red-800',
  };

  // For the select dropdown: if the entity_type matches an existing def, show that value.
  // If it's a new/custom entity, show the sentinel so we can display the custom UI.
  const selectValue = !asset.entity_type ? '' : isExistingEntity ? asset.entity_type : NEW_ENTITY_SENTINEL;

  return (
    <div className="flex flex-col gap-3 p-4 bg-zinc-800 rounded-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">Asset Details</h2>
        <span className={`text-xs text-white px-2 py-0.5 rounded ${stateColors[asset.state] || 'bg-zinc-600'}`}>
          {asset.state}
        </span>
      </div>

      <div className="text-xs text-zinc-400 space-y-1">
        <div><strong>ID:</strong> {asset.id}</div>
        <div><strong>Name:</strong> {asset.name}</div>
        <div><strong>Category:</strong> {asset.category}</div>
        <div><strong>Created:</strong> {asset.created_at}</div>
        {asset.prompt && <div><strong>Prompt:</strong> <span className="text-zinc-500">{asset.prompt}</span></div>}
        {asset.model && <div><strong>Model:</strong> {asset.model}</div>}
        {asset.image_path && <div><strong>Image:</strong> {asset.image_path}</div>}
        <div><strong>Anchor:</strong> ({asset.anchor_x}, {asset.anchor_y})</div>
        <div><strong>Grid:</strong> {asset.grid_w}x{asset.grid_h}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Entity Binding</span>
          <select
            value={selectValue}
            onChange={e => handleEntityBindingChange(e.target.value)}
            className="bg-zinc-700 text-white text-sm rounded px-2 py-1.5"
          >
            <option value="">(none)</option>
            <option value={NEW_ENTITY_SENTINEL}>+ New Entity (use asset ID)</option>
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
            <optgroup label="Scenery & Props">
              {Object.values(SCENERY_DEFINITIONS).map(scenery => (
                <option key={scenery.id} value={scenery.id}>{scenery.name}</option>
              ))}
            </optgroup>
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Slot</span>
          <select
            value={asset.slot}
            onChange={e => handleFieldChange('slot', e.target.value)}
            className="bg-zinc-700 text-white text-sm rounded px-2 py-1.5"
          >
            {SLOTS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>

      {/* Show custom entity ID when in "new entity" mode */}
      {isNewEntity && (
        <div className="bg-zinc-900 rounded p-2 text-xs space-y-2">
          <div className="text-emerald-400">New entity: <strong>{asset.entity_type}</strong></div>
          <label className="flex flex-col gap-1">
            <span className="text-zinc-400">Entity ID</span>
            <input
              type="text"
              value={asset.entity_type || ''}
              onChange={e => handleFieldChange('entity_type', e.target.value || null)}
              className="bg-zinc-700 text-white text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-emerald-500"
              placeholder="my_custom_ride"
            />
          </label>
        </div>
      )}

      {/* Game Category — required when entity is bound, determines behavior */}
      {asset.entity_type && (
        <label className="flex flex-col gap-1">
          <span className="text-xs text-zinc-400">Game Category <span className="text-zinc-600">(determines behavior: rides, food, etc.)</span></span>
          <select
            value={asset.game_category || ''}
            onChange={e => handleFieldChange('game_category', e.target.value || null)}
            className="bg-zinc-700 text-white text-sm rounded px-2 py-1.5"
          >
            <option value="">(not set)</option>
            {CATEGORY_ORDER.map(cat => (
              <option key={cat} value={cat}>{CATEGORY_LABELS[cat]}</option>
            ))}
          </select>
        </label>
      )}

      {/* Biome tags (for prop/terrain scenery) */}
      {(asset.category === 'prop' || asset.category === 'terrain') && (
        <div className="border-t border-zinc-700 pt-2">
          <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">Biome Tags</h3>
          <div className="flex flex-wrap gap-2">
            {ALL_BIOMES.map(biome => {
              const currentBiomes = asset.biomes ? asset.biomes.split(',').map(b => b.trim()) : [];
              const isActive = currentBiomes.includes(biome);
              return (
                <button
                  key={biome}
                  onClick={() => {
                    const updated = isActive
                      ? currentBiomes.filter(b => b !== biome)
                      : [...currentBiomes, biome];
                    handleFieldChange('biomes', updated.length > 0 ? updated.join(',') : null);
                  }}
                  className={`text-xs px-2 py-1 rounded transition-colors ${
                    isActive
                      ? 'bg-emerald-600 text-white'
                      : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                  }`}
                >
                  {biome}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Game stats */}
      <div className="border-t border-zinc-700 pt-2">
        <h3 className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">Game Stats</h3>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['prestige', 'Prestige', 'number'],
            ['value', 'Value', 'number'],
            ['quality', 'Quality', 'number'],
            ['item_cost', 'Cost', 'number'],
            ['base_price', 'Base Price', 'number'],
            ['unlock_day', 'Unlock Day', 'number'],
            ['unlock_location', 'Unlock Location', 'text'],
            ['capacity', 'Capacity', 'number'],
            ['duration', 'Duration', 'number'],
            ['travel_weight', 'Travel Weight', 'number'],
          ] as const).map(([field, label, type]) => (
            <label key={field} className="flex flex-col gap-0.5">
              <span className="text-xs text-zinc-500">{label}</span>
              <input
                type={type}
                value={asset[field] ?? ''}
                onChange={e => handleFieldChange(field, type === 'number' ? (e.target.value === '' ? null : Number(e.target.value)) : (e.target.value || null))}
                className="bg-zinc-700 text-white text-xs rounded px-2 py-1 outline-none focus:ring-1 focus:ring-amber-500"
              />
            </label>
          ))}
        </div>
      </div>

      {/* State workflow buttons */}
      <div className="flex gap-2">
        {asset.state === 'draft' && (
          <button
            onClick={() => handleStateChange('review')}
            disabled={saving}
            className="flex-1 bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold rounded px-3 py-1.5 transition-colors"
          >
            Submit for Review
          </button>
        )}
        {asset.state === 'review' && (
          <>
            <button
              onClick={() => handleStateChange('approved')}
              disabled={saving}
              className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded px-3 py-1.5 transition-colors"
            >
              Approve
            </button>
            <button
              onClick={() => handleStateChange('draft')}
              disabled={saving}
              className="flex-1 bg-zinc-600 hover:bg-zinc-500 text-white text-xs font-bold rounded px-3 py-1.5 transition-colors"
            >
              Back to Draft
            </button>
          </>
        )}
        {asset.state === 'approved' && (
          <button
            onClick={() => handleStateChange('deprecated')}
            disabled={saving}
            className="flex-1 bg-red-700 hover:bg-red-600 text-white text-xs font-bold rounded px-3 py-1.5 transition-colors"
          >
            Deprecate
          </button>
        )}
      </div>

      {/* Export */}
      <div className="border-t border-zinc-700 pt-3">
        <button
          onClick={handleExport}
          disabled={exporting}
          className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-zinc-600 text-white text-sm font-bold rounded px-4 py-2 transition-colors"
        >
          {exporting ? 'Exporting...' : 'Export to Game'}
        </button>
        {exportResult && (
          <div className="mt-2 text-xs">
            <div className="text-emerald-400">Exported {exportResult.exported} assets to manifest.json</div>
            {exportResult.warnings.map((w, i) => (
              <div key={i} className="text-amber-400">Warning: {w}</div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
