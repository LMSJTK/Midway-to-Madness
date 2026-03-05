import React, { useEffect, useRef, useState } from 'react';
import { engine, fromIso, toIso } from '../game/engine';
import { gameStateManager } from '../game/gameState';
import { GuestInspector } from './ParkView/GuestInspector';
import { ItemInspector } from './ParkView/ItemInspector';
import { BuildToolbar } from './ParkView/BuildToolbar';
import { ITEM_DEFINITIONS } from '../game/items';

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

    if (state.phase === 'OPERATION' || state.phase === 'SETUP') {
      // In SETUP with a tool selected, place items instead of selecting
      if (state.phase === 'SETUP' && selectedTool) {
        const logicalPos = fromIso(screenX, screenY);
        const def = ITEM_DEFINITIONS[selectedTool];
        if (def) {
          const success = gameStateManager.placeItem(
            selectedTool,
            logicalPos.x - def.width / 2,
            logicalPos.y - def.height / 2
          );
          if (success) {
            setSelectedTool(null);
          }
        }
        return;
      }

      // Check for guest clicks (only during OPERATION)
      if (state.phase === 'OPERATION') {
        const guests = engine.world.getEntitiesWith(['Position', 'Guest', 'Renderable']);
        let clickedGuest: number | null = null;
        for (const entity of guests) {
          const pos = engine.world.getComponent(entity, 'Position')!;
          const ren = engine.world.getComponent(entity, 'Renderable')!;
          const isoPos = toIso(pos.x, pos.y);

          const dist = Math.sqrt(Math.pow(isoPos.x - screenX, 2) + Math.pow(isoPos.y - screenY, 2));
          if (dist <= ren.size * 3) {
            clickedGuest = entity;
            break;
          }
        }

        if (clickedGuest !== null) {
          gameStateManager.update({ selectedGuestId: clickedGuest, selectedItemId: null });
          return;
        }
      }

      // Check for item clicks (SETUP and OPERATION)
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
      else if (item.type === 'gameStall') inventory.gameStalls++;
      else if (item.type === 'shop') inventory.shops++;
      else if (item.type === 'performance') inventory.performances++;
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
        
        {state.selectedGuestId !== null && state.phase === 'OPERATION' && <GuestInspector entityId={state.selectedGuestId} />}
        {state.selectedItemId !== null && <ItemInspector itemId={state.selectedItemId} />}

        {state.phase === 'SETUP' && (
          <BuildToolbar 
            selectedTool={selectedTool} 
            setSelectedTool={setSelectedTool} 
            onOpenMidway={handleOpenMidway} 
          />
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
