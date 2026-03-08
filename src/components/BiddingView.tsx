import React, { useState } from 'react';
import { gameStateManager } from '../game/gameState';
import { ITEM_DEFINITIONS } from '../game/items';

export function BiddingView() {
  const state = gameStateManager.state;
  const loc = state.currentLocation;

  // Calculate travel cost from dynamic inventory using each item's travelWeight
  const travelCost = loc ? loc.distance * Object.entries(state.inventory).reduce((sum, [itemId, count]) => {
    const def = ITEM_DEFINITIONS[itemId];
    return sum + (def ? def.travelWeight * count : 0);
  }, 0) : 0;
  
  const [bidAmount, setBidAmount] = useState(loc?.fee || 0);
  const [revenueShare, setRevenueShare] = useState(loc?.revenueShare || 0.2);

  const totalCost = bidAmount + travelCost;

  const handleAccept = () => {
    if (loc && state.money >= totalCost) {
      gameStateManager.update({
        money: state.money - totalCost,
        phase: 'SETUP',
        currentLocation: { ...loc, fee: bidAmount, revenueShare }
      });
      gameStateManager.generateScenery();
    }
  };

  const handleReject = () => {
    gameStateManager.update({
      currentLocation: null,
      phase: 'MAP'
    });
  };

  if (!loc) return null;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white p-8">
      <div className="max-w-2xl w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-8 shadow-2xl">
        <h1 className="text-3xl font-bold mb-6 font-serif text-emerald-400">Contract Negotiation</h1>
        <h2 className="text-xl mb-8 text-zinc-300">City of {loc.name}</h2>
        
        <div className="space-y-6 mb-8">
          <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-700">
            <div className="flex justify-between mb-2">
              <span className="text-zinc-400">Estimated Travel Cost</span>
              <span className="font-mono text-red-400">${travelCost}</span>
            </div>
            <p className="text-xs text-zinc-500">Based on distance ({loc.distance} miles) and fleet size.</p>
          </div>

          <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-700">
            <label className="block text-sm font-medium text-zinc-400 mb-2">Upfront Privilege Fee</label>
            <div className="flex items-center">
              <span className="text-xl mr-2">$</span>
              <input 
                type="number" 
                value={bidAmount} 
                onChange={(e) => setBidAmount(Number(e.target.value))}
                className="bg-zinc-800 text-white border border-zinc-600 rounded px-3 py-2 w-full font-mono"
              />
            </div>
            <p className="text-xs text-zinc-500 mt-2">Minimum required: ${loc.fee}</p>
          </div>
          
          <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-700">
            <label className="block text-sm font-medium text-zinc-400 mb-2">Revenue Share to City</label>
            <div className="flex items-center">
              <input 
                type="range" 
                min="0" 
                max="0.5" 
                step="0.01" 
                value={revenueShare} 
                onChange={(e) => setRevenueShare(Number(e.target.value))}
                className="w-full mr-4"
              />
              <span className="font-mono text-lg">{(revenueShare * 100).toFixed(0)}%</span>
            </div>
            <p className="text-xs text-zinc-500 mt-2">Higher share increases chance of winning future bids (simulated).</p>
          </div>

          <div className="bg-zinc-900 p-4 rounded-lg border border-emerald-700">
            <div className="flex justify-between font-bold text-lg">
              <span className="text-zinc-300">Total Upfront Cost</span>
              <span className="font-mono text-emerald-400">${totalCost}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-4">
          <button 
            onClick={handleReject}
            className="flex-1 py-3 rounded-lg font-semibold bg-zinc-700 hover:bg-zinc-600 text-white transition-colors"
          >
            Decline & Return
          </button>
          <button 
            onClick={handleAccept}
            disabled={state.money < totalCost || bidAmount < loc.fee}
            className={`flex-1 py-3 rounded-lg font-semibold transition-colors ${
              state.money >= totalCost && bidAmount >= loc.fee
                ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
            }`}
          >
            Sign Contract
          </button>
        </div>
      </div>
    </div>
  );
}
