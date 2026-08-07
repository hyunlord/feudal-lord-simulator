[▶ Play Feudal Lord Simulator](https://hyunlord.github.io/feudal-lord-simulator/)

# Feudal Lord Simulator

A playable medieval isometric settlement simulator built with React, TypeScript, Vite, and Canvas 2D.

## What works today

- Procedural isometric terrain with camera pan, zoom, and tile picking
- Building and continuous-road placement with previews and failure reasons
- Wheat and timber production chains with delivery carters and distributors
- Population, housing, labour allocation, construction sites, and cancellation
- Palisade-era progression with wall drafting, staged construction, and protection
- Court-console controls, diagnostics, overlays, and responsive layouts
- Deterministic simulation and economy harnesses

## Local setup

Requires Node.js 20.19 or newer and npm 11 or newer.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. The development build remains rooted at `/`.

## Controls

- Pan: middle-drag, Space+drag, WASD, or arrow keys
- Zoom: mouse wheel
- Build: select a build seal, then click a valid tile
- Roads and palisades: select the tool, then drag a continuous path
- Time: use the speed seals in the court ledger
- Overlays: `Digit1` for water and `Digit2` for labour

## Verify

```bash
npm run typecheck
npm test
npm run build
npm run harness
```

On the DGX host, the existing development server uses port 3200. Do not restart
or replace that service while running production-build verification.

## Documentation

- `docs/ARCHITECTURE.md` — module boundaries and layer responsibilities
- `docs/DECISIONS.md` — settled product constraints
- `docs/DEV_LOG.md` — implementation history and verification notes
- `docs/ASSET_REPORT.md` — generated-asset provenance and palette verification
