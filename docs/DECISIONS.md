# Settled decisions

These decisions are locked by the current code and tests.

1. Camera and picking live in `render/`, not in `GameState`. Screen space is
   presentation state, and the canvas layer owns it.
2. Placement is validated before mutation. `world/placement.ts` and
   `world/roadGraph.ts` decide whether a tile or road line is legal;
   `engine/gameActions.ts` applies the mutation only after a successful check.
3. The live phase keeps the economic and population systems intentionally
   inactive. The directories exist as future pure modules, but no production,
   storage, labor allocation, housing evolution, or walker behavior runs in the
   current loop.
4. Terrain, transitions, road geometry, and visible-tile culling are
   deterministic. This keeps headless tests and browser QA aligned.
5. The scene renders as ground, objects, and an empty overhang seam. Future
   walls and walkers should occupy the seam rather than being folded into the
   lower passes.
6. Presentation motion is draw-time only. Trees and other accents sway via
   deterministic sine offsets derived from tick and identity, with no per-object
   animation state.
7. The console is a single continuous bottom overlay, not separate floating
   panels. Its content is the minimap shield, 4-column seal matrix, and compact
   ledger and speed controls.
8. The palette and surface assets are closed sets. Only the nineteen canonical
   palette colours and the generated UI assets belong in the live surface
   language.

## Future-phase constraints retained

These earlier product decisions remain settled, but none is active in the
Phase 2 loop:

- The economic prototype will have exactly two two-stage chains: wheat to bread
  and logs to timber. A third production stage is outside that experiment.
- The isometric world uses 64 by 32 screen-space tile diamonds.
- Population will be an abstract census value; visible walkers will be
  representative agents rather than one-to-one population records.
- Headless simulation must remain deterministic even if later presentation
  effects are allowed to vary.
- Housing has four levels, represented by values 0 through 3.
