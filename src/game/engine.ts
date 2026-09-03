import { World } from './ecs';
import { gameStateManager, SIM_SPEED_MULTIPLIERS } from './gameState';
import { GuestSpawningSystem, GuestAISystem, MovementSystem, TimeSystem, StaffAISystem } from './systems';
import { spriteRegistry, SpriteAsset } from './spriteRegistry';
import { CATEGORY_DEFAULTS, ItemCategory, ITEM_DEFINITIONS, STOCK_CATEGORIES } from './items';
import { BIOME_CONFIG, SCENERY_DEFINITIONS } from './scenery';
import { GAME_CONFIG } from './constants';

export const ISO_OFFSET_X = GAME_CONFIG.ISO_OFFSET_X;
export const ISO_OFFSET_Y = GAME_CONFIG.ISO_OFFSET_Y;

export function toIso(x: number, y: number) {
  return {
    x: (x - y) + ISO_OFFSET_X,
    y: (x + y) * 0.5 + ISO_OFFSET_Y
  };
}

export function fromIso(isoX: number, isoY: number) {
  const adjX = isoX - ISO_OFFSET_X;
  const adjY = (isoY - ISO_OFFSET_Y) * 2;
  return {
    x: (adjX + adjY) / 2,
    y: (adjY - adjX) / 2
  };
}

function drawIsoBlock(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, z: number, color: string) {
  const p1 = toIso(x, y);
  const p2 = toIso(x + w, y);
  const p3 = toIso(x + w, y + h);
  const p4 = toIso(x, y + h);

  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';

  // Left face (p4 to p3)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(p4.x, p4.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p3.x, p3.y - z);
  ctx.lineTo(p4.x, p4.y - z);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.2)'; // darken
  ctx.fill();
  ctx.stroke();

  // Right face (p3 to p2)
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(p3.x, p3.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p2.x, p2.y - z);
  ctx.lineTo(p3.x, p3.y - z);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.4)'; // darken more
  ctx.fill();
  ctx.stroke();

  // Top face
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y - z);
  ctx.lineTo(p2.x, p2.y - z);
  ctx.lineTo(p3.x, p3.y - z);
  ctx.lineTo(p4.x, p4.y - z);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
}

function drawIsoFlat(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  const p1 = toIso(x, y);
  const p2 = toIso(x + w, y);
  const p3 = toIso(x + w, y + h);
  const p4 = toIso(x, y + h);

  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(p1.x, p1.y);
  ctx.lineTo(p2.x, p2.y);
  ctx.lineTo(p3.x, p3.y);
  ctx.lineTo(p4.x, p4.y);
  ctx.closePath();
  ctx.fill();
  // Set explicitly: otherwise litter picks up the last stroke colour used.
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

const SKIN_TONES = ['#f2d3b3', '#e0ac7e', '#c68642', '#8d5524', '#5c3317'];

/**
 * A person, standing on the tile their position maps to: a shadow on the
 * ground, a torso, and a head. Still primitives, but readable as a crowd in a
 * way that a flat circle is not.
 */
function drawPerson(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  color: string, size: number,
  skin: string, hat: string | null,
) {
  const p = toIso(x, y);
  const bodyH = size * 2.1;
  const headR = size * 0.62;

  ctx.fillStyle = 'rgba(0,0,0,0.22)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, size * 0.95, size * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Torso, tapered so it reads as shoulders rather than a pill
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(p.x - size * 0.62, p.y - 1);
  ctx.lineTo(p.x + size * 0.62, p.y - 1);
  ctx.lineTo(p.x + size * 0.5, p.y - bodyH * 0.62);
  ctx.lineTo(p.x - size * 0.5, p.y - bodyH * 0.62);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = skin;
  ctx.beginPath();
  ctx.arc(p.x, p.y - bodyH * 0.62 - headR * 0.75, headR, 0, Math.PI * 2);
  ctx.fill();

  if (hat) {
    ctx.fillStyle = hat;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - bodyH * 0.62 - headR * 1.5, headR * 1.25, headR * 0.45, 0, 0, Math.PI * 2);
    ctx.fill();
  }
}

