# Phase 2 QA — The Living Manuscript

This report records the browser, interaction, asset, and visual checks performed
against product commit `22375bd4f40839b95c4eac5b186d7720dbd77acc` on the
DGX worktree. Later documentation-only commits do not change the captured UI.
The final release gate must still rerun the repository verification commands at
the integrated `main` commit.

## Evidence locations

The reproducible evidence bundle for this run is retained outside the repository
under `/tmp/feudal-phase2-evidence/` on the QA workstation:

- `browser/browser-qa-report.json` — viewport, interaction, asset-response, and
  browser-failure results;
- `browser/viewport-{320,375,768,1280}.png` — responsive captures;
- `browser/01-map-default.png` through `05-full-screen-console.png` — required
  product-state captures;
- `assets/*_contact_sheet.png` — generated candidate sheets;
- `assets/before/` and `assets/final/` — selected images before and after palette
  quantisation;
- `visual/baseline-diff.json` — bundled OMX image-diff output;
- `visual/visual-verdict-round{1,2}.json` — visual gate records;
- `debug/camera-probe-journal.md` — the QA-harness timing diagnosis.

The temporary executable browser harness is
`/tmp/feudal-sim-qa/phase2-qa.mjs`. It drives Chromium against the loopback
development server on port 3200.

## Required screenshots

| Capture | What it proves |
| --- | --- |
| `01-map-default.png` | Default camera composition and the procedural manuscript world. |
| `02-map-zoomed-in.png` | Wheel zoom, 2x clamp, accurate hover, and visible occupied feedback. |
| `03-placement-valid.png` | A valid translucent building footprint before placement. |
| `04-placement-invalid-needs-road.png` | Refused placement with a visible `needs road` reason on a vellum plaque. |
| `05-full-screen-console.png` | Full viewport plus one continuous 150px court console. |

## Browser and interaction run

Command:

```bash
cd /tmp/feudal-sim-qa
node phase2-qa.mjs
```

Final result: exit code 0. The harness opens a real headless Chromium browser,
records console errors, page errors, failed requests, canvas transforms, layout
geometry, ledger changes, and generated-asset responses.

| Viewport | Console | Build grid | Scroll size | Browser failures |
| --- | ---: | ---: | --- | ---: |
| 320x640 | 150px | 4 columns | exactly 320x640 | 0 |
| 375x667 at DPR 2 | 150px | 4 columns | exactly 375x667 | 0 |
| 768x720 | 150px | 4 columns | exactly 768x720 | 0 |
| 1280x720 | 150px | 4 columns | exactly 1280x720 | 0 |

The same run verified:

- WASD changed camera `panX` from 640 to 608;
- arrow input changed `panY` from 80 to 48;
- middle drag moved the camera from `(640, 80)` to `(690, 105)`;
- space-drag moved it from `(640, 80)` to `(590, 55)`;
- wheel zoom reached and stopped at both 0.5x and 2x;
- a Cottar House placement reduced timber from 160 to 154;
- a road drag produced a continuous occupied path;
- a road-adjacent Storehouse placement reduced timber from 154 to 140;
- an invalid Sawmill preview rendered `needs road` and refused placement;
- Tick stayed fixed while paused, advanced after Normal speed, and stopped again
  after Pause;
- all five committed UI images produced a first-load `200 image/png` response;
- no console error, page error, failed request, body overflow, or document
  overflow was observed.

The first harness version sampled a render-derived camera probe in the same
task as key dispatch and failed before the next animation frame. An isolated
probe recorded `panX=640` before the frame and `panX=608` after it. The harness
was corrected to wait on the expected camera direction; product code was not
changed for that instrumentation race. Repeated reloads also legitimately
produced conditional 304 responses, so asset verification requires at least one
observed first-load 200 response per asset and retains later 304s as evidence.

## Automated verification at the captured product commit

```text
npm test          -> 96 tests passed, 0 failed
npm run typecheck -> passed
npm run build     -> passed; Vite transformed 46 modules
git diff --check  -> passed
```

The full test suite includes camera transforms, diamond-edge picking, negative
coordinates, all placement failures, orthogonal road adjacency, road-line
normalisation, deterministic terrain, explicit render passes, palette guards,
asset verification, responsive console contracts, and the zoom-stable failure
plaque.

## Visual QA

The Phase 1 screenshots are a before-state scaffold, not a fidelity target. The
bundled OMX image diff reports matching dimensions and intact alpha at 375,
768, and 1280. Every overlap pixel differs from Phase 1, which is expected for
the intentional replacement of a dark placeholder dashboard by a full
illustrated world and integrated court console.

Two independent read-only visual passes inspected the screenshots directly.
Round 1 found two important legibility issues: the placement reason blended
into the world, and the 320px ledger text competed with generated ruled texture.
It also noted low clearance below the minimap caption. The remediation added a
zoom-compensated vellum failure plaque, muted the ledger centre, raised compact
ledger type to 10px, and lifted the caption. Regression tests were written
before the implementation.

Round 2 passed both visual oracles. The structured verdict is 92/100 and
`pass`. Remaining observations are minor: failure text and 320px numerals are
necessarily compact, and the tablet caption remains close to its ornament, but
all are readable and unclipped. No blur, gradient, layer inversion, console
seam, or responsive regression was observed. CJK review is not applicable to
the current English-only interface.

## Generated UI assets — honest assessment

Every final non-transparent RGB pixel belongs to the canonical palette and
every alpha byte is preserved from its selected source. Exact generation and
manifest evidence is in `ASSET_REPORT.md`.

- `scroll_frame.png` has the strongest parchment silhouette, but its ruled
  centre is visually active. The ledger therefore places a quiet parchment
  field beneath live text.
- `wood_console.png` is the most convincing continuous medieval surface. Its
  carving is busier than ideal, especially across the open desktop centre, but
  it reads as one console rather than adjacent web widgets.
- `seal_slot.png` reads as a usable wax-like recess after refinement. Its
  concentric detail is slightly stronger than the procedural glyph outlines.
- `parchment_texture.png` is the weakest selected asset: it is high-key, noisy,
  opaque, and carries blue flecks. Low-opacity or occluded use keeps it from
  overpowering content.
- `illumination_corner.png` gives the frame a clear manuscript flourish, though
  it is a cropped salvage from a model that resisted a single-corner prompt.

## Product read

### Does it read as a game rather than a web application?

Yes. The world owns the viewport, camera and placement feedback respond directly
on the map, and the only HTML chrome is a single embedded court console with
icon seals. It no longer presents repeated panels, cards, text action pills, or
a scrolling document. The open centre of the desktop console is slightly
underused, but it preserves world focus and does not read as a dashboard.

### Does everything look like it came from one hand?

Mostly, and sufficiently for Phase 2. The procedural world, SVG seal glyphs,
hover marks, building silhouettes, and generated surfaces share the same
nineteen canonical colours, ink outline, hard edges, and upper-left lighting.
The greatest family tension is the extra surface noise in
`parchment_texture.png` and `wood_console.png` compared with the flatter
procedural world. Quantisation and restrained layering contain that mismatch;
future replacement assets should be quieter rather than adding more detail.

## Remaining test limitation

The interaction run uses desktop Chromium with emulated viewport sizes and DPR.
It does not substitute for a physical touch-device pass. Phase 2 specifies
mouse, keyboard, and wheel controls, all of which were exercised.
