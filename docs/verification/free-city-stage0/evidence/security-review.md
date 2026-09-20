# Final bounded security and data-preservation review

Verdict: PASS. Confidence: high for reviewed diff preservation properties. No blocking security findings.

Reviewed product: `/Users/rexxa/github/feudal-lord-simulator-playable`, branch `codex/phase15-organic-ground`, base `ec80d314`. Reviewed tracked diff SHA256: `42fdd97dfc6cab6950989303d67c40280edc6f588495cceeeceec3503d2c4a15`. All 17 changed file hashes are in `security-context-source.json`. Verdict applies only to those exact bytes; later edits require re-review. Product source was read only.

Independent bounded verification: `node --import tsx --test tests/autoplayFoodThroughput.test.ts tests/phase20GrowthHarness.test.ts`, exit 0, 33/33 passed, 2026-09-21. This reviewer did not run a full suite, a million-tick simulation, browser UI or deployment.

## Evidence

- `engine.types.ts` makes `autoplayFoodObservation` optional. All observation entry points guard absent fields, so legacy raw states lacking the observation remain valid; no migration deletes buildings, IDs, walkers, cargo, reservations or inventories.
- `gameStore.ts` creates observation metadata only after successful explicitly tagged autoplay food placement. Manual and rejected actions retain existing behavior. Cancellation invokes the unchanged `cancelConstruction` first, preserving the existing refund/carter-return contract, then removes only unfinished observation metadata. No cargo-removal shortcut was added.
- `roamingStep.ts` emits source granary ID, recipient house ID and actual delivered amount adjacent to the existing delivery operation. Cargo subtraction, house increment, reservations, return handling and walker retention remain the original operations. `tick.ts` attributes events only to the observed source and affected recipient; it does not spend or create food. Production observation counts the observed building's actual production event while retaining `stepProduction` unchanged.
- `terrainResourcePreflight` uses a copied hypothetical quarry placement probe with timber 999 and palisade era. The probe is never assigned to simulation state; it does not inject resources. Zero legal footprints with existing rock is diagnostic only; absence of rock is the blocking case.
- The harness refuses a nonempty output directory before state writes. Existing raw saves and failed-run evidence are preserved. This remains a single-process guard, not an atomic multiwriter lock.
- No new dependency, package/lockfile, networking, credential, shell-execution, terrain generator, balance, production/consumption rule, service allocation rule or default housing cap change is present. Default cap remains 8. Existing provenance execution is outside the new diff and uses argument arrays.

## Limits

This is not formal validation of arbitrary malformed JSON, a new save migration implementation, or a proof of equivalent future city trajectories after changed autoplay decisions. The optional metadata records runtime observations; old engines need not understand it. Stage 0 remains blocked by seed 2's unchanged initial zero-rock map. No curves, 3D, main merge or deployment is approved by this review.
