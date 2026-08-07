# Phase 8 Task 11 Part 1a Mobile Legibility Evidence

## Scope

- Base revision before commit: `e0c84786e1d9723d4d39b8ab27ea27ecea5f0448`
- Owned code/test files: `src/render/canvasRuntime.ts`, `tests/canvasRuntime.test.ts`, `tests/openingCameraLegibility.test.ts`
- Evidence-owned files: `.omo/evidence/phase8-presentation-completion/task-11/mobile-legibility-fix/*`
- Unrelated dirty title-fix files were preserved and not staged by this task.

## Implementation

- Compact authored-opening camera zoom now has a width-independent floor derived from `18 / TILE_H`, so the short side of a projected 1x1 footprint is never below 18 screen px.
- Low-height authored-opening vertical framing uses the opening village sprite footprint for y centering, allowing distant ford terrain to crop instead of shrinking cottages below the pixel floor.
- The user-controlled resize path remains the existing clamp path.

## Verification

1. Focused camera tests
   - Invocation: `npx tsx --test tests/openingCameraLegibility.test.ts tests/canvasRuntime.test.ts tests/openingVillage.test.ts`
   - Exit artifact: `.omo/evidence/phase8-presentation-completion/task-11/mobile-legibility-fix/focused-tests.exit`
   - Binary observable: exit `0`.

2. Typecheck
   - Invocation: `npm run typecheck`
   - Exit artifact: `.omo/evidence/phase8-presentation-completion/task-11/mobile-legibility-fix/typecheck.exit`
   - Binary observable: exit `0`.

3. Build
   - Invocation: `npm run build`
   - Exit artifact: `.omo/evidence/phase8-presentation-completion/task-11/mobile-legibility-fix/build.exit`
   - Binary observable: exit `0`.

4. Full tests
   - Invocation: `npm test`
   - Exit artifact: `.omo/evidence/phase8-presentation-completion/task-11/mobile-legibility-fix/npm-test.exit`
   - Binary observable: exit `0`; 699 tests, 699 pass, 0 fail.

5. Browser one-pass exact viewport check
   - Invocation: `PHASE8_HEAD=$(git rev-parse HEAD) PHASE8_TREE=$(git write-tree) QA_URL=http://127.0.0.1:4198 QA_CHROME_PORT=9518 node .omo/evidence/phase8-presentation-completion/task-11/mobile-legibility-fix/browser-legibility-qa.mjs`
   - Exit artifact: `.omo/evidence/phase8-presentation-completion/task-11/mobile-legibility-fix/browser-legibility-qa.exit`
   - Result artifact: `.omo/evidence/phase8-presentation-completion/task-11/mobile-legibility-fix/browser-legibility-results.json`
   - Binary observable: exit `0`; verdict `PASS`; no runtime errors; no failed resources; exact viewport set; canvas sized; projected floor true; console clearance true; welcome dismissed; screenshots non-empty.

## Browser Measurements

- `375x640`: console top `416`, console height `224`, projected 1x1 short side `18` px.
- `375x720`: console top `496`, console height `224`, projected 1x1 short side `18` px.
- `768x720`: console top `444`, console height `276`, projected 1x1 short side `19.2` px.

## Screenshot Artifacts

- `.omo/evidence/phase8-presentation-completion/task-11/mobile-legibility-fix/01-opening-375x640.png`, 209923 bytes, 375x640, sha256 `b6a8f8d10306dedad2f3263453d832e3076a02391f8513e941032cae94b8017e`.
- `.omo/evidence/phase8-presentation-completion/task-11/mobile-legibility-fix/02-opening-375x720.png`, 241486 bytes, 375x720, sha256 `4702a1839022071b0e9c51688ab389965da047660ab9b4243c7fad35b783340b`.
- `.omo/evidence/phase8-presentation-completion/task-11/mobile-legibility-fix/03-opening-768x720.png`, 479034 bytes, 768x720, sha256 `4be0818c1a0f399173f489589b7bba95e27ec118449acc438dc31334d64b47b8`.

## Post-write Review

- Pure LOC: `src/render/canvasRuntime.ts` 203, `tests/canvasRuntime.test.ts` 205, `tests/openingCameraLegibility.test.ts` 81, `browser-legibility-qa.mjs` 191.
- `canvasRuntime.ts` and `tests/canvasRuntime.test.ts` are in the warning band but under the 250 LOC defect threshold.
