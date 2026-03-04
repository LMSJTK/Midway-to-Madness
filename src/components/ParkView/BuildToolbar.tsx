import React from 'react';
import { gameStateManager } from '../../game/gameState';

interface BuildToolbarProps {
  selectedTool: string | null;
  setSelectedTool: (tool: string | null) => void;
  onOpenMidway: () => void;
}

export function BuildToolbar({ selectedTool, setSelectedTool, onOpenMidway }: BuildToolbarProps) {
  const state = gameStateManager.state;
  
  return (
    <div className="absolute top-8 right-8 bg-zinc-800/90 p-6 border border-zinc-700 rounded-xl shadow-xl backdrop-blur-sm">
      <h3 className="text-xl font-bold mb-4 text-emerald-400">Setup Phase</h3>
      <p className="text-sm text-zinc-400 mb-6">Place your rides and stalls on the lot.</p>
      
      <div className="space-y-3 mb-6">
        <button 
          onClick={() => setSelectedTool('kiddie')}
          disabled={state.inventory.kiddieRides === 0}
          className={`w-full text-left px-4 py-2 rounded flex justify-between items-center ${selectedTool === 'kiddie' ? 'bg-emerald-600' : 'bg-zinc-700 hover:bg-zinc-600'} ${state.inventory.kiddieRides === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span>Kiddie Ride</span>
          <span className="font-mono bg-zinc-900 px-2 py-1 rounded text-xs">{state.inventory.kiddieRides}</span>
        </button>
        <button 
          onClick={() => setSelectedTool('major')}
          disabled={state.inventory.majorRides === 0}
          className={`w-full text-left px-4 py-2 rounded flex justify-between items-center ${selectedTool === 'major' ? 'bg-emerald-600' : 'bg-zinc-700 hover:bg-zinc-600'} ${state.inventory.majorRides === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span>Major Ride</span>
          <span className="font-mono bg-zinc-900 px-2 py-1 rounded text-xs">{state.inventory.majorRides}</span>
        </button>
        <button 
          onClick={() => setSelectedTool('spectacular')}
          disabled={state.inventory.spectacularRides === 0}
          className={`w-full text-left px-4 py-2 rounded flex justify-between items-center ${selectedTool === 'spectacular' ? 'bg-emerald-600' : 'bg-zinc-700 hover:bg-zinc-600'} ${state.inventory.spectacularRides === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span>Spectacular Ride</span>
          <span className="font-mono bg-zinc-900 px-2 py-1 rounded text-xs">{state.inventory.spectacularRides}</span>
        </button>
        <button 
          onClick={() => setSelectedTool('food')}
          disabled={state.inventory.foodStalls === 0}
          className={`w-full text-left px-4 py-2 rounded flex justify-between items-center ${selectedTool === 'food' ? 'bg-emerald-600' : 'bg-zinc-700 hover:bg-zinc-600'} ${state.inventory.foodStalls === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span>Food Stall</span>
          <span className="font-mono bg-zinc-900 px-2 py-1 rounded text-xs">{state.inventory.foodStalls}</span>
        </button>
        <button 
          onClick={() => setSelectedTool('bathroom')}
          disabled={state.inventory.bathrooms === 0}
          className={`w-full text-left px-4 py-2 rounded flex justify-between items-center ${selectedTool === 'bathroom' ? 'bg-emerald-600' : 'bg-zinc-700 hover:bg-zinc-600'} ${state.inventory.bathrooms === 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <span>Bathroom</span>
          <span className="font-mono bg-zinc-900 px-2 py-1 rounded text-xs">{state.inventory.bathrooms}</span>
        </button>
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
