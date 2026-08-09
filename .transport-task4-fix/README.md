# Feudal Lord Simulator

A medieval lord and city-building simulator inspired by classic isometric city
builders. The first product question is intentionally narrow: can two shallow,
two-stage economic chains be made genuinely fun?

This repository currently contains Phase 1 scaffolding only. It has no game
logic, simulation behavior, drawing behavior, or interactive controls. The
isometric coordinate transforms are the sole implemented engine-adjacent logic.

## Requirements

- Node.js 20.19 or newer
- npm 11 or newer

## Run

```bash
npm install
npm run dev
```

For network access from the DGX Spark host:

```bash
npm run dev -- --host 0.0.0.0 --port 3200 --strictPort
```

Open `http://100.70.109.50:3200/` while that server is running.

## Verify

```bash
npm test
npm run typecheck
npm run build
```

See `docs/ARCHITECTURE.md` for dependency boundaries and
`docs/DECISIONS.md` for settled product constraints.
