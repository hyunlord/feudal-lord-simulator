# Phase 12 — 이미 살아 있는 마을

## 1. 파트별 구현과 건너뛴 항목

- Part 1 (`8112d6778d97213fd31a523fc9a9156af21aeb3e`)은 첫 로드부터 주민과 물류가 움직이도록 고정 좌표의 시작 마을을 추가했다. 짧은 도로망, 빵이 든 곡창, 벌목소, 통나무가 든 창고를 완성 상태로 배치하고 시작 목재를 `120`으로 조정했다.
- Part 2 (`d9d1e8bb388b530a48b77b997d7824190eb21823`)는 미니맵을 최대 `160×160`의 사각형 실제 이동 제어로 줄이고 장식 방패와 캡션을 제거했다.
- Part 3 (`c7c665b099fcbbbb0501abab95bf177393664367`)은 1280/768/375 폭에서 건물 이름과 네 개 그룹 헤더가 온전히 읽히도록 메뉴 셀과 반응형 레이아웃을 수정했다.
- Part 4 (`5b33a649c9c4cc20551a9ee28f107286d0948208`)은 나무 크기 범위를 `0.55–1.45`, 침엽수 비중을 약 60%, 수평 반전을 결정적 해시로 적용해 원형 점무늬처럼 보이던 숲을 해소했다.
- Part 5(`7323dfc` → `8ecaf4e`)는 순수 advisor, 꺼진 상태가 기본인 `자동 발전` UI, 행동 예고 pulse, 실제 커밋 기준 120-tick cadence, 취소 처리, 하네스 진단 소비자를 canonical 경로로 바꿨다. `scripts/economyHarnessAdvisorScenario.ts`, `scripts/economyHarnessAutoplay.ts`, `scripts/economyHarnessMetrics.ts`, `src/engine/autoplayFood.ts`, `src/engine/autoplayWater.ts`가 공유하는 구조로 14개 canonical harness metric을 advisor-driven scenario와 per-row provenance로 계산한다. 이후 metrics facade는 `economyHarnessBaseReport` / `economyHarnessEraReports` / `economyHarnessReportFormat` / `economyHarnessReportTypes`로 분리됐고, 각 모듈은 250줄 이하로 유지했다. autoplay 테스트도 동작별로 분리해 회귀를 좁혔고, 최종 재실행 전까지 937개 테스트 결과를 보존했다.
- Part 5 remediation에서는 `noAutoplay12kHash=19689206a4b614bd`, `autoplay12kHash=24d448e46243e107`, 12k headless `peak=110`, `final=94`, `retention=85.45%`, `bread=422`, `actions=6`, `minGap=218`이 확인됐다.
- Part 6 (`113fe7c`)는 공개 URL 전용 CDP 증명 도구와 공개 acceptance 경로를 더했다. fresh Play 30초, 안내 5분, 자동 발전 10분, 별도 60초 관찰, 5× 프레임 30초를 브라우저 벽시계로 실행한다.
- 나무 PNG 재생성은 건너뛰었다. 4a–4c의 배치·크기·변형만으로 독립 visual QA가 PASS했기 때문이다. DGX 이미지 생성도 필요하지 않았다.

## 2. 작성한 시작 상태

시작 상태는 완성 건물 8개, 도로 14칸, 주민 12명, treasury timber `120`이다.

- 오두막: `(44,40)`, `(46,40)`, `(44,42)`, `(46,42)`, 각 3명
- 우물: `(45,41)`
- 곡창: `(42,37)`, workers `2`, inventory `bread: 30`
- 벌목소: `(50,40)`, workers `3`
- 창고: `(41,40)`, workers `1`, inventory `logs: 20`
- 도로: `(43,39)`, `(44,39)`, `(45,39)`, `(46,39)`, `(47,39)`, `(43,40)`, `(47,40)`, `(43,41)`, `(44,41)`, `(46,41)`, `(47,41)`, `(48,41)`, `(49,41)`, `(50,41)`

대표 시작 집은 `house-46-40-0`이고 시작 카메라는 `(45,41)`을 중심으로 잡는다. 시작 주민에게는 6,000 tick의 starvation grace가 적용된다. 저수지처럼 쌓인 자원으로 시작하지 않으면서도, Play 직후 곡창 distributor와 벌목소 carter가 실제 도로를 쓰게 만드는 최소 authored tableau를 선택했다.

## 3. 나무 재생성 판단

