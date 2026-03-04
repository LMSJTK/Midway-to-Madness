# Asset Engine Roadmap ("Complex Engine"-style) for Midway to Madness

## Short answer
Yes — building your own internal asset engine is very possible, and your preferred workflow (AI base image + iterative edit/re-prompt + final assignment to game entities) is a strong fit for an indie-to-mid scope project.

The key is to treat this as a **pipeline product**, not only an image editor:
1. generate,
2. refine,
3. validate,
4. version,
5. export,
6. bind to gameplay entities.

---

## Recommended high-level architecture

### 1) Asset Workspace (editor app)
A dedicated editor UI (web/Electron) where you can:
- create a new asset from text prompt,
- do inpainting/outpainting (mask + prompt),
- manually paint/touch-up,
- run cleanup tools (palette reduction, edge cleanup, silhouette checks),
- define metadata and gameplay bindings.

### 2) Asset Pipeline Service
Background jobs for heavyweight operations:
- image generation / variation jobs,
- background removal or normal-map generation (optional),
- format conversion and sprite slicing,
- atlas packing,
- validation checks,
- deterministic export manifests.

### 3) Asset Registry + Versioning
A database table (or JSON+git initially) that tracks:
- asset ID (stable UUID),
- source prompt(s), seed(s), model + settings,
- edit history,
- semantic tags,
- state (`draft`, `review`, `approved`, `deprecated`),
- exported artifact hashes,
- game entity references.

### 4) Runtime Asset Loader
Your game should consume **compiled outputs** only:
- sprite sheets / atlases,
- metadata manifests,
- collision/anchor points,
- animation definitions,
- quality tier variants.

Never load editor-only source data in runtime builds.

---

## Core concepts to define early

### A. Asset identity model
Use immutable IDs and mutable versions:
- `asset_id`: permanent identity (`park_bench_01`),
- `revision`: integer or hash (`r12`),
- `variant`: style/tier (`default`, `night`, `damaged`).

This prevents broken references when artwork iterates.

### B. Data schema (minimal v1)
For each asset record:
- `id`, `name`, `category`, `tags`
- `source` (prompt/model/seed/reference images)
- `processing` (trim, scale, palette, compression)
- `anchors` (feet/base, interaction point, shadow origin)
- `collision` (optional polygon/box)
- `animation` (frame set + timing)
- `bindings` (entity types using this asset)
- `license/provenance` fields

### C. Art style constraints
Define machine-checkable constraints before bulk generation:
- target resolution grid (e.g., 64x64 base cell),
- palette strategy,
- camera angle/isometric rules,
- outline and contrast rules,
- acceptable value range for readability.

This avoids huge rework later.

---

## Practical phased plan

## Phase 0 — Spec first (1–2 weeks)
Deliverables:
- style guide v1,
- asset taxonomy (props, rides, staff, UI icons, terrain decals),
- JSON schema for asset metadata,
- directory + naming conventions,
- export contract consumed by game runtime.

## Phase 1 — MVP "Complex Engine" (2–4 weeks)
Build only what unblocks production:
- prompt-to-image generation panel,
- image upload and manual replacement,
- mask-based reprompt (inpaint),
- revision history,
- metadata form,
- one-click export to game-ready folder + manifest.

Keep scope strict: no advanced node graph editor yet.

## Phase 2 — Production hardening (3–6 weeks)
Add:
- atlas packing,
- validation suite (size, alpha fringe, palette drift, missing anchors),
- entity binding browser (which entities use this asset),
- dependency graph (what breaks if changed),
- batch operations and auto-tagging.

## Phase 3 — Power features
Then consider:
- procedural variants,
- style transfer consistency tools,
- LOD and platform-specific compression presets,
- collaborative review workflow.

---

## Suggested technical stack (aligned with your current codebase)
Given the repo already uses TypeScript/React and Node tooling:
- **UI:** React + TypeScript (reuse your existing app patterns),
- **Backend jobs/API:** Node/Express + worker queue,
- **Storage:** SQLite initially (`better-sqlite3`), move to Postgres if needed,
- **File storage:** local folder structure now, object storage later,
- **Image ops:** Sharp + optional Python microservice for advanced ML tasks,
- **Schema validation:** Zod/JSON Schema,
- **Packaging:** deterministic build script that emits manifests + atlases.

---

## AI workflow that avoids chaos

For each generated base image, store:
- model name/version,
- positive/negative prompt,
- seed,
- CFG/steps/sampler (if applicable),
- source references,
- generation timestamp.

Then enforce a gate:
1. visual quality pass,
2. style consistency pass,
3. gameplay readability pass,
4. metadata completeness pass.

Only then mark as `approved` and export.

---

## Binding assets to entities (important)

Use indirection:
- entities reference **asset slots**, not raw files.
- example: `RideFerrisWheel` asks for slots:
  - `base_idle`,
  - `base_active`,
  - `broken_state`,
  - `icon_small`.

Registry resolves slot → approved asset revision.

Benefits:
- swap art without code edits,
- seasonal variants become straightforward,
- rollback is safe.

---

## Risks and mitigations

- **Risk: style drift from AI outputs**  
  Mitigation: strong guide + approval gate + palette/contrast checks.

- **Risk: untraceable legal provenance**  
  Mitigation: keep source/model/prompt metadata and provenance fields.

- **Risk: content explosion**  
  Mitigation: strict taxonomy, de-dup detection, and status lifecycle.

- **Risk: runtime performance regressions**  
  Mitigation: atlas packing + build-time validation budgets.

---

## MVP success criteria
Your first version is successful if you can:
1. Generate a new prop from prompt.
2. Re-edit one region with inpaint/re-prompt.
3. Tag and bind it to an entity slot.
4. Export build artifacts.
5. Launch game and see the new asset with zero code changes.

If these five work reliably, you have a real "Complex Engine" foundation.

---

## Recommendation
You should absolutely build this, but do it as a staged internal tool:
- **v1:** dependable pipeline + metadata + export contract,
- **v2:** convenience and power features.

That path gives you creative leverage now without locking yourself into brittle tooling.
