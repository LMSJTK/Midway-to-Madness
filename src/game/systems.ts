import { World, Entity } from './ecs';
import { gameStateManager } from './gameState';

export interface Position { x: number; y: number; }
export interface Velocity { vx: number; vy: number; }
export interface Renderable { type: 'guest' | 'ride' | 'stall'; color: string; size: number; }
export interface Guest { money: number; initialMoney: number; hunger: number; bladder: number; excitement: number; targetId: string | null; state: 'wandering' | 'walking' | 'riding' | 'eating' | 'leaving'; timer: number; arrivalTime: number; }
export interface Ride { id: string; type: string; capacity: number; currentRiders: number; duration: number; timer: number; ticketPrice: number; excitement: number; x: number; y: number; w: number; h: number; }
export interface StaffMember { type: 'maintenance' | 'sanitation'; targetId: string | number | null; state: 'wandering' | 'walking' | 'working'; timer: number; }
export interface Trash {}

export function GuestSpawningSystem(world: World, dt: number) {
  const state = gameStateManager.state;
  if (state.phase !== 'OPERATION') return;
  if (state.time >= 21) return; // Stop spawning near closing

  const currentGuests = world.getEntitiesWith(['Guest']).length;
  const expected = state.currentLocation?.expectedGuests || 100;
  
  // Total real time for a day is 14 in-game hours * 6 real seconds/hour = 84 real seconds.
  // Average spawn rate = expected / 84 guests per real second.
  // Peak factor makes it higher in the middle of the day.
  const peakFactor = Math.max(0.1, 1 - Math.abs(state.time - 14) / 6);
  // Normalize peak factor so the average over the day is roughly 1.
  // The integral of max(0.1, 1 - |t-14|/6) from 8 to 22 is roughly 6. 
  // Average value is 6 / 14 = 0.42. So we divide by 0.42 to normalize.
  const normalizedPeak = peakFactor / 0.42;
  
  const spawnChance = (expected / 84) * normalizedPeak * dt;

  if (Math.random() < spawnChance && state.stats.guestsToday < expected) {
    const entity = world.createEntity();
    world.addComponent<Position>(entity, 'Position', { x: 400, y: 600 }); // Entrance
    world.addComponent<Velocity>(entity, 'Velocity', { vx: 0, vy: -50 });
    world.addComponent<Renderable>(entity, 'Renderable', { type: 'guest', color: '#3b82f6', size: 4 });
    const initialMoney = 50 + Math.random() * 100;
    world.addComponent<Guest>(entity, 'Guest', { 
      money: initialMoney, 
      initialMoney,
      hunger: Math.random() * 50, 
      bladder: Math.random() * 30,
      excitement: 0, 
      targetId: null, 
      state: 'wandering', 
      timer: 0,
      arrivalTime: state.time
    });
    state.stats.guestsToday++;
  }
}

