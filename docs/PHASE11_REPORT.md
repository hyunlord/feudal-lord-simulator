# Phase 11 Published Experience Recovery Report

## 1. Diagnosis: six investigations and the actual cause

The published site looked like a placeholder even though the simulation and authored art existed. The six required investigations established the following:

- Network and console: all 35 sprite requests returned the Pages HTML fallback (`404`, `text/html`), with no page exception or connection failure. The renderer therefore remained alive while every image load failed semantically.
- Asset-loader state: every one of the 35 manifest keys was `missing`; the prior gate had treated transferred HTML as a successful response instead of requiring `200 image/png` and a decoded image.
- Draw trace: real tree keys were selected, but `drawWorldSprite` returned `false` with `image_missing`, so the canvas deliberately fell back to geometric shapes.
- Camera and LOD: startup zoom was `1.111111111` and the full-detail LOD was active. LOD was not suppressing the art.
- Bootstrap state: a fresh default and a fresh published session both contained four cottages, one well, and 12 residents. The settlement was not absent from state.
- Persistence: there was no stale save or reset path wiping the village; only the welcome-dismissal sentinel was stored.

The primary root cause was `servedUrl()` discarding Vite's GitHub Pages repository base and requesting `/assets/...` from the domain root. That made all 35 authored images fail while fallback geometry kept the canvas nonblank. A second presentation defect then amplified the impression: the onboarding layer painted 1,901 semi-transparent parchment diamonds over the map. Separate, real UI defects were untranslated English literals and a ledger layout that clipped at narrow widths.

The first genuine public five-minute run exposed an additional gameplay root cause after the rendering fix: starting residents began starving after the ordinary 300-tick window and lost one resident every 50 ticks. Population fell from 12 to 0 before a novice could establish food production. This was not hidden; it was converted into a RED regression test and fixed before the corrected run.

## 2. Fixed defects versus red herrings

Fixed:

- asset URLs now use Vite's `BASE_URL`, so the same resolver works at `/` and `/feudal-lord-simulator/`;
- asset verification requires actual PNG content and decoded, drawable images;
- renderer diagnostics expose selected keys, successful sprite draws, missing assets, and geometry fallback counts;
- the 1,901-diamond onboarding wash became one quiet, localized guidance region;
- the first current action is singular, Korean, and tied to the relevant build tool and map region; the next task is not shown simultaneously;
- direct English status literals were localized and the ledger was made responsive;
- only the four authored opening houses receive a 6,000-tick starvation grace period; ordinary houses retain the normal 300-tick balance rule;
- house diagnostics honor that explicit grace instead of falsely announcing decline.

Red herrings:

- camera zoom and sprite LOD were already correct and did not cause missing art;
- Canvas itself was not blank: fallback geometry was visible, which is precisely why a nonblank-only gate passed;
- game state did contain the authored settlement, so bootstrap deletion and persistence corruption were ruled out;
- no new image generation or replacement assets were needed; the committed assets were valid.

## 3. Why previous gates passed and the regression guards added

Earlier tests hosted the app at the domain root, preserved root-relative URLs, mocked `Image` objects, or accepted any nonblank canvas. The public check accepted an HTML response body as an asset transfer. Together these proved that the renderer could draw something, not that GitHub Pages could resolve, decode, and draw the authored sprites.

The new guards cover both producer and consumer:

- root and repository-base URL resolution are asserted separately;
- published asset probes reject redirects, HTML fallbacks, wrong MIME types, and undecoded images;
- browser evidence requires all 35 assets ready, successful authored sprite draws, and zero geometry failures;
- onboarding tests require exactly one current task, zero visible next tasks, Korean copy, and the correct highlighted tool;
- responsive checks cover 1280, 768, and 375 pixel widths;
- an opening-settlement regression advances 6,000 ticks and asserts population never drops below the initial 12;
- ordinary-house starvation behavior remains independently covered, preventing a silent global balance change.

## 4. Owner decisions and reasoning