PNG를 재생성하지 않았다. before는 `/tmp/feudal-phase12/part3/visual-qa/1280.png`, after는 `/tmp/feudal-phase12/part4/visual-qa/opening.png`와 `/tmp/feudal-phase12/part4/visual-qa/forest-b.png`이다.

4a–4c 이후 독립 visual QA는 scale variety, conifer dominance, deterministic flip, oak circularity를 모두 PASS로 판정했다. 공개 최종 스크린샷에서도 큰 침엽수, 작은 침엽수, 비대칭 활엽수와 그루터기가 섞여 균일한 원형 점밭으로 보이지 않았다. 따라서 새 oak 후보 생성은 비용만 늘리고 이미 통과한 자산 계약을 흔드는 선택이라 기각했다.

## 4. 소유자 대신 내린 결정

1. 빈 sandbox 대신 이미 운영 중인 작은 마을을 authored default로 삼았다. 첫 10초가 이 목표의 핵심이기 때문이다.
2. 시작 목재는 `120`을 선택했다. 플레이어가 벌목소를 다시 살 필요는 없지만 다음 수동 건설을 시작할 여지는 남는다.
3. 미니맵의 장식보다 build menu 가독성에 화면 폭을 배분했다. 고정 월드에서는 작은 실제 네비게이션이 큰 장식 지도보다 유용하다.
4. 1280에서는 가로 스크롤을 허용하지 않고 375에서만 허용했다. 데스크톱 기본 경로의 한글 잘림을 우선 제거했다.
5. 나무는 새 PNG보다 결정적 배치 변형을 먼저 적용했다. 같은 시드의 렌더와 선택 안정성을 보존하면서 실루엣 다양성을 늘릴 수 있었다.
6. autoplay 상태는 `GameState` 밖 React presentation state에 두고 기존 action만 dispatch했다. off 상태의 simulation hash를 바꾸지 않기 위해서다.
7. pulse가 보인 뒤 240ms 후 커밋하고, cadence는 예약 시점이 아니라 실제 커밋 tick에 고정했다. 지연 중인 커밋은 새 pulse를 막고 disable/unmount에서 취소한다.
8. 도로 필요 건물 후보는 단순 인접 도로가 아니라 실제 construction material source와 route가 있는지 검사한다. 고립된 도로 섬을 합법적인 공급망으로 오인한 공개 10분 붕괴를 그대로 재현한 뒤 수정했다.
9. 공개 PNG 검사는 `transferSize=0`만으로 실패시키지 않고 response status, body size, cache delivery를 함께 판정한다. CDN 캐시 히트를 missing asset으로 오인한 첫 실행을 보존한 뒤 회귀 테스트를 추가했다.
10. 프레임 프로브는 동일 rAF timestamp의 callback work를 합산하고 exported sample array의 identity를 보존하며 reset한다. refresh interval이나 교체된 배열을 측정하는 허위 통과/실패를 막기 위해서다.
11. 첫 완결 실행의 frame p95 `13ms` 실패는 삭제하지 않았다. 당시 호스트 CPU 경합을 확인했고, 동일 공개 배포의 독립 30초 측정 `6.3ms`와 새 완결 실행 `8.4ms`로 분리 재현했다.
12. 배포 증거에는 Actions run, Pages deployment, HTML이 참조한 bundle URL과 SHA-256을 함께 기록한다. 다만 도구가 이 부가 필드를 강제하지 않는다는 review-cap 반론은 해결된 것으로 가장하지 않는다.
13. Part 5 harness metric source는 더 이상 scripted row를 섞지 않는다. 이제 canonical advisor scenario가 balance numbers의 실제 source이며, per-row provenance가 함께 기록된다.
14. Part 6 public proof는 `main`/feature branch SHA, GitHub Pages workflow, public URL, browser screenshots, and artifact JSON을 분리해서 검증한다. HTML 200만으로는 충분하지 않다.

## 5. 2회 검토 상한으로 수용한 반론 원문

Part 5:

> The harness integration is still diagnostic-only, not the required shared decision source for balance numbers. scripts/economyHarnessMetrics.ts:163-176 continues computing all 14 balance metrics from createConstructionEconomyHarnessScenario + trackStage3Run; it separately runs trackAutoplayRun(DEFAULT_GAME_STATE, 480) and appends only hash/actionCount. Current `npm run harness` proves this: 14 legacy/scripted metric rows (including `2/2 scripted sites`) plus `Autoplay advisor 2 actions... PASS`. tests/autoplay.test.ts:350 explicitly locks 'without changing fourteen metrics'. This does not satisfy attachment lines207-211: replace scripted decision logic so the watched mode is the same one balance numbers come from.

