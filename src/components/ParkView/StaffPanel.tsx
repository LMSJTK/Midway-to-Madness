import React, { useState } from 'react';
import {
  gameStateManager, StaffRecord,
  ZONE_RADIUS_MIN, ZONE_RADIUS_MAX,
} from '../../game/gameState';
import { ITEM_DEFINITIONS } from '../../game/items';

const ROLE_STYLE = {
  maintenance: { dot: 'bg-orange-500', label: 'Mechanic' },
  sanitation: { dot: 'bg-slate-200', label: 'Sweeper' },
} as const;

const ROAM = 'roam';
const ZONE = 'zone';

interface Props {
  /** Staff member awaiting a click on the lot to place their zone. */
  zonePlacementFor: string | null;
  setZonePlacementFor: (id: string | null) => void;
}

interface RowProps {
  member: StaffRecord;
  zonePlacementFor: string | null;
  setZonePlacementFor: (id: string | null) => void;
}

/** Attractions a mechanic can be posted to: whatever is on the lot right now. */
function postableItems() {
  const seen = new Map<string, string>();
  for (const item of gameStateManager.state.placedItems) {
    if (item.type === 'bathroom') continue; // sweepers service those
    if (seen.has(item.itemDefId)) continue;
    seen.set(item.itemDefId, ITEM_DEFINITIONS[item.itemDefId]?.name ?? item.itemDefId);
  }
  return [...seen.entries()];
}

function StaffRow({ member, zonePlacementFor, setZonePlacementFor }: RowProps) {
  const style = ROLE_STYLE[member.role];
  const assignment = member.assignment;
  const awaitingClick = zonePlacementFor === member.id;
  const isSelected = gameStateManager.state.selectedStaffId === member.id;

  const select = (value: string) => {
    if (value === ROAM) {
      setZonePlacementFor(null);
      gameStateManager.setStaffAssignment(member.id, { kind: 'roam' });
      return;
    }
    if (value === ZONE) {
      // Needs a spot on the lot, so arm the next canvas click.
      setZonePlacementFor(member.id);
      gameStateManager.update({ selectedStaffId: member.id });
      return;
    }
    setZonePlacementFor(null);
    gameStateManager.setStaffAssignment(member.id, { kind: 'ride', itemDefId: value });
  };

  const setRadius = (radius: number) => {
    if (assignment.kind !== 'zone') return;
    gameStateManager.setStaffAssignment(member.id, { ...assignment, radius });
  };

  const value = assignment.kind === 'ride' ? assignment.itemDefId : assignment.kind === 'zone' ? ZONE : ROAM;

  return (
    <div
      onMouseEnter={() => gameStateManager.update({ selectedStaffId: member.id })}
      onMouseLeave={() => { if (!awaitingClick) gameStateManager.update({ selectedStaffId: null }); }}
      className={`rounded-lg px-2.5 py-2 transition-colors ${isSelected ? 'bg-zinc-700/70' : 'bg-zinc-900/60'}`}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span className={`w-2.5 h-2.5 rounded-full ${style.dot}`} />
        <span className="text-sm font-semibold text-zinc-100">{member.name}</span>
        <span className="text-[10px] uppercase tracking-wide text-zinc-500">{style.label}</span>
      </div>

      <select
        value={value}
        onChange={e => select(e.target.value)}
        className="w-full bg-zinc-800 text-zinc-200 text-xs rounded px-2 py-1 border border-zinc-700"
      >
        <option value={ROAM}>Free roam</option>
        {member.role === 'maintenance' && postableItems().map(([id, name]) => (
          <option key={id} value={id}>Post to {name}</option>
        ))}
        <option value={ZONE}>Zone…</option>
      </select>

      {awaitingClick && (
        <p className="text-[11px] text-amber-300 mt-1.5">Click the lot to set {member.name}'s patch.</p>
      )}

      {assignment.kind === 'zone' && !awaitingClick && (
        <div className="mt-1.5 flex items-center gap-2">
          <input
            type="range"
            min={ZONE_RADIUS_MIN}
            max={ZONE_RADIUS_MAX}
            step={20}
            value={assignment.radius}
            onChange={e => setRadius(Number(e.target.value))}
            className="flex-1 accent-emerald-500"
          />
          <span className="text-[10px] font-mono text-zinc-400 w-8 text-right">{assignment.radius}</span>
          <button
            onClick={() => setZonePlacementFor(member.id)}
            className="text-[10px] text-zinc-300 bg-zinc-700 hover:bg-zinc-600 rounded px-1.5 py-0.5"
          >
            Move
          </button>
        </div>
      )}

      {assignment.kind === 'ride' && !gameStateManager.state.placedItems.some(i => i.itemDefId === assignment.itemDefId) && (
        <p className="text-[11px] text-amber-400 mt-1.5">That ride isn't set up here — {member.name} will roam.</p>
      )}
    </div>
  );
}

export function StaffPanel({ zonePlacementFor, setZonePlacementFor }: Props) {
  const [open, setOpen] = useState(true);
  const staff = gameStateManager.state.staff;

  if (staff.length === 0) return null;

  return (
    <div className="absolute top-8 left-8 w-64 bg-zinc-800/90 border border-zinc-700 rounded-xl shadow-xl backdrop-blur-sm z-10">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <span className="font-bold text-orange-400">Crew ({staff.length})</span>
        <span className="text-zinc-500 text-xs">{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2 max-h-[55vh] overflow-y-auto">
          {staff.map(member => (
            <StaffRow
              key={member.id}
              member={member}
              zonePlacementFor={zonePlacementFor}
              setZonePlacementFor={setZonePlacementFor}
            />
          ))}
        </div>
      )}
    </div>
  );
}