- Use `import.meta.env.BASE_URL`, not a hardcoded Pages prefix: local preview, alternate deployments, and the repository path now share one contract.
- Preserve the gameplay model's `next` field but hide it in the opening UI: progression logic stays stable while the novice sees one action.
- Replace the repeated tile wash with one restrained region cue: it communicates where to act without masking authored terrain.
- Reuse the existing 35 assets: diagnosis proved the files were valid, so generating replacements would have treated a routing bug as an art problem.
- Localize user-facing literals and reflow the ledger in place: no dependency or parallel design system was justified.
- Apply 6,000 ticks of grace only to explicit opening-house fixtures: this protects the five-minute learning window without weakening ordinary-house starvation balance.
- Keep the browser proof port read-only: UI clicks and normal speed drive the session; snapshot and tile-coordinate access may observe but cannot advance simulation state.
- Record the failed public session and rerun after a test-first repair: publication evidence must show the defect discovery, not erase it.
- Accept bounded nonblocking review dissent after two rounds: the functional and visual acceptance gates were green, and the remaining items did not contradict the requested outcome.

## 5. Review objections overridden under the two-round cap

The following objections are reproduced verbatim and recorded as nonblocking rather than silently discarded:

- `hidden \`next\` still computed in \`src/ui/onboardingTaskModel.ts\`` — accepted as a maintainability follow-up. The field remains part of progression state, but the rendered opening experience proves it is not exposed.
- `avoidable resolver cast in \`tests/phase11PublishedUi.test.ts:22\`` — accepted as test-cleanup debt. It is confined to a resolver fixture and does not weaken the runtime contract.
- `mobile target weaker due constrained forest` — accepted as a narrow-viewport tradeoff. The 375-pixel view still exposes one current task, its relevant tool, a usable canvas, and healthy authored assets.
- `desktop center group label tight` — accepted as a polish issue. It remained readable at 1280 pixels and did not clip or obscure the action target.

The design and Korean/CJK visual reviews both returned PASS with no blocker. No third review round was opened.

## 6. Five-minute public session, screenshots, final population, and every confusion

The first public run against `3b2cdaee255b0d5e66773553fae2520d94f3249d` lasted 300.320 seconds and reached tick 5,956. It loaded and drew all authored assets, but population changed `12 → 0` by the first 60-second checkpoint and remained zero. That run failed the acceptance criterion. Its complete state log is `/tmp/feudal-phase11/public-five-minute/session.json`; screenshots are `/tmp/feudal-phase11/public-five-minute/minute-00.png` through `minute-05.png`.

After the opening-house grace fix was published, the corrected ordinary-UI run used three road drags, placed a logging camp, sawmill, and storehouse, then selected `1배속`. It did not call a direct tick mutation. The run lasted 300.343 seconds and produced:

| Time | Tick | Population | Evidence |
| ---: | ---: | ---: | --- |
| 0s | 0 | 12 | one current logging-camp task; 35/35 assets; 120 sprite draws; zero geometry failures |
| 60s | 1,166 | 32 | all three buildings complete; nine idle workers; logs-carrying carter moving |
| 120s | 2,366 | 32 | storehouse timber 20; carter active |
| 180s | 3,557 | 32 | storehouse timber 32 |
| 240s | 4,757 | 32 | storehouse timber 44; sawmill progress 30 |
| 300s | 5,957 | 32 | storehouse timber 56; outbound carter; no asset/resource failure |

Corrected evidence is `/tmp/feudal-phase11/public-five-minute-corrected/session.json`, with screenshots:

- `/tmp/feudal-phase11/public-five-minute-corrected/minute-00.png`
- `/tmp/feudal-phase11/public-five-minute-corrected/minute-01.png`
- `/tmp/feudal-phase11/public-five-minute-corrected/minute-02.png`
- `/tmp/feudal-phase11/public-five-minute-corrected/minute-03.png`
- `/tmp/feudal-phase11/public-five-minute-corrected/minute-04.png`
- `/tmp/feudal-phase11/public-five-minute-corrected/minute-05.png`

