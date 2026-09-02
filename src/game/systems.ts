import { World, Entity, Velocity, Guest } from './ecs';
import { gameStateManager, PlacedItem } from './gameState';
import { INSTANT_CATEGORIES, STOCK_CATEGORIES, ITEM_DEFINITIONS, ItemCategory } from './items';
import { spriteRegistry } from './spriteRegistry';
import { GAME_CONFIG, DAY_LENGTH_SECONDS } from './constants';

type GameState = typeof gameStateManager.state;

/**
 * Excitement bleeds off so a guest who has ridden everything wants another go
 * later in the day. Without this, ride scores — which are driven by
 * (100 - excitement) — go negative for good after two or three rides.
 */
const EXCITEMENT_DECAY_PER_SECOND = 4;

/** Release any ride slot or queue place the guest is holding. */
function detachFromTarget(state: GameState, guest: Guest, entity: Entity) {
  const target = guest.targetId ? state.placedItems.find(i => i.id === guest.targetId) : undefined;
  if (target) {
    if (guest.state === 'queued') {
      target.queue = target.queue.filter(id => id !== entity);
    } else if (guest.state === 'riding' && !INSTANT_CATEGORIES.includes(target.type as ItemCategory)) {
      target.currentRiders = Math.max(0, target.currentRiders - 1);
    }
  }
  guest.targetId = null;
}

/**
 * Cheapest thing a guest could still spend money on right now. A guest who
 * cannot afford this has nothing left to do and goes home. Infinity means the
 * park has nothing open at all, which also sends them home.
 */
function cheapestTicket(state: GameState): number {
  let min = Infinity;
  for (const item of state.placedItems) {
    if (!item.built || item.isBroken) continue;
    if (STOCK_CATEGORIES.includes(item.type as ItemCategory) && item.stock <= 0) continue;
    if (item.ticketPrice < min) min = item.ticketPrice;
  }
  return min;
}

/** Shared logic: guest boards a ride/facility and pays */
function boardGuest(
  guest: Guest,
  target: PlacedItem,
  _entity: number,
  vel: Velocity,
  state: GameState,
) {
  const category = target.type as ItemCategory;
  guest.money -= target.ticketPrice;
  target.currentRiders++;
  target.customersToday++;
  target.patronsServed++;
  target.revenueToday += target.ticketPrice;
  if (STOCK_CATEGORIES.includes(category)) target.stock--;

  // Update economy
  const netRevenue = target.ticketPrice * (1 - (state.currentLocation?.revenueShare || 0));
  state.stats.revenueToday += netRevenue;
  state.money += netRevenue;

  // Quality-based breakdown
  const def = ITEM_DEFINITIONS[target.itemDefId];
  const quality = def?.quality ?? 50;
  if (target.patronsServed > quality) {
    const excess = target.patronsServed - quality;
    const breakdownChance = 1 - Math.exp(-excess * 0.05);
    if (Math.random() < breakdownChance) {
      target.isBroken = true;
      target.condition = 0;
    }
  }

  if (target.type === 'food') {
    guest.state = 'eating';
    guest.timer = 5;
    guest.hunger = 0;
    target.currentRiders--;
  } else if (target.type === 'bathroom') {
    guest.state = 'eating';
    guest.timer = 2;
    guest.bladder = 0;
    target.currentRiders--;
  } else if (target.type === 'gameStall') {
    guest.state = 'eating';
    guest.timer = 4;
    guest.excitement += target.excitement;
    target.currentRiders--;
  } else if (target.type === 'shop') {
    guest.state = 'eating';
    guest.timer = 3;
    target.currentRiders--;
  } else {
    guest.state = 'riding';
    guest.timer = target.duration;
    guest.excitement += target.excitement;
  }
  vel.vx = 0;
  vel.vy = 0;
}

