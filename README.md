# Feudal Lord Simulator

Feudal Lord Simulator is a medieval isometric city-building prototype. The current slice is Phase 3, "The Economy Turns": a full-viewport Canvas 2D map with a court-console UI, manuscript-inspired palette, procedural terrain, camera controls, tile picking, build placement, and the active economy loop.

## Current capabilities

- Full-viewport world canvas with deterministic procedural terrain
- Camera pan with middle-drag, space+drag, WASD, or arrow keys
- Mouse-wheel zoom clamped to 0.5×–2×
- Hover picking with placement previews and failure reasons
- Building placement and continuous road dragging
- One continuous court console with:
  - map shield
  - build seals for placement tools
  - court ledger
  - speed seals for tick control
- Active economy loop with exactly two chains:
  - wheat farm -> mill -> granary
  - logging camp -> sawmill -> storehouse
- Separate delivery carters and roaming distributors
- Population, housing, and labour simulation with visible overlays
- One authored level-2 opening household with 10 residents, yielding the five
  workers required to start the logging-camp -> sawmill chain without changing
  the locked building table or labour constants
- A measured 205-timber opening grant: 185 timber buys one complete timber
  chain, well, and food chain; the remaining 20 buys the second wheat farm
  required for a stable default-map bootstrap
- Generated UI art that is palette-quantised and reused across the console
- Three-pass rendering structure for ground, objects, and overhangs

## Requirements

- Node.js 20.19 or newer
- npm 11 or newer

## Controls

- Pan: middle mouse drag, or hold Space and drag, or use WASD / arrow keys
- Zoom: mouse wheel
- Place buildings: select a build seal, then click a valid tile
- Place roads: select the road seal, then drag to draw a continuous line
- Inspect build options: hover a seal to see its name and timber cost
- Control time: use the speed seals in the ledger recess
- Toggle overlays: `Digit1` for water, `Digit2` for labour

## Economy harness

```bash
npm run harness
```

Current report:

| Metric | Value | Status |
| --- | --- | --- |
| Determinism hash | `4d92c66f9408a603 == 4d92c66f9408a603` | PASS |
| Food stability | `9.5% starving` | PASS |
| Cargo thrashing | `0 cancellations/1200` | PASS |
| Labour deadlock | `0 consecutive ticks` | PASS |
| Housing oscillation | `1 changes/2000` | PASS |

## Run

```bash
npm install
npm run dev
```

For the tested default-map opening, draw a road from `(1,2)` through `(13,2)`
plus the starter-house spur `(0,1)` to `(0,2)`. Build the well, logging camp,
sawmill, storehouse, wheat farm, mill, granary, and second wheat farm before
adding houses. This spends the full 205-timber grant and keeps both economy
chains staffed while bread distribution starts.

On the DGX host, run:

```bash
npm run dev -- --host 0.0.0.0 --port 3200 --strictPort
```

Use that network binding only on an approved private network; Vite's development
server is not a production deployment surface.

## Verify

```bash
npm test
npm run typecheck
npm run build
```

## Scope exclusions

This slice is intentionally limited to the economy loop, population, walkers, and presentation.

- No politics, military, seasons, or walls yet
- No scrollable card-based UI; the console is integrated into the art

## Docs

- `docs/ARCHITECTURE.md` — module boundaries and layer responsibilities
- `docs/DECISIONS.md` — settled product constraints
- `docs/DEV_LOG.md` — implementation history and verification notes
- `docs/PHASE2_QA.md` — browser, interaction, responsive, and visual evidence
- `docs/ASSET_REPORT.md` — generated-asset provenance and palette verification
