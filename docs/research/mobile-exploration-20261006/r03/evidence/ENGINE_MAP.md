# Engine reuse map — static source verification

관문: 소스 지도 완료 / 모바일 실행·성능은 미판정. Mac에서 읽기만 수행, 벤치마크·DGX·원본 코드 수정·커밋 없음.

Observed checkout HEAD: `eeccc92a6c3c67b82859d325492b8166f1e6a3be`. Files were readable while leader managed Git LFS checkout; this report does not certify clone completion. All paths below are relative to `/Users/rexxa/fls-astra-mobile`.

## Graft-first evidence

Exactly one query ran before source searches:

```
graft ask 'townAgency estates negotiation marriage litigation engine createInitialState tick serialize deserialize benchmark entrypoints' --source
```

Exit 0, output: `graft ask … (empty)` / `no matching nodes — try different words, or graft build if graft/ is empty`. The present `graft/` directory had no listed entries when inspected. No index build was attempted during the concurrent checkout; direct-source fallback was explicitly allowed by the assignment.

Saved tally: unavailable, not zero. `graft saved` is not a supported command (`error: unknown command 'saved'`). Correct installed command `graft stats` returned `graft stats: no session recorded yet — use graft in an agent session, then look again.` No token-saving number is asserted.

## Actual callable systems

| System | Source verified entrypoints | Reuse constraints |
|---|---|---|
| Town agency | `src/engine/townAgency.ts:46` initialAgency; :65 setEstatePolicy; :83 setProjectSubsidy; :95 setMarketDues; :325 townProposals; :396 applyTownAction; :499 advanceTownAgency; :607 whyHere; :627 auditReceipt | Weekly gating at :501. Uses autoplay planning/search, construction, placement, zones, inventories, labour, ledger and receipts; it is not an isolated policy calculator. |
| Estates / rights | `src/engine/estates.ts:88` initialEstates; :96 estatesOf; :135 takePossession; :144 restorePossession; :180 raiseClaim; :204 settleForLife; :248 advanceEstates; :304 estatePortfolio | Annual gate :249, lazy lord-mode estate initialization :251. Depends on persons/aging/heredity/portrait identity, configuration and deterministic seed hashing. |
| Negotiation | `src/engine/negotiation.ts:26` EMPTY_DIPLOMACY; :29 diplomacyOf; :88 evaluateOffer; :120 materialCeiling; :203 counterOffer; :239 offerDraw | Reads treasury, rights/estate holdings, persons/year, lordship and balance config. Pure-looking state functions still need complete semantic GameState; no separate service/package. |
| Marriage | `src/engine/marriage.ts:85` marriageGrooms; :104 marriageCandidates; :114 marriageRefusal; :137 proposeMarriage; :154 answerCounter; :211 keepPromise; :374 answerWillChange; :528 advanceDiplomacy | Advances lapseCounters → promises → marriage; no diplomacy means immediate return (:529). Uses negotiations, ledger transactions, estate claims/life settlement, people and portraits. |
| Litigation | `src/engine/estateSuits.ts:59` fileSuitRefusal; :72 fileSuit; :86 addSuitEvidence; :99 seekSuitPatron; :108 suitHearing; :142 enforcePossession; :171 advanceSuits | Actual implementation is estateSuits.ts, not litigation.ts. Seasonal gate :172; stage fees can prevent progress (:177–181). Must seed a valid claim/suit to measure active litigation. |

`src/engine/tick.ts:287–298` is the composed tick entrypoint. It calls the requested town agency, estates, suits and diplomacy systems, plus population, logistics, events, politics, construction, land, money, trade, history and registry. `advanceSimulationSubstep` at :135 is only the economic/logistics substep and cannot stand in for the full Lord Mode engine. Abandoned settlements return unchanged (:288).

## State and save seams

