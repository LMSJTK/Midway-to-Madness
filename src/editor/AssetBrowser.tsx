import React, { useEffect, useState } from 'react';
import { AssetRecord, assetsApi } from './api';

const STATE_COLORS: Record<string, string> = {
  draft: 'border-zinc-600',
  review: 'border-amber-600',
  approved: 'border-emerald-600',
  deprecated: 'border-red-800',
};

interface Props {
  onSelect: (asset: AssetRecord) => void;
  selectedId: string | null;
  refreshKey: number;
}

export function AssetBrowser({ onSelect, selectedId, refreshKey }: Props) {
  const [assets, setAssets] = useState<AssetRecord[]>([]);
  const [filter, setFilter] = useState<string>('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const params = filter ? { category: filter } : undefined;
    assetsApi.list(params)
      .then(setAssets)
      .catch(err => console.error('Failed to load assets:', err))
      .finally(() => setLoading(false));
  }, [filter, refreshKey]);

  return (
    <div className="flex flex-col gap-2 p-4 bg-zinc-800 rounded-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-300 uppercase tracking-wide">Assets</h2>
        <select
          value={filter}
          onChange={e => setFilter(e.target.value)}
          className="bg-zinc-700 text-white text-xs rounded px-2 py-1"
        >
          <option value="">All</option>
          <option value="ride">Rides</option>
          <option value="stall">Stalls</option>
          <option value="guest">Guests</option>
          <option value="staff">Staff</option>
          <option value="trash">Trash</option>
          <option value="prop">Props</option>
        </select>
      </div>

      {loading ? (
        <div className="text-zinc-500 text-xs py-4 text-center">Loading...</div>
      ) : assets.length === 0 ? (
        <div className="text-zinc-500 text-xs py-4 text-center">No assets yet. Generate one above.</div>
      ) : (
        <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
          {assets.map(asset => (
            <button
              key={asset.id}
              onClick={() => onSelect(asset)}
              className={`flex flex-col items-center gap-1 p-2 rounded border-2 transition-colors hover:bg-zinc-700 ${
                selectedId === asset.id ? 'border-amber-500 bg-zinc-700' : STATE_COLORS[asset.state] || 'border-zinc-700'
              }`}
            >
              {asset.image_path ? (
                <img
                  src={'/' + asset.image_path}
                  alt={asset.name}
                  className="w-12 h-12 object-contain"
                  style={{ imageRendering: 'pixelated' }}
                />
              ) : (
                <div className="w-12 h-12 bg-zinc-600 rounded flex items-center justify-center text-zinc-400 text-xs">?</div>
              )}
              <span className="text-xs text-zinc-300 truncate w-full text-center">{asset.name}</span>
              <span className="text-[10px] text-zinc-500">{asset.state}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
