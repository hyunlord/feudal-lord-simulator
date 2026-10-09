# EB trunk e5abc impact review

Scope: read-only impact assessment of refreshed trunk range `5c9ea89de..e5abc0e64` before merging into the Engine B weight branch. This note separates simulation/audit validity from browser/UI evidence freshness.

## Verdict

- The running/completed 125-year Engine B weight results from source revision `2485af40046793f1856829fa1161dc4431942aa7` remain simulation-valid for this trunk refresh. I found no changes in `src/engine/`, `src/state/`, `src/save/`, `src/content/`, or `src/render/` in `5c9ea89de..e5abc0e64`, and no changes to the visible-capture harness, Vite/TS/package configs, or the saved-checkpoint decoder path used by the harness.
- Do not restart the 125-year seeds solely because of this trunk refresh. A restart would be justified only if a later merge/conflict resolution changes simulation-owned sources, save decoding, render-presentation state generation, audit/weight scripts, or harness logic.
- Do not carry forward the latest browser/UI claims as “latest trunk” after merging `e5abc0e64` without bounded revalidation. The trunk range changes live UI presentation and interaction files used by the browser harness: event cards/chips, story chip selection, chronicle/because-thread wording, decision-thread titles, and year-review thread headings.

## Diff surface checked

`git diff --name-only 5c9ea89de..e5abc0e64` contains 103 files. Categorization from the actual diff:

- `src/engine/`: 0 files
- `src/state/`: 0 files
- `src/save/`: 0 files
- `src/content/`: 0 files
- `src/render/`: 0 files
- visible capture harness/configs checked unchanged: `scripts/engineBVisibleCapture.mjs`, `scripts/engineBVisibleCapture.sh`, `scripts/remote/viteNoWatch.config.ts`, `package.json`, `vite.config.ts`, `tsconfig.json`
- UI/runtime changed: 45 files, including `src/App.tsx`, `src/ui/hud/EventCards.tsx`, `src/ui/hud/useStoryPresentation.ts`, `src/ui/chronicle/chronicleScreenModel.ts`, `src/ui/chronicle/decisionThreadModel.ts`, `src/ui/results/decisionThread.ts`, and `src/ui/results/lordYearReview.ts`

The only source-scan-list change I found is an added exception in `scripts/checks/sourceScanTests.mjs`:

- `tests/suitLedger.test.ts`: `walks $SUIT_LEDGER_STATES (DGX states); imports src`

That exception is for a suit-ledger test walking external DGX states. It is not an EB audit/source-scan behavior change.

## Harness boundary

`engineBVisibleCapture.mjs` is saved-checkpoint/browser QA, not a ticking simulation run. Its header says it opens actual saved checkpoints only. The harness imports `decodeSave` from `src/save/saveCodec.ts`, `stateCalendar` from `src/engine/scenarioState.ts`, `withResidentWalkers` from `src/render/presentation/residentWalkerState.ts`, and browser helpers from `scripts/renderCommitProbe.mjs`. The trunk range did not change those imported source areas or the harness file.

The harness checks saved-state integrity before UI inspection: manifest/source cleanliness, save file SHA/size, encoded save SHA, decoded-vs-raw state equality, observed tick, answer decision existence, and consequence links in saved state. It opens the scene with `run: false`, then compares browser state/presentation/history/trace against the saved checkpoint state.

That means the existing 125-year metrics, candidate observations, saved checkpoints, and manifest remain valid inputs. The same boundary also means browser evidence is sensitive to UI/runtime changes after the saved state is loaded.

## UI claims invalidated by the trunk refresh

The previous browser artifacts remain historical evidence for their source revisions, but should not be described as latest-trunk UI evidence after `e5abc0e64` is merged.

Revalidate these claim classes on the merged trunk:

- exact chip/card DOM claims and chip-id matching, because `EventCards.tsx` now adds `data-chip-id` to chips/cards and changes the decision button to handle lord-screen beats;
- chip presence/order/pinning claims, because `useStoryPresentation.ts` changes the due-chip source from `lordMattersDueNow` to `lordMatterChipIds` and adds `lasting` pinning behavior;
- manual forward/back chronicle link claims and because-thread wording, because `chronicleScreenModel.ts` and `decisionThreadModel.ts` special-case `crisis_prepared` wording;
- decision-thread/news/year-review text and section headings, because `results/decisionThread.ts` adds prepared-only titles and `results/lordYearReview.ts` uses those titles;
- visual/CJK layout claims for event chips/cards, chronicle, and year-review screens, because the visible UI text and layout surfaces changed.

Prior local evidence that should be treated as historical rather than latest-trunk after merge:

- `.omo/evidence/eb-visible125-functional-review.md` for the 31-case browser pass at `ee7d0ffe...`;
- `.omo/evidence/eb-old-history-review.md` for the targeted old-history recapture at `1bab7af...`;
- `.omo/evidence/eb-038-seen-review.md` for the ck_evt_038 `/seen` diagnosis.

## Recommendation

Proceed with integrating `e5abc0e64`; the trunk refresh does not provide source evidence requiring a new 125-year simulation run.

After integration, run bounded browser-only revalidation from the existing `2485af40046793f1856829fa1161dc4431942aa7` checkpoints on the merged trunk. At minimum recapture the targeted cases that exercised prior weak spots and UI-sensitive paths:

- `ck_evt_038` answer and final/no-pair path;
- `ck_evt_140` final/no-pair path;
- `ck_evt_201` cross-year consequence/backlink path;
- enough ordinary answer-to-consequence pairs to confirm chip/card IDs, forward/back links, and prepared/because wording under the new UI.

If a latest-trunk browser claim is needed for the full visible corpus, rerun the saved-checkpoint visible capture over the existing 31-case manifest. This is a browser/UI replay with `run:false`, not a simulation restart.
