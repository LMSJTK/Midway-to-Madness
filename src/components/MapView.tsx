import React, { useEffect, useState } from 'react';
import { gameStateManager, LOCATIONS, Location, StaffRole, STAFF_HIRE_COST } from '../game/gameState';
import { ITEM_DEFINITIONS, ItemCategory, CATEGORY_DEFAULTS, getItemsByCategory } from '../game/items';

const CATEGORY_ORDER: ItemCategory[] = ['kiddie', 'major', 'spectacular', 'food', 'bathroom', 'gameStall', 'shop', 'performance'];
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

export function MapView() {
  const [state, setState] = useState(gameStateManager.state);

  useEffect(() => {
    const unsubscribe = gameStateManager.subscribe(() => {
      setState(gameStateManager.state);
    });
    return unsubscribe;
  }, []);

  const handleSelectLocation = (loc: Location) => {
    if (state.money < loc.fee) return;
    gameStateManager.update({ currentLocation: loc, phase: 'BIDDING' });
  };

  const handleBuy = (itemId: string) => {
    const def = ITEM_DEFINITIONS[itemId];
    if (!def || state.money < def.cost) return;
    gameStateManager.update({
      inventory: {
        ...state.inventory,
        [itemId]: (state.inventory[itemId] || 0) + 1
      }
    });
    gameStateManager.spend(def.cost);
  };

  const handleHire = (role: StaffRole) => {
    gameStateManager.hireStaff(role);
  };

  // Nothing on the board is affordable and there is no other way to earn:
  // say so plainly instead of leaving every button greyed out with no reason.
  const cheapestFee = Math.min(...LOCATIONS.map(l => l.fee));
  const stranded = state.money < cheapestFee;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-zinc-800 text-white p-8">
      <h1 className="text-4xl font-bold mb-8 font-serif mt-16">Select Next Destination</h1>

      {stranded && (
        <div className="w-full max-w-5xl mb-6 bg-red-950/60 border border-red-800 rounded-xl p-5">
          <h2 className="text-lg font-bold text-red-300 mb-1">The show can't make the next town</h2>
          <p className="text-sm text-red-200/80">
            You have ${state.money.toFixed(2)}, and the cheapest privilege fee on the board is ${cheapestFee}.
            There's no way left to earn tonight.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-700 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Start a New Season
          </button>
        </div>
      )}
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
        {CATEGORY_ORDER.map(cat => {
          const items = getItemsByCategory(cat).filter(def => gameStateManager.isItemUnlocked(def.id));
          if (items.length === 0) return null;
          return (
            <div key={cat} className="mb-6">
              <h3 className="text-lg font-bold mb-3" style={{ color: CATEGORY_DEFAULTS[cat].color }}>
                {CATEGORY_LABELS[cat]}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {items.map(def => (
                  <div key={def.id} className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 flex flex-col justify-between">
                    <div>
                      <h3 className="font-bold text-lg">{def.name}</h3>
                      <p className="text-xs text-zinc-400 mt-1 mb-1">Prestige: {def.prestige} | Value: {def.value}</p>
                      <div className="text-sm mb-4">
                        Owned: <span className="font-mono text-emerald-400">{state.inventory[def.id] || 0}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => handleBuy(def.id)}
                      disabled={state.money < def.cost}
                      className={`w-full py-2 rounded text-sm font-semibold transition-colors ${
                        state.money >= def.cost ? 'bg-blue-600 hover:bg-blue-500 text-white' : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                      }`}
                    >
                      Buy (${def.cost})
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 bg-zinc-900 border border-zinc-700 rounded-xl p-6 shadow-lg w-full max-w-5xl">
        <h2 className="text-2xl font-bold text-orange-400 mb-4">Staff Management</h2>
        <p className="text-sm text-zinc-400 mb-4">Postings are set on the lot during setup.</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {([
            { id: 'maintenance', name: 'Maintenance Worker', desc: 'Repairs breakdowns. Post one to a ride and it also breaks down less often.' },
            { id: 'sanitation', name: 'Sanitation Worker', desc: 'Clears litter and services bathrooms. Give one a zone to spread your crew out.' },
          ] as { id: StaffRole; name: string; desc: string }[]).map((item) => {
            const cost = STAFF_HIRE_COST[item.id];
            const crew = state.staff.filter(s => s.role === item.id);
            return (
            <div key={item.id} className="bg-zinc-800 p-4 rounded-lg border border-zinc-700 flex flex-col justify-between">
              <div>
                <h3 className="font-bold text-lg">{item.name}</h3>
                <p className="text-xs text-zinc-400 mt-1 mb-2">{item.desc}</p>
                <div className="text-sm mb-4">
                  Hired: <span className="font-mono text-orange-400">{crew.length}</span>
                  {crew.length > 0 && (
                    <span className="text-zinc-500 text-xs"> — {crew.map(s => s.name).join(', ')}</span>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleHire(item.id)}
                disabled={state.money < cost}
                className={`w-full py-2 rounded text-sm font-semibold transition-colors ${
                  state.money >= cost ? 'bg-orange-600 hover:bg-orange-500 text-white' : 'bg-zinc-700 text-zinc-500 cursor-not-allowed'
                }`}
              >
                Hire (${cost})
              </button>
            </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
