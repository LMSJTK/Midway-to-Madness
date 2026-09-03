import { World } from './ecs';
import { gameStateManager, SIM_SPEED_MULTIPLIERS } from './gameState';
import { GuestSpawningSystem, GuestAISystem, MovementSystem, TimeSystem, StaffAISystem } from './systems';
import { spriteRegistry } from './spriteRegistry';
import { CATEGORY_DEFAULTS, ItemCategory, ITEM_DEFINITIONS } from './items';
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
  ctx.stroke();
}

function drawIsoGuest(ctx: CanvasRenderingContext2D, x: number, y: number, color: string, size: number) {
  const p = toIso(x, y);
  
  // Shadow
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath();
  ctx.ellipse(p.x, p.y, size, size * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();

  // Body
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(p.x, p.y - size, size, 0, Math.PI * 2);
  ctx.fill();
  
  ctx.lineWidth = 1;
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.stroke();
}

function drawSpriteIso(ctx: CanvasRenderingContext2D, image: HTMLImageElement,
                       x: number, y: number, anchor: { x: number; y: number }) {
  const p = toIso(x, y);
  ctx.drawImage(image, p.x - anchor.x, p.y - anchor.y);
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
  spriteImage?: HTMLImageElement;
  spriteAnchor?: { x: number; y: number };
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

export class GameEngine {
  public world: World;
  public camera = { x: 0, y: 0, zoom: 1 };
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

  constructor() {
    this.world = new World();
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
    
    // Clear screen
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    const state = gameStateManager.state;
    if (state.phase === 'SETUP' || state.phase === 'OPERATION' || state.phase === 'TEARDOWN') {
       
       // Draw title (fixed to screen)
       if (state.currentLocation) {
         this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
         this.ctx.font = 'bold 48px serif';
         this.ctx.textAlign = 'center';
         this.ctx.fillText(state.currentLocation.name, this.canvas.width / 2, 60);
         this.ctx.textAlign = 'left'; // reset
       }

       this.ctx.save();
       this.ctx.translate(this.camera.x, this.camera.y);
       this.ctx.scale(this.camera.zoom, this.camera.zoom);

       // Draw base ground with biome-aware color
       const biome = state.currentLocation?.biome ?? 'meadow';
       const biomeColors = BIOME_CONFIG[biome];
       drawIsoBlock(this.ctx, 0, 0, GAME_CONFIG.MAP_WIDTH, GAME_CONFIG.MAP_HEIGHT, 20, biomeColors.groundColor);

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

       // Add entrance
       renderItems.push({
         type: 'flat',
         x: GAME_CONFIG.ENTRANCE_X - 50,
         y: GAME_CONFIG.MAP_HEIGHT - 20,
         w: 100,
         h: 20,
         color: biomeColors.entranceColor
       });

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
             spriteImage: sprite.image,
             spriteAnchor: sprite.anchor,
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
         const slot = item.isBroken ? 'broken_state' : 'base_idle';
         // Look up sprite by specific item definition ID first, then fall back to category
         const sprite = spriteRegistry.get(item.itemDefId, slot) || spriteRegistry.get(item.type, slot);

         if (sprite) {
           renderItems.push({
             type: 'sprite',
             x: item.x,
             y: item.y,
             w: item.width,
             h: item.height,
             color: '',
             spriteImage: sprite.image,
             spriteAnchor: sprite.anchor,
             label: item.isBroken ? 'BROKEN' : undefined,
             subLabel: item.capacity > 0 && !item.isBroken ? `${item.currentRiders}/${item.capacity}${item.queue.length > 0 ? ` +${item.queue.length}Q` : ''}` : undefined
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
             label: item.isBroken ? 'BROKEN' : (ITEM_DEFINITIONS[item.itemDefId]?.name ?? item.type),
             subLabel: item.capacity > 0 && !item.isBroken ? `${item.currentRiders}/${item.capacity}${item.queue.length > 0 ? ` +${item.queue.length}Q` : ''}` : undefined
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
             x: pos.x - ren.size,
             y: pos.y - ren.size,
             w: ren.size * 2,
             h: ren.size * 2,
             color: ren.color
           });
         } else {
           renderItems.push({
             type: 'guest',
             x: pos.x,
             y: pos.y,
             color: ren.color,
             size: ren.size
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
           drawSpriteIso(this.ctx, item.spriteImage!, item.x, item.y, item.spriteAnchor!);

           // Draw labels above sprite
           if (item.label || item.subLabel) {
             const topCenter = toIso(item.x + item.w! / 2, item.y + item.h! / 2);
             this.ctx.fillStyle = '#000';
             this.ctx.font = '10px sans-serif';
             this.ctx.textAlign = 'center';
             if (item.label) {
               this.ctx.fillText(item.label.toUpperCase(), topCenter.x, topCenter.y - (item.spriteImage!.height / 2) - 5);
             }
             if (item.subLabel) {
               this.ctx.fillText(item.subLabel, topCenter.x, topCenter.y - (item.spriteImage!.height / 2) + 5);
             }
             this.ctx.textAlign = 'left';
           }
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
           drawIsoGuest(this.ctx, item.x, item.y, item.color, item.size!);
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
             drawSpriteIso(this.ctx, sprite.image, gx, gy, sprite.anchor);
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
    }
  }
}

export const engine = new GameEngine();