후속 `7323dfc`와 `8ecaf4e`에서 14개 canonical metric의 source를 advisor-driven scenario로 옮기면서 이 반론을 해소했다. 이전 scripted row는 하네스 진단용으로만 남는다.

Part 5 round2 gate:

> REVISE
>
> Current uncommitted palisade fix is not acceptable yet.
>
> What changed/was verified:
>
> - The specific 8×8 edge-map regression is now fixed:
>   - src/engine/autoplayActions.ts:36 now returns null when computePalisadeProposal fails.
>   - tests/autoplayPalisadeValidation.test.ts:106 captures regression.
>   - Command npx tsx --test tests/autoplayPalisadeValidation.test.ts
>   - PASS1/1
>
> Blocking:
>
> - broader gate fails because Stage3 no longer proclaims/builds wall.
> - command six files:
> npx tsx --test tests/autoplayPalisadeValidation.test.ts tests/autoplayPhase12Part5.test.ts tests/autoplay.test.ts tests/economyHarnessStage3.test.ts tests/economyHarnessPhase9.test.ts tests/phase9BalanceTuning.test.ts
> - FAIL 36 pass/10 fail
> - key failures:
>   Part5 line93 one FAIL row
>   line140 Stage3 actionCount no longer>0
>   line169 adapter no longer confirm_palisade_proclamation
>   Phase9/Stage3 fail because palisade/proclamation missing
>
> Harness:
>
> Palisade wall completion    unfinished    FAIL
> Advisor provenance ... stage3-seeded... 0 actions,11 snapshots PASS
> npm run harness -- --workers=8 exit0 but not all rows PASS
> typecheck PASS

8ecaf4e subsequently resolved the issue with the canonical 20x16 Stage 3 fixture, so focused `14/14` and harness `14/14` both pass, and the forbidden clamped fallback was not restored.

Part 6-1:

> Deployment binding remains caller-asserted rather than authoritative: `readDeploymentProof` accepts any locally authored JSON containing the requested URL, SHA, and `success`, and the test itself fabricates exactly such a file. No workflow run ID/URL, Pages environment/deployment ID, authenticated capture, or served-build marker is verified, so an arbitrary 40-hex revision can still be presented as the published revision.

Part 6-2:

> Autoplay sensibility still cannot identify semantic road-to-nowhere behavior. A road is accepted as sensible solely when `roadRevision` increases; although the pulse contains the proposed path, the tooling never proves that path connects the target building to the existing connected network. `sensible: true` is therefore derived only from commit success plus mill-before-wheat ordering, not from whether the ten-minute sequence actually made sense as required.

Part 6-3:

> Guided-action truth is still too weak: the fixed canvas-fraction road gesture is recorded as successfully following ‘길을 놓아 오두막을 이으세요’ whenever any roadRevision delta occurs, without proving adjacency to the instructed house or onboarding-task advancement. Building success likewise uses aggregate site/building counts rather than the requested kind/ID. The proof can pass after an irrelevant placement while the same guidance remains incomplete.

Part 6-4:

> Exact screenshot timing is enforced only for object-form evidence. `requireTimedScreenshot` explicitly returns without checking when screenshots are string labels, and the original passing test still supplies strings, so the public assertion contract can certify ‘exact 10s/30s’ evidence with no timestamps.

현재 보정된 final-all은 object-form screenshots와 timestamp를 사용하지만, string-form 계약 gap 자체는 여전히 도구 레벨의 한계로 남아 있다.

## 6. 공개 플레이 세션

