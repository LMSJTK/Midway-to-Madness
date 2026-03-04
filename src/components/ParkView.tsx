import React, { useEffect, useRef, useState } from 'react';
import { engine, fromIso, toIso } from '../game/engine';
import { gameStateManager, PlacedItem } from '../game/gameState';
import { Guest } from '../game/systems';

const formatTime = (time: number) => {
  const hours = Math.floor(time);
  const minutes = Math.floor((time - hours) * 60);
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours > 12 ? hours - 12 : hours === 0 ? 12 : hours;
  return `${displayHours}:${minutes.toString().padStart(2, '0')} ${ampm}`;
};

function GuestInspector({ entityId }: { entityId: number }) {
  const [guestData, setGuestData] = useState<Guest | null>(null);
  
  useEffect(() => {
    let frameId: number;
    const update = () => {
      if (engine.world.entities.has(entityId)) {
        const guest = engine.world.getComponent<Guest>(entityId, 'Guest');
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
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-lg font-bold text-blue-400">Guest #{entityId}</h3>
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

function ItemInspector({ itemId }: { itemId: string }) {
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
        <h3 className="text-lg font-bold text-emerald-400 capitalize">{itemData.type}</h3>
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
        {itemData.type === 'food' && (
          <div className="flex justify-between"><span>Stock:</span> <span className={itemData.stock > 20 ? "text-zinc-300" : "text-red-400"}>{itemData.stock}</span></div>
        )}
        {itemData.type !== 'food' && itemData.type !== 'bathroom' && (
          <div className="flex justify-between"><span>Current Riders:</span> <span className="text-zinc-300">{itemData.currentRiders} / {itemData.capacity}</span></div>
        )}
        {itemData.type !== 'food' && itemData.type !== 'bathroom' && (
          <div className="flex justify-between"><span>Condition:</span> <span className={itemData.condition > 30 ? "text-zinc-300" : "text-red-400"}>{itemData.condition.toFixed(0)}%</span></div>
        )}
      </div>
    </div>
  );
}

export function ParkView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [state, setState] = useState(gameStateManager.state);
  const [selectedTool, setSelectedTool] = useState<'kiddie' | 'major' | 'spectacular' | 'food' | 'bathroom' | null>(null);

  useEffect(() => {
    const unsubscribe = gameStateManager.subscribe(() => {
      setState({ ...gameStateManager.state });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (canvasRef.current) {
      engine.canvas = canvasRef.current;
      engine.ctx = canvasRef.current.getContext('2d');
      engine.start();
    }
    return () => {
      engine.stop();
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const speed = 20 / engine.camera.zoom;
      if (e.key === 'ArrowUp') engine.camera.y += speed;
      if (e.key === 'ArrowDown') engine.camera.y -= speed;
      if (e.key === 'ArrowLeft') engine.camera.x += speed;
      if (e.key === 'ArrowRight') engine.camera.x -= speed;
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const zoomSensitivity = 0.001;
    const delta = -e.deltaY * zoomSensitivity;
    const newZoom = Math.max(0.5, Math.min(3, engine.camera.zoom + delta));
    
    const rect = canvasRef.current?.getBoundingClientRect();
    if (rect) {
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      // Zoom towards mouse
      engine.camera.x = mouseX - (mouseX - engine.camera.x) * (newZoom / engine.camera.zoom);
      engine.camera.y = mouseY - (mouseY - engine.camera.y) * (newZoom / engine.camera.zoom);
    }
    
    engine.camera.zoom = newZoom;
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const screenX = (e.clientX - rect.left - engine.camera.x) / engine.camera.zoom;
    const screenY = (e.clientY - rect.top - engine.camera.y) / engine.camera.zoom;
    
    if (state.phase === 'OPERATION') {
      // Check for guest clicks
      const guests = engine.world.getEntitiesWith(['Position', 'Guest', 'Renderable']);
      let clickedGuest: number | null = null;
      for (const entity of guests) {
        const pos = engine.world.getComponent<{x: number, y: number}>(entity, 'Position')!;
        const ren = engine.world.getComponent<{size: number}>(entity, 'Renderable')!;
        const isoPos = toIso(pos.x, pos.y);
        
        // Distance check in iso space
        const dist = Math.sqrt(Math.pow(isoPos.x - screenX, 2) + Math.pow(isoPos.y - screenY, 2));
        if (dist <= ren.size * 3) { // slightly larger hit area
          clickedGuest = entity;
          break;
        }
      }
      
      if (clickedGuest !== null) {
        gameStateManager.update({ selectedGuestId: clickedGuest, selectedItemId: null });
        return;
      }

      // Check for item clicks
      const logicalPos = fromIso(screenX, screenY);
      let clickedItem: string | null = null;
      for (let i = state.placedItems.length - 1; i >= 0; i--) {
        const item = state.placedItems[i];
        if (logicalPos.x >= item.x && logicalPos.x <= item.x + item.width &&
            logicalPos.y >= item.y && logicalPos.y <= item.y + item.height) {
          clickedItem = item.id;
          break;
        }
      }
      
      gameStateManager.update({ selectedGuestId: null, selectedItemId: clickedItem });
      return;
    }

    if (state.phase !== 'SETUP' || !selectedTool) return;
    
    // Map screen coordinates back to logical coordinates
    const logicalPos = fromIso(screenX, screenY);
    
    // Check inventory
    const inventory = { ...state.inventory };
    if (selectedTool === 'kiddie' && inventory.kiddieRides > 0) inventory.kiddieRides--;
    else if (selectedTool === 'major' && inventory.majorRides > 0) inventory.majorRides--;
    else if (selectedTool === 'spectacular' && inventory.spectacularRides > 0) inventory.spectacularRides--;
    else if (selectedTool === 'food' && inventory.foodStalls > 0) inventory.foodStalls--;
    else if (selectedTool === 'bathroom' && inventory.bathrooms > 0) inventory.bathrooms--;
    else return; // None left
    
    const width = selectedTool === 'spectacular' ? 100 : selectedTool === 'major' ? 75 : 50;
    const height = selectedTool === 'spectacular' ? 100 : selectedTool === 'major' ? 75 : 50;
    const initialPrice = selectedTool === 'food' ? 5 : selectedTool === 'bathroom' ? 1 : selectedTool === 'kiddie' ? 3 : selectedTool === 'major' ? 6 : 10;
    
    const newItem: PlacedItem = {
      id: Math.random().toString(36).substring(7),
      type: selectedTool,
      x: logicalPos.x - width / 2,
      y: logicalPos.y - height / 2,
      width,
      height,
      built: true, // Instant build for prototype
      buildTimeRemaining: 0,
      ticketPrice: initialPrice,
      basePrice: initialPrice,
      excitement: selectedTool === 'food' || selectedTool === 'bathroom' ? 0 : selectedTool === 'kiddie' ? 30 : selectedTool === 'major' ? 60 : 90,
      capacity: selectedTool === 'food' || selectedTool === 'bathroom' ? 1 : selectedTool === 'kiddie' ? 8 : selectedTool === 'major' ? 16 : 24,
      currentRiders: 0,
      duration: selectedTool === 'food' ? 0 : selectedTool === 'bathroom' ? 2 : 5,
      timer: 0,
      revenueToday: 0,
      customersToday: 0,
      stock: selectedTool === 'food' ? 100 : 0,
      isBroken: false,
      condition: 100,
    };
    
    gameStateManager.update({
      inventory,
      placedItems: [...state.placedItems, newItem]
    });
    setSelectedTool(null);
  };

  const handleOpenMidway = () => {
    gameStateManager.update({ phase: 'OPERATION' });
  };

  const handleTeardown = () => {
    // Return items to inventory
    const inventory = { ...state.inventory };
    state.placedItems.forEach(item => {
      if (item.type === 'kiddie') inventory.kiddieRides++;
      else if (item.type === 'major') inventory.majorRides++;
      else if (item.type === 'spectacular') inventory.spectacularRides++;
      else if (item.type === 'food') inventory.foodStalls++;
      else if (item.type === 'bathroom') inventory.bathrooms++;
    });
    
    engine.world.clear(); // Remove all guests
    engine.camera = { x: 0, y: 0, zoom: 1 }; // Reset camera
    
    gameStateManager.update({
      phase: 'SUMMARY',
      inventory,
      placedItems: [],
      selectedGuestId: null,
      selectedItemId: null
    });
  };

  return (
    <div className="flex h-screen bg-zinc-900 text-white pt-16">
      <div className="flex-1 flex items-center justify-center p-4 relative overflow-hidden">
        <canvas 
          ref={canvasRef} 
          width={800} 
          height={600} 
          onClick={handleCanvasClick}
          onWheel={handleWheel}
          className={`bg-zinc-800 border-2 border-zinc-700 rounded-lg shadow-2xl ${state.phase === 'SETUP' && selectedTool ? 'cursor-crosshair' : 'cursor-default'}`}
        />
        
        {state.selectedGuestId !== null && <GuestInspector entityId={state.selectedGuestId} />}
        {state.selectedItemId !== null && <ItemInspector itemId={state.selectedItemId} />}

        {state.phase === 'SETUP' && (
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
              onClick={handleOpenMidway}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-zinc-900 font-bold rounded-lg transition-colors"
            >
              Open Midway
            </button>
          </div>
        )}
        
        {state.phase === 'TEARDOWN' && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-zinc-800 p-8 border border-zinc-700 rounded-2xl shadow-2xl text-center">
            <h2 className="text-3xl font-bold text-red-400 mb-4">10:00 PM - Midway Closed</h2>
            <p className="text-zinc-300 mb-8">It's time to pack up the rides and move to the next town.</p>
            <button 
              onClick={handleTeardown}
              className="px-8 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-lg transition-colors"
            >
              Begin Teardown
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
