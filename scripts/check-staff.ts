/** Headless check of staff postings: drives the real systems, no canvas. */
import { World } from '../src/game/ecs.ts';
import { gameStateManager, StaffRecord, StaffAssignment } from '../src/game/gameState.ts';
import { StaffAISystem, MovementSystem, effectiveQuality } from '../src/game/systems.ts';
import { ITEM_DEFINITIONS } from '../src/game/items.ts';

let failures = 0;
const check = (name: string, pass: boolean, detail = '') => {
  if (!pass) failures++;
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
};

const S = gameStateManager.state;

function placed(itemDefId: string, x: number, y: number) {
  const def = ITEM_DEFINITIONS[itemDefId];
  return {
    id: itemDefId + '_1', itemDefId, type: def.category, x, y,
    width: def.width, height: def.height, built: true, buildTimeRemaining: 0,
    ticketPrice: def.basePrice, basePrice: def.basePrice, excitement: def.value,
    capacity: def.capacity ?? 0, currentRiders: 0, duration: def.duration ?? 0, timer: 0,
    revenueToday: 0, customersToday: 0, patronsServed: 0, stock: 0,
    isBroken: false, condition: 100, queue: [] as number[],
  };
}

function hire(id: string, role: 'maintenance' | 'sanitation', assignment: StaffAssignment): StaffRecord {
  return { id, role, name: id, assignment };
}

function reset(staff: StaffRecord[], items: ReturnType<typeof placed>[]) {
  const world = new World();
  Object.assign(S, {
    phase: 'OPERATION', time: 12, staff, placedItems: items,
    currentLocation: { id: 'loc1', name: 'T', type: 'Local', distance: 1, fee: 0, expectedGuests: 0, revenueShare: 0, biome: 'meadow' },
  });
  return world;
}

const tick = (world: World, seconds: number) => {
  const dt = 1 / 20;
  for (let i = 0; i < seconds * 20; i++) { StaffAISystem(world, dt); MovementSystem(world, dt); }
};

const staffPos = (world: World, staffId: string) => {
  for (const e of world.getEntitiesWith(['Staff', 'Position'])) {
    if (world.getComponent(e, 'Staff')!.staffId === staffId) return world.getComponent(e, 'Position')!;
  }
  return null;
};
const dist = (a: {x:number;y:number}, b: {x:number;y:number}) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------------------------------------------------------------- posting
{
  const scrambler = placed('scrambler', 400, 400);
  const teacups = placed('teacups', 1200, 900);
  const world = reset([hire('dale', 'maintenance', { kind: 'ride', itemDefId: 'scrambler' })], [scrambler, teacups]);

  tick(world, 30);
  const post = { x: scrambler.x + scrambler.width / 2, y: scrambler.y + scrambler.height };
  const idle = staffPos(world, 'dale')!;
  check('posted mechanic waits at their ride', dist(idle, post) < 60, `${Math.round(dist(idle, post))} units away`);

  // Something else breaks: not their problem.
  teacups.isBroken = true;
  tick(world, 40);
  check('posted mechanic ignores other breakdowns', teacups.isBroken, 'teacups still broken');
  const stillThere = staffPos(world, 'dale')!;
  check('posted mechanic holds their post', dist(stillThere, post) < 60, `${Math.round(dist(stillThere, post))} units away`);

  // Their ride breaks: fixed promptly because they were already standing there.
  scrambler.isBroken = true;
  scrambler.patronsServed = 90;
  tick(world, 8);
  check('posted mechanic fixes their own ride fast', !scrambler.isBroken, 'repaired within 8s');
  check('repair clears accumulated wear', scrambler.patronsServed === 0, `patronsServed ${scrambler.patronsServed}`);
}

// ------------------------------------------------------------------- zones
{
  const zone: StaffAssignment = { kind: 'zone', x: 500, y: 500, radius: 250 };
  const far = placed('teacups', 1300, 1000);
  far.isBroken = true;
  const world = reset([hire('rosa', 'maintenance', zone)], [far]);

  // Staff clock on at the entrance, so give them time to walk to their patch
  // before judging how well they stay in it.
  tick(world, 40);
  const arrived = dist(staffPos(world, 'rosa')!, { x: 500, y: 500 });
  check('zoned worker reports to their patch', arrived <= 250, `${Math.round(arrived)} from centre`);

  let maxDrift = 0;
  for (let i = 0; i < 120; i++) {
    tick(world, 1);
    maxDrift = Math.max(maxDrift, dist(staffPos(world, 'rosa')!, { x: 500, y: 500 }));
  }
  check('zoned worker stays inside their patch', maxDrift <= 250 * 1.02, `drifted ${Math.round(maxDrift)} of 250`);
  check('zoned worker ignores jobs outside the patch', far.isBroken, 'distant ride still broken');
}

// --------------------------------------------------------- zone does reach in
{
  const near = placed('teacups', 480, 480);
  near.isBroken = true;
  const world = reset([hire('gus', 'maintenance', { kind: 'zone', x: 500, y: 500, radius: 250 })], [near]);
  tick(world, 30);
  check('zoned worker takes jobs inside the patch', !near.isBroken, 'in-zone ride repaired');
}

// ------------------------------------------------------------ roam unchanged
{
  const a = placed('scrambler', 300, 300); a.isBroken = true;
  const b = placed('teacups', 1200, 1000); b.isBroken = true;
  const world = reset([hire('ray', 'maintenance', { kind: 'roam' })], [a, b]);
  tick(world, 90);
  check('free roamer still works the whole lot', !a.isBroken && !b.isBroken, 'both ends repaired');
}

// --------------------------------------------------------- breakdown bonus
{
  const base = ITEM_DEFINITIONS['scrambler'].quality;
  Object.assign(S, { staff: [] });
  const none = effectiveQuality(S, 'scrambler');
  Object.assign(S, { staff: [hire('a', 'maintenance', { kind: 'ride', itemDefId: 'scrambler' })] });
  const one = effectiveQuality(S, 'scrambler');
  Object.assign(S, { staff: [
    hire('a', 'maintenance', { kind: 'ride', itemDefId: 'scrambler' }),
    hire('b', 'maintenance', { kind: 'ride', itemDefId: 'scrambler' }),
    hire('c', 'maintenance', { kind: 'ride', itemDefId: 'scrambler' }),
  ]});
  const three = effectiveQuality(S, 'scrambler');
  Object.assign(S, { staff: [hire('z', 'maintenance', { kind: 'zone', x: 0, y: 0, radius: 900 })] });
  const zoned = effectiveQuality(S, 'scrambler');

  check('posting raises the ride\'s tolerance', one === base * 1.25, `${none} -> ${one}`);
  check('the bonus stops stacking', three === base * 1.5, `three posted -> ${three}`);
  check('a zone posting gives no durability bonus', zoned === base, `${zoned} vs base ${base}`);
}

console.log(`\n${failures} failed`);
process.exit(failures ? 1 : 0);