Final population was 32, above the initial 12. All six checkpoints had 35/35 ready assets, 120 successful sprite draws, zero geometry failures, and no resource-load failures.

Every confusion observed:

- Opening status says `水우물이 필요합니다` while a well is visibly present. It appears to mean household service or route coverage, but the wording looks contradictory.
- The logging-camp cue identifies a broad forest-adjacent region. It teaches the rule, but dense foliage still makes the exact footprint a trial choice.
- After storehouse placement, the storehouse tool remains armed and status continues to say `지을 곳을 클릭하세요 — 창고 · 취소하려면 Esc` even though the current task has advanced to the food chain.
- The food-chain task names and highlights three buildings, but their recommended sequence and road connection are inferred rather than explicitly taught.
- In the failed first run, all workers disappeared. That was a real defect and was fixed; it did not recur in the corrected run.

## 7. Test output and determinism hash

Verification recorded before this report gate:

- focused Phase 11 product tests: `21/21` pass;
- final expanded full suite: `866/866` pass, 16 suites, zero failures, 45.98 seconds;
- typecheck: `tsc --noEmit` pass;
- GitHub Pages build: pass, 176 modules;
- harness: all 14 metrics pass with eight workers.

Determinism evidence:

- current: `e33eda222a38da4a == e33eda222a38da4a`;
- legacy comparison: `5a393f13af3e61be`;
- Stage 3 comparison: `007c206047131a97 == 007c206047131a97`.

Harness log: `/tmp/feudal-phase11/harness-after-starvation-grace.txt`. Cross-viewport visual evidence: `/tmp/feudal-phase11/part2-desktop-1280.png`, `/tmp/feudal-phase11/part2-tablet-768.png`, `/tmp/feudal-phase11/part2-mobile-375.png`, with machine-readable facts in `/tmp/feudal-phase11/part2-qa.json`. The expected large difference from the broken published reference is recorded in `/tmp/feudal-phase11/part3-image-diff.json`.

## 8. Pushed commits and public update confirmation

Phase 11 product commits pushed to `origin/main`:

- `16eb1c4aee02dece62c76be26c19c4fecc70d1e7` — make published render failures observable;
- `daf920ef64590298f50dde37e6335b83b0efe712` — record the diagnosis before repair;
- `09f38a10ac2b22ad02e278617cc19660377257d5` — restore authored assets on repository-base deployments;
- `3b2cdaee255b0d5e66773553fae2520d94f3249d` — make the first action singular and unmistakable;
- `894886cc8dbb0c4ea25bc8ad74a9fc92e8f7f6dd` — protect the opening settlement's learning window.

For each push, local HEAD and remote `origin/main` were equal. GitHub Pages workflow `31272754632` completed build and deploy successfully for `894886cc8dbb0c4ea25bc8ad74a9fc92e8f7f6dd`. The public HTML referenced the exact Pages build bundles `index-DmNxO6Iy.js` and `index-VklrvcOu.css`, and the corrected five-minute run used `https://hyunlord.github.io/feudal-lord-simulator/?phase11=894886cc8dbb0c4ea25bc8ad74a9fc92e8f7f6dd`.

The final report commit is pushed only after the expanded test suite, typecheck, Pages build, diff check, remote equality, and its Pages workflow are reverified.

## 9. Honest 30-second read and what remains unclear

Within 30 seconds, the corrected public build reads as an authored Korean settlement game rather than a placeholder: terrain, trees, cottages, well, readable resources, one current instruction, one highlighted build tool, and a restrained forest target are visible immediately. The novice can infer “build a logging camp beside the forest,” find the matching control, and see the settlement continue living while experimenting. At all three tested widths the page retained one current task, no visible next task, and healthy authored assets.

What remains unclear is bounded but real: the well warning conflicts with the visible well; the precise valid forest footprint is learned partly by trial; placement mode remains active after successful construction; and the three-building food-chain step does not explicitly teach order or road connectivity. These are follow-up UX opportunities, not evidence that the recovered public path is broken.
