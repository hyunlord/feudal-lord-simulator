# Living Manuscript Phase 2 Design

## Decision

Use a render-owned interaction controller with pure world validation and
domain-only engine actions. `render/` owns camera, pointer conversion, hover,
drag previews, culling, and ambient presentation. `world/` owns deterministic
terrain data, road geometry, and placement validation. `engine/` is the only
layer that mutates `GameState`. React provides the selected build tool and the
single bottom console, but never performs screen-coordinate math.

## Why This Architecture

The Phase 1 dependency contract already treats `render/` as the sole owner of
screen knowledge and keeps simulation axes pure. Preserving that boundary makes
camera and motion exclusions mechanically testable and prevents high-frequency
pointer state from rerendering the React tree.

The placement API creates one structural conflict: `BuildingKind` currently
lives in `economy/`, while `world/` may not import that axis. Move the canonical
building kind, definition, and instance contracts into `content/`, and re-export
them from `economy/economy.types.ts` for compatibility. This gives both world
validation and economy stubs a dependency-safe source.

## Options Considered

### Render controller plus engine actions — selected

This preserves existing boundaries, keeps presentation out of `GameState`, and
makes the required pointer pipeline explicit. It requires a small building type
move before placement work.

### App-owned camera and pointer shell — rejected

Wiring is initially simple, but screen math would spread into React/UI and
pointer movement would create unnecessary component renders.

### Store-owned editor and camera state — rejected

It centralises replayable actions but directly violates the Phase 2 requirement
that camera and ambient state never enter `GameState`.

### Scene graph or DOM/SVG world — rejected

Either adds abstraction without a Phase 2 consumer or conflicts with the
required procedural Canvas renderer. A single Canvas 2D renderer with explicit
passes is sufficient and easier to verify.

## Data and Action Flow

1. React console selects a `BuildTool` (`road` or a `BuildingKind`).
2. `GameCanvas` converts client coordinates to CSS canvas coordinates, removes
   camera transform, and performs robust diamond containment picking.
3. The render layer derives hover and preview visuals without mutating state.
4. A click or completed road drag dispatches a domain action.
5. The reducer delegates to pure engine helpers, which call world validation
   and return a new `GameState`.
6. The renderer reads the new state through ground, object, and overhang passes.

## Visual System

The screen is a full-bleed living manuscript with one continuous carved console
at the bottom. Generated art is limited to five UI surfaces; terrain, roads,
buildings, glyphs, and future agents remain procedural. All art shares the exact
listed nineteen-colour palette, one-pixel ink outline, upper-left illumination,
integer coordinate snapping, and hard diamond shadows.

The console has a shield minimap, a four-column seal grid, and a compact ledger.
There are no floating cards, pills, system-sans labels, scrolling regions,
gradients, blurs, or CSS shadows.

## Error and Boundary Behaviour

Placement validation returns a discriminated union and an explicit
`PlacementFailure` enum. Failure priority is deterministic:
`out_of_bounds`, `occupied`, `wrong_terrain`, `needs_road`,
`needs_adjacent_terrain`, then `insufficient_timber`. Roads require buildable
tiles but no road adjacency. Non-axis-aligned drags are normalised along the
dominant axis so every committed road remains continuous and orthogonal.

Picking first computes the analytic inverse, then checks nearby diamond
candidates and chooses the containing tile using stable depth/tie rules. This
handles negatives and points just inside every edge.

## Verification Shape

Pure tests cover palette enforcement, camera transforms and clamps, picking,
terrain variation, every placement failure, road connectivity and drag lines,
state exclusions, and tick-only advancement. DGX typecheck, test, build, asset
palette scans, browser interaction checks, console-error capture, and viewport
overflow checks provide integration evidence. Two independent visual oracles
review the final screenshots before delivery.
