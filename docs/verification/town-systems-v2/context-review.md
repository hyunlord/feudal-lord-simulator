# Context and scope review — town-systems-v2

Verdict: **PASS — final implementation, natural trajectory and delivery context are consistent with prior constraints.**

Read-only review against HEAD `6684a6a`, current source diff and newly added engine files, DESIGN.md, docs/DEVELOPMENT_STATUS.md, local work plan, occlusion report/matrix, growth proof script, capture script and placement review. This review did not modify product files or independently execute the engine/browser.

## Confirmed alignment

- No generated art, existing runtime IDs, historical house profiles, asset scales, package dependencies, save schema, prices or construction recipes change. Approved L3 v2 and existing assets remain intact.
- Roads now paint before upright objects. Normal-mode automatic cursor/density transparency is removed, preventing roads or rear walls showing through otherwise opaque houses. Explicit outline mode remains intentional. Existing wall depth rules are retained; a genuinely foreground wall may correctly hide a lower portion of a house. The user request must not be translated into putting every wall behind every house.
- Placement safety now includes construction-site footprints through one helper shared by UI proposals, advisor proposals and actual proclamation confirmation. This closes the build-order gap instead of hardcoding one demonstration layout. The independent placement report distinguishes actual reducer checks from rendering evidence.
- Urban growth consults the same finite household service allocation used by engine and inspector, tries road repair before buying redundant nearby facilities, avoids same-kind pending construction and requires available workers for new markets. Candidates pass normal placement, clearance, affordability and connected construction checks, then use existing game actions. No free resources or instant completed buildings are introduced.
- The new civic export reserve addresses the observed economic deadlock: selling construction material below the church cost. Existing reserved goods remain excluded; sequential market settlement recalculates remaining available stock. The rule intentionally applies to manual play as well as automatic development and should be explained as an economic rule, not an advisor-only hidden bonus.
- The natural proof starts from an unchanged DEFAULT_GAME_STATE and runs normal advisor/reducer/ticks. The state used for screenshots is an output of that engine trajectory, not an independently composed prosperous city fixture.

## Evidence boundaries required in delivery

1. `occlusion/before.png` and `after.png` are six synthetic scenarios using the real renderer/assets. `matrix.json` contains 240 software-Chrome combinations and zero recorded failures. Report DPR, zoom, footprint/orientation coverage without claiming universal layout or GPU/backend parity. Foreground wall occlusion is expected and retained.
2. `capture-town.mjs` injects a recorded engine state into initial React state and uses real UI inspection. Label these as **natural engine result loaded in the actual development UI**, not as hundreds of thousands of ticks played through browser clicks. Separate road deletion/rebuild interaction evidence from the natural trajectory.
3. Final refresh verified `growth/final-report.json`: tick415877, population256, eight L4 houses at32 residents each, all water/market/church supplied, no construction, rejected actions or invalid ledgers. The revised proof checks this stability condition **every tick**, holding it from403877 through415877 for12,000ticks; advisor decisions remain every120ticks. This condition proves full population/L4/services stability, not strictly positive bread stock at every tick. Final bread stock is12 per home. `source-sha256-check.log` verifies all18 recorded engine/service source hashes. Earlier summaries and intermediate logs are historical counterevidence, not the final outcome.
4. Growth is a deterministic heuristic, not a global optimizer. Resource/worker shortage, blocked terrain, bad old save geometry and arbitrary future manual layouts are not repaired magically. Existing saves are not automatically relocated.

## Final refresh: resolved delivery checks

- `docs/DEVELOPMENT_STATUS.md` now marks the392808tick result explicitly as the prior stage and links the updated system report.
- `docs/TOWN_SYSTEMS_V2.md` distinguishes natural engine state loaded in UI, actual road interactions, and synthetic renderer comparisons. It explains foreground occlusion, construction footprints, civic reserve applying to manual play, real transport, service abstractions and limits.
- Late food siting uses actual reachable granary routes while retaining legal placement and clearance. It does not create goods or change production/consumption costs. Updated civic reserve includes outstanding unclaimed church deliveries; tick passes current labour construction sites into settlement so new reservations are not lost or counted against stale state.
- The plan scaffold and obsolete permission template are removed; task checkboxes remain an execution-closeout responsibility, not a scope issue.
- `growth/final-state.json`, `final-report.json`, source-hash checks, fresh grown-town/UI interaction evidence and strained/recovered states now exist. `interactions.json` identifies the final natural state, normal reducer road removal,400tick service-loss interval and23tick recovery without injected food/buildings/resources.
- Direct individual image links and final remote commit verification remain final delivery responsibilities.

No required source-code or context correction remains. The independent code, execution and image reviews own their respective correctness gates; this review did not rerun the full engine/browser tests.