/**
 * Place a sprite on the lot it occupies.
 *
 * A w x h footprint projects to a diamond (w + h) wide and half that tall, so
 * the artwork is scaled to span that width and pinned by its ground point: the
 * horizontal middle of the art, and — lacking an anchor from the editor — the
 * bottom of the art, which for an isometric object is the front corner of its
 * base, half a diamond below the footprint's centre.
 */
function drawFootprintSprite(
  ctx: CanvasRenderingContext2D,
  sprite: SpriteAsset,
  x: number, y: number, w: number, h: number,
) {
  const diamondWidth = w + h;
  const scale = sprite.bounds.w > 0 ? diamondWidth / sprite.bounds.w : 1;
  const centre = toIso(x + w / 2, y + h / 2);

  const anchorX = (sprite.anchor ? sprite.anchor.x : sprite.groundX) * scale;
  const anchorY = sprite.anchor
    ? sprite.anchor.y * scale
    : (sprite.bounds.y + sprite.bounds.h) * scale - diamondWidth / 4;

  ctx.drawImage(
    sprite.image,
    centre.x - anchorX,
    centre.y - anchorY,
    sprite.image.width * scale,
    sprite.image.height * scale,
  );
}

/** Screen-space top of a sprite once it is placed, for hanging labels off. */
function spriteTop(sprite: SpriteAsset, x: number, y: number, w: number, h: number): number {
  const diamondWidth = w + h;
  const scale = sprite.bounds.w > 0 ? diamondWidth / sprite.bounds.w : 1;
  const centre = toIso(x + w / 2, y + h / 2);
  const anchorY = sprite.anchor
    ? sprite.anchor.y * scale
    : (sprite.bounds.y + sprite.bounds.h) * scale - diamondWidth / 4;
  return centre.y - anchorY + sprite.bounds.y * scale;
}

/**
 * Colour wash for the hour: neutral through the afternoon, warming toward
 * sunset, then a cool dusk once the lamps would be on.
 */
function daylightWash(time: number): { color: string; alpha: number } | null {
  if (time <= 16.5) return null;
  if (time <= 19.5) {
    // Late afternoon into a low, warm sun.
    return { color: '#ea8c1b', alpha: ((time - 16.5) / 3) * 0.34 };
  }
  // Blue hour, deepening to closing time.
  const t = Math.min((time - 19.5) / 2.5, 1);
  return { color: '#15265e', alpha: 0.2 + t * 0.34 };
}

/** The gate guests arrive through, drawn so the entrance reads at a glance. */
function drawEntrance(ctx: CanvasRenderingContext2D, accent: string) {
  const x = GAME_CONFIG.ENTRANCE_X;
  const y = GAME_CONFIG.MAP_HEIGHT;
  const pad = toIso(x, y);

  // Apron
  ctx.fillStyle = 'rgba(63, 63, 70, 0.85)';
  ctx.beginPath();
  const corners = [toIso(x - 70, y - 60), toIso(x + 70, y - 60), toIso(x + 70, y), toIso(x - 70, y)];
  ctx.moveTo(corners[0].x, corners[0].y);
  for (const c of corners.slice(1)) ctx.lineTo(c.x, c.y);
  ctx.closePath();
  ctx.fill();

  // Posts and banner
  const postH = 54;
  for (const dx of [-60, 60]) {
    const base = toIso(x + dx, y - 30);
    ctx.fillStyle = '#7c2d12';
    ctx.fillRect(base.x - 4, base.y - postH, 8, postH);
  }
  const left = toIso(x - 60, y - 30);
  const right = toIso(x + 60, y - 30);
  ctx.fillStyle = accent;
  ctx.beginPath();
  ctx.moveTo(left.x - 6, left.y - postH);
  ctx.lineTo(right.x + 6, right.y - postH);
  ctx.lineTo(right.x + 6, right.y - postH - 20);
  ctx.lineTo(left.x - 6, left.y - postH - 20);
  ctx.closePath();
  ctx.fill();

  ctx.fillStyle = '#fffbeb';
  ctx.font = 'bold 11px ui-sans-serif, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('WAY IN', pad.x, left.y - postH - 6);
  ctx.textAlign = 'left';
}

