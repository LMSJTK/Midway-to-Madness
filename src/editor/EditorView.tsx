import React, { useState, useCallback } from 'react';
import { AssetRecord } from './api';
import { PromptPanel } from './PromptPanel';
import { SpriteCanvas } from './SpriteCanvas';
import { MetadataForm } from './MetadataForm';
import { AssetBrowser } from './AssetBrowser';

export function EditorView() {
  const [currentAsset, setCurrentAsset] = useState<AssetRecord | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  const handleAssetCreated = useCallback((asset: AssetRecord) => {
    setCurrentAsset(asset);
    refresh();
  }, [refresh]);

  const handleAssetUpdated = useCallback((asset: AssetRecord) => {
    setCurrentAsset(asset);
    refresh();
  }, [refresh]);

  const handleAnchorSet = useCallback((asset: AssetRecord) => {
    setCurrentAsset(asset);
  }, []);

  return (
    <div className="min-h-screen bg-zinc-900 text-white p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-xl font-bold">Asset Engine</h1>
            <p className="text-xs text-zinc-500">Midway to Madness — Complex Engine v1</p>
          </div>
          <a
            href="/"
            className="text-xs text-zinc-400 hover:text-white bg-zinc-800 rounded px-3 py-1.5 transition-colors"
          >
            Back to Game
          </a>
        </div>

        {/* Main layout: 3-column */}
        <div className="grid grid-cols-[300px_1fr_280px] gap-4">
          {/* Left column: Generate + Browser */}
          <div className="flex flex-col gap-4">
            <PromptPanel
              onAssetCreated={handleAssetCreated}
              currentAsset={currentAsset}
            />
            <AssetBrowser
              onSelect={setCurrentAsset}
              selectedId={currentAsset?.id ?? null}
              refreshKey={refreshKey}
            />
          </div>

          {/* Center: Sprite canvas */}
          <div>
            <SpriteCanvas
              asset={currentAsset}
              onAnchorSet={handleAnchorSet}
            />
          </div>

          {/* Right column: Metadata + export */}
          <div>
            <MetadataForm
              asset={currentAsset}
              onAssetUpdated={handleAssetUpdated}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
