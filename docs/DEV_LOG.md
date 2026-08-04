# Development log

## 2026-08-05 - Phase 3 Economy Turns documentation update

Refreshed the public docs to match the current Phase 3 implementation and
verified harness output.

- `README.md` now describes the active economy loop, overlay keys, and the
  harness command.
- `docs/ARCHITECTURE.md` and `docs/DECISIONS.md` now record delivery-vs-roaming
  separation, reservation rules, cache invalidation, tick order, and housing /
  labour behavior.
- Legalized the fixed harness scenario so roads do not overlap footprints,
  required observed bread production for the food metric, and recorded the
  authored level-2 / 10-resident opening household used to make the locked
  five-worker timber-chain opening feasible.
- Reproduced the default-map cold start: 160 timber leaves 65 after the timber
  chain and well, while the food chain costs 90; waiting for the missing timber
  delayed affordability to about tick 3,076, beyond the 300-tick starvation
  window. A 185-timber one-farm opening produced bread but collapsed in the
  3,500-tick regression. The final 205 grant funds a second farm and remains
  populated with evolved housing through 3,500 ticks.
- Corrected browser speed multipliers to the locked 20-tick base rate and kept
  starvation governed by distributor service recency rather than inventing a
  per-growth household bread-consumption rate.
- Added adversarial capacity guards: outbound delivery carters hold a
  home-capacity claim from departure until successful delivery or cancelled
  cargo recovery, bread distributors reserve and progressively release granary
  capacity, and malformed unreserved returns wait instead of overfilling
  storage. Granary distributors now choose the largest reachable access-road
  component rather than a sorted-first dead end.
- Closed the one-way-delivery edge case: outbound carters now verify that the
  current road graph still reaches home, so removing a home-side access behind
  a walker cancels and restores its cargo before any destination deposit.
- Expanded the determinism hash to cover complete carter/distributor lifecycle,
  reservation, cancellation, and junction state.
- Kept the 205-timber harness grant in `treasuryTimber` rather than putting it
  into a capacity-200 storehouse; an invariant test now checks every building
  through all 4,000 ticks.
- Verified `npm run harness` on DGX; the current PASS rows are determinism hash
  `4d92c66f9408a603 == 4d92c66f9408a603`, food stability `9.5% starving`, cargo
  thrashing `0 cancellations/1200`, labour deadlock `0
  consecutive ticks`, and housing oscillation `1 changes/2000`.

## 2026-08-04 - Phase 2 Living Manuscript

Built the Living Manuscript slice on the DGX worktree.

- Established the manuscript visual system: shared palette variables, Canvas 2D style helpers, integer snapping, and consistent upper-left lighting.
- Added and quantised the generated UI surfaces: scroll frame, wood console, seal slot, parchment texture, and illumination corner.
- Replaced the placeholder view with procedural terrain, deterministic variation, hover picking, camera pan and zoom, building placement previews, road dragging, and placement failure feedback.
- Built the court console as one continuous chrome band with the map shield, placement seals, court ledger, and speed seals.
- Verified the slice with typecheck, build, tests, and browser QA at 320, 375, 768, and 1280 widths; captured screenshots and QA reports.

## 2026-08-04 - Phase 1 scaffolding

Created the Vite, React, and TypeScript shell; established the one-way module boundaries; added complete shared type contracts; and left simulation modules as explicit stubs. Implemented and tested the isometric coordinate transforms. The application renders only a full-viewport placeholder canvas and labelled panels.
