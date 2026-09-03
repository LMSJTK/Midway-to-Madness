import React, { useEffect, useRef, useState } from 'react';
import { engine, fromIso, toIso } from '../game/engine';
import { gameStateManager } from '../game/gameState';
import { GuestInspector } from './ParkView/GuestInspector';
import { ItemInspector } from './ParkView/ItemInspector';
import { BuildToolbar } from './ParkView/BuildToolbar';
import { StaffPanel } from './ParkView/StaffPanel';
import { ITEM_DEFINITIONS } from '../game/items';
import { ZONE_RADIUS_DEFAULT } from '../game/gameState';

export function ParkView() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const [state, setState] = useState(gameStateManager.state);
  const [selectedTool, setSelectedTool] = useState<string | null>(null);
  const [zonePlacementFor, setZonePlacementFor] = useState<string | null>(null);

  /** Translate a mouse event into lot coordinates. */
  const toLotCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return null;
    return fromIso(
      (e.clientX - rect.left - engine.camera.x) / engine.camera.zoom,
      (e.clientY - rect.top - engine.camera.y) / engine.camera.zoom,
    );
  };

  useEffect(() => {
    const unsubscribe = gameStateManager.subscribe(() => {
      setState({ ...gameStateManager.state });
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const stage = stageRef.current;
    if (!canvas || !stage) return;

    engine.canvas = canvas;
    engine.ctx = canvas.getContext('2d');

    // Follow the element rather than a fixed size, so the lot fills whatever
    // window it is given.
    let framed = false;
    const observer = new ResizeObserver(() => {
      const { width, height } = stage.getBoundingClientRect();
      if (width < 2 || height < 2) return;
      engine.resize(width, height);
      if (!framed) {
        engine.frameLot();
        framed = true;
      }
    });
    observer.observe(stage);

    engine.start();
    return () => {
      observer.disconnect();
      engine.stop();
    };
  }, []);

  useEffect(() => {
    const PAN_KEYS: Record<string, [number, number]> = {
      ArrowUp: [0, 1], ArrowDown: [0, -1], ArrowLeft: [1, 0], ArrowRight: [-1, 0],
      w: [0, 1], s: [0, -1], a: [1, 0], d: [-1, 0],
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;

      if (e.key === 'f' || e.key === 'F') {
        engine.frameLot();
        return;
      }
      const dir = PAN_KEYS[e.key];
      if (!dir) return;
      e.preventDefault();
      const step = 60;
      engine.panBy(dir[0] * step, dir[1] * step);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const drag = dragRef.current;
    if (drag && e.buttons === 1) {
      const dx = e.clientX - drag.x;
      const dy = e.clientY - drag.y;
      if (Math.abs(dx) > 2 || Math.abs(dy) > 2) drag.moved = true;
      drag.x = e.clientX;
      drag.y = e.clientY;
      engine.panBy(dx, dy);
      return;
    }

    // Track what the cursor is over so its label can surface.
    const over = toLotCoords(e);
    let hovered: string | null = null;
    if (over) {
      for (let i = state.placedItems.length - 1; i >= 0; i--) {
        const it = state.placedItems[i];
        if (over.x >= it.x && over.x <= it.x + it.width && over.y >= it.y && over.y <= it.y + it.height) {
          hovered = it.id;
          break;
        }
      }
    }
    engine.hoveredItemId = hovered;

    if (zonePlacementFor) {
      const member = state.staff.find(s => s.id === zonePlacementFor);
      const pos = toLotCoords(e);
      engine.ghost = null;
      engine.zoneGhost = member && pos
        ? {
            x: pos.x,
            y: pos.y,
            radius: member.assignment.kind === 'zone' ? member.assignment.radius : ZONE_RADIUS_DEFAULT,
            role: member.role,
          }
        : null;
      return;
    }
    engine.zoneGhost = null;

    if (state.phase !== 'SETUP' || !selectedTool) {
      engine.ghost = null;
      return;
    }
    const logicalPos = toLotCoords(e);
    if (!logicalPos) return;
    const def = ITEM_DEFINITIONS[selectedTool];
    const valid = def
      ? gameStateManager.canPlaceItem(selectedTool, logicalPos.x - def.width / 2, logicalPos.y - def.height / 2)
      : false;
    engine.ghost = { itemDefId: selectedTool, x: logicalPos.x, y: logicalPos.y, valid };
  };

  const handleMouseLeave = () => {
    engine.ghost = null;
    engine.zoneGhost = null;
    engine.hoveredItemId = null;
    dragRef.current = null;
  };

  // Clear ghost when tool is deselected
  useEffect(() => {
    if (!selectedTool) engine.ghost = null;
  }, [selectedTool]);

  useEffect(() => {
    if (!zonePlacementFor) engine.zoneGhost = null;
  }, [zonePlacementFor]);

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    // Scale the step with the current zoom so it feels even at both ends.
    const delta = -e.deltaY * 0.0015 * engine.camera.zoom;
    engine.zoomAt(e.clientX - rect.left, e.clientY - rect.top, delta);
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (selectedTool || zonePlacementFor) return; // those clicks place things
    dragRef.current = { x: e.clientX, y: e.clientY, moved: false };
  };

  const endDrag = () => { dragRef.current = null; };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;

    // A click that ended a drag was the player moving the camera, not selecting.
    if (dragRef.current?.moved) { dragRef.current = null; return; }
    dragRef.current = null;

    const screenX = (e.clientX - rect.left - engine.camera.x) / engine.camera.zoom;
    const screenY = (e.clientY - rect.top - engine.camera.y) / engine.camera.zoom;

    // Dropping a worker's patch takes priority over everything else.
    if (zonePlacementFor) {
      const member = state.staff.find(s => s.id === zonePlacementFor);
      const pos = fromIso(screenX, screenY);
      if (member) {
        gameStateManager.setStaffAssignment(member.id, {
          kind: 'zone',
          x: Math.round(pos.x),
          y: Math.round(pos.y),
          radius: member.assignment.kind === 'zone' ? member.assignment.radius : ZONE_RADIUS_DEFAULT,
        });
      }
      setZonePlacementFor(null);
      engine.zoneGhost = null;
      return;
    }

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
    // Return items to inventory using their specific definition ID
    const inventory = { ...state.inventory };
    state.placedItems.forEach(item => {
      inventory[item.itemDefId] = (inventory[item.itemDefId] || 0) + 1;
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
      <div ref={stageRef} className="flex-1 relative overflow-hidden">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          onMouseDown={handleMouseDown}
          onMouseUp={endDrag}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          onWheel={handleWheel}
          className={`absolute inset-0 w-full h-full bg-zinc-800 ${(state.phase === 'SETUP' && selectedTool) || zonePlacementFor ? 'cursor-crosshair' : 'cursor-grab'}`}
        />
        
        {(state.phase === 'SETUP' || state.phase === 'OPERATION') && (
          <StaffPanel zonePlacementFor={zonePlacementFor} setZonePlacementFor={setZonePlacementFor} />
        )}

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
