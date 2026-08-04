# Feudal Lord Simulator

Feudal Lord Simulator is a medieval isometric city-building prototype. The current slice is Phase 2, "The Living Manuscript": a full-viewport Canvas 2D map with a court-console UI, manuscript-inspired palette, procedural terrain, camera controls, tile picking, and build placement for roads and buildings.

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

## Run

```bash
npm install
npm run dev
```

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

This slice is intentionally limited to presentation and placement.

- No economy or production chains
- No population or housing progression
- No walkers or service simulation loop
- No seasons, walls, or overlays yet
- No scrollable card-based UI; the console is integrated into the art

## Docs

- `docs/ARCHITECTURE.md` — module boundaries and layer responsibilities
- `docs/DECISIONS.md` — settled product constraints
- `docs/DEV_LOG.md` — implementation history and verification notes
- `docs/PHASE2_QA.md` — browser, interaction, responsive, and visual evidence
- `docs/ASSET_REPORT.md` — generated-asset provenance and palette verification
