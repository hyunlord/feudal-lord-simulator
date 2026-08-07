# Todo 6 adversarial probes

Scenario: deterministic forest harvest history for successful logging output only.

Verified probes:

- No append before output completion: `tests/forestHarvests.test.ts` covers a logging camp below completion progress and expects `forestHarvests: []`.
- No append when output storage is full: `tests/forestHarvests.test.ts` covers a logging camp with `logs: 20`; production is blocked and history stays empty.
- No append for non-logging output: `tests/forestHarvests.test.ts` covers a wheat farm producing wheat; history stays empty.
- Tie-break is deterministic: nearest forest uses Manhattan distance, then `ty`, then `tx`; first logged coordinate is `{ tx: 2, ty: 1 }`.
- Duplicate coordinates are rejected: existing `{ tx: 2, ty: 1 }` causes the next append to choose `{ tx: 1, ty: 2 }`.
- Canonical order is stable: history sorts by `harvestedAtTick`, then `ty`, then `tx`.
- Saturation is non-blocking: when all forest coordinates are already recorded, logs still increment and history length stays unchanged.
- Stump age boundary is explicit: tick 599 is `fresh`, tick 600 is `old`.
- Static render queue cache observes `forestHarvests` reference changes, so future stump rendering cannot be hidden by stale tree cache.

Non-goals verified by diff/test scope:

- No terrain mutation or regrowth was added.
- No logging camp yield, cycle duration, capacity, route, or worker allocation setting was changed.
- Forest history is deterministic serializer state, not an economy depletion model.
