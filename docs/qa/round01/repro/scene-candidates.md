# Scene candidates — read-only decode evidence

HEAD: 4ad2d2a4. Scanned repository fixtures plus existing output/docs state-shaped JSON/gzip. Called official decodeSave only; no game tick, bot, app/browser, state edits, or repository edits. Calendar: 1300 + floor(tick / 4000). Save decoding PASS is not UI/scene verification.

## Closest candidates

| Target | Source | Tick / year | Official decode | Qualification / normal UI plan |
|---|---|---|---|---|
| Chapter 1 end | fixtures/saves/v32/population-176.save.json | 27471 / 1306 | PASS v32 | Prefer this pre-famine city over later legacy snapshots. Politics absent initially; normal engine initializes chapter 1. Use ordinary 5x play and normal decisions until chapter completion appears. Target end not guaranteed by year alone. |
| Chapter 2 around 1340 | fixtures/autoplay-search-budget/seed4-120000.json.gz | 120000 / 1330 | PASS v0→32 | Closest pre-year candidate but politics absent, so NOT an established chapter-2 scene. Prefer continuation from actually observed chapter-1 completion above. 40000 ticks to 1340 if using this older snapshot, and chapter progression must be observed. |
| Chapter 3 plague | Same actual chapter-2 UI continuation | 192000 = 1348 | Not an existing exact fixture | Continue with ordinary UI choices. Plague presence and chapter must be observed, not inferred from calendar. No exact immutable plague state found. |
| Chapter 4 1380 | fixtures/perf-gate/ch4-1380.save.json.gz | 320000 / 1380 | PASS v30→32 | Actual politics chapter 4; completed chapters 1,2,3 present. Exact target date source. |
| Chapter 5 1440 | fixtures/saves/v32/chapter-five-town.save.json | 329000 / 1382 | PASS v32 | Actual politics chapter 5; completed chapters 1,2,3,4 present. Continue ordinary 5x UI to tick 560000 / year1440: 231000 more ticks. |

At configured 20 ticks/sec and 5x, ideal elapsed times excluding interruptions/throttling: 40000 ticks ≈ 6m40s; 231000 ticks ≈ 38m30s. Use visible calendar, not elapsed time, as the stop condition. No direct tick fast-forward is authorized or proposed. Auto-development is separate from speed; it builds roads and changes the observation scene.

## Other verified candidates

- fixtures/saves/v32/timber-shortage.save.json: PASS v32, tick92684/year1323; nearest pre1340 current-schema save, but politics absent. Its name/schema does not establish chapter2.
- fixtures/saves/v32/chapter-four-town.save.json: PASS v32, tick275340/year1368, actual chapter4 and ends1–3.
- fixtures/construction-reserve/seed2-113040.json.gz: PASS v0→32, tick113040/year1328; politics absent.
- output/playtest-a-double-prime/seeds/final-689bda7/seed4/final-state.json: PASS v0→32, tick540864/year1435; politics/plague/legacy absent. Near1440 but NOT chapter5. Do not use as chapter5 evidence.

## Rejected compatibility candidates

Every one of the 11 files under fixtures/autoplay/ fails official decodeSave with `Save state zone undo ordinal is out of range`. This includes seed3-120000.json.gz, seed1-78560-pre-palisade.json.gz, seed2-70140.json.gz and all other autoplay snapshots. Do not repair, wrap, or edit them to force this QA setup.

fixtures/zones/town-with-arable.json also fails normal decode (`Save has no schemaVersion and is not a v0 state`).

All 11 fixtures/saves/v32 saves PASS decoding. Only chapter-four-town and chapter-five-town contain existing chapter state; no chapter-one/two/three/end-named saves exist in the fixture inventory. Historical versions repeat older snapshots; they do not supply the missing exact scene.

## Setup

Use original save bytes (gzip decompressed only), `decodeSave(bytes)` for validation, then normal `IndexedDbSaveStorage.write("manual", bytes)`, reload, and normal Continue / manual-slot UI. Use isolated browser storage per source so a newer autosave cannot win Continue selection. Record source SHA and migratedFrom. Never present this setup as natural uninterrupted play.

Source anchors: src/save/saveCodec.ts:decodeSave; src/engine/scenarioState.ts:calendar; src/content/balanceConfig.ts:TICKS_PER_SECOND/TICKS_PER_YEAR; src/ui/SpeedControls.tsx:SPEED_SEALS; src/engine/politics.ts:initialPolitics/updatePolitics; fixtures/saves/v32/manifest.json.