function spawnGuest(world: World, state: GameState) {
  const entity = world.createEntity();
  world.addComponent(entity, 'Position', { x: GAME_CONFIG.ENTRANCE_X, y: GAME_CONFIG.ENTRANCE_Y });
  world.addComponent(entity, 'Velocity', { vx: 0, vy: -GAME_CONFIG.WALK_SPEED });
  world.addComponent(entity, 'Renderable', { type: 'guest', color: '#3b82f6', size: 4 });
  const initialMoney = 50 + Math.random() * 100;
  const portraitCount = spriteRegistry.guestPortraits.length;
  world.addComponent(entity, 'Guest', {
    money: initialMoney,
    initialMoney,
    hunger: Math.random() * 50,
    bladder: Math.random() * 30,
    excitement: 0,
    targetId: null,
    state: 'wandering',
    timer: 0,
    arrivalTime: state.time,
    portraitIndex: portraitCount > 0 ? Math.floor(Math.random() * portraitCount) : -1,
    maxWaitTolerance: 3 + Math.random() * 10, // 3-13 guests they'll wait behind
    maxStayHours: 3 + Math.random() * 2,      // in-game hours before heading home
  });
  state.stats.guestsToday++;
}

export function GuestSpawningSystem(world: World, dt: number) {
  const state = gameStateManager.state;
  if (state.phase !== 'OPERATION') return;
  if (state.time >= GAME_CONFIG.LAST_ARRIVAL) return; // Stop spawning near closing

  const expected = state.currentLocation?.expectedGuests || 100;

  // Spread `expected` arrivals across the operating day, busier around 2 PM.
  // The peak curve integrates to roughly 0.42 of a flat day, so dividing by
  // that keeps the day's total near `expected`.
  const peakFactor = Math.max(0.1, 1 - Math.abs(state.time - 14) / 6);
  const normalizedPeak = peakFactor / 0.42;

  // dt is already scaled by the sim speed, so this is arrivals per tick.
  // Big fairs need more than one guest per tick, hence the loop rather than
  // a single coin flip.
  const arrivals = (expected / DAY_LENGTH_SECONDS) * normalizedPeak * dt;
  let toSpawn = Math.floor(arrivals);
  if (Math.random() < arrivals - toSpawn) toSpawn++;

  for (let i = 0; i < toSpawn && state.stats.guestsToday < expected; i++) {
    spawnGuest(world, state);
  }
}

