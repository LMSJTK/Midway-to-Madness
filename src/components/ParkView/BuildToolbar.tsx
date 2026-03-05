import React from 'react';
import { gameStateManager } from '../../game/gameState';
import { ITEM_DEFINITIONS } from '../../game/items';

interface BuildToolbarProps {
  selectedTool: string | null;
  setSelectedTool: (tool: string | null) => void;
  onOpenMidway: () => void;
}

const ITEM_TYPES = [
  { key: 'kiddie', label: 'Kiddie Ride', inventoryKey: 'kiddieRides' as const },
  { key: 'major', label: 'Major Ride', inventoryKey: 'majorRides' as const },
  { key: 'spectacular', label: 'Spectacular Ride', inventoryKey: 'spectacularRides' as const },
  { key: 'food', label: 'Food Stall', inventoryKey: 'foodStalls' as const },
  { key: 'bathroom', label: 'Bathroom', inventoryKey: 'bathrooms' as const },
];

function PriceControl({ itemType }: { itemType: string }) {
  const state = gameStateManager.state;
  const def = ITEM_DEFINITIONS[itemType];
  const currentPrice = state.priceOverrides[itemType] ?? def.basePrice;

  const handleChange = (delta: number) => {
    gameStateManager.setGlobalPrice(itemType, currentPrice + delta);
  };

  return (
    <div className="flex items-center gap-1 ml-2" onClick={e => e.stopPropagation()}>
      <button
        onClick={() => handleChange(-1)}
        className="px-1.5 bg-zinc-900 rounded text-xs hover:bg-zinc-600"
      >-</button>
      <span className="text-emerald-400 text-xs font-mono w-6 text-center">${currentPrice}</span>
      <button
        onClick={() => handleChange(1)}
        className="px-1.5 bg-zinc-900 rounded text-xs hover:bg-zinc-600"
      >+</button>
    </div>
  );
}

export function BuildToolbar({ selectedTool, setSelectedTool, onOpenMidway }: BuildToolbarProps) {
  const state = gameStateManager.state;

  return (
    <div className="absolute top-8 right-8 bg-zinc-800/90 p-6 border border-zinc-700 rounded-xl shadow-xl backdrop-blur-sm">
      <h3 className="text-xl font-bold mb-4 text-emerald-400">Setup Phase</h3>
      <p className="text-sm text-zinc-400 mb-4">Place your rides and stalls on the lot.</p>

      <div className="space-y-3 mb-4">
        {ITEM_TYPES.map(({ key, label, inventoryKey }) => {
          const count = state.inventory[inventoryKey];
          return (
            <div key={key} className="flex flex-col gap-1">
              <button
                onClick={() => setSelectedTool(key)}
                disabled={count === 0}
                className={`w-full text-left px-4 py-2 rounded flex justify-between items-center ${selectedTool === key ? 'bg-emerald-600' : 'bg-zinc-700 hover:bg-zinc-600'} ${count === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span>{label}</span>
                <span className="font-mono bg-zinc-900 px-2 py-1 rounded text-xs">{count}</span>
              </button>
            </div>
          );
        })}
      </div>

      {/* Global pricing section */}
      <div className="border-t border-zinc-700 pt-3 mb-4">
        <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">Base Prices</h4>
        <p className="text-[10px] text-zinc-500 mb-2">Sets price for all placed + future items of this type.</p>
        <div className="space-y-1.5">
          {ITEM_TYPES.map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between text-sm">
              <span className="text-zinc-300 text-xs">{label}</span>
              <PriceControl itemType={key} />
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={onOpenMidway}
        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-bold rounded-lg transition-colors"
      >
        Open Midway
      </button>
    </div>
  );
}