- `src/state/newGame.ts:35–64`: `newGameState({ scenarioId, seed, mode, archetypeId?, house? })` returns GameState or null. Explicit fixed seed avoids the intentionally random seed picker (:26). Lord mode injects agency and registry at :63. `core:lord_slice` is defined in `src/content/scenario/coreScenarios.ts:93`; campaign id is :155.
- Important extraction coupling: factory imports `DEFAULT_GAME_STATE` from `src/state/gameStore.ts` (:13). The store imports React (:17) and save hooks (:68). Node import may work with installed dependencies, but this is not yet a clean framework-independent factory. Measure startup/import cost separately from tick cost; do not describe removing React as already completed.
- `src/save/saveCodec.ts:45`: `encodeSave({ state, createdAt, savedAt, scenarioId?, gameVersion? })` produces Uint8Array, header, serialization timing. `decodeSave(bytes)` at :186 validates checksum, migrates, validates envelope and returns `{ envelope, migratedFrom }` (:194–206). Loaded state is `decoded.envelope.state`.
- `toSnapshot` (:41–42) returns the state itself; serialization, not this helper, establishes independent bytes. Use a fixed timestamp for deterministic byte comparison.
- Save schema currently 49 (`src/save/saveTypes.ts:5`). Retain migration chain and validation, ledger and scenario registries together; copying only a serializer is insufficient.
- Web persistence is already behind `SaveStorage`; `MemorySaveStorage` is `src/save/saveStorage.ts:12`. `src/platform/saveStoragePlatform.ts:6–11` explicitly calls Capacitor and file stores reserved/unimplemented. IndexedDB→memory fallback at :24–36 must not be presented as mobile durable-save support.

## Existing layout versus proposed architecture

The source tree has `engine`, `content`, `state`, `save`, `platform`, `agents`, `population`, `economy`, `zones`, `geometry`, `world`, `ledger`, `render`, and `ui` responsibilities. A filename search found zero files under literal `src/core/`, `src/modules/`, or `src/packs/`. Namespaced content ids such as `core:lord_slice` are not evidence of a `core` package.

`docs/design/foundation.md:42–58` describes deterministic engine → read-model API → render/UI and data registries as the target contract. It is not evidence that engine, modules and content packs already have independent package builds. Reuse existing functions first; isolate startup factory, command/read-model boundaries and platform storage in a later implementation task. Preserve game rules, historical content, IDs, seeds, receipts, save migrations and ledger semantics. A smaller mobile UI or less frequent presentation update can be explored without rewriting those rules.

## Small local benchmark proposal (not executed)

Preferred harness command after leader writes and reviews a bounded standalone harness:

```
./node_modules/.bin/tsx mobile-study/scripts/engine-bench.ts
```

Proposed harness: fixed seed 1, `newGameState({scenarioId:'core:lord_slice',seed:1,mode:'lord'})`, reject null, 20 warmup full ticks then 200 timed full ticks, stop immediately on abandonment; log whether agency/estates/diplomacy/suits actually activated. Record runtime/CPU/OS/HEAD, warmup/count, mean/p50/p95/p99/max, state dimensions/buildings/people/walkers, memory before/after, tick progression and one fixed-timestamp save encode/decode duration plus byte size and round-trip state check. Use separate explicitly labelled synthetic fixtures for seasonal/yearly/active suit or marriage boundaries; do not claim 200 opening ticks exercised them. Bound total wall time in the harness and keep setup/save outside tick timings. This is desktop Node screening only, not iPhone Safari/Android WebView or renderer/frame/thermal/battery proof.

Existing reusable timing recipe: `scripts/perf/tickTiming.ts:10–27` uses the real tick, fixture migration, 50 warmups and percentile timings. A bounded command would be `./node_modules/.bin/tsx scripts/perf/tickTiming.ts 200 1`, but its ch4-1380 fixture (:12) must be LFS-real, and it is a mature-town load with unspecified Lord Mode activation. Prefer the opening harness for the requested small local study. Default existing 3000×3 invocation is not proposed. No benchmark was run by this mapper.

Package evidence: `package.json:39–52` declares React/React DOM 19.2.8, fonts, tsx 4.23.5, TypeScript 7.0.2 and Vite 8.2.0. Existing commands include typecheck, changed tests and perf gate; local small tests are permitted by AGENTS, while broad suites/browser/long runs are not in this task. No dependency addition is necessary for the proposed harness. Source-level feasibility does not establish a measured mobile performance budget.
