# Round 02 scene source map

- Read-only source review at `/Users/rexxa/fls-qa`, HEAD `d5b3f88aa3003834437cb559c361e1c77d8ef541`.
- Performance lock active. No browser, simulation, bot, direct engine calls, proof mode, save changes, product edits, or broad archive scans performed. Small source reads and JSON metadata reads only. Current decoder compatibility NOT rerun under the lock.

## Exact available originals and limits

| Target | Original source under repository | Observed stored state | Qualification |
|---|---|---|---|
| 1장 종료 1318–1323 | `fixtures/saves/v33/population-176.save.json` | tick27471/year1306, no politics | Pre-famine original; requires genuine normal UI progression. Not an exact ending save. |
| 1323 alternative | `fixtures/saves/v33/timber-shortage.save.json` | tick92684/year1323, no politics | Date only; not a chapter-end original. |
| 1340 | `docs/qa/round01/repro/saves/middle1340.json.gz` | tick162948/year1340, **chapter1**, ends[], war exists | Actual war-event state, NOT actual chapter2. Cannot fulfill chapter2 target. |
| 1348 | `docs/qa/round01/repro/saves/plague1348.json.gz` | tick194560/year1348, **chapter1**, ends[], plague.first exists | Actual plague-era state, NOT actual chapter3. Cannot fulfill chapter3 target. |
| Existing early continuation | `docs/qa/round01/repro/early-current.save.json.gz` | tick105451/year1326, chapter1, ends[] | Previous failed famine branch; not useful for end gate. |
| 4장 original | `fixtures/saves/v33/chapter-four-town.save.json` | tick275340/year1368, chapter4, ends1–3 | Fixed historical fixture only; not live chapters1–3. |
| 1380 original | `fixtures/perf-gate/ch4-1380.save.json.gz` | Prior decoder review: tick320000/year1380/chapter4 | Historical synthetic/fixed fixture; label explicitly. No fresh decoder run this pass. |
| 5장 original | `fixtures/saves/v33/chapter-five-town.save.json` | tick329000/year1382, chapter5, ends1–4 | Fixed historical fixture only. Original source/provenance in v33 manifest; not a natural new UI run. |

Round01's `docs/qa/round01/repro/scene-candidates.md` documents prior exhaustive discovery: 336 direct state-shaped files plus146 state-shaped archive members, no compatible actual chapter2/3 original. Its original decoder run was HEAD4ad2d2a4/schema32, not this HEAD. Small fresh metadata reads above confirm the tempting round01 middle/plague files still contain chapter1. Do not claim a new exhaustive search. Previous playable/output directory inventory contains old playtest/rule-repair snapshots; prior source discovery already classified legacy finals without politics as unsuitable.

## Normal chapter1 route and exact gate

`src/engine/politics.ts:287–291,438–445`: ALL required: actual great-famine record with endTick, populationAtArrival, populationAtEnd; end population >=60% of arrival population; current era !=hamlet; no already recorded chapter1 end. Campaign then writes chapter1 ending and changes chapter.number to2 in the same tick. Later population recovery does NOT repair the recorded famine-end population.

Normal UI strategy (not a promise of success): load untouched population176 original through the normal save route, enable **설정 → 자동 발전** and visibly verify aria-pressed/on state, run normal speed controls, inspect food/granaries/markets and remaining construction resources, respond to famine with **구휼**, and keep town advancement supported through ordinary UI. Save/capture the real chapter-end modal when reached, then **제2장으로 → 제2장 시작**. Record this as explicit autoplay-enabled scene preparation, not manual natural play.

Why relief: `src/content/chapterConfig.ts:15–34` and `src/engine/famineRelief.ts` implement poor-household bread relief and lower seasonal departure cap (1 versus2 normally,3 for speculation). It still needs functioning supply; it does not guarantee60% survival. Chapter1's historical famine era starts1315, delayed up to1320 until granary+12lots+market (`coreScenarios.ts:45–49`). Observe recorded completion rather than date alone.

Round01 manual progression with autoplay OFF chose relief but arrival171/end37 at tick89500, so failed. Starting from that failed continuation cannot fix the historic ratio. Fresh original+explicit autoplay is an authorized different strategy; its result remains unverified. No bot-script execution suggested.

FIX-10 report (`docs/verification/fix10/REPORT.md`) adds timber purchases and fords/bot crossings; it can unblock resource-constrained growth, but does not claim to repair famine survival. It explicitly leaves the late-game grain-planning defect as BOT-4. Do not promise latest FIX-10 solves population176 famine failure. Its fresh bot campaign results are evidence of engine campaigns reaching free_borough, not proof this imported source succeeds through normal UI.

## Actual chapter2/3 and event timing

- Check real chapter indicator or original saved politics.chapter.number, not just visible1340/1348 date.
- `war.ts:480–490`: chapter2 ends only when current chapter2, campaign mode, and year>=1348 OR war recovered plus chosen market / complete stone wall. The war event itself can exist while chapter1 remains blocked, as saved round01 state proves.
- War begins with era1337; old imports first seen after1340 miss messenger. `warConfig.ts:24–38`: raid9 or13 seasons after messenger (normally1339/1340); beacon1 season before raid. Coastal archetype required (`war.ts:55–58,374–384`).
- `plague.ts:63–70` and `plagueConfig.ts`: collapse era1348, coastal arrival sooner; plague state alone does not establish chapter3. Capture actual chapter3 plus plague arrival/first record.

## coastal_port / fen_drainage and QA information

At this HEAD there is NO supported normal UI/URL map selector found. `src/ui/screens/WelcomeScreen.tsx:93–106` renders only CORE_SCENARIOS mode buttons; `src/content/scenario/coreScenarios.ts` registers campaign/sandbox, both default open_field; `src/App.tsx:390–401` dispatches scenarioId only. Engine `start_new_game` accepts archetypeId, but directly dispatching it or generating altered saves bypasses the allowed normal UI and is not proposed.

Known campaign results exist at `docs/verification/fix10/campaign/coastal_port-seed{1,2,3}.json` and `fen_drainage-seed{2,3}.json`; analogous ARCH-1b files and terrain JPGs exist. `scripts/archetypeCampaign.ts:45–59` returns summary fields (final population/year/chapter, chapterEnds, raid, plague, decades), NOT a full GameState/save. These are not loadable scene originals. Fen seed1 result explicitly missing in FIX-10 report. No suitable fixed-save coastal/fen original found in targeted paths this pass.

No QA information panel/display implementation found by targeted source search for QA/qa-info/buildSha/commitSha. Do not claim it is available. This and map-selection absence are source-backed access blockers at this HEAD; recheck if upstream supplies a new build/original compatible save.

## Live-observation correction

The source review above over-restricted the beacon/raid to the new coastal_port map. Normal play from population176 DID show beacon and raid in1339. `src/content/scenario/archetypes.ts:31–32` marks the default riverside/open_field town as coastal:true (tidal river mouth); `src/engine/archetype.ts:16–17` falls back to the scenario archetype when the legacy save has no archetypeId. `chapter2-war1340.json.gz` records raid tick157000,1 burnt house,559 goods,73 coins. This does NOT supply a new coastal_port/fen_drainage terrain scene. Earlier source assumptions are retained as investigation history and superseded by this observed correction.
