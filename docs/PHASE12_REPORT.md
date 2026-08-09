# Phase 12 — 이미 살아 있는 마을

## 1. 파트별 구현과 건너뛴 항목

- Part 1 (`8112d6778d97213fd31a523fc9a9156af21aeb3e`)은 첫 로드부터 주민과 물류가 움직이도록 고정 좌표의 시작 마을을 추가했다. 짧은 도로망, 빵이 든 곡창, 벌목소, 통나무가 든 창고를 완성 상태로 배치하고 시작 목재를 `120`으로 조정했다.
- Part 2 (`d9d1e8bb388b530a48b77b997d7824190eb21823`)는 미니맵을 최대 `160×160`의 사각형 실제 이동 제어로 줄이고 장식 방패와 캡션을 제거했다.
- Part 3 (`c7c665b099fcbbbb0501abab95bf177393664367`)은 1280/768/375 폭에서 건물 이름과 네 개 그룹 헤더가 온전히 읽히도록 메뉴 셀과 반응형 레이아웃을 수정했다.
- Part 4 (`5b33a649c9c4cc20551a9ee28f107286d0948208`)는 나무 크기 범위를 `0.55–1.45`, 침엽수 비중을 약 60%, 수평 반전을 결정적 해시로 적용해 원형 점무늬처럼 보이던 숲을 해소했다.
- Part 5 (`8c0d2d0a35e7f4a3985931194709297f52b89234`)는 순수 advisor, 꺼진 상태가 기본인 `자동 발전` UI, 행동 예고 pulse, 실제 커밋 기준 120-tick cadence, 취소 처리, 하네스 진단 소비자를 추가했다. 데스크톱 speed/autoplay 배치와 지연 커밋 중복 문제도 TDD로 보정했다.
- Part 5 공개 실행에서 식량 건설 부지가 인접 도로는 갖췄지만 자재 공급망과 분리되는 결함을 발견했다. `474238f441906608af2c1d4fe08b58eadfce61d0`에서 실제 construction source/route 판정을 advisor 후보 검사에 연결해 밀밭과 방앗간이 완공되고 마을이 10분 뒤에도 생존하도록 수정했다.
- Part 6은 공개 URL 전용 CDP 증명 도구와 25개 회귀 테스트를 추가했다. fresh Play 30초, 안내 5분, 자동 발전 10분, 별도 60초 관찰, 5× 프레임 30초를 브라우저 벽시계로 실행한다.
- 나무 PNG 재생성은 건너뛰었다. 4a–4c의 배치·크기·변형만으로 독립 visual QA가 PASS했기 때문이다. DGX 이미지 생성도 필요하지 않았다.
- Part 5 하네스의 14개 balance metric을 autoplay가 직접 산출하도록 바꾸는 작업과 Part 6 review-cap 반론 네 건은 2회 검토 상한에 따라 추가 수정하지 않고 아래에 원문 보존했다.

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
12. 배포 증거에는 Actions run, Pages deployment, HTML이 참조한 bundle URL과 SHA-256을 함께 기록했다. 다만 도구가 이 부가 필드를 강제하지 않는다는 review-cap 반론은 해결된 것으로 가장하지 않는다.

## 5. 2회 검토 상한으로 수용한 반론 원문

Part 5:

> “The autoplay run is appended as a two-action determinism diagnostic, while all 14 balance metrics still come from the existing scripted scenario. `npm run harness` confirms this with `2/2 scripted sites` followed by a separate `Autoplay advisor 2 actions` row. Therefore, the watched autoplay mode is not yet the source of the reported balance numbers as required.”

Part 6-1:

> “Deployment binding remains caller-asserted rather than authoritative: `readDeploymentProof` accepts any locally authored JSON containing the requested URL, SHA, and `success`, and the test itself fabricates exactly such a file. No workflow run ID/URL, Pages environment/deployment ID, authenticated capture, or served-build marker is verified, so an arbitrary 40-hex revision can still be presented as the published revision.”

Part 6-2:

> “Autoplay sensibility still cannot identify semantic road-to-nowhere behavior. A road is accepted as sensible solely when `roadRevision` increases; although the pulse contains the proposed path, the tooling never proves that path connects the target building to the existing connected network. `sensible: true` is therefore derived only from commit success plus mill-before-wheat ordering, not from whether the ten-minute sequence actually made sense as required.”

Part 6-3:

> “Guided-action truth is still too weak: the fixed canvas-fraction road gesture is recorded as successfully following ‘길을 놓아 오두막을 이으세요’ whenever any roadRevision delta occurs, without proving adjacency to the instructed house or onboarding-task advancement. Building success likewise uses aggregate site/building counts rather than the requested kind/ID. The proof can pass after an irrelevant placement while the same guidance remains incomplete.”

