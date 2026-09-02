<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Midway to Madness

A traveling-carnival management sim. Each day you pick a fair, negotiate the
contract, lay out the midway, open the gates, and see what the crowd leaves
behind. Guests carry money, hunger, a bladder and an appetite for thrills, and
they pick their next stop by weighing need against price, distance and how long
the line is.

Built with React, TypeScript, Vite and a canvas isometric renderer, plus an
in-browser asset engine that generates the artwork.

## Running the game

**Prerequisites:** Node.js 20+

```bash
npm install
npm run dev          # http://localhost:3000
```

`npm run lint` type-checks the project; `npm run build` produces `dist/`.

### How a day goes

1. **Route planning** — pick a fair, buy rides and stalls, hire staff.
2. **Negotiation** — set the privilege fee and the city's revenue share. Travel
   cost scales with the size of your fleet and the distance.
3. **Setting up** — place what you brought. A green outline means the footprint
   fits; red means it overlaps something or hangs off the lot.
4. **Open for business** — 8 AM to 10 PM. Run it at 1x, 2x or 4x. Click a guest
   or a ride to inspect it.
5. **Counting the take** — revenue, expenses and the day's net.

## The asset engine

The editor lives at [`/#editor`](http://localhost:3000/#editor). It generates
sprites with Gemini's image models, cuts the background out with `rembg`,
resizes with `sharp`, and writes approved assets into
`public/assets/manifest.json`, which the game loads at runtime. Anything without
a sprite falls back to a colored isometric block, so the game runs with an empty
manifest.

The editor needs the Express backend and the background-removal service:

```bash
GEMINI_API_KEY=... docker compose up
```

That starts the Vite frontend (port 3000), the asset API (3001) and `rembg`
(5000). The API key is only ever passed to the backend — the browser never sees
it. To run the backend alone, use `npm run editor:server`.

Asset records live in `assets.db` (SQLite, tracked in the repo). Approved assets
are exported to the manifest with the **Export to Game** button.

## Layout

| Path | What's in it |
|------|--------------|
| `src/game/` | Simulation: ECS, systems, item definitions, renderer, state |
| `src/components/` | Game UI: HUD, map, bidding, park view, summary |
| `src/editor/` | Asset engine UI |
| `server/` | Express asset API: assets, generation, manifest export |
| `rembg/` | Background-removal microservice |
| `docs/` | [Improvement plan](docs/game-improvement-plan.md), [asset engine roadmap](docs/asset-engine-roadmap.md) |