export function GuestAISystem(world: World, dt: number) {
  const guests = world.getEntitiesWith(['Guest', 'Position', 'Velocity']);
  const state = gameStateManager.state;
  const closing = state.time >= GAME_CONFIG.DAY_END;
  const minTicket = cheapestTicket(state);

  for (const entity of guests) {
    const guest = world.getComponent(entity, 'Guest')!;
    const pos = world.getComponent(entity, 'Position')!;
    const vel = world.getComponent(entity, 'Velocity')!;

    guest.hunger += dt * 0.5; // Hunger increases over time
    guest.bladder += dt * 0.8; // Bladder increases over time
    guest.excitement = Math.max(0, guest.excitement - dt * EXCITEMENT_DECAY_PER_SECOND);

    if (Math.random() < 0.02 * dt) { // Chance to drop trash
      const trash = world.createEntity();
      world.addComponent(trash, 'Position', { x: pos.x, y: pos.y });
      world.addComponent(trash, 'Renderable', { type: 'trash', color: '#78716c', size: 2 });
      world.addComponent(trash, 'Trash', {});
    }

    // Decide whether it's time to go home. Guests mid-ride finish first;
    // at closing everyone is turned out regardless.
    if (guest.state !== 'leaving') {
      const between = guest.state === 'wandering' || guest.state === 'walking' || guest.state === 'queued';
      const stayedLongEnough = state.time - guest.arrivalTime >= guest.maxStayHours;
      const outOfMoney = minTicket > 0 && guest.money < minTicket;
      if (closing || (between && (stayedLongEnough || outOfMoney))) {
        detachFromTarget(state, guest, entity);
        guest.state = 'leaving';
      }
    }

    if (guest.state === 'leaving') {
      // Move towards exit
      const dx = GAME_CONFIG.ENTRANCE_X - pos.x;
      const dy = GAME_CONFIG.ENTRANCE_Y - pos.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 10) {
        world.destroyEntity(entity);
      } else {
        vel.vx = (dx / dist) * GAME_CONFIG.WALK_SPEED;
        vel.vy = (dy / dist) * GAME_CONFIG.WALK_SPEED;
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
            } else if (item.type === 'gameStall') {
              // Game stalls give small excitement, guests play when not too excited already
              const randomPreference = Math.random() * 15;
              score = (80 - guest.excitement) * (item.excitement / 10) * priceRatio - (dist * 0.05) - item.ticketPrice + randomPreference;
            } else if (item.type === 'shop') {
              // Guests visit shops based on excitement (souvenirs after having fun) and remaining money
              const shopInterest = guest.excitement * 0.3 + Math.random() * 15;
              score = shopInterest * priceRatio - (dist * 0.05) - item.ticketPrice;
              if (item.stock <= 0) score = -Infinity;
            } else if (item.type === 'performance') {
              // Performances are like rides: high excitement draw, capacity-limited
              const randomPreference = Math.random() * 15;
              score = (100 - guest.excitement) * (item.excitement / 10) * priceRatio - (dist * 0.05) - item.ticketPrice + randomPreference;
            } else {
              // Rides: add some randomness to preference so they don't all pick the exact same ride
              const randomPreference = Math.random() * 20;
              score = (100 - guest.excitement) * (item.excitement / 10) * priceRatio - (dist * 0.05) - item.ticketPrice + randomPreference;
            }

            if (guest.money < item.ticketPrice) score = -Infinity;
            // If ride is full, penalize by queue length instead of excluding entirely.
            // Guest will still consider it if the queue is short enough for their tolerance.
            if (item.capacity > 0 && item.currentRiders >= item.capacity) {
              const queueLen = item.queue.length;
              if (queueLen >= item.capacity || queueLen >= guest.maxWaitTolerance) {
                score = -Infinity; // Queue full or too long for this guest
              } else {
                // Penalize score by how long the wait will be
                score -= queueLen * 8;
              }
            }
            
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
        const category = target.type as ItemCategory;
        const isInstant = INSTANT_CATEGORIES.includes(category);
        const hasCapacity = isInstant || target.currentRiders < target.capacity;
        const hasStock = !STOCK_CATEGORIES.includes(category) || target.stock > 0;
        if (guest.money >= target.ticketPrice && hasStock && !target.isBroken) {
          if (hasCapacity) {
            // Board immediately
            boardGuest(guest, target, entity, vel, state);
          } else if (target.queue.length < target.capacity && target.queue.length < guest.maxWaitTolerance) {
            // Ride full but queue has room and guest is willing to wait
            guest.state = 'queued';
            target.queue.push(entity);
            vel.vx = 0;
            vel.vy = 0;
          } else {
            // Queue too long or full
            guest.state = 'wandering';
            guest.timer = 0;
          }
        } else {
          // Can't afford, out of stock, or broken
          guest.state = 'wandering';
          guest.timer = 0;
        }
      } else {
        vel.vx = (dx / dist) * GAME_CONFIG.WALK_SPEED;
        vel.vy = (dy / dist) * GAME_CONFIG.WALK_SPEED;
      }
    } else if (guest.state === 'queued') {
      // Waiting in line — check if ride broke, was removed, or we should leave
      const target = state.placedItems.find(i => i.id === guest.targetId);
      if (!target || !target.built || target.isBroken) {
        // Ride gone or broken — leave queue
        if (target) target.queue = target.queue.filter(id => id !== entity);
        guest.state = 'wandering';
        guest.timer = 0;
        guest.targetId = null;
        continue;
      }
      // Check if we're first in line and ride has capacity
      if (target.queue[0] === entity && target.currentRiders < target.capacity) {
        target.queue.shift();
        boardGuest(guest, target, entity, vel, state);
      }
      // Otherwise keep waiting (vel already 0)
    } else if (guest.state === 'riding' || guest.state === 'eating') {
      guest.timer -= dt;
      if (guest.timer <= 0) {
        guest.state = 'wandering';
        guest.timer = 0;
        const target = state.placedItems.find(i => i.id === guest.targetId);
        if (target && !INSTANT_CATEGORIES.includes(target.type as ItemCategory)) {
          target.currentRiders = Math.max(0, target.currentRiders - 1);
        }
        guest.targetId = null;
      }
    }
    
    // Keep in bounds
    if (pos.x < 0) pos.x = 0;
    if (pos.x > GAME_CONFIG.MAP_WIDTH) pos.x = GAME_CONFIG.MAP_WIDTH;
    if (pos.y < 0) pos.y = 0;
    if (pos.y > GAME_CONFIG.MAP_HEIGHT) pos.y = GAME_CONFIG.MAP_HEIGHT;
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

