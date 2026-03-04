import { World } from './ecs';
import { gameStateManager } from './gameState';
import { GuestSpawningSystem, GuestAISystem, MovementSystem, TimeSystem, StaffAISystem } from './systems';

export const ISO_OFFSET_X = 400;
export const ISO_OFFSET_Y = 100;

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

interface RenderItem {
  type: 'block' | 'guest' | 'flat';
  x: number;
  y: number;
  w?: number;
  h?: number;
  z?: number;
  color: string;
  label?: string;
  subLabel?: string;
  size?: number;
}

export class GameEngine {
  public world: World;
  public camera = { x: 0, y: 0, zoom: 1 };
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly SIMULATION_STEP = 1000 / 20; // 20 FPS for logic
  private animationFrameId: number = 0;
  private isRunning: boolean = false;
  
  public canvas: HTMLCanvasElement | null = null;
  public ctx: CanvasRenderingContext2D | null = null;

  constructor() {
    this.world = new World();
  }

  start() {
    if (this.isRunning) return;
    this.isRunning = true;
    this.lastTime = performance.now();
    this.loop(this.lastTime);
  }

  stop() {
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
    if (state.phase === 'OPERATION') {
      GuestSpawningSystem(this.world, dt);
      GuestAISystem(this.world, dt);
      StaffAISystem(this.world, dt);
      MovementSystem(this.world, dt);
      TimeSystem(this.world, dt);
    }
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

       // Draw grass base (isometric)
       drawIsoBlock(this.ctx, 0, 0, 800, 600, 20, '#4ade80');
       
       const renderItems: RenderItem[] = [];

       // Add entrance
       renderItems.push({
         type: 'flat',
         x: 350,
         y: 580,
         w: 100,
         h: 20,
         color: '#9ca3af'
       });

       // Add placed items
       for (const item of state.placedItems) {
         let color = '#fff';
         let z = 20;
         if (item.type === 'kiddie') { color = '#f87171'; z = 30; }
         else if (item.type === 'major') { color = '#fbbf24'; z = 50; }
         else if (item.type === 'spectacular') { color = '#a78bfa'; z = 80; }
         else if (item.type === 'food') { color = '#f472b6'; z = 20; }
         else if (item.type === 'bathroom') { color = '#38bdf8'; z = 20; }
         
         if (item.isBroken) {
           color = '#ef4444'; // Red when broken
         }
         
         renderItems.push({
           type: 'block',
           x: item.x,
           y: item.y,
           w: item.width,
           h: item.height,
           z: z,
           color,
           label: item.isBroken ? 'BROKEN' : item.type,
           subLabel: item.type !== 'food' && item.type !== 'bathroom' && !item.isBroken ? `${item.currentRiders}/${item.capacity}` : undefined
         });
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
