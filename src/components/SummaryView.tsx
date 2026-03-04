import React from 'react';
import { gameStateManager } from '../game/gameState';

export function SummaryView() {
  const state = gameStateManager.state;

  const handleNextDay = () => {
    gameStateManager.resetDay();
    gameStateManager.update({
      day: state.day + 1,
      phase: 'MAP',
      currentLocation: null
    });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-900 text-white p-8">
      <div className="max-w-2xl w-full bg-zinc-800 border border-zinc-700 rounded-2xl p-8 shadow-2xl text-center">
        <h1 className="text-4xl font-bold mb-2 font-serif text-emerald-400">Day {state.day} Summary</h1>
        <h2 className="text-xl mb-8 text-zinc-400">{state.currentLocation?.name}</h2>
        
        <div className="grid grid-cols-2 gap-6 mb-8 text-left">
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-700">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">Total Revenue</h3>
            <div className="text-3xl font-mono text-emerald-400">${state.stats.revenueToday.toFixed(2)}</div>
          </div>
          <div className="bg-zinc-900 p-6 rounded-xl border border-zinc-700">
            <h3 className="text-sm font-medium text-zinc-400 uppercase tracking-wider mb-2">Guests Served</h3>
            <div className="text-3xl font-mono text-blue-400">{state.stats.guestsToday}</div>
          </div>
        </div>

        <button 
          onClick={handleNextDay}
          className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl transition-colors text-lg"
        >
          Plan Next Route
        </button>
      </div>
    </div>
  );
}
