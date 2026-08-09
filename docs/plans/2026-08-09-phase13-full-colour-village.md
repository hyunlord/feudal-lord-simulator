# Phase 13 Full-Colour Village Implementation Plan

> Approved source: `pasted-text-1.txt` (Phase 13: Undo the Palette, Regenerate Everything).
> This plan deliberately lives under `docs/plans/`; orchestration state under
> `.omo/` and `.omx/` is protected and remains untouched.

## Delivery contract

- Work on `codex/phase13-full-colour` in the isolated Phase 13 worktree.
- Use RED-GREEN-REFACTOR for behavior changes.
- Run image generation and tests sequentially, never concurrently.
- Use ComfyUI batch size one and unload between asset groups.
- Cap economy harness concurrency at eight workers.
- Before heavy DGX work, require at least 30 GiB available memory; retry at
  60-second intervals up to ten times, then record and skip the group.
- Do not terminate, reuse, or piggyback on foreign DGX sessions or servers.
- Review each Part for specification fidelity and code quality, with at most
  two rounds. Record any second-round objection verbatim and move on.
- Commit and push after each numbered Part.

## Baseline

The clean `origin/main` baseline at `c4e3169c6f38bb72859bfde8e23f4071541db1b4`
must remain reproducible:

- `npm test`: 937/937 passing.
- `npm run typecheck`: passing.
- `npm run build`: passing.
- `npm run harness -- --workers=8`: all fourteen canonical metrics passing.

Evidence is stored under `/tmp/feudal-phase13/baseline/`.

## Part 1 — Remove generated-art palette quantisation

### Contract tests first

1. Add a focused generated-art pipeline test with a high-colour RGBA fixture.
   Assert sprite processing preserves every interior RGB value, preserves
   transparent background semantics, and adds only the one-pixel alpha-179 ink
   silhouette.
2. Change terrain pipeline tests to assert source colour depth survives resize,
   offset, and seam blending rather than belonging to material ramps.
3. Change world manifest tests so every generated world asset declares a
   `full-colour-generated` colour policy while retaining exact dimensions,
   alpha, seam, reference, and no-baked-shadow contracts.
4. Change UI asset verification tests so generated surfaces accept full-colour
   pixels and measure colour diversity instead of rejecting non-palette RGB.
5. Retain the source-code hex literal guard and all procedural palette tests.

### Implementation

- Update `DESIGN.md`: the canonical palette governs code, DOM surfaces, and
  procedural canvas fallback only; generated PNG interiors are full colour.
- Remove nearest-palette mapping from `processBuildingSprite.ts`; keep chroma
  removal, alpha cleanup, exact dimensions/baseline, and exterior outline.
- Remove ramp quantisation from `terrainTexturePipeline.ts`; keep exact opaque
  output, deterministic offset, edge blending, and seam metrics.
- Update world asset contracts, preparation, parsing, and verification to the
  full-colour policy. Verify outline alpha and ink RGB independently from
  interior RGB.
- Retire generated-art CLI use of `quantisePalette.ts`; keep only generic PNG
  decode/Lab helpers if still consumed, or extract those helpers to a neutral
  PNG/colour module when that produces the smaller honest boundary.
- Update the generated UI verification boundary to preserve full colour while
  retaining alpha/dimension/readability contracts.

### Verification and landing

- Focused sprite, terrain, manifest, UI, palette, and generator suites.
- Typecheck, build, full tests, harness at eight workers, and diff/source audit.
- Specification review, quality review, commit with Lore trailers, push.

## Part 4 — Continuous motion and measured frame behavior

This code Part lands before long DGX generation.

### Diagnose before modifying

- Run a real production-build Chrome session for 30 seconds at 1x with a
  town-sized state.
- Record frame-work distribution: count, min, p50, p75, p90, p95, p99, max,
  and frames over 16.67 ms and 20 ms.
- Journal and test at least these hypotheses:
  1. interpolation alpha/previous-state publication occurs on the wrong side of
     fixed-tick commit;
  2. destination snapping or identity/phase transitions create apparent jumps;
  3. per-frame object rebuilding/cache misses create long callbacks;
  4. autoplay commit cadence creates visible main-thread spikes.
- Name the confirmed cause from evidence; do not optimize by intuition.

### Implement and prove

- Fix the confirmed walker/frame cause without changing deterministic state.
- Add presentation-only construction progress interpolation.
- Add presentation-only resource readout tweening of roughly 300 ms.
- Add a short completion reveal that does not enter `GameState`.
- Re-run the identical profile and require zero frame callbacks over 20 ms.
- Prove GameState and harness hashes remain unchanged.

## Part 5 — Camera controls

### RED contracts