export function GuestAISystem(world: World, dt: number) {
  const guests = world.getEntitiesWith(['Guest', 'Position', 'Velocity']);
  const state = gameStateManager.state;
  
  for (const entity of guests) {
    const guest = world.getComponent(entity, 'Guest')!;
    const pos = world.getComponent(entity, 'Position')!;
    const vel = world.getComponent(entity, 'Velocity')!;

    guest.hunger += dt * 0.5; // Hunger increases over time
    guest.bladder += dt * 0.8; // Bladder increases over time

    if (Math.random() < 0.02 * dt) { // Chance to drop trash
      const trash = world.createEntity();
      world.addComponent<Position>(trash, 'Position', { x: pos.x, y: pos.y });
      world.addComponent<Renderable>(trash, 'Renderable', { type: 'trash', color: '#78716c', size: 2 });
      world.addComponent<Trash>(trash, 'Trash', {});
    }

    if (state.time >= 22) {
      guest.state = 'leaving';
    }

    if (guest.state === 'leaving') {
      // Move towards exit (400, 600)
      const dx = 400 - pos.x;
      const dy = 600 - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 10) {
        world.destroyEntity(entity);
      } else {
        vel.vx = (dx / dist) * 60;
        vel.vy = (dy / dist) * 60;
      }
      continue;
    }

    if (guest.state === 'wandering') {
      guest.timer -= dt;
      if (guest.timer <= 0) {
        // Pick a new target
        if (state.placedItems.length > 0) {
          // Utility based choice
          let bestScore = -Infinity;
          let bestItem = null;
          
          for (const item of state.placedItems) {
            if (!item.built) continue;
            
            const dx = item.x + item.width/2 - pos.x;
            const dy = item.y + item.height/2 - pos.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            let score = 0;
            const priceRatio = item.basePrice / Math.max(0.5, item.ticketPrice); // Prevent division by zero, 0.5 is min price floor for ratio
            
            if (item.isBroken) {
              score = -Infinity;
            } else if (item.type === 'bathroom') {
              // Higher bladder = higher urgency = higher distance penalty (can't hold it!)
              const urgencyMultiplier = 1 + (guest.bladder / 100);
              score = guest.bladder * 3 - (dist * 0.05 * urgencyMultiplier) - item.ticketPrice;
            } else if (item.type === 'food') {
              // Higher hunger = higher urgency = higher distance penalty
              const urgencyMultiplier = 1 + (guest.hunger / 100);
              score = guest.hunger * 2 * priceRatio - (dist * 0.05 * urgencyMultiplier) - item.ticketPrice;
              if (item.stock <= 0) score = -Infinity;
            } else {
              // Add some randomness to preference so they don't all pick the exact same ride
              const randomPreference = Math.random() * 20;
              score = (100 - guest.excitement) * (item.excitement / 10) * priceRatio - (dist * 0.05) - item.ticketPrice + randomPreference;
            }
            
            if (guest.money < item.ticketPrice) score = -Infinity;
            if (item.type !== 'food' && item.type !== 'bathroom' && item.currentRiders >= item.capacity) score = -Infinity; // Don't queue for full rides right now
            
            if (score > bestScore) {
              bestScore = score;
              bestItem = item;
            }
          }
          
          if (bestItem && bestScore > 0) {
            guest.targetId = bestItem.id;
            guest.state = 'walking';
          } else {
            // Just wander
            vel.vx = (Math.random() - 0.5) * 40;
            vel.vy = (Math.random() - 0.5) * 40;
            guest.timer = 2 + Math.random() * 3;
          }
        } else {
          vel.vx = (Math.random() - 0.5) * 40;
          vel.vy = (Math.random() - 0.5) * 40;
          guest.timer = 2 + Math.random() * 3;
        }
      }
    } else if (guest.state === 'walking') {
      const target = state.placedItems.find(i => i.id === guest.targetId);
      if (!target || !target.built) {
        guest.state = 'wandering';
        guest.timer = 0;
        continue;
      }
      
      const tx = target.x + target.width/2;
      const ty = target.y + target.height; // entrance at bottom
      
      const dx = tx - pos.x;
      const dy = ty - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      
      if (dist < 10) {
        // Arrived
        const hasCapacity = target.type === 'food' || target.type === 'bathroom' || target.currentRiders < target.capacity;
        if (guest.money >= target.ticketPrice && hasCapacity && (target.type !== 'food' || target.stock > 0) && !target.isBroken) {
          guest.money -= target.ticketPrice;
          target.currentRiders++;
          target.customersToday++;
          target.revenueToday += target.ticketPrice;
          if (target.type === 'food') target.stock--;
          
          // Update economy
          const netRevenue = target.ticketPrice * (1 - (state.currentLocation?.revenueShare || 0));
          state.stats.revenueToday += netRevenue;
          state.money += netRevenue;
          
          if (target.type === 'food') {
            guest.state = 'eating';
            guest.timer = 5;
            guest.hunger = 0;
            target.currentRiders--; // Food stalls process instantly
          } else if (target.type === 'bathroom') {
            guest.state = 'eating'; // Reuse eating state for quick use
            guest.timer = 2;
            guest.bladder = 0;
            target.currentRiders--; // Bathrooms process instantly
            
            // Degrade bathroom condition
            target.condition -= 2;
            if (target.condition <= 0) {
              target.isBroken = true;
              target.condition = 0;
            }
          } else {
            guest.state = 'riding';
            guest.timer = target.duration;
            guest.excitement += target.excitement;
            
            // Degrade condition
            target.condition -= 1;
            if (target.condition <= 0) {
              target.isBroken = true;
              target.condition = 0;
            }
          }
          vel.vx = 0;
          vel.vy = 0;
        } else {
          // Can't afford or full
          guest.state = 'wandering';
          guest.timer = 0;
        }
      } else {
        vel.vx = (dx / dist) * 60;
        vel.vy = (dy / dist) * 60;
      }
    } else if (guest.state === 'riding' || guest.state === 'eating') {
      guest.timer -= dt;
      if (guest.timer <= 0) {
        guest.state = 'wandering';
        guest.timer = 0;
        const target = state.placedItems.find(i => i.id === guest.targetId);
        if (target && target.type !== 'food' && target.type !== 'bathroom') {
          target.currentRiders = Math.max(0, target.currentRiders - 1);
        }
        guest.targetId = null;
      }
    }
    
    // Keep in bounds
    if (pos.x < 0) pos.x = 0;
    if (pos.x > 800) pos.x = 800;
    if (pos.y < 0) pos.y = 0;
    if (pos.y > 600) pos.y = 600;
  }
}

