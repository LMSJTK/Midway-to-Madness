import React, { useEffect, useState } from 'react';
import { gameStateManager, PlacedItem } from '../../game/gameState';
import { ITEM_DEFINITIONS } from '../../game/items';

export function ItemInspector({ itemId }: { itemId: string }) {
  const [itemData, setItemData] = useState<PlacedItem | null>(null);
  
  useEffect(() => {
    let frameId: number;
    const update = () => {
      const item = gameStateManager.state.placedItems.find(i => i.id === itemId);
      if (item) {
        setItemData({ ...item });
      } else {
        setItemData(null);
      }
      frameId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frameId);
  }, [itemId]);

  if (!itemData) return null;

  const handlePriceChange = (delta: number) => {
    const newItems = [...gameStateManager.state.placedItems];
    const index = newItems.findIndex(i => i.id === itemId);
    if (index !== -1) {
      newItems[index] = { ...newItems[index], ticketPrice: Math.max(1, newItems[index].ticketPrice + delta) };
      gameStateManager.update({ placedItems: newItems });
    }
  };

  return (
    <div className="absolute bottom-8 right-8 bg-zinc-800/90 p-4 border border-zinc-700 rounded-xl shadow-xl backdrop-blur-sm w-64 z-10">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-emerald-400">{ITEM_DEFINITIONS[itemData.itemDefId]?.name ?? itemData.type}</h3>
        <button 
          onClick={() => gameStateManager.update({ selectedItemId: null })}
          className="text-zinc-500 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="text-sm space-y-2">
        <div className="flex items-center justify-between">
          <span>Ticket Price:</span>
          <div className="flex items-center gap-2">
            <button onClick={() => handlePriceChange(-1)} className="px-2 bg-zinc-700 rounded hover:bg-zinc-600">-</button>
            <span className="text-emerald-400 w-12 text-center">${itemData.ticketPrice.toFixed(2)}</span>
            <button onClick={() => handlePriceChange(1)} className="px-2 bg-zinc-700 rounded hover:bg-zinc-600">+</button>
          </div>
        </div>
        <div className="flex justify-between"><span>Customers Today:</span> <span className="text-blue-400">{itemData.customersToday}</span></div>
        <div className="flex justify-between"><span>Revenue Today:</span> <span className="text-emerald-400">${itemData.revenueToday.toFixed(2)}</span></div>
        {(itemData.type === 'food' || itemData.type === 'shop') && (
          <div className="flex justify-between"><span>Stock:</span> <span className={itemData.stock > 20 ? "text-zinc-300" : "text-red-400"}>{itemData.stock}</span></div>
        )}
        {itemData.capacity > 0 && (
          <div className="flex justify-between"><span>Current {itemData.type === 'performance' ? 'Audience' : 'Riders'}:</span> <span className="text-zinc-300">{itemData.currentRiders} / {itemData.capacity}</span></div>
        )}
        {itemData.capacity > 0 && (
          <div className="flex justify-between"><span>Condition:</span> <span className={itemData.condition > 30 ? "text-zinc-300" : "text-red-400"}>{itemData.condition.toFixed(0)}%</span></div>
        )}
      </div>
    </div>
  );
}
