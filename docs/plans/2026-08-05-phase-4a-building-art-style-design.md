# Phase 4A Building Art Style Design

## Decision

Buildings become generated, palette-constrained sprites while terrain remains procedural. This slice proves the direction with six candidates each for the level-zero house, mill, and granary; it deliberately does not change runtime rendering.

## Visual system

The target is painted, realistic 2:1 isometric medieval European architecture with upper-left light and visible thatch, timber, plaster, stone, and slate texture. Generation uses one shared SDXL base prompt, six deterministic seeds per subject, a flat chroma field, and no ground or contact shadow. Candidates with an incorrect projection remain visible in the review grid but cannot be selected.

The canonical colour system is eight six-step material ramps plus ink, vermilion, gold, and ultramarine. Existing semantic terrain and court colours map to the nearest canonical entry so every literal colour originates in `RAMPS` or `PALETTE`. The CSS compatibility layer keeps existing semantic variable names without duplicating hex literals.

## Pipeline

`scripts/generateBuildingCandidates.py` queues the 18 reproducible 1024x1024 SDXL sources through the existing local ComfyUI service. `scripts/processBuildingSprite.ts` applies identical chroma removal, Lanczos downscaling into the target canvas, ramp quantisation, and a one-pixel ink silhouette outline. It anchors the lowest opaque building pixel on a declared base line and clears all rows below that line.

Processed candidates live in `public/assets/buildings/candidates/`. A machine-readable report records subject, seed, source, target dimensions, base line, coverage, colours, and selected review candidate. `docs/assets/building_candidates.png` presents all 18 at release size on neutral grey; `docs/assets/building_in_context.png` composites the three selected candidates onto a real default-zoom terrain capture without touching the renderer.

## Verification

Tests first lock the 48 ramp colours plus four palette colours, semantic compatibility mappings, full-set quantisation, exact sprite geometry, alpha/base-line constraints, allowed colours, and renderer non-integration. Final gates are the complete TypeScript test suite, Python generator tests, typecheck, production build, economy harness hash `4d92c66f9408a603`, processed-asset verifier, source hash comparison for `src/render/drawBuildings.ts`, and remote SHA verification after push.