완결 원자료는 `/tmp/feudal-phase12/published-8ecaf4e/final-all/final-all.json`이다. 대상은 [공개 Pages](https://hyunlord.github.io/feudal-lord-simulator/)의 runtime revision `8ecaf4e686258d2819c3cfe83850f282249b6f36`이다.

### press-play

- elapsed `30293.8ms`
- `10,074ms` 스크린샷과 `30,059ms` 스크린샷 모두 확보
- `visibleActivityBy10s=true`, `resourceChanged=true`, `blankCanvas=false`, `missingAssets=[]`
- ten-second walker hash와 final walker hash가 서로 달랐다

### guided-5min

- elapsed `300281.2ms`
- final population `87`
- 실제 action `1`개: `1,766ms`에 `제재소` construction site를 세웠다
- guess `15`회:
  1. `1,766ms` — `building-click at visible canvas fraction 0.500,0.480`
  2. `21,809ms` — `waited for in-progress 제재소 construction`
  3. `41,854ms` — `waited for in-progress 제재소 construction`
  4. `61,884ms` — `waited for in-progress 제재소 construction`
  5. `81,909ms` — `waited for in-progress 제재소 construction`
  6. `101,949ms` — `waited for in-progress 제재소 construction`
  7. `121,993ms` — `waited for in-progress 제재소 construction`
  8. `142,023ms` — `waited for in-progress 제재소 construction`
  9. `162,059ms` — `waited for in-progress 제재소 construction`
  10. `182,100ms` — `waited for in-progress 제재소 construction`
  11. `202,132ms` — `waited for in-progress 제재소 construction`
  12. `222,182ms` — `waited for in-progress 제재소 construction`
  13. `242,215ms` — `waited for in-progress 제재소 construction`
  14. `262,255ms` — `waited for in-progress 제재소 construction`
  15. `282,301ms` — `waited for in-progress 제재소 construction`
- 이 구간은 여전히 정확한 타일/인접성 증명을 못 한다. `제재소`는 완공되지 않았고, 안내는 “무엇을 지으라”는 방향까지만 안정적으로 증명된다.

### autoplay-10min

- elapsed `631,017.7ms`
- population curve: `12 → 87 → 87 → 87 → 87 → 87 → 87 → 87 → 87 → 88`
- sample points:
  - `0ms` = `12`
  - `60,238ms` = `87`
  - `139,737ms` = `87`
  - `206,514ms` = `87`
  - `242,168ms` = `87`
  - `306,376ms` = `87`
  - `372,811ms` = `87`
  - `423,457ms` = `87`
  - `495,003ms` = `87`
  - `543,733ms` = `88`
- action order:
  1. `6,376ms` — `wheat_farm` at `(44,37)`
  2. `18,388ms` — `mill` at `(46,38)`
  3. `51,940ms` — `wheat_farm` at `(47,37)`
  4. `63,140ms` — `mill` at `(42,39)`
  5. `299,986ms` — `house` at `(43,42)`
- `sensible=true`, `wrongChoices=[]`, `derivedFrom=advisorCommits`
- 이번 공개 run은 더 이상 `109 → 22`로 붕괴하지 않는다. 다만 `sensible=true`는 current tool surface에서 commit order와 route checks의 합으로 판정된 것이지, 모든 세맨틱 경로를 완전 증명한 것은 아니다.

### honest-60s

- elapsed `60,233.1ms`
- `untouched=false`
- setup interactions:
  - `dismiss visible welcome guidance`
  - `press visible 1x control`
- 공개 화면은 실재 동작을 보여 주지만, 시작 후 1분 안에 성장한 수치가 곧 균형을 뜻하지는 않는다.

### frame-budget

- duration `30,055.7ms`
- measured frames `1,257`
- average `3.4168ms`
- p95 `3.9ms`
- worst `6.5ms`
- over-budget `0`
- canvas visible pixels `921,600`
- blankCanvas `false`
- missingAssets `[]`

## 7. 보조 responsive QA

보조 QA는 현재 보정된 evaluator 기준으로 `PASS`다. `desktop-1280x720`, `tablet-768x1024`, `mobile-375x667` 세 viewport에서 모두 welcome을 열고 닫았고, `horizontalOverflow=false`, `controlsPresentInViewport=true`, `intentionalScrollableBuildMenu=true`, `buildLabelsClipped=[]`, `assetsOk=true`, `assetCount=36`, `overall=PASS`였다.

cadence 증거도 `PASS`다.

- ticks: `120`, `360`, `1031`
- gaps: `240`, `671`
- `duplicatePendingCommit=false`

초기 supplemental evaluator는 의도적으로 스크롤 가능한 `.build-seals` 컨테이너를 clipping 실패로 잘못 판정했다. 수정된 evaluator는 컨테이너 자체의 clipping을 허용하되, 개별 build label이 잘리지 않고 필수 컨트롤이 viewport 안에 있으면 통과시킨다. false positive는 `archive-before-viewport-verdict-fix/` 아래에 보존했다.

관련 원자료:

- `/tmp/feudal-phase12/published-8ecaf4e/viewports/supplemental-qa.json`
- `/tmp/feudal-phase12/published-8ecaf4e/viewports/viewport-verdict-correction.json`
- `/tmp/feudal-phase12/published-8ecaf4e/archive-before-viewport-verdict-fix/supplemental-qa.false-positive.json`

## 8. 테스트, 해시, 5× 프레임

최종 landing gate 로그는 `/tmp/feudal-phase12/final-landing-verify/`에 있다.

- focused autoplay tests: `36/36` PASS
- TypeScript: `npm run typecheck` PASS
- 전체 테스트: `937/937`, 16 suites, fail `0`
- production build: `184` modules, JS `434.77kB` / gzip `132.61kB`
- `noAutoplay12kHash`: `19689206a4b614bd`
- `autoplay12kHash`: `24d448e46243e107`
- autoplay 12k headless summary: `peak=110`, `final=94`, `retention=85.45%`, `bread=422`, `actions=6`, `minGap=218`
- Stage 3 summary: `proposalOk=true`, `validationOk=true`, `proclamationTick=600`, `wallCompleteTick=2311`, `wallCompletionElapsedTicks=1711`, `finalHash=2338ddb7b73d987b`
- canonical harness: 14 rows PASS, per-row provenance PASS, separate autoplay advisor diagnostic PASS

`autoplay-focused.log`, `typecheck-after-cleanup.log`, `full-test-after-cleanup.log`, `build-after-cleanup.log`, `harness-after-cleanup.log`, `no-excuse-after-cleanup.log`를 확인했다. 하네스는 더 이상 scripted 14행과 autoplay diagnostic을 섞어 balance numbers를 만들지 않으며, advisor-driven canonical scenario가 source가 되었다.

## 9. 커밋과 공개 배포

Part별 push:

- Part 1: `8112d6778d97213fd31a523fc9a9156af21aeb3e`
- Part 2: `d9d1e8bb388b530a48b77b997d7824190eb21823`
- Part 3: `c7c665b099fcbbbb0501abab95bf177393664367`
- Part 4: `5b33a649c9c4cc20551a9ee28f107286d0948208`
- Part 5 remediation: `7323dfc`
- canonical Stage 3 fix: `8ecaf4e`
- reproducible public acceptance scaffold: `113fe7c`

`main`과 `codex/phase12-living-village`는 proof 시점에 모두 `8ecaf4e686258d2819c3cfe83850f282249b6f36`을 가리켰다. GitHub Pages workflow [31291633248](https://github.com/hyunlord/feudal-lord-simulator/actions/runs/31291633248)은 success였고, Pages public URL은 [https://hyunlord.github.io/feudal-lord-simulator/](https://hyunlord.github.io/feudal-lord-simulator/)이다.

공개 HTML은 `/feudal-lord-simulator/assets/index-C2d1E8xT.js`와 `/feudal-lord-simulator/assets/index-D5PuJv07.css`를 참조했고, JS bundle SHA-256은 `499e1da3e222924c1bdaefdb87a13cde05d0645b179fa39bf36ff9e0c67aad1c`였다. 이 값은 published deployment proof와 함께 검증했다.

이 보고서 자체를 담는 마지막 report-only commit/push/deploy 확인은 handoff에 별도로 기록한다. 문서가 자기 자신의 미래 SHA를 먼저 적을 수는 없다.

## 10. 1분 동안 지켜본 솔직한 읽기

fresh 공개 페이지에서 화면의 welcome을 닫고 1×를 누른 뒤 60초 동안 추가 입력 없이 지켜봤다. 따라서 `untouched=false`이고, 두 setup interaction을 증거에 정직하게 기록했다. 실행 시간은 `60,233.1ms`였다.

결론은 이제 더 이상 collapse가 아니라 성장이다. 10초 안에 walker와 resource 변화가 보였고, 10분 자동 발전은 `12 → 87 → … → 88`로 안정적으로 유지됐다. 공개 화면은 비어 있지 않았고 asset error도 없었다.

다만 “살아 있음”과 “완전히 이해된 상태”는 다르다. `제재소` 안내는 여전히 정확한 타일/인접성 증명을 못 했고, guide proof는 construction-site 수준까지만 안정적이다. 다음 개선 우선순위는 새 장식이 아니라 성장 속도, 반복 식량 회복 action, 그리고 공급 경로까지 포함한 안내 좌표다.
