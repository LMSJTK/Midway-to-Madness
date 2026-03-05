import React from 'react';
import { gameStateManager } from '../../game/gameState';
import { ITEM_DEFINITIONS, ItemCategory, CATEGORY_DEFAULTS } from '../../game/items';

interface BuildToolbarProps {
  selectedTool: string | null;
  setSelectedTool: (tool: string | null) => void;
  onOpenMidway: () => void;
}

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

const CATEGORY_ORDER: ItemCategory[] = ['kiddie', 'major', 'spectacular', 'food', 'bathroom', 'gameStall', 'shop', 'performance'];

function PriceControl({ itemId }: { itemId: string }) {
  const state = gameStateManager.state;
  const def = ITEM_DEFINITIONS[itemId];
  const currentPrice = state.priceOverrides[itemId] ?? def.basePrice;

  const handleChange = (delta: number) => {
    gameStateManager.setGlobalPrice(itemId, currentPrice + delta);
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

  // Group unlocked items with inventory > 0 by category
  const itemsByCategory = CATEGORY_ORDER.map(cat => {
    const items = Object.values(ITEM_DEFINITIONS)
      .filter(def => def.category === cat && gameStateManager.isItemUnlocked(def.id) && (state.inventory[def.id] || 0) > 0);
    return { category: cat, items };
  }).filter(g => g.items.length > 0);

  // All owned items for pricing section
  const ownedItemIds = Object.entries(state.inventory)
    .filter(([id, count]) => count > 0 && ITEM_DEFINITIONS[id])
    .map(([id]) => id);

  return (
    <div className="absolute top-8 right-8 bg-zinc-800/90 p-6 border border-zinc-700 rounded-xl shadow-xl backdrop-blur-sm max-h-[80vh] overflow-y-auto">
      <h3 className="text-xl font-bold mb-4 text-emerald-400">Setup Phase</h3>
      <p className="text-sm text-zinc-400 mb-4">Place your rides and stalls on the lot.</p>

      <div className="space-y-3 mb-4">
        {itemsByCategory.map(({ category, items }) => (
          <div key={category}>
            <h4 className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: CATEGORY_DEFAULTS[category].color }}>
              {CATEGORY_LABELS[category]}
            </h4>
            {items.map(def => {
              const count = state.inventory[def.id] || 0;
              return (
                <button
                  key={def.id}
                  onClick={() => setSelectedTool(def.id)}
                  className={`w-full text-left px-4 py-2 rounded flex justify-between items-center mb-1 ${selectedTool === def.id ? 'bg-emerald-600' : 'bg-zinc-700 hover:bg-zinc-600'}`}
                >
                  <span>{def.name}</span>
                  <span className="font-mono bg-zinc-900 px-2 py-1 rounded text-xs">{count}</span>
                </button>
              );
            })}
          </div>
        ))}
      </div>

      {/* Global pricing section */}
      {ownedItemIds.length > 0 && (
        <div className="border-t border-zinc-700 pt-3 mb-4">
          <h4 className="text-xs font-bold text-zinc-400 uppercase tracking-wide mb-2">Base Prices</h4>
          <p className="text-[10px] text-zinc-500 mb-2">Sets price for all placed + future items of this type.</p>
          <div className="space-y-1.5">
            {ownedItemIds.map(itemId => (
              <div key={itemId} className="flex items-center justify-between text-sm">
                <span className="text-zinc-300 text-xs">{ITEM_DEFINITIONS[itemId].name}</span>
                <PriceControl itemId={itemId} />
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={onOpenMidway}
        className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-bold rounded-lg transition-colors"
      >
        Open Midway
      </button>
    </div>
  );
}