interface RenderItem {
  type: 'block' | 'guest' | 'flat' | 'sprite';
  x: number;
  y: number;
  w?: number;
  h?: number;
  z?: number;
  color: string;
  label?: string;
  subLabel?: string;
  size?: number;
  sprite?: SpriteAsset;
  skin?: string;
  hat?: string | null;
  broken?: boolean;
}

export interface GhostPreview {
  itemDefId: string;
  x: number;
  y: number;
  valid: boolean;
}

/** Zone being positioned on the lot, following the cursor. */
export interface ZoneGhost {
  x: number;
  y: number;
  radius: number;
  role: 'maintenance' | 'sanitation';
}

/**
 * toIso is linear, so a circle on the ground projects to an axis-aligned
 * ellipse: the horizontal axis stretches by root two, the vertical one
 * shrinks by the same factor.
 */
function strokeGroundCircle(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, radius: number,
  stroke: string, fill?: string,
) {
  const c = toIso(x, y);
  ctx.beginPath();
  ctx.ellipse(c.x, c.y, radius * Math.SQRT2, radius / Math.SQRT2, 0, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  ctx.strokeStyle = stroke;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 6]);
  ctx.stroke();
  ctx.setLineDash([]);
}

/** Screen-space rectangle the whole lot occupies, before the camera moves. */
export function lotScreenBounds() {
  const corners = [
    toIso(0, 0),
    toIso(GAME_CONFIG.MAP_WIDTH, 0),
    toIso(GAME_CONFIG.MAP_WIDTH, GAME_CONFIG.MAP_HEIGHT),
    toIso(0, GAME_CONFIG.MAP_HEIGHT),
  ];
  const xs = corners.map(c => c.x);
  const ys = corners.map(c => c.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  return { minX, minY, maxX, maxY, width: maxX - minX, height: maxY - minY };
}

export class GameEngine {
  public world: World;
  public camera = { x: 0, y: 0, zoom: 1 };
  /** Canvas size in CSS pixels; the backing store is this times the pixel ratio. */
  public view = { width: 800, height: 600 };
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly SIMULATION_STEP = 1000 / 20; // 20 FPS for logic
  private animationFrameId: number = 0;
  private isRunning: boolean = false;
  /** Set while the manifest is loading, so a second start() can't race in. */
  private starting: boolean = false;

  public canvas: HTMLCanvasElement | null = null;
  public ctx: CanvasRenderingContext2D | null = null;
  public ghost: GhostPreview | null = null;
  public zoneGhost: ZoneGhost | null = null;
  /** Item under the cursor, so its label can surface without clutter elsewhere. */
  public hoveredItemId: string | null = null;
  private dpr = 1;

  constructor() {
    this.world = new World();
  }

  /** Smallest zoom that still shows the whole lot. */
  get minZoom(): number {
    const lot = lotScreenBounds();
    return Math.min(this.view.width / lot.width, this.view.height / lot.height);
  }

  /** Match the backing store to the element and the display's pixel ratio. */
  resize(cssWidth: number, cssHeight: number) {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.view = { width: cssWidth, height: cssHeight };
    const w = Math.round(cssWidth * dpr);
    const h = Math.round(cssHeight * dpr);
    if (this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas.width = w;
      this.canvas.height = h;
    }
    this.dpr = dpr;
    this.clampCamera();
  }

  /** Point the camera at the middle of the lot, zoomed out far enough to see it. */
  frameLot() {
    this.camera.zoom = this.minZoom;
    this.centreOn(GAME_CONFIG.MAP_WIDTH / 2, GAME_CONFIG.MAP_HEIGHT / 2);
  }

  centreOn(lotX: number, lotY: number) {
    const p = toIso(lotX, lotY);
    this.camera.x = this.view.width / 2 - p.x * this.camera.zoom;
    this.camera.y = this.view.height / 2 - p.y * this.camera.zoom;
    this.clampCamera();
  }

  /**
   * Keep the lot on screen: centred along any axis where it is smaller than the
   * viewport, and otherwise pinned so its edges never pull inside the frame.
   */
  clampCamera() {
    const lot = lotScreenBounds();
    const z = this.camera.zoom;
    const spanX = lot.width * z;
    const spanY = lot.height * z;

    if (spanX <= this.view.width) {
      this.camera.x = (this.view.width - spanX) / 2 - lot.minX * z;
    } else {
      const min = this.view.width - lot.maxX * z;
      const max = -lot.minX * z;
      this.camera.x = Math.min(max, Math.max(min, this.camera.x));
    }

    if (spanY <= this.view.height) {
      this.camera.y = (this.view.height - spanY) / 2 - lot.minY * z;
    } else {
      const min = this.view.height - lot.maxY * z;
      const max = -lot.minY * z;
      this.camera.y = Math.min(max, Math.max(min, this.camera.y));
    }
  }

  /** Zoom about a point given in CSS pixels within the canvas. */
  zoomAt(screenX: number, screenY: number, delta: number) {
    const next = Math.max(this.minZoom, Math.min(3, this.camera.zoom + delta));
    if (next === this.camera.zoom) return;
    this.camera.x = screenX - (screenX - this.camera.x) * (next / this.camera.zoom);
    this.camera.y = screenY - (screenY - this.camera.y) * (next / this.camera.zoom);
    this.camera.zoom = next;
    this.clampCamera();
  }

  panBy(dx: number, dy: number) {
    this.camera.x += dx;
    this.camera.y += dy;
    this.clampCamera();
  }

  async start() {
    // React StrictMode mounts, unmounts and remounts in development. Without
    // the `starting` guard both mounts get past the isRunning check while the
    // manifest is still loading and the simulation runs at double speed.
    if (this.isRunning || this.starting) return;
    this.starting = true;
    await spriteRegistry.load();
    if (!this.starting) return; // stop() was called while loading
    this.starting = false;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
    this.starting = false;
    this.isRunning = false;
    cancelAnimationFrame(this.animationFrameId);
  }

  private loop = (currentTime: number) => {
    if (!this.isRunning) return;

    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;
    this.accumulator += deltaTime;

    while (this.accumulator >= this.SIMULATION_STEP) {
      this.update(this.SIMULATION_STEP / 1000); // pass dt in seconds
      this.accumulator -= this.SIMULATION_STEP;
    }

    this.render();

    this.animationFrameId = requestAnimationFrame(this.loop);
  };

  private update(dt: number) {
    const state = gameStateManager.state;
    if (state.phase !== 'OPERATION') return;

    // Scale the timestep once, here, so every system below advances by the
    // same amount of simulated time.
    const step = dt * (SIM_SPEED_MULTIPLIERS[state.simSpeed] ?? 1);

    GuestSpawningSystem(this.world, step);
    GuestAISystem(this.world, step);
    StaffAISystem(this.world, step);
    MovementSystem(this.world, step);
    TimeSystem(this.world, step);
  }

  private render() {
    if (!this.ctx || !this.canvas) return;
    
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.clearRect(0, 0, this.view.width, this.view.height);

    const state = gameStateManager.state;
    if (state.phase === 'SETUP' || state.phase === 'OPERATION' || state.phase === 'TEARDOWN') {
       
       // Draw title (fixed to screen)
       if (state.currentLocation) {
         this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
         this.ctx.font = 'bold 48px serif';
         this.ctx.textAlign = 'center';
         this.ctx.fillText(state.currentLocation.name, this.view.width / 2, 60);
         this.ctx.textAlign = 'left'; // reset
       }

       this.ctx.save();
       this.ctx.translate(this.camera.x, this.camera.y);
       this.ctx.scale(this.camera.zoom, this.camera.zoom);

       // Draw base ground with biome-aware color
       const biome = state.currentLocation?.biome ?? 'meadow';
       const biomeColors = BIOME_CONFIG[biome];
       drawIsoBlock(this.ctx, 0, 0, GAME_CONFIG.MAP_WIDTH, GAME_CONFIG.MAP_HEIGHT, 20, biomeColors.groundColor);

       // A worn path from the gate up the middle of the lot, so the crowd has
       // somewhere to arrive from.
       this.ctx.save();
       this.ctx.beginPath();
       const pathEdge = [
         toIso(GAME_CONFIG.ENTRANCE_X - 95, GAME_CONFIG.MAP_HEIGHT),
         toIso(GAME_CONFIG.ENTRANCE_X + 95, GAME_CONFIG.MAP_HEIGHT),
         toIso(GAME_CONFIG.ENTRANCE_X + 55, GAME_CONFIG.MAP_HEIGHT * 0.78),
         toIso(GAME_CONFIG.ENTRANCE_X - 55, GAME_CONFIG.MAP_HEIGHT * 0.78),
       ];
       this.ctx.moveTo(pathEdge[0].x, pathEdge[0].y);
       for (const c of pathEdge.slice(1)) this.ctx.lineTo(c.x, c.y);
       this.ctx.closePath();
       this.ctx.fillStyle = biomeColors.accentColor;
       this.ctx.globalAlpha = 0.22;
       this.ctx.fill();
       this.ctx.restore();

       drawEntrance(this.ctx, biomeColors.entranceColor);

       // Staff patches, painted on the ground before anything stands on it.
       for (const member of state.staff) {
         if (member.assignment.kind !== 'zone') continue;
         const focused = state.selectedStaffId === member.id;
         const hue = member.role === 'maintenance' ? '249, 115, 22' : '203, 213, 225';
         strokeGroundCircle(
           this.ctx,
           member.assignment.x, member.assignment.y, member.assignment.radius,
           `rgba(${hue}, ${focused ? 0.95 : 0.35})`,
           focused ? `rgba(${hue}, 0.10)` : undefined,
         );
       }

       if (this.zoneGhost) {
         const hue = this.zoneGhost.role === 'maintenance' ? '249, 115, 22' : '203, 213, 225';
         strokeGroundCircle(
           this.ctx,
           this.zoneGhost.x, this.zoneGhost.y, this.zoneGhost.radius,
           `rgba(${hue}, 0.9)`, `rgba(${hue}, 0.12)`,
         );
       }

       const renderItems: RenderItem[] = [];
       /** Labels are drawn after the world, unscaled, so text stays crisp. */
       const labels: { x: number; y: number; title: string; note?: string; tone: 'normal' | 'alert' }[] = [];

       // Add scenery items
       for (const scenery of state.sceneryItems) {
         const def = SCENERY_DEFINITIONS[scenery.defId];
         if (!def) continue;

         const sprite = spriteRegistry.get(scenery.defId, 'base_idle');
         if (sprite) {
           renderItems.push({
             type: 'sprite',
             x: scenery.x,
             y: scenery.y,
             w: scenery.width,
             h: scenery.height,
             color: '',
             sprite,
           });
         } else {
           renderItems.push({
             type: 'block',
             x: scenery.x,
             y: scenery.y,
             w: scenery.width,
             h: scenery.height,
             z: def.z,
             color: def.color,
           });
         }
       }

       // Add placed items
       for (const item of state.placedItems) {
         // Prefer the state-specific frame, then the idle one, by item id and
         // then by category. A missing broken_state must not cost us the artwork.
         const slot = item.isBroken ? 'broken_state' : 'base_idle';
         const sprite =
           spriteRegistry.get(item.itemDefId, slot) ||
           spriteRegistry.get(item.type, slot) ||
           spriteRegistry.get(item.itemDefId, 'base_idle') ||
           spriteRegistry.get(item.type, 'base_idle');

         if (sprite) {
           renderItems.push({
             type: 'sprite',
             x: item.x,
             y: item.y,
             w: item.width,
             h: item.height,
             color: '',
             sprite,
             broken: item.isBroken,
           });
         } else {
           // Fallback to primitive colored blocks
           const catDefaults = CATEGORY_DEFAULTS[item.type as ItemCategory];
           let color = catDefaults?.color ?? '#fff';
           let z = catDefaults?.z ?? 20;

           if (item.isBroken) {
             color = '#ef4444';
           }

           renderItems.push({
             type: 'block',
             x: item.x,
             y: item.y,
             w: item.width,
             h: item.height,
             z: z,
             color,
           });
         }

         // Say something when it matters: always for trouble, otherwise on
         // hover, on selection, or once the player has zoomed in far enough.
         const busy = item.capacity > 0
           ? `${item.currentRiders}/${item.capacity}${item.queue.length > 0 ? `  +${item.queue.length} waiting` : ''}`
           : undefined;
         const soldOut = STOCK_CATEGORIES.includes(item.type as ItemCategory) && item.stock <= 0;
         const focused = this.hoveredItemId === item.id || state.selectedItemId === item.id;

         if (item.isBroken || soldOut || focused || this.camera.zoom >= 1.2) {
           const top = sprite
             ? spriteTop(sprite, item.x, item.y, item.width, item.height)
             : toIso(item.x + item.width / 2, item.y + item.height / 2).y - (CATEGORY_DEFAULTS[item.type as ItemCategory]?.z ?? 20);
           labels.push({
             x: toIso(item.x + item.width / 2, item.y + item.height / 2).x,
             y: top,
             title: item.isBroken ? 'Broken down' : soldOut ? 'Sold out' : (ITEM_DEFINITIONS[item.itemDefId]?.name ?? item.type),
             note: item.isBroken || soldOut ? (ITEM_DEFINITIONS[item.itemDefId]?.name ?? item.type) : busy,
             tone: item.isBroken || soldOut ? 'alert' : 'normal',
           });
         }
       }

       // Add guests, staff, and trash
       const renderables = this.world.getEntitiesWith(['Position', 'Renderable']);
       for (const entity of renderables) {
         const pos = this.world.getComponent(entity, 'Position')!;
         const ren = this.world.getComponent(entity, 'Renderable')!;
         
         if (ren.type === 'trash') {
           renderItems.push({
             type: 'flat',
             x: pos.x - ren.size * 0.6,
             y: pos.y - ren.size * 0.6,
             w: ren.size * 1.2,
             h: ren.size * 1.2,
             color: 'rgba(68, 64, 60, 0.55)',
           });
         } else {
           const isStaff = ren.type === 'staff';
           renderItems.push({
             type: 'guest',
             x: pos.x,
             y: pos.y,
             color: ren.color,
             size: isStaff ? ren.size * 1.15 : ren.size,
             skin: SKIN_TONES[entity % SKIN_TONES.length],
             // Staff wear a cap so they read apart from the crowd.
             hat: isStaff ? (ren.color === '#f97316' ? '#7c2d12' : '#334155') : null,
           });
         }
       }

       // Sort by depth
       renderItems.sort((a, b) => {
         const depthA = a.x + a.y + (a.w ? a.w * 0.5 : 0) + (a.h ? a.h * 0.5 : 0);
         const depthB = b.x + b.y + (b.w ? b.w * 0.5 : 0) + (b.h ? b.h * 0.5 : 0);
         return depthA - depthB;
       });

       // Draw items
       for (const item of renderItems) {
         if (item.type === 'flat') {
           drawIsoFlat(this.ctx, item.x, item.y, item.w!, item.h!, item.color);
         } else if (item.type === 'sprite') {
           if (item.broken) {
             // Mark the ground rather than swapping the ride for a red box:
             // the player still needs to recognise what has stopped working.
             drawIsoFlat(this.ctx, item.x, item.y, item.w!, item.h!, 'rgba(220, 38, 38, 0.55)');
           }
           drawFootprintSprite(this.ctx, item.sprite!, item.x, item.y, item.w!, item.h!);
         } else if (item.type === 'block') {
           drawIsoBlock(this.ctx, item.x, item.y, item.w!, item.h!, item.z!, item.color);

           // Draw labels on top face
           if (item.label) {
             const topCenter = toIso(item.x + item.w! / 2, item.y + item.h! / 2);
             this.ctx.fillStyle = '#000';
             this.ctx.font = '10px sans-serif';
             this.ctx.textAlign = 'center';
             this.ctx.fillText(item.label.toUpperCase(), topCenter.x, topCenter.y - item.z! - 5);
             if (item.subLabel) {
               this.ctx.fillText(item.subLabel, topCenter.x, topCenter.y - item.z! + 5);
             }
             this.ctx.textAlign = 'left';
           }
         } else if (item.type === 'guest') {
           drawPerson(this.ctx, item.x, item.y, item.color, item.size!, item.skin ?? SKIN_TONES[0], item.hat ?? null);
         }
       }

       // Draw ghost preview for building placement
       if (this.ghost && state.phase === 'SETUP') {
         const def = ITEM_DEFINITIONS[this.ghost.itemDefId];
         if (def) {
           const gx = this.ghost.x - def.width / 2;
           const gy = this.ghost.y - def.height / 2;
           this.ctx.globalAlpha = 0.4;

           const slot = 'base_idle';
           const sprite = spriteRegistry.get(this.ghost.itemDefId, slot) || spriteRegistry.get(def.category, slot);
           if (sprite) {
             drawFootprintSprite(this.ctx, sprite, gx, gy, def.width, def.height);
           } else {
             const catDefaults = CATEGORY_DEFAULTS[def.category as ItemCategory];
             const color = catDefaults?.color ?? '#fff';
             const z = catDefaults?.z ?? 20;
             drawIsoBlock(this.ctx, gx, gy, def.width, def.height, z, color);
           }

           this.ctx.globalAlpha = 1.0;

           // Outline the footprint: red means the piece won't fit here.
           const c1 = toIso(gx, gy);
           const c2 = toIso(gx + def.width, gy);
           const c3 = toIso(gx + def.width, gy + def.height);
           const c4 = toIso(gx, gy + def.height);
           this.ctx.strokeStyle = this.ghost.valid ? 'rgba(52, 211, 153, 0.9)' : 'rgba(239, 68, 68, 0.95)';
           this.ctx.lineWidth = 2;
           this.ctx.beginPath();
           this.ctx.moveTo(c1.x, c1.y);
           this.ctx.lineTo(c2.x, c2.y);
           this.ctx.lineTo(c3.x, c3.y);
           this.ctx.lineTo(c4.x, c4.y);
           this.ctx.closePath();
           this.ctx.stroke();
           if (!this.ghost.valid) {
             this.ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
             this.ctx.fill();
           }
         }
       }

       // Draw selection highlight for guest
       if (state.selectedGuestId !== null && this.world.entities.has(state.selectedGuestId)) {
         const pos = this.world.getComponent(state.selectedGuestId, 'Position');
         const ren = this.world.getComponent(state.selectedGuestId, 'Renderable');
         if (pos && ren) {
           const p = toIso(pos.x, pos.y);
           this.ctx.strokeStyle = '#fbbf24';
           this.ctx.lineWidth = 2;
           this.ctx.beginPath();
           this.ctx.ellipse(p.x, p.y, ren.size * 2, ren.size, 0, 0, Math.PI * 2);
           this.ctx.stroke();
         }
       }

       // Show which attraction the highlighted mechanic is posted to
       if (state.selectedStaffId !== null) {
         const member = state.staff.find(s => s.id === state.selectedStaffId);
         if (member && member.assignment.kind === 'ride') {
           const defId = member.assignment.itemDefId;
           for (const item of state.placedItems) {
             if (item.itemDefId !== defId) continue;
             const q1 = toIso(item.x, item.y);
             const q2 = toIso(item.x + item.width, item.y);
             const q3 = toIso(item.x + item.width, item.y + item.height);
             const q4 = toIso(item.x, item.y + item.height);
             this.ctx.strokeStyle = 'rgba(249, 115, 22, 0.95)';
             this.ctx.lineWidth = 3;
             this.ctx.beginPath();
             this.ctx.moveTo(q1.x, q1.y);
             this.ctx.lineTo(q2.x, q2.y);
             this.ctx.lineTo(q3.x, q3.y);
             this.ctx.lineTo(q4.x, q4.y);
             this.ctx.closePath();
             this.ctx.stroke();
           }
         }
       }

       // Draw selection highlight for item
       if (state.selectedItemId !== null) {
         const item = state.placedItems.find(i => i.id === state.selectedItemId);
         if (item) {
           const p1 = toIso(item.x, item.y);
           const p2 = toIso(item.x + item.width, item.y);
           const p3 = toIso(item.x + item.width, item.y + item.height);
           const p4 = toIso(item.x, item.y + item.height);
           
           this.ctx.strokeStyle = '#fbbf24';
           this.ctx.lineWidth = 3;
           this.ctx.beginPath();
           this.ctx.moveTo(p1.x, p1.y);
           this.ctx.lineTo(p2.x, p2.y);
           this.ctx.lineTo(p3.x, p3.y);
           this.ctx.lineTo(p4.x, p4.y);
           this.ctx.closePath();
           this.ctx.stroke();
         }
       }

       this.ctx.restore();

       // Evening light, painted over the lot but under the interface.
       const wash = daylightWash(state.time);
       if (wash) {
         this.ctx.save();
         this.ctx.globalAlpha = wash.alpha;
         this.ctx.fillStyle = wash.color;
         this.ctx.fillRect(0, 0, this.view.width, this.view.height);
         this.ctx.restore();
       }

       // Labels last, in screen space: constant size at any zoom.
       this.ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
       this.ctx.textAlign = 'center';
       this.ctx.textBaseline = 'alphabetic';
       for (const label of labels) {
         const sx = label.x * this.camera.zoom + this.camera.x;
         const sy = label.y * this.camera.zoom + this.camera.y;
         if (sx < -120 || sx > this.view.width + 120 || sy < -40 || sy > this.view.height + 40) continue;

         const titleW = this.ctx.measureText(label.title).width;
         this.ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
         const noteW = label.note ? this.ctx.measureText(label.note).width : 0;
         this.ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';

         const padX = 7;
         const boxW = Math.max(titleW, noteW) + padX * 2;
         const boxH = label.note ? 30 : 19;
         const boxX = sx - boxW / 2;
         const boxY = sy - boxH - 8;

         this.ctx.fillStyle = label.tone === 'alert' ? 'rgba(127, 29, 29, 0.92)' : 'rgba(24, 24, 27, 0.82)';
         this.ctx.beginPath();
         this.ctx.roundRect(boxX, boxY, boxW, boxH, 5);
         this.ctx.fill();
         this.ctx.strokeStyle = label.tone === 'alert' ? 'rgba(248, 113, 113, 0.9)' : 'rgba(255,255,255,0.14)';
         this.ctx.lineWidth = 1;
         this.ctx.stroke();

         this.ctx.fillStyle = label.tone === 'alert' ? '#fecaca' : '#f4f4f5';
         this.ctx.fillText(label.title, sx, boxY + 13);
         if (label.note) {
           this.ctx.font = '500 10px ui-sans-serif, system-ui, sans-serif';
           this.ctx.fillStyle = label.tone === 'alert' ? '#fca5a5' : '#a1a1aa';
           this.ctx.fillText(label.note, sx, boxY + 25);
           this.ctx.font = '600 12px ui-sans-serif, system-ui, sans-serif';
         }
       }
       this.ctx.textAlign = 'left';
    }
  }
}

export const engine = new GameEngine();
