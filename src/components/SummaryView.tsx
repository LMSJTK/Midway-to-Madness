import React from 'react';
import { gameStateManager } from '../game/gameState';

export function SummaryView() {
  const state = gameStateManager.state;
  const net = state.stats.revenueToday - state.stats.expensesToday;

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
        
        <div className="bg-zinc-900 rounded-xl border border-zinc-700 mb-8 text-left divide-y divide-zinc-800">
          <div className="flex justify-between px-6 py-3">
            <span className="text-zinc-400">Ticket &amp; stall revenue</span>
            <span className="font-mono text-emerald-400">${state.stats.revenueToday.toFixed(2)}</span>
          </div>
          <div className="flex justify-between px-6 py-3">
            <span className="text-zinc-400">Fees, travel, rides &amp; staff</span>
            <span className="font-mono text-red-400">-${state.stats.expensesToday.toFixed(2)}</span>
          </div>
          <div className="flex justify-between px-6 py-4">
            <span className="font-bold text-zinc-200">Net for the day</span>
            <span className={`font-mono text-2xl font-bold ${net >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
              {net < 0 ? '-' : ''}${Math.abs(net).toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between px-6 py-3">
            <span className="text-zinc-400">Guests served</span>
            <span className="font-mono text-blue-400">{state.stats.guestsToday}</span>
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