export function MovementSystem(world: World, dt: number) {
  const entities = world.getEntitiesWith(['Position', 'Velocity']);
  for (const entity of entities) {
    const pos = world.getComponent(entity, 'Position')!;
    const vel = world.getComponent(entity, 'Velocity')!;
    pos.x += vel.vx * dt;
    pos.y += vel.vy * dt;
  }
}

export function StaffAISystem(world: World, dt: number) {
  const state = gameStateManager.state;
  if (state.phase !== 'OPERATION') return;

  const staffEntities = world.getEntitiesWith(['Staff', 'Position', 'Velocity']);
  let maintCount = 0;
  let saniCount = 0;

  const claimedRideTargets = new Set<string>();
  const claimedBathroomTargets = new Set<string>();
  const claimedTrashTargets = new Set<number>();

  for (const entity of staffEntities) {
    const staff = world.getComponent(entity, 'Staff');
    if (!staff || (staff.state !== 'walking' && staff.state !== 'working') || staff.targetId == null) continue;

    if (staff.type === 'maintenance' && typeof staff.targetId === 'string') {
      claimedRideTargets.add(staff.targetId);
    } else if (staff.type === 'sanitation') {
      if (typeof staff.targetId === 'string') {
        claimedBathroomTargets.add(staff.targetId);
      } else {
        claimedTrashTargets.add(staff.targetId);
      }
    }
  }

  for (const entity of staffEntities) {
    const staff = world.getComponent(entity, 'Staff')!;
    const pos = world.getComponent(entity, 'Position')!;
    const vel = world.getComponent(entity, 'Velocity')!;

    if (staff.type === 'maintenance') maintCount++;
    if (staff.type === 'sanitation') saniCount++;

    if (staff.state === 'wandering') {
      staff.timer -= dt;
      if (staff.timer <= 0) {
        if (staff.type === 'maintenance') {
          const availableBrokenRides = state.placedItems.filter(i => i.isBroken && i.type !== 'bathroom' && !claimedRideTargets.has(i.id));
          const brokenRide = (availableBrokenRides.length > 0 ? availableBrokenRides : state.placedItems.filter(i => i.isBroken && i.type !== 'bathroom'))[0];
          if (brokenRide) {
            staff.targetId = brokenRide.id;
            staff.state = 'walking';
            claimedRideTargets.add(brokenRide.id);
          } else {
            vel.vx = (Math.random() - 0.5) * 50;
            vel.vy = (Math.random() - 0.5) * 50;
            staff.timer = 2 + Math.random() * 3;
          }
        } else if (staff.type === 'sanitation') {
          const availableBrokenBathrooms = state.placedItems.filter(i => i.isBroken && i.type === 'bathroom' && !claimedBathroomTargets.has(i.id));
          const brokenBathroom = (availableBrokenBathrooms.length > 0 ? availableBrokenBathrooms : state.placedItems.filter(i => i.isBroken && i.type === 'bathroom'))[0];
          if (brokenBathroom) {
            staff.targetId = brokenBathroom.id;
            staff.state = 'walking';
            claimedBathroomTargets.add(brokenBathroom.id);
          } else {
            const trashes = world.getEntitiesWith(['Trash', 'Position']);
            if (trashes.length > 0) {
              let closest = -1;
              let minDist = Infinity;
              for (const t of trashes) {
                if (claimedTrashTargets.has(t)) continue;

                const tPos = world.getComponent(t, 'Position')!;
                const dist = Math.pow(tPos.x - pos.x, 2) + Math.pow(tPos.y - pos.y, 2);
                if (dist < minDist) {
                  minDist = dist;
                  closest = t;
                }
              }
              if (closest !== -1) {
                staff.targetId = closest;
                staff.state = 'walking';
                claimedTrashTargets.add(closest);
              }
            } else {
              vel.vx = (Math.random() - 0.5) * 50;
              vel.vy = (Math.random() - 0.5) * 50;
              staff.timer = 2 + Math.random() * 3;
            }
          }
        }
      }
    } else if (staff.state === 'walking') {
      if (staff.type === 'maintenance') {
        const target = state.placedItems.find(i => i.id === staff.targetId);
        if (!target || !target.isBroken) {
          staff.state = 'wandering';
          staff.timer = 0;
          continue;
        }
        const tx = target.x + target.width/2;
        const ty = target.y + target.height;
        const dist = Math.sqrt(Math.pow(tx - pos.x, 2) + Math.pow(ty - pos.y, 2));
        if (dist < 10) {
          staff.state = 'working';
          staff.timer = 5; // 5 seconds to fix
          vel.vx = 0; vel.vy = 0;
        } else {
          vel.vx = ((tx - pos.x) / dist) * 70;
          vel.vy = ((ty - pos.y) / dist) * 70;
        }
      } else if (staff.type === 'sanitation') {
        if (typeof staff.targetId === 'string') {
          // Targeting a bathroom
          const target = state.placedItems.find(i => i.id === staff.targetId);
          if (!target || !target.isBroken) {
            staff.state = 'wandering';
            staff.timer = 0;
            continue;
          }
          const tx = target.x + target.width/2;
          const ty = target.y + target.height;
          const dist = Math.sqrt(Math.pow(tx - pos.x, 2) + Math.pow(ty - pos.y, 2));
          if (dist < 10) {
            staff.state = 'working';
            staff.timer = 3; // 3 seconds to clean
            vel.vx = 0; vel.vy = 0;
          } else {
            vel.vx = ((tx - pos.x) / dist) * 70;
            vel.vy = ((ty - pos.y) / dist) * 70;
          }
        } else {
          // Targeting trash
          const targetEntity = staff.targetId as number;
          if (!world.entities.has(targetEntity)) {
            staff.state = 'wandering';
            staff.timer = 0;
            continue;
          }
          const tPos = world.getComponent(targetEntity, 'Position')!;
          const dist = Math.sqrt(Math.pow(tPos.x - pos.x, 2) + Math.pow(tPos.y - pos.y, 2));
          if (dist < 10) {
            world.destroyEntity(targetEntity);
            staff.state = 'wandering';
            staff.timer = 0;
            vel.vx = 0; vel.vy = 0;
          } else {
            vel.vx = ((tPos.x - pos.x) / dist) * 70;
            vel.vy = ((tPos.y - pos.y) / dist) * 70;
          }
        }
      }
    } else if (staff.state === 'working') {
      staff.timer -= dt;
      if (staff.timer <= 0) {
        if (staff.type === 'maintenance' || (staff.type === 'sanitation' && typeof staff.targetId === 'string')) {
          const target = state.placedItems.find(i => i.id === staff.targetId);
          if (target) {
            target.isBroken = false;
            target.condition = 100;
          }
        }
        staff.state = 'wandering';
        staff.timer = 0;
      }
    }
    
    // Keep in bounds
    if (pos.x < 0) pos.x = 0;
    if (pos.x > 800) pos.x = 800;
    if (pos.y < 0) pos.y = 0;
    if (pos.y > 600) pos.y = 600;
  }

  // Spawn missing staff
  while (maintCount < state.staff.maintenance) {
    const entity = world.createEntity();
    world.addComponent<Position>(entity, 'Position', { x: 400, y: 600 });
    world.addComponent<Velocity>(entity, 'Velocity', { vx: 0, vy: -50 });
    world.addComponent<Renderable>(entity, 'Renderable', { type: 'staff', color: '#f97316', size: 4 }); // Orange
    world.addComponent<StaffMember>(entity, 'Staff', { type: 'maintenance', targetId: null, state: 'wandering', timer: 0 });
    maintCount++;
  }
  while (saniCount < state.staff.sanitation) {
    const entity = world.createEntity();
    world.addComponent<Position>(entity, 'Position', { x: 400, y: 600 });
    world.addComponent<Velocity>(entity, 'Velocity', { vx: 0, vy: -50 });
    world.addComponent<Renderable>(entity, 'Renderable', { type: 'staff', color: '#f8fafc', size: 4 }); // White
    world.addComponent<StaffMember>(entity, 'Staff', { type: 'sanitation', targetId: null, state: 'wandering', timer: 0 });
    saniCount++;
  }
}

let lastNotifyTime = 0;

export function TimeSystem(world: World, dt: number) {
  const state = gameStateManager.state;
  if (state.phase === 'OPERATION') {
    // 1 real second = 10 in-game minutes
    // 6 real seconds = 1 in-game hour
    state.time += dt / 6;
    if (state.time >= 22) { // 10 PM
      gameStateManager.update({ phase: 'TEARDOWN' });
    } else {
      if (state.time - lastNotifyTime > 0.1) { // Notify roughly every 6 in-game minutes
        lastNotifyTime = state.time;
        gameStateManager.notify();
      }
    }
  }
}
