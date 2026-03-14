import React, { useEffect, useState } from 'react';
import { engine } from '../../game/engine';
import { gameStateManager } from '../../game/gameState';
import { Guest } from '../../game/ecs';
import { spriteRegistry } from '../../game/spriteRegistry';

const formatTime = (time: number) => {
  const hours = Math.floor(time);
  const minutes = Math.floor((time - hours) * 60);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

export function GuestInspector({ entityId }: { entityId: number }) {
  const [guestData, setGuestData] = useState<Guest | null>(null);
  
  useEffect(() => {
    let frameId: number;
    const update = () => {
      if (engine.world.entities.has(entityId)) {
        const guest = engine.world.getComponent(entityId, 'Guest');
        if (guest) {
          setGuestData({ ...guest });
        }
      } else {
        setGuestData(null); // Guest left
      }
      frameId = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(frameId);
  }, [entityId]);

  if (!guestData) return (
    <div className="absolute bottom-8 left-8 bg-zinc-800/90 p-4 border border-zinc-700 rounded-xl shadow-xl backdrop-blur-sm text-zinc-400">
      Guest has left the park.
    </div>
  );

  return (
    <div className="absolute bottom-8 left-8 bg-zinc-800/90 p-4 border border-zinc-700 rounded-xl shadow-xl backdrop-blur-sm w-64 z-10">
      <div className="flex justify-between items-start mb-2">
        <div className="flex items-center gap-3">
          {guestData.portraitIndex >= 0 && spriteRegistry.guestPortraits[guestData.portraitIndex] && (
            <img
              src={spriteRegistry.guestPortraits[guestData.portraitIndex]}
              alt="Guest portrait"
              className="w-12 h-12 rounded-full object-cover border-2 border-blue-400 bg-zinc-700"
            />
          )}
          <h3 className="text-lg font-bold text-blue-400">Guest #{entityId}</h3>
        </div>
        <button
          onClick={() => gameStateManager.update({ selectedGuestId: null })}
          className="text-zinc-500 hover:text-white"
        >
          ✕
        </button>
      </div>
      <div className="text-sm space-y-1">
        <div>State: <span className="text-white capitalize">{guestData.state}</span></div>
        <div>Money: <span className="text-emerald-400">${guestData.money.toFixed(2)}</span> / ${guestData.initialMoney.toFixed(2)}</div>
        <div>Excitement: <span className="text-yellow-400">{guestData.excitement.toFixed(0)}</span></div>
        <div>Hunger: <span className="text-orange-400">{guestData.hunger.toFixed(0)}</span></div>
        <div>Bladder: <span className="text-blue-400">{guestData.bladder.toFixed(0)}</span></div>
        <div>Arrival: <span className="text-zinc-300">{formatTime(guestData.arrivalTime)}</span></div>
        {guestData.targetId && <div>Target: <span className="text-zinc-300">{guestData.targetId}</span></div>}
      </div>
    </div>
  );
}
