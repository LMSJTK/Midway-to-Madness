# Asset Engine Roadmap ("Complex Engine"-style) for Midway to Madness

## Short answer

Building your own internal asset engine is highly viable and an excellent fit for this project. The key is treating it as a **pipeline product** that handles the entire lifecycle:
1. generate,
2. refine (isometric alignment),
3. validate (style + gameplay readability),
4. version,
5. pack (atlas),
6. bind to gameplay entities.

Your current rendering pipeline in `engine.ts` relies on primitive drawing functions (`drawIsoBlock`, `drawIsoFlat`, `drawIsoGuest`). The asset engine serves as the bridge to replace those primitives with rich, AI-generated sprites while preserving your strict isometric math (`toIso`/`fromIso`) and depth-sorting logic.

---

## Recommended high-level architecture

### 1) Asset Workspace (Editor App)

A dedicated editor UI — either a hidden route in your existing React app (e.g., `/editor`) or a standalone Vite build — where you can:

- **Prompt generation** — leveraging the `@google/genai` SDK (already installed) and potentially other APIs for image synthesis.
- **Inpainting/outpainting** — mask a region + re-prompt to fix AI artifacts directly in the browser.
- **Manual touch-up** — paint/erase tools for quick fixes.
- **Isometric footprint definition** — declare the logical grid size (e.g., 1x1 tile, 2x2 tile) mapped to your `TILE_WIDTH: 40` / `TILE_HEIGHT: 20` grid in `constants.ts`.
- **Anchor point setter** — click on the generated image to define the true bottom-center of the isometric sprite, the point that aligns with `toIso(x, y)` at render time.
- **Metadata + gameplay bindings** — associate the asset with an entity type, define colliders, set state variants.

### 2) Asset Pipeline Service

Background operations for the heavy lifting:

- **Background removal** — crucial for isolating sprites from generated images. Either via an API or a lightweight Python microservice.
- **Isometric slicing** — handling tall rides (like `spectacular` at 100x100 / z=80) that may need to be split or properly layered to avoid z-fighting in the `renderItems.sort` loop.
- **Atlas packing** — combining individual sprites into sprite sheets to keep canvas rendering fast.
- **Format conversion** — resizing, cropping, palette normalization via `sharp`.
- **Manifest generation** — exporting `asset_manifest.json` that the game's ECS can consume at runtime.
- **Validation checks** — size budgets, alpha fringe detection, palette drift, missing anchors.

### 3) Asset Registry + Versioning

A local SQLite database (via `better-sqlite3`, already in `package.json`) tracking:

| Field | Purpose |
|-------|---------|
| `asset_id` | Permanent identity (e.g., `spectacular_ferris_wheel_01`) |
| `revision` | Integer or hash (`r12`) — immutable ID, mutable versions |
| `variant` | Style/tier (`default`, `night`, `damaged`, `broken`) |
| `source` | Prompts, seeds, model parameters used for generation |
| `state` | `draft` → `review` → `approved` → `deprecated` |
| `game_bindings` | Which entity in `items.ts` uses this asset |
| `exported_hash` | Hash of compiled artifact for cache invalidation |

### 4) Runtime Asset Loader

The runtime game consumes **compiled outputs only**:

- Packed sprite atlases (PNG sheets).
- JSON metadata manifests (containing x/y offsets, widths, heights, anchor points).
- Animation definitions (frame sets + timing).

The `Renderable` component in `ecs.ts` will evolve from its current shape:
```typescript
// Current
interface Renderable { type: 'guest' | 'ride' | 'stall' | 'staff' | 'trash'; color: string; size: number; }

// Future
interface Renderable { type: string; spriteId: string; atlasRef: string; frame: number; color?: string; size?: number; }
```

Never load editor-only source data in runtime builds.

---

## Core concepts to define early

### A. Isometric art constraints (the most important step)

Machine-checkable constraints must be defined before bulk generation to prevent a chaotic art style:

