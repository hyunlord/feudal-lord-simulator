# Final validation

- Full initial suite: 1450 tests, 1448 passed, two stale test expectations failed.
- Updated housing diagnosis expectation to derived water allocation and exact missing-church text; registered only worldRasterCache as the new raster blit boundary.
- Final suite excluding the unchanged long Phase9 harness: 1445/1445 passed, 92.13 seconds.
- The five unchanged Phase9 harness tests passed in the full run (including deliberate broken scenarios); no production source changed afterward.
- Focused final regression run: 23/23 passed.
- TypeScript and production build passed. Vite reports an existing-size warning for the 561.70 kB main JS chunk.
- Accepted art verification passed; natural-simulation source hashes still match.
- Isolated staged-tree build passed without the neighboring art workspace.
- Browser, simulation and rendering evidence is preserved in this directory.

The final test evidence combines the five successful long-harness tests from the full run with the 1445-test clean rerun; it is not a claim of a second full 1450-test run.
