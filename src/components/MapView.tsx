import React, { useEffect, useState } from 'react';
import { gameStateManager, LOCATIONS, Location, Staff } from '../game/gameState';

export function MapView() {
  const [state, setState] = useState(gameStateManager.state);

  useEffect(() => {
    const unsubscribe = gameStateManager.subscribe(() => {
      setState(gameStateManager.state);
    });
    return unsubscribe;
  }, []);

  const handleSelectLocation = (loc: Location) => {
    if (state.money >= loc.fee) {
      gameStateManager.update({
        currentLocation: loc,
        phase: 'BIDDING'
      });
    } else {
      alert("Not enough money for the privilege fee!");
    }
  };

  const handleBuy = (type: keyof typeof state.inventory, cost: number) => {
    if (state.money >= cost) {
      gameStateManager.update({
        money: state.money - cost,
        inventory: {
          ...state.inventory,
          [type]: state.inventory[type] + 1
        }
      });
    }
  };

  const handleHire = (type: keyof Staff, cost: number) => {
    if (state.money >= cost) {
      gameStateManager.update({
        money: state.money - cost,
        staff: {
          ...state.staff,
          [type]: state.staff[type] + 1
        }
      });
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-800 text-white p-8">
      <h1 className="text-4xl font-bold mb-8 font-serif mt-16">Select Next Destination</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
        {LOCATIONS.map((loc) => (
          <div key={loc.id} className="bg-zinc-900 border border-zinc-700 rounded-xl p-6 shadow-lg hover:border-emerald-500 transition-colors">
            <h2 className="text-2xl font-bold text-emerald-400 mb-2">{loc.name}</h2>
            <div className="text-zinc-400 mb-4">{loc.type} Fair</div>
            <div className="space-y-2 mb-6 text-sm">
              <div className="flex justify-between">
                <span>Distance:</span>
                <span className="font-mono">{loc.distance} miles</span>
              </div>
              <div className="flex justify-between">
                <span>Expected Guests:</span>
                <span className="font-mono">{loc.expectedGuests}</span>
              </div>
              <div className="flex justify-between">
                <span>Privilege Fee (Upfront):</span>
                <span className="font-mono text-red-400">${loc.fee}</span>
              </div>
              <div className="flex justify-between">
                <span>City Revenue Share:</span>
                <span className="font-mono text-red-400">{(loc.revenueShare * 100).toFixed(0)}%</span>
              </div>
            </div>
            <button
              onClick={() => handleSelectLocation(loc)}
              disabled={state.money < loc.fee}
              className={`w-full py-3 rounded-lg font-semibold transition-colors ${
                state.money >= loc.fee 
                  ? 'bg-emerald-600 hover:bg-emerald-500 text-white' 
                  : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
              }`}
            >
              {state.money >= loc.fee ? 'Bid for Contract' : 'Insufficient Funds'}
            </button>
          </div>
        ))}
      </div>

      <div className="mt-12 bg-zinc-900 border border-zinc-700 rounded-xl p-6 shadow-lg w-full max-w-5xl">
        <h2 className="text-2xl font-bold text-emerald-400 mb-4">Fleet Management & Upgrades</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {[
            { id: 'kiddieRides', name: 'Kiddie Ride', cost: 2000, desc: 'Low capacity, low excitement.' },
            { id: 'majorRides', name: 'Major Ride', cost: 5000, desc: 'Medium capacity, good excitement.' },
            { id: 'spectacularRides', name: 'Spectacular', cost: 15000, desc: 'High capacity, massive draw.' },
            { id: 'foodStalls', name: 'Food Stall', cost: 1000, desc: 'Satisfies hunger, high margin.' },
            { id: 'bathrooms', name: 'Bathroom', cost: 500, desc: 'Satisfies bladder needs.' },
          ].map((item) => (
            <div key={item.id} className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg">{item.name}</h3>
                <p className="text-xs text-zinc-400 mt-1 mb-2">{item.desc}</p>
                <div className="text-sm mb-4">
                  Owned: <span className="font-mono text-emerald-400">{state.inventory[item.id as keyof typeof state.inventory]}</span>
                </div>
              </div>
              <button
                onClick={() => handleBuy(item.id as keyof typeof state.inventory, item.cost)}
                disabled={state.money < item.cost}
                className={`w-full py-2 rounded text-sm font-semibold transition-colors ${
                  state.money >= item.cost ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                }`}
              >
                Buy (${item.cost})
              </button>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-6 bg-zinc-900 border border-zinc-700 rounded-xl p-6 shadow-lg w-full max-w-5xl">
        <h2 className="text-2xl font-bold text-orange-400 mb-4">Staff Management</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            { id: 'maintenance', name: 'Maintenance Worker', cost: 500, desc: 'Fixes broken rides automatically.' },
            { id: 'sanitation', name: 'Sanitation Worker', cost: 300, desc: 'Cleans up trash around the park.' },
          ].map((item) => (
            <div key={item.id} className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg">{item.name}</h3>
                <p className="text-xs text-zinc-400 mt-1 mb-2">{item.desc}</p>
                <div className="text-sm mb-4">
                  Hired: <span className="font-mono text-orange-400">{state.staff[item.id as keyof Staff]}</span>
                </div>
              </div>
              <button
                onClick={() => handleHire(item.id as keyof Staff, item.cost)}
                disabled={state.money < item.cost}
                className={`w-full py-2 rounded text-sm font-semibold transition-colors ${
                  state.money >= item.cost ? 'bg-orange-600 hover:bg-orange-500 text-white' : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                }`}
              >
                Hire (${item.cost})
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