Part 6-4:

> “Exact screenshot timing is enforced only for object-form evidence. `requireTimedScreenshot` explicitly returns without checking when screenshots are string labels, and the original passing test still supplies strings, so the public assertion contract can certify ‘exact 10s/30s’ evidence with no timestamps.”

## 6. Part 6 공개 플레이 세션

완결 원자료는 `/tmp/feudal-phase12/part6/published-final-474238f-rerun/final-all.json`이다. 대상은 [공개 Pages](https://hyunlord.github.io/feudal-lord-simulator/)의 runtime revision `474238f441906608af2c1d4fe08b58eadfce61d0`이다.

fresh Play 구간:

- fresh: 인구 `12/60`, 비어 있지 않은 `1280×720` canvas
- `play-10s.png`: Play 후 `10,073ms`, 인구 `28/60`, 빵 `26`; carter와 distributor 두 walker가 서로 다른 실제 좌표에서 관찰됨
- `play-30s.png`: Play 후 `30,082ms`, 인구 `58/60`, 빵 `32`
- walker hash는 empty → `carter:...|distributor:...` → 새 좌표로 변했고, building inventory/treasury resource hash도 변했다. `visibleActivityBy10s=true`, `resourceChanged=true`, missing assets `0`이다.

5분 안내 플레이는 `300,420ms` 실행했고 최종 인구는 `87`이었다. 전용 onboarding DOM이 `제재소`를 지으라고 했지만 정확한 타일을 주지 않아 `1.839s`에 화면 비율 `(0.500, 0.480)`을 추정했다. 건설 부지는 `0 → 1`로 늘어 실제 action delta는 있었지만, 최종 화면에는 `🚧 창고에서 길이 이어지지 않음`이 남았다.

추정/혼란 기록은 총 15회다.

- `1.839s`: 정확한 타일 좌표가 없어 중앙 근처를 추정해 제재소를 배치했다.
- `21.877s`, `41.925s`, `61.975s`, `82.088s`, `102.146s`, `122.199s`, `142.234s`, `162.287s`, `182.334s`, `202.382s`, `222.425s`, `242.469s`, `262.514s`, `282.547s`: 같은 제재소 부지가 공사 중이어서 중복 배치를 하지 않고 기다렸다.

즉, 5분 동안 마을 자체는 성장했지만 안내가 유효한 공급 경로까지 가르치지는 못했다. 이 혼란은 Part 6-3 반론과 일치하며 숨기지 않는다. 스크린샷은 같은 evidence root의 `press-play/`와 `guided/`에 있다.

## 7. 10분 자동 발전 실행

자동 발전은 fresh 세션에서 UI toggle을 켜고 1×로 `600,215ms` 관찰했다. 그 뒤에는 수동 입력을 하지 않았다.

인구 곡선:

| 경과 | 인구 |
| ---: | ---: |
| 0분 | 12 |
| 1분 | 87 |
| 2분 | 109 |
| 3분 | 109 |
| 4분 | 104 |
| 5분 | 91 |
| 6분 | 44 |
| 7분 | 40 |
| 8분 | 40 |
| 9분 | 44 |
| 10분 종료 화면 | 22 |

실제 advisor commit 순서:

1. `6.508s` — 밀밭 `(42,42)`, construction sites `0 → 1`, timber `120 → 100`
2. `12.822s` — 방앗간 `(42,39)`, construction sites `1 → 2`, timber `100 → 70`
3. `52.091s` — 오두막 `(45,40)`, construction sites `0 → 1`
4. `58.380s` — 오두막 `(47,42)`, construction sites `0 → 1`

각 커밋에는 같은 위치를 가리키는 UI pulse가 먼저 기록됐다. 밀밭이 방앗간보다 먼저였고 이번 실행에는 도로 또는 시대 선포 action이 없어 road-to-nowhere는 발생하지 않았다. tool evidence는 `sensible=true`, `wrongChoices=[]`, `derivedFrom=advisorCommits`로 판정했다.

내 판단은 **초기 순서는 sensible하지만 10분 경제는 아직 지속 가능하지 않다**이다. 밀밭→방앗간→주거 순서는 맞고, route 수정 뒤 두 식량 건물이 완공되어 0명 붕괴는 피했다. 그러나 인구가 `109`까지 급증한 뒤 `22`, 빵 `1`까지 떨어졌고 advisor는 58초 이후 추가 회복 action을 내지 않았다. 따라서 “잘못된 건설 순서”는 없었지만, 성장 속도와 식량 회복 정책은 후속 balance 작업이 필요하다. 종료 화면은 `autoplay/autoplay-final.png`이다.

## 8. 테스트, 해시, 5× 프레임

최종 gate 로그는 `/tmp/feudal-phase12/final-gate/`에 있다.

- Part 6 focused: `25/25` PASS
- TypeScript: `npm run typecheck` PASS
- 전체 테스트: `924/924`, 16 suites, fail `0`, `47.76s`
- production build: 181 modules, JS `433.06kB` / gzip `132.17kB`
- opening authored-state hash: `2e036754c2d05951`
- economy determinism: `0efbe96e61adb61f == 0efbe96e61adb61f`
- legacy Stage 2: `5a393f13af3e61be`
- Stage 3: `007c206047131a97 == 007c206047131a97`
- autoplay harness diagnostic: `2 actions`, `a2e05144aeda6688 == a2e05144aeda6688`
- 14개 기존 harness metric과 autoplay diagnostic 모두 PASS; harness는 `--workers=8` 상한으로 실행했다.

최종 공개 5× 30초 측정은 평균 `4.738ms`, p95 `8.400ms`, 최악 `113.600ms`, 측정 `1,146`프레임, 12ms 이상 `28`프레임이다. acceptance 기준은 p95 `<12ms`이므로 PASS다. canvas visible pixels는 `921,600`, missing assets는 `0`이다.

첫 완결 시도는 외부 CPU 경합 중 p95 `13ms`로 실패했다. 동일 revision의 독립 재측정은 평균 `4.524ms`, p95 `6.300ms`, 최악 `10.000ms`, 943프레임으로 통과했고, 최종 완결 재실행도 위 `8.400ms`로 통과했다. 실패를 삭제하지 않고 `/tmp/feudal-phase12/part6/published-final-474238f/`에 보존했다.

## 9. 커밋과 공개 배포

Part별 push:

- Part 1: `8112d6778d97213fd31a523fc9a9156af21aeb3e`
- Part 2: `d9d1e8bb388b530a48b77b997d7824190eb21823`
- Part 3: `c7c665b099fcbbbb0501abab95bf177393664367`
- Part 4: `5b33a649c9c4cc20551a9ee28f107286d0948208`
- Part 5: `8c0d2d0a35e7f4a3985931194709297f52b89234`
- 공개 10분 route remediation: `474238f441906608af2c1d4fe08b58eadfce61d0`

`main`과 `codex/phase12-living-village`는 runtime proof 당시 모두 `474238f441906608af2c1d4fe08b58eadfce61d0`이었다. GitHub Pages workflow [31285270746](https://github.com/hyunlord/feudal-lord-simulator/actions/runs/31285270746)은 success였고 Pages deployment `5813924929`는 정확히 이 SHA와 `github-pages` environment를 가리켰다.

공개 HTML은 `/feudal-lord-simulator/assets/index-TD05TTl0.js`를 참조했고 200 `application/javascript`로 응답했다. 원격 bundle은 `433,086` bytes, SHA-256 `d527af3e9a4c2e7c9a32dcbbf69981b0405cadb9544179fdeb2233dfe589f97a`였으며 `GITHUB_PAGES=true` 로컬 빌드와 바이트 단위로 같았다. 원자료는 `/tmp/feudal-phase12/part6/published-final-474238f/deployment-proof.json`이다.

이 보고서와 재사용 proof tooling을 담는 마지막 commit은 파일이 자기 SHA를 미리 기록할 수 없으므로, 최종 push 후 handoff에 정확한 local/remote SHA와 새 Pages workflow를 기록한다. 이 마지막 commit은 runtime `src/`를 바꾸지 않는다.

## 10. 1분 동안 지켜본 솔직한 읽기

fresh 공개 페이지에서 화면의 welcome을 닫고 1×를 누른 뒤 60초 동안 추가 입력 없이 지켜봤다. 따라서 `untouched=false`이고, 두 setup interaction을 증거에 정직하게 기록했다. 실행 시간은 `60,228ms`였다.

결론은 **이제 마을이 자기 삶을 사는 것처럼 보인다**이다. 10초 안에 carter와 distributor 두 명이 서로 다른 도로 위치에서 움직였고, 60초 화면은 인구 `87/60`, 빵 `44`, 안정 상태를 표시했다. 집과 숲의 모습도 시작 화면과 달라졌고 canvas는 계속 비어 있지 않았으며 asset error는 없었다.

다만 “살아 있음”과 “균형 잡힘”은 다르다. 1분에 `12 → 87`은 지나치게 빠르고, 10분 자동 발전은 `109 → 22`로 크게 수축했다. 빽빽한 전경 숲이 작은 walker를 가리는 순간이 있고, 제재소 안내는 유효한 도로/창고 경로를 정확히 알려주지 않는다. 다음 개선 우선순위는 새 장식이 아니라 성장 속도, 반복 식량 회복 action, 그리고 공급 경로까지 포함한 안내 좌표다.
