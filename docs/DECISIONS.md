# Settled decisions

These decisions are locked by the current code and tests.

1. Camera and picking live in `render/`, not in `GameState`. Screen space is
   presentation state, and the canvas layer owns it.
2. Placement is validated before mutation. `world/placement.ts` and
   `world/roadGraph.ts` decide whether a tile or road line is legal;
   `engine/gameActions.ts` applies the mutation only after a successful check.
3. Phase 3 keeps the economy split into two distinct walker lanes. Delivery
   carters own destinations, cargo, reservations, and cancellation recovery;
   roaming distributors stay local, choose road junctions pseudo-randomly, and
   do not path toward hungry houses.
4. Terrain, transitions, road geometry, and visible-tile culling are
   deterministic. This keeps headless tests and browser QA aligned.
5. The scene renders as ground, objects, and an overhang seam. Walkers and cargo
   occupy the seam; future walls should join it rather than being folded into
   the lower passes.
6. Presentation motion is draw-time only. Trees and other accents sway via
   deterministic sine offsets derived from tick and identity, with no per-object
   animation state.
7. The console is a single continuous bottom overlay, not separate floating
   panels. Its content is the minimap shield, 4-column seal matrix, and compact
   ledger and speed controls.
8. The palette and surface assets are closed sets. Only the nineteen canonical
   palette colours and the generated UI assets belong in the live surface
   language.

## Phase 3 decisions

These are locked by the current code and tests.

- The economy has exactly two two-stage chains: wheat to bread and logs to
  timber. Granaries hold food and storehouses hold materials; there is no third
  stage.
- Production is binary staffed. Buildings below `workersRequired` produce
  nothing, and a full inventory holds progress at the cap rather than silently
  deleting output.
- Reservations are explicit. Delivery destinations reserve space, outbound
  delivery cargo also holds contingency capacity at home, and fetch missions
  separately reserve source stock plus inbound home capacity. Destination and
  source claims are released on arrival or cancellation; the home claim is
  released after a successful deposit or after cancelled cargo is restored.
- The road-path cache is invalidated when road edits change the road revision.
  A stale path is never reused after the road graph changes.
- `engine/tick.ts` is ordered carters -> distributors -> housing -> labour ->
  production -> carter spawns -> distributor spawns.
- Housing levels evolve immediately when requirements are met, devolve only
  after 400 unmet ticks, gain residents every 50 ticks when watered, and lose
  residents after 300 ticks without a bread-service visit. A bread-dependent
  housing level requires positive `breadStock` plus recent service; starvation
  uses `lastServicedTick`. Growth does not consume household bread.
- The authored opening household starts at level 2 with 10 residents so the
  exact opening logging-camp and sawmill staffing requirement is reachable.
  Normal housing and starvation rules take over immediately; this is not a new
  housing level or balance constant.
- The opening treasury is 205 timber. A measured default-map run needs 185 for
  the timber chain, well, and one food chain, then 20 more for a second wheat
  farm. The earlier 160 grant could not fund the food chain before starvation,
  and a 185 grant with only one farm still collapsed in the long opening run.
- Time controls are exact simulation-rate multipliers: normal, threefold, and
  fivefold run at 20, 60, and 100 ticks per second.
- A carter whose cancelled route has no road home remains observable for one
  tick with its cancellation metadata, then performs deterministic logical
  recovery on the next tick. The destination claim is released, the home claim
  held since departure remains until cargo is restored, and an unreserved
  malformed return waits rather than overfilling storage.
- Outbound delivery remains valid only while both its remaining destination
  path and a road path back to the home building exist. A home-side road removed
  behind the walker cancels before delivery, so cargo cannot be deposited by a
  carter that would then have no return route.
- Bread leaving a granary with a distributor is represented by an equal home
  capacity claim. House service releases the served portion; return releases
  the restored portion. This prevents inbound carters from consuming the space
  needed by leftover bread.
- A granary chooses the largest reachable road component for distributor spawn,
  with the existing coordinate order as the deterministic tie-break. Roaming
  remains local and never seeks hungry houses.
- The only economy overlays are water and labour, mapped to `Digit1` and
  `Digit2`.

## Future-phase constraints retained

These earlier product decisions remain settled, but none is active in the
Phase 3 loop:

- The isometric world uses 64 by 32 screen-space tile diamonds.
- Population will be an abstract census value; visible walkers will be
  representative agents rather than one-to-one population records.
- Headless simulation must remain deterministic even if later presentation
  effects are allowed to vary.
- Housing has four levels, represented by values 0 through 3.