- **Target resolution grid:** Your base tile is currently `TILE_WIDTH: 40`, `TILE_HEIGHT: 20` in `constants.ts`. Define sprite canvas sizes as multiples of this (e.g., a 1x1 stall = 80x80px sprite, a 2x2 ride = 160x160px).
- **Camera angle:** Standardize all prompts to enforce your specific dimetric projection. Your `toIso` formula uses `(x - y, (x + y) * 0.5)` — this is a true 2:1 isometric projection. All AI prompts must specify this exact viewing angle.
- **Lighting direction:** Enforce a universal light source (e.g., "top-left lighting") in all prompts so shadows align across the entire park. Your current `drawIsoBlock` already implies top-left lighting via its face darkening pattern (left face: `rgba(0,0,0,0.2)`, right face: `rgba(0,0,0,0.4)`).
- **Color palette strategy:** Post-process AI outputs to map them to a constrained carnival palette. Consider extracting a master palette from your existing item colors (`#fcd34d` kiddie, `#ef4444` major, `#a855f7` spectacular, `#10b981` food, `#3b82f6` bathroom) and using it as a tonal anchor.
- **Outline and contrast rules:** Define minimum contrast ratios for gameplay readability at your 800x600 canvas size with zoom.

To ensure strict isometric consistency beyond prompt engineering alone, consider setting up a ControlNet pipeline (for Stable Diffusion) or fine-tuning on your base tile grid. Zero-shot prompting alone will produce inconsistent projection angles — a reference-guided approach yields far more reliable results.

### B. Asset identity model

Use immutable IDs and mutable versions:
- `asset_id`: permanent identity (`park_bench_01`),
- `revision`: integer or hash (`r12`),
- `variant`: style/tier (`default`, `night`, `damaged`).

This prevents broken references when artwork iterates.

### C. Data schema (minimal v1)

For each asset record:

```typescript
interface AssetRecord {
  id: string;                    // "food_stall_hotdog_01"
  name: string;                  // "Hot Dog Stand"
  category: 'ride' | 'stall' | 'guest' | 'staff' | 'trash' | 'prop' | 'terrain' | 'ui';
  tags: string[];                // ["food", "carnival", "small"]

  source: {
    prompt: string;              // generation prompt
    negativePrompt?: string;
    model: string;               // model name/version
    seed?: number;
    cfg?: number;
    steps?: number;
    referenceImages?: string[];  // paths to reference inputs
    timestamp: string;           // ISO 8601
  };

  processing: {
    trim: boolean;
    scale: { width: number; height: number };
    palette?: string[];          // constrained color set
    compression: 'png' | 'webp';
  };

  grid_footprint: { x: number; y: number };  // e.g., { x: 2, y: 2 } for a 2x2 ride
  anchor_offset: { px: number; py: number };  // pixel offset to align sprite base with toIso()

  collision?: { type: 'box' | 'polygon'; points?: [number, number][] };

  animation?: {
    frames: string[];            // frame image paths or atlas coords
    fps: number;
    loop: boolean;
  };

  bindings: {
    entityType: string;          // maps to key in ITEM_DEFINITIONS
    slot: string;                // "base_idle", "base_active", "broken_state", "icon_small"
  }[];

  license: {
    model: string;               // "gemini-2.0-flash" etc.
    provenance: string;          // "AI-generated" | "human-created" | "mixed"
  };
}
```

### D. Entity binding via asset slots

Use indirection — entities reference **asset slots**, not raw files:

```typescript
// Example: a ride definition references slots, not images
const RIDE_SLOTS = {
  spectacular: ['base_idle', 'base_active', 'broken_state', 'icon_small'],
  major:       ['base_idle', 'base_active', 'broken_state', 'icon_small'],
  kiddie:      ['base_idle', 'base_active', 'broken_state', 'icon_small'],
  food:        ['base_idle', 'icon_small'],
  bathroom:    ['base_idle', 'base_dirty', 'icon_small'],
};
```

The registry resolves `slot → approved asset revision` at build time. Benefits:
- Swap art without code edits.
- Seasonal/location variants become straightforward.
- Rollback is safe — just point back to a previous revision.

---

## Practical phased plan

### Phase 0 — Spec first (1-2 weeks)

**Deliverables:**

