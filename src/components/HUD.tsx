import React, { useEffect, useState } from 'react';
import { gameStateManager, SimSpeed } from '../game/gameState';

export function HUD() {
  const [state, setState] = useState(gameStateManager.state);

  useEffect(() => {
    const unsubscribe = gameStateManager.subscribe(() => {
      setState({ ...gameStateManager.state });
    });
    return unsubscribe;
  }, []);

  const formatTime = (time: number) => {
    const hours = Math.floor(time);
    const minutes = Math.floor((time - hours) * 60);
    const ampm = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
  };

  return (
    <div className="fixed top-0 left-0 w-full bg-zinc-900 text-white p-4 flex justify-between items-center shadow-md z-50">
      <div className="flex gap-6">
        <div className="text-xl font-bold text-emerald-400">${state.money.toFixed(2)}</div>
        <div className="text-lg text-zinc-300">Day {state.day}</div>
        <div className="text-lg font-mono text-zinc-300">{formatTime(state.time)}</div>
      </div>
      <div className="flex gap-6">
        {state.currentLocation && (
          <div className="text-sm text-zinc-400">
            Location: <span className="text-white">{state.currentLocation.name}</span>
          </div>
        )}
        {state.phase === 'OPERATION' && (
          <div className="flex items-center gap-1">
            {(['normal', 'fast'] as SimSpeed[]).map(speed => (
              <button
                key={speed}
                onClick={() => gameStateManager.update({ simSpeed: speed })}
                className={`px-2 py-0.5 text-xs font-bold rounded transition-colors ${
                  state.simSpeed === speed
                    ? 'bg-emerald-600 text-white'
                    : 'bg-zinc-700 text-zinc-400 hover:bg-zinc-600'
                }`}
              >
                {speed === 'normal' ? '1x' : '2x'}
              </button>
            ))}
          </div>
        )}
        <div className="text-sm text-zinc-400">
          Phase: <span className="text-white font-semibold">{state.phase}</span>
        </div>
      </div>
    </div>
  );
}