/** A repaired ride starts its wear count over, otherwise it breaks again immediately. */
function repairItem(target: PlacedItem) {
  target.isBroken = false;
  target.condition = 100;
  target.patronsServed = 0;
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
          vel.vx = ((tx - pos.x) / dist) * GAME_CONFIG.STAFF_SPEED;
          vel.vy = ((ty - pos.y) / dist) * GAME_CONFIG.STAFF_SPEED;
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
            vel.vx = ((tx - pos.x) / dist) * GAME_CONFIG.STAFF_SPEED;
            vel.vy = ((ty - pos.y) / dist) * GAME_CONFIG.STAFF_SPEED;
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
            vel.vx = ((tPos.x - pos.x) / dist) * GAME_CONFIG.STAFF_SPEED;
            vel.vy = ((tPos.y - pos.y) / dist) * GAME_CONFIG.STAFF_SPEED;
          }
        }
      }
    } else if (staff.state === 'working') {
      staff.timer -= dt;
      if (staff.timer <= 0) {
        if (staff.type === 'maintenance' || (staff.type === 'sanitation' && typeof staff.targetId === 'string')) {
          const target = state.placedItems.find(i => i.id === staff.targetId);
          if (target) repairItem(target);
        }
        staff.state = 'wandering';
        staff.timer = 0;
      }
    }
    
    // Keep in bounds
    if (pos.x < 0) pos.x = 0;
    if (pos.x > GAME_CONFIG.MAP_WIDTH) pos.x = GAME_CONFIG.MAP_WIDTH;
    if (pos.y < 0) pos.y = 0;
    if (pos.y > GAME_CONFIG.MAP_HEIGHT) pos.y = GAME_CONFIG.MAP_HEIGHT;
  }

  // Spawn missing staff
  while (maintCount < state.staff.maintenance) {
    const entity = world.createEntity();
    world.addComponent(entity, 'Position', { x: GAME_CONFIG.ENTRANCE_X, y: GAME_CONFIG.ENTRANCE_Y });
    world.addComponent(entity, 'Velocity', { vx: 0, vy: -GAME_CONFIG.STAFF_SPEED });
    world.addComponent(entity, 'Renderable', { type: 'staff', color: '#f97316', size: 4 }); // Orange
    world.addComponent(entity, 'Staff', { type: 'maintenance', targetId: null, state: 'wandering', timer: 0 });
    maintCount++;
  }
  while (saniCount < state.staff.sanitation) {
    const entity = world.createEntity();
    world.addComponent(entity, 'Position', { x: GAME_CONFIG.ENTRANCE_X, y: GAME_CONFIG.ENTRANCE_Y });
    world.addComponent(entity, 'Velocity', { vx: 0, vy: -GAME_CONFIG.STAFF_SPEED });
    world.addComponent(entity, 'Renderable', { type: 'staff', color: '#f8fafc', size: 4 }); // White
    world.addComponent(entity, 'Staff', { type: 'sanitation', targetId: null, state: 'wandering', timer: 0 });
    saniCount++;
  }
}

let lastNotifyTime = 0;

export function TimeSystem(world: World, dt: number) {
  const state = gameStateManager.state;
  if (state.phase !== 'OPERATION') return;

  // The clock rewinds to opening time each morning. Without this the marker
  // left at last night's closing time suppresses every notify for the whole
  // next day, freezing the clock and cash readouts in the HUD.
  if (state.time < lastNotifyTime) lastNotifyTime = state.time;

  // dt arrives already scaled by the sim speed.
  state.time += dt / GAME_CONFIG.TIME_SCALE;

  if (state.time >= GAME_CONFIG.DAY_END) {
    gameStateManager.update({ phase: 'TEARDOWN' });
  } else if (state.time - lastNotifyTime > 0.1) { // roughly every 6 in-game minutes
    lastNotifyTime = state.time;
    gameStateManager.notify();
  }
}
