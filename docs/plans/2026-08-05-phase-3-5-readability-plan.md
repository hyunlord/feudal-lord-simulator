# Phase 3.5 Readability Implementation Plan

1. Add failing render-model tests for unique profiles, road arms, decals, tree
   clearing, zoom LOD, walker minimum size, and hover inspector content.
2. Extract deterministic terrain detail policy and implement ground paths plus
   decals without touching world or economy state.
3. Expand building profiles and split building/tree drawing while implementing
   unique roofs, signatures, and category-block LOD.
4. Add settlement clearing to object render selection and simplified low-zoom
   forests.
5. Rebuild walker marks with shadow, ink body, 5px cargo, distributor shoulder,
   and inverse-scale minimum size.
6. Add the pure hover-inspector model and a positioned parchment React view;
   extract pointer presentation concerns from `GameCanvas` as needed.
7. Run focused tests after every slice, then full typecheck/build/test/harness.
8. Run browser visual QA, capture the five required views, fix concrete
   readability failures, and repeat until the visual contract is met.
9. Commit with Lore trailers, fast-forward `main`, push, verify remote SHA, and
   restart the DGX `feudal-sim` session on port 3200.