- **Style guide v1** — lock in the exact prompt structure to consistently generate isometric assets at your 2:1 projection angle.
- **Asset taxonomy** — categorize everything: rides (kiddie/major/spectacular), stalls (food/bathroom), guests, staff, trash, terrain decals, UI icons.
- **JSON schema** for the asset manifest (see data schema above).
- **Directory + naming conventions** — e.g., `assets/sprites/{category}/{id}/r{revision}.png`.
- **Proof-of-concept `drawSpriteIso`** — add a new function to `engine.ts` that renders a static `Image` at the correct iso position using `ISO_OFFSET_X`/`ISO_OFFSET_Y` and the depth-sort key `x + y + (w * 0.5) + (h * 0.5)`. This validates the rendering contract before building the full editor.
- **Export contract** — define what the runtime loader expects (atlas path, manifest JSON structure, anchor format).

### Phase 1 — MVP "Complex Engine" (2-4 weeks)

Build only what unblocks production:

- **React dashboard** — a basic editor UI hitting a local Node/Express backend. Can live at `/editor` route in your existing Vite app.
- **Prompt-to-image generation panel** — using the `@google/genai` SDK to generate candidate images. Include prompt template enforcement (isometric angle, top-left lighting, carnival style, transparent background).
- **Basic background removal** — either via an API or a lightweight Python microservice using `rembg` or similar.
- **Visual anchor-point setter** — click on the generated image to define the "floor" of the object. The click coordinates become the `anchor_offset` that aligns the sprite with `toIso(x, y)`.
- **Metadata form** — fill in category, grid footprint, tags, entity binding.
- **Revision history** — store each generation/edit as a new revision in SQLite.
- **Export button** — dumps an image and a JSON definition into `/public/assets/` folder + updates `asset_manifest.json`.

Keep scope strict: no atlas packing, no advanced node graph, no animation frames yet.

### Phase 2 — Production hardening (3-6 weeks)

Add:

- **Atlas packing** — bundle multiple sprites into single sprite sheets via `sharp`. Emit atlas coordinates in the manifest.
- **Entity binding browser** — a UI to link `food_stall_hotdog` to the food item definition in `items.ts`, or `spectacular_ferris_wheel` to the spectacular ride type.
- **Mask-based reprompting (inpainting)** — draw a mask directly in the editor UI, re-prompt just that region to fix weird AI artifacts.
- **Z-depth validation** — ensure tall assets (spectacular rides with z=80) overlap correctly in the `renderItems.sort` loop. Visual preview showing the sprite in context of neighboring items.
- **Validation suite** — automated checks for: size budget, alpha fringe, palette drift from master palette, missing anchors, missing required slots.
- **Batch operations** — generate 5 variants of a stall, auto-tag, bulk approve.
- **Dependency graph** — "what breaks if this asset is changed?" based on binding references.

### Phase 3 — Power features

Then consider:

- **Procedural variants** — generate 5 types of trash automatically, 3 color variants of each stall.
- **Ride animation frame generation** — prompt the AI for "active state" vs "idle state" frames. Use consistent seed + slight prompt variation.
- **LOD scaling** — generate lower-resolution variants for zoomed-out camera views.
- **Style transfer consistency tools** — ControlNet or img2img passes to unify the look of assets generated across different sessions.
- **Collaborative review workflow** — if you bring on other contributors.
- **Platform-specific compression presets** — WebP for web, PNG for dev.

---

## Suggested technical stack

Aligned with your current Vite/React codebase:

| Layer | Technology | Notes |
|-------|-----------|-------|
| **Editor UI** | React + TypeScript + Tailwind | Reuse your existing app patterns, same Vite build |
| **Backend API** | Node/Express | Already in `package.json` |
| **Database** | `better-sqlite3` | Already in `package.json`. Move to Postgres only if multi-user |
| **AI generation** | `@google/genai` | Already installed (`^1.29.0`). Gemini for prompt-based generation |
| **Image processing** | `sharp` | Add to dependencies. Resize, crop, atlas pack, format convert |
| **Background removal** | Python microservice (`rembg`) or API | Isolate sprites from generated backgrounds |
| **Schema validation** | Zod or JSON Schema | Validate manifest entries at build time |
| **File storage** | Local folder (`/public/assets/`) | Object storage later if needed |
| **Packaging** | Deterministic build script | Emits `asset_manifest.json` + atlas PNGs to `/dist` |

---

## The AI workflow: avoiding chaos

For each generated base image, enforce this pipeline:

### 1. Generate
- Save the full provenance: model name/version, positive prompt, negative prompt, seed, CFG/steps/sampler, generation timestamp.
- Use prompt templates that enforce your isometric constraints: *"Isometric 2:1 projection, top-left lighting, carnival/fairground style, transparent background, pixel-art-adjacent, [object description]"*.

### 2. Isolate
- Remove background. This is non-negotiable — every sprite must be on transparency.
- Check for alpha fringe artifacts and clean edges.

### 3. Align
- The user manually places the anchor point at the base of the isometric tile.
- The tool overlays your actual iso grid (using `TILE_WIDTH`/`TILE_HEIGHT`) so the user can verify alignment visually.
- Validate that the sprite dimensions match the declared `grid_footprint`.

### 4. Gate
Before marking as `approved`, enforce:
1. Visual quality pass (no obvious AI artifacts).
2. Style consistency pass (palette within tolerance, lighting direction correct).
3. Gameplay readability pass (identifiable at game zoom level on 800x600 canvas).
4. Metadata completeness pass (all required fields filled, bindings set).

### 5. Export
Only `approved` assets get compiled into the runtime manifest and atlas.

---

## Integration with the existing renderer

The transition from primitives to sprites happens in `engine.ts`'s render loop. Currently (lines 215-239), placed items are drawn like this:

```typescript
// Current: color-coded isometric blocks
if (item.type === 'kiddie') { color = '#f87171'; z = 30; }
drawIsoBlock(ctx, item.x, item.y, item.w, item.h, z, color);
```

The asset engine introduces a new path:

```typescript
// Future: sprite-based rendering with fallback
function drawSpriteIso(ctx: CanvasRenderingContext2D, sprite: HTMLImageElement,
                        x: number, y: number, anchor: { px: number; py: number }) {
  const p = toIso(x, y);
  ctx.drawImage(sprite, p.x - anchor.px, p.y - anchor.py);
}

// In the render loop:
const asset = assetRegistry.resolve(item.type, item.isBroken ? 'broken_state' : 'base_idle');
if (asset) {
  drawSpriteIso(ctx, asset.image, item.x, item.y, asset.anchor);
} else {
  drawIsoBlock(ctx, item.x, item.y, item.w, item.h, z, color); // fallback to primitives
}
```

This fallback approach means you can adopt sprites incrementally — one item type at a time — without breaking the game.

---

## Risks and mitigations

| Risk | Mitigation |
|------|-----------|
| **Style drift from AI outputs** | Strong style guide + approval gate + palette/contrast checks. Consider ControlNet for projection consistency. |
| **Isometric projection inconsistency** | Reference-guided generation (ControlNet or fine-tuning on your tile grid) rather than zero-shot prompting alone. |
| **Untraceable legal provenance** | Store full source/model/prompt metadata and provenance fields for every asset. |
| **Content explosion** | Strict taxonomy, de-dup detection, status lifecycle (`draft` → `approved` → `deprecated`). |
| **Runtime performance regressions** | Atlas packing + build-time validation budgets (max sprite size, max atlas size, max total asset memory). |
| **Z-fighting with tall sprites** | Isometric slicing for tall rides + z-depth validation tool in the editor. Test against the `renderItems.sort` depth key. |

---

## MVP success criteria

Your first version is successful when you can:

1. Type **"isometric hot dog stand, carnival style"** into your editor.
2. The AI generates a candidate image; you remove the background and set the base anchor point.
3. You bind it to the `food` entity type in the `base_idle` slot.
4. Click **"Export to Game"**.
5. Open the game, buy a Food Stall, and see the AI-generated hot dog stand **seamlessly replace the current `#10b981` block** — sorting correctly behind and in front of guests via the existing depth-sort logic.

If these five steps work reliably end-to-end, you have a real "Complex Engine" foundation.

---

## Recommendation

Build this, but do it as a staged internal tool:

- **v1:** Dependable pipeline + metadata + export contract. One prompt, one sprite, one entity, no atlas. Get the rendering integration right first — the `drawSpriteIso` proof-of-concept in Phase 0 is the single most important validation step.
- **v2:** Convenience and power features — atlas packing, batch generation, animation frames, inpainting.

That path gives you creative leverage now without locking yourself into brittle tooling. And unlike Bullfrog's original Complex Engine, you have AI generation in the loop — which means your tool can produce not just organize art, but create it. That's a genuine force multiplier for an indie project.