- A 3 px left movement remains a click; a 10 px movement becomes a pan.
- Active left/middle/space drag changes pan one-to-one with pointer delta.
- A drag suppresses world selection.
- Held keyboard direction accelerates from 8 to 24 tiles/second over 0.4 s and
  decays after release.
- Pointer inside a 20 px edge band pans; outside it does not.
- Wheel zoom keeps the world point beneath the cursor fixed.
- Camera, drag, velocity, and interpolation fields remain absent from
  `GameState` and deterministic serializers.

### Implementation

- Keep camera and input state in render-owned refs/modules.
- Make ordinary left pointer down a pending pan unless the active road tool
  owns the gesture; cross the four-pixel threshold before suppressing click.
- Reuse the existing pan path for left, middle, and space drags.
- Advance keyboard velocity and edge pan from the RAF presentation loop, then
  clamp with the existing world bounds.

## Part 6 — Visible construction and readable object layering

### RED contracts

- Render-call signatures differ across 0–25, 25–55, 55–85, and 85–100 percent.
- Each stage contains the requested physical cues; active later stages include
  a visible builder.
- A building whose footprint contains the cursor tile renders at 55% alpha.
- Walkers are painted after buildings and receive a soft ink outline.
- A render-only outline-view toggle is off by default and paints buildings at
  40% silhouette alpha with solid outlines.

### Implementation

- Strengthen the existing four-stage procedural renderer rather than adding a
  second construction model.
- Preserve selection and depth facts, but split the final painting sequence so
  walkers remain readable above dense structures.
- Keep hover/outlines state outside `GameState`.

## Part 7 — Build-menu width and legibility

### RED contracts

- At a 1280 px viewport the minimap rendered box is square, no larger than
  140 px, and has one plain ink border.
- Measure every visible build-group header and label; its rendered text width
  plus required padding must not exceed its cell width.
- The menu uses one row when it fits; two rows are allowed only when all text is
  complete and unclipped.

### Implementation

- Remove ornamental minimap geometry and cap its grid track at 140 px.
- Give the reclaimed console width to the build menu using the existing
  manuscript tokens and control semantics.
- Verify production browser screenshots at 1280, 768, and 375 px.

## Part 2 — Regenerate full-colour environment and UI art

Run only after code/test processes are idle.

### DGX preflight

- Revalidate SSH host/user, repository origin/revision, memory, GPU, ComfyUI
  ownership, port availability, and model/node inventory.
- Use an isolated remote `/tmp` checkout for the exact pushed Part 1 revision.
- Start a separate owned ComfyUI port/session only when no owned compatible
  server exists; never reuse a foreign process.

### Sequential groups

1. Terrain: five 512x512 seamless sources, validate 2x2 joins and greater than
   100 opaque RGB colours, then render at 60% over the base material.
2. Foliage: all trees, shrubs, tufts, stones, and stumps with internal material
   shading and visible trunks where applicable.
3. Buildings: every manifest building, with stable isometric camera, upper-left
   lighting, fixed references, transparent background, and material detail;
   require greater than 80 opaque RGB colours.
4. UI: parchment, console, scroll/frame, and panels with fine low-contrast
   material texture and readable text surfaces.

After each group: decode/dimension audit, model unload, queue-idle proof, memory
proof, candidate contact sheet, deterministic selection record, integration.
If ComfyUI wedges twice, stop remaining generation and report the exact skips.

## Part 3 — People sprites

- Generate each walker role and direction independently at 32x48 per frame:
  carter, distributor, builder, idle; NE, SE, SW, NW; four frames preferred.
- Assemble and validate directional sheets. If four frames lack identity
  consistency, select a two-frame contact/passing cycle. If characters fail,
  ship an improved procedural humanoid with alternating legs.
- Preserve the existing coloured cargo square above the head.
- Add tests for sprite availability/fallback and heading-to-frame selection.
- Produce a labelled contact sheet, review, commit, and push.

## Final verification, publication, and report

- Run focused suites, all existing and new tests, typecheck, production build,
  asset verification, no-excuse/static guards, and harness with eight workers.
- Compare pre-feature and final deterministic hashes.
- Run production-browser visual QA at 1280, 768, and 375 px, plus required
  terrain, forest, walker, construction-stage, and full-screen captures.
- Run the final 30-second 1x frame profile on the published build.
- Publish the exact pushed revision and bind evidence to the deployment SHA.
- Write `docs/PHASE13_REPORT.md` with per-Part work/skips, before/after colour
  counts, before/after profiles and named cause, walker path/contact sheet,
  autonomous decisions, review objections, screenshots, tests/hashes, pushed
  commits, publication proof, and an honest visual comparison.