## Follow-up: 1315 summer still showing palisade-village goal

This observation does NOT establish missing story mode. `population-176` has scenarioId `core:campaign_market_town`, which registers GREAT_FAMINE_EVENT_ID and the war/plague/reorganisation/legacy sequences (`src/content/scenario/coreScenarios.ts:CORE_EVENTS`).

`src/engine/tick.ts:advanceTick` calls `advancePolitics`; `src/engine/politics.ts:advancePolitics` initializes missing politics on its first eligible tick when the scenario has the famine event. `initialPolitics` starts chapter1 at that live tick. Thus absence of politics in this imported fixture does not by itself prevent story progression.

The HUD deliberately shows a chapter goal card only for `chapter >= 2` (`src/ui/tutorial/useTutorialController.ts:generalCards`, lines298–312); chapter1 retains the settlement goal such as palisade village. No chapter label in1315 is expected, not proof of sandbox mode.

Chapter1 completion requires ALL: no existing chapter1 end; famineSurvived(state); era != hamlet (`politics.ts:advancePolitics`, lines438–445). famineSurvived requires an actual great-famine record with endTick, populationAtArrival and populationAtEnd, and populationAtEnd >=60% of populationAtArrival (`politics.ts:famineSurvived`, lines287–291). Therefore the 1315 famine warning is not completion and calendar alone cannot transition chapter. In campaign mode the successful condition records chapter1 end and changes politics.chapter to2 in the same tick.

Conclusion: this source is NOT categorically blocked from story progression. Continue ordinary UI famine decisions and settlement progression if authorized; retain required population and leave hamlet era. Mark chapter1/2/3 scene coverage unverified until the actual chapter transition/event is observed. Do not call the visible date a substitute for chapter completion or plague occurrence. This source review did not run any game tick or inspect live browser state.

## Final additional search after population-176 famine failure

The leader's live UI observation supersedes the earlier proposed route: population-176 reached a famine populationAtArrival171/populationAtEnd37, below the60% survival gate, so it did not establish chapter1 completion. Seed4-120000 at1334 remains chapter1. No state edits or replay claims were made to bypass either result.

Expanded original-source inventory: recursively read state-shaped JSON/gzip from output/, docs/, fixtures/ (ALL saved schema versions), and tests/fixtures/. Found336 state-shaped files,312 pass the current official decodeSave. **ZERO decoded originals already have politics.chapter.number2 or3.** This includes public checked-in natural-play snapshots and legacy finals in those paths.

Also read archive members in memory only, without extracting/mutating files:
- output/trunk-baseline/recorded-states.tar.xz:73 state-shaped originals,0 with politics,0 chapter2/3 candidates.
- fixtures/autoplay-search-budget/slow-inputs.tar.xz:67 state-shaped originals,0 with politics,0 chapter2/3 candidates.

Result: **No suitable immutable original chapter2/3 alternative found in the checked-out repository, public checked-in snapshots, or these archives.** Existing chapter4/5 saves retain historical chapterEnds but are not live chapter1-end/1340/plague-arrival scenes and must not replace the missing scenes. This was a read-only source/decoder search; no browser, game tick, bot, synthetic state, or repository mutation.

## Final relaxed-discovery criterion, unchanged game rules

Searched for originals that could finish chapter1 on a normal tick even without politics: great_famine record has endTick/populationAtArrival/populationAtEnd, end population >=60% of arrival, era !=hamlet, no existing chapter1 end, and official decodeSave succeeds. This is the existing advancePolitics gate, not edited rules or state.

Direct336 state files: **0 usable candidates**. Two raw originals meet the famine/era numeric criterion but fail the unchanged official decoder: fixtures/autoplay/seed3-market1-1200000.json.gz and fixtures/autoplay/seed5-276000-log-overflow.json.gz, both `Save state zone undo ordinal is out of range`.

Archive rescan used streaming decompression with no per-member40MB output limit. Corrected inventory is77 state-shaped members in recorded-states.tar.xz and69 in slow-inputs.tar.xz (the earlier73/67 counts omitted oversized members). In the complete146-member archive scan, **0 originals meet the famine/era criterion**, so no decoder-usable chapter1-completion alternative exists there either. Initial whole-buffer decompression hit ENOBUFS; streaming recovered and completed the read-only scan without extraction or mutations.

Final discovery outcome: **No qualifying unedited source found.** Do not modify the two invalid saves to force setup; missing chapter scenes remain unverified. No browser/game ticks/bots were executed in this investigation.
