관문: ①오차 · ②결정론 · ③성능 · ④캐시 · ⑤플래그 끔 동일 — 통과

# D1a 곡선 렌더 1단계 보고 (Claude Code, 2026-09-24)

플래그 `RENDER_BOUNDARY_V2`(기본 끔)를 켜면 도로가 굽은 리본으로, 숲 가장자리와 밭 무리가 매끈한 윤곽으로 그려진다. 게임 규칙·저장·경로 탐색 파일은 바꾸지 않았다(`src/engine`·`src/agents`·`src/population`·`src/save` 변경 0줄). 모든 캡처는 fixture 상태를 주입하고 시뮬레이션을 시작하지 않은 **준비 상태** 화면이다.

## 커밋·합치기·회귀

작업 브랜치 `claude/d1a-curved-render`(본선 `403cfa9`에서 분기, 원격에 올리지 않음):

| 커밋 | 내용 |
|---|---|
| `9b018bd` | 경계층·리본·숲/밭 윤곽·청크 캐시·플래그·온보딩 메모·에셋 7장·테스트 |
| `61f2bf6` | 화면 청크 유지 + 시야 둘레 유휴 시간 선래스터(드래그 p95 52→9 ms) |
| `79c4c22` | 퇴출을 프레임 사이로(한 프레임이 곧 그릴 청크를 퇴출하던 요동 제거) |
| `5d96b78` | 숲 데칼 앵커를 Chaikin 창 탐색으로(장면 생성 13.0→4.2 ms) |
| `321e20c` | 지도 테두리에 숲 데칼을 두지 않음 |
| `b42efa5` | 증빙 |
| `e568d2e` | 본선 `0725764` 병합(엔진만 바뀜, 충돌 없음) |
| `0d8536a` 이후 | 패턴 사각형 채움 금지 가드 테스트, 설계 통합안에 D1a 구현 기록, 보고서·STATUS, 순수 모듈 가드(`window.` 금지)에 걸린 지역 변수 이름 변경(동작 동일) |

본선 합치기는 B11과 같은 절차다: 본선 merge → 깨끗한 클론에서 최종 커밋 기준 `npm ci`·typecheck·전체 회귀(Phase 9 포함)·build → 그 사이 본선이 그대로면 fast-forward 푸시. 최종 커밋·원격 해시·회귀 N/N은 이 파일을 포함한 커밋에서 측정하므로 최종 보고 메시지에 적는다.

## 관문 결과

### ① 오차 — 통과 (`gates-node.json`, `tests/boundaryLayer.test.ts`)

곡선을 0.05칸 간격으로 표본화했다. 도로 = 리본 중심선 표본이 지나가는 도로 칸(칸 정사각형) 밖으로 벗어난 거리. 숲·밭 = 윤곽 표본에서 안/밖을 가르는 가장 가까운 칸 변까지 거리.

| fixture | 도로 최대(한계 0.25) | 0.25 초과 | 숲 최대(한계 0.35) | 밭 최대(한계 0.35) | 초과 | 참고: 중심선↔셀 중심 사슬 최대 |
|---|---|---|---|---|---|---|
| 12×12 고정 장면 | 0.117 | 0 | 0.250 | 0.125 | 0 | 0.617 |
| seed 1 최종 | 0.125 | 0 | 0.250 | 0.125 | 0 | 0.625 |
| seed 2 최종 | 0.125 | 0 | 0.250 | 0.125 | 0 | 0.625 |
| seed 3 최종 | 0.125 | 0 | 0.250 | 0.125 | 0 | 0.625 |
| seed 4 최종 | 0.125 | 0 | 0.250 | 0.125 | 0 | 0.625 |
| seed 5 최종 | 0.125 | 0 | 0.250 | 0.125 | 0 | 0.625 |

- **해석**: 지시서 문구 "가장 가까운 도로 셀 중심에서 ≤0.25칸"은 글자 그대로면 곧은 길도 칸과 칸 사이 점이 0.5칸이라 성립하지 않는다. 채택안의 근거(v3-A 탐침 P1 "outside>0.25tile", 통합안 "리본 넘침 0")와 같은 **도로 칸 합집합 밖 거리**로 판정했다. 워커가 걷는 셀 중심 사슬과의 거리는 모퉁이에서 최대 0.625칸이라 따로 적었다(D1b·D2 제안 1).
- seed 1~5 최종 상태는 `output/playtest-a-double-prime/seeds/final-689bda7/`에서 지면 관련 필드만 `tests/fixtures/boundary/`(각 4KB)로 옮겨 테스트가 `output/`을 읽지 않는다(`scripts/extractBoundaryFixtures.ts`, 원본 SHA 기록).

### ② 결정론 — 통과

| 층 | 방법 | 결과 |
|---|---|---|
| 데이터 | 6개 fixture를 타일 배열 정순·역순으로 경계층 생성 → 도로 사슬·고정점·광장·숲/밭 윤곽·데칼·청크 키 JSON 비교 | 6/6 동일 |
| 렌더(Node) | 12×12·seed 2를 정순/역순 입력으로 한 프레임씩 그림 → 모든 청크 래스터의 호출열 해시와 프레임 호출열 비교 | 동일 |
| 화면(브라우저) | `determinism-browser.json`: 같은 상태를 (a) 정순 (b) 역순 입력으로 장면 재생성·청크 전부 폐기 후 (c) 새 페이지에서 그림 → canvas PNG SHA-256 | fixed12·seed2 × DPR 1·2 = 4/4 동일 |

브라우저 비교는 소프트웨어 래스터(`--disable-gpu`)다. GPU 래스터는 같은 코드도 두 번 그리면 비트가 다르다(B11 `road-fix-pixels/gpu-noise-same-code`).

### ③ 성능 — 통과 (`perf/`, `gpu-commit-flag0/1.json`, `gpu-commit-repeats.json`)

B11 방식(3회 × 240프레임, 첫 회 버림, 1배속, 1280×800, headless Chrome GPU). "끔"·"켬"은 같은 세션, 같은 병합 코드에서 번갈아 측정했다.

| 도시 | DPR | CPU | 카메라 | B11 기준선 frameWork 중앙/p95 | 끔 중앙/p95 | **켬 중앙/p95** | 켬 p95 ÷ B11 p95 | 켬 rAF 중앙/p95 | 켬 상위 3단계 |
|---|---|---|---|---|---|---|---|---|---|
| lots24 | 1 | 1× | 정지 | 11.6 / 14.3 | 9.5 / 12.9 | **3.8 / 8.8** | 62% | 16.7 / 16.8 | nature 0.6, terrain.grounding 0.6, walls 0.6 |
| lots24 | 1 | 1× | 드래그 | 13.4 / 15.3 | 9.9 / 12.5 | **3.8 / 6.3** | 41% | 16.7 / 16.7 | terrain.grounding 0.6, walls 0.6, nature 0.5 |
| lots24 | 2 | 1× | 정지 | 13.0 / 16.5 | 9.5 / 12.7 | **4.4 / 7.3** | 44% | 16.7 / 16.7 | terrain.grounding 0.6, walls 0.6, nature 0.5 |
| lots24 | 2 | 1× | 드래그 | 14.1 / 16.1 | 10.1 / 12.7 | **4.6 / 7.1** | 44% | 16.7 / 16.8 | terrain.grounding 0.6, nature 0.6, walls 0.6 |
| lots24 | 1 | 4× | 정지 | 59.2 / 68.5 | 52.7 / 59.8 | **28.0 / 33.6** | 49% | 66.7 / 100.1 | objects.sort 6.7, terrain.grounding 4.2, nature 3.0 |
| lots24 | 1 | 4× | 드래그 | 61.6 / 74.9 | 52.4 / 61.1 | **27.3 / 33.4** | 45% | 83.3 / 116.7 | objects.sort 7.3, terrain.grounding 4.0, walls 3.0 |
| newgame | 1 | 1× | 정지 | 20.2 / 22.4 | 4.7 / 18.2 | **2.8 / 16.5** | 74% | 16.7 / 16.7 | nature 1.0, terrain.grounding 0.9, terrain.fill 0.2 |
| newgame | 1 | 1× | 드래그 | 20.1 / 22.5 | 4.9 / 18.4 | **3.0 / 16.5** | 73% | 16.7 / 16.7 | nature 1.0, terrain.grounding 0.9, terrain.fill 0.2 |
| pop176 | 1 | 1× | 정지 | 6.6 / 8.3 | 4.8 / 6.2 | **2.7 / 4.3** | 52% | 16.7 / 16.8 | nature 0.9, terrain.grounding 0.8, terrain.fill 0.2 |
| pop176 | 1 | 1× | 드래그 | 7.1 / 8.9 | 5.1 / 6.8 | **2.9 / 4.6** | 52% | 16.7 / 16.8 | nature 0.8, terrain.grounding 0.8, objects.sort 0.2 |

- 24필지 `frameWorkMs`: 켬이 B11 기준선보다 중앙값·p95 모두 낮다(p95 비율 41~62%). 청크 캐시가 지면 마름모·도로(B11 상위 두 단계 roads.ground·roads.overlay)를 매 프레임 그리지 않게 했다.
- GPU 프레임 간격·Commit(3초 트레이스 합, ms):

| 모드 | 장면 | 끔 rAF 중앙/p95 | 켬 rAF 중앙/p95 | 끔 Commit | 켬 Commit |
|---|---|---|---|---|---|
| headless-gpu | lots24-town | 16.7 / 33.3 | 16.7 / 16.7 | 420 | 138 |
| headless-gpu | pop176-village | 16.7 / 16.8 | 16.7 / 33.4 | 353 | 137 |
| headless-gpu | newgame-village | 16.7 / 16.7 | 16.7 / 16.8 | 352 | 131 |
| headed-gpu | lots24-town | 16.7 / 25.0 | 8.3 / 16.0 | 449 | 267 |
| headed-gpu | pop176-village | 8.3 / 16.1 | 8.3 / 9.3 | 606 | 242 |
| headed-gpu | newgame-village | 8.6 / 24.4 | 8.3 / 16.1 | 506 | 243 |

  headless pop176 켬 첫 측정의 rAF p95 33.4는 3회 반복에서 16.7/16.7/16.7로 재현되지 않았다(`gpu-commit-repeats.json`).
- 온보딩 안내 캐시(7항): 새 게임 `frameWorkMs` 중앙값 16.1→4.7 ms(정지)·16.3→4.9 ms(드래그), 안내 단계 11.5→0.10 ms(D1a 이전 `403cfa9`를 같은 세션에서 측정, `perf/newgame-*-base-403cfa9.json`). p95는 18.2→18.2 ms로 그대로다: 틱으로 상태가 바뀐 직후 프레임은 안내를 다시 계산한다(약 12.8 ms). 키를 더 좁히는 것은 다음 후보.

### ④ 캐시 정합 — 통과 (`gates-node.json` freshness, `tests/boundaryRender.test.ts`)

12×12 장면을 캐시와 함께 그려 둔 뒤 실제 엔진 함수로 상태를 바꾸고 다음 한 프레임만 그렸다. "오래된 그림"은 같은 프레임을 빈 캐시로 새로 그린 청크와 호출열 해시가 다른 청크 수다.

| 변경 | 변경이 닿은 청크(다시 그리기 전 오래된 수) | 같은 프레임에 다시 래스터 | 그린 뒤 오래된 그림 |
|---|---|---|---|
| 변경 없이 다시 그림 | 0 | 0 | 0 |
| 도로 설치 `placeRoadLine` (43,57)-(44,57) | 6 | 6 | **0** |
| 도로 철거 `removeRoad` (39,61) | 6 | 6 | **0** |
| 밀밭 배치 `placeBuilding` (42,51) | 2 | 2 | **0** |
| 밀밭 완공 `completeEligibleConstruction` | 2 | 2 | **0** |

카메라 이동만 한 프레임은 래스터 0(테스트). 확대 전체 지도(seed 2, 줌 0.3)를 연속 두 번 그리면 두 번째 래스터 0(퇴출 요동 없음, 테스트).

### ⑤ 플래그 끄면 픽셀 동일 — 통과 (`flag-off-pixels.json`, `tests/boundaryRender.test.ts`)

| 방법 | 결과 |
|---|---|
| D1a 이전 본선(`403cfa9`)과 D1a(플래그 끔) 화면을 같은 fixture로 캡처해 픽셀 비교: pop176·새 게임·24필지·12×12·seed 2 × DPR 1·2, 소프트웨어 래스터 | 10/10 장, 다른 픽셀 0, 최대 채널 차 0 |
| V8 정밀 커버리지: 플래그 끔으로 한 프레임 전체를 그리는 동안 곡선 지면 모듈(`src/world/boundary/*`, 청크 캐시, 리본·윤곽 그리기, 장면) 함수 실행 수 | 0 (대조: 켬이면 실행됨) |

본선 병합 후에도 다시 확인했다: 본선 끝 `0725764` 대 병합 커밋(쿼리 없음 = 기본 끔) 10/10 장 다른 픽셀 0(`flag-off-pixels-after-merge.json`).

## 만든 것

| 항목 | 파일 |
|---|---|
| 경계층(파생·비저장·순서 무관) | `src/world/boundary/boundaryGeometry.ts`(변 키 `boundaryEdgeKey`, 해시, 이동평균·Chaikin), `cellContours.ts`(marching squares, 칸 변 추적), `roadCenterline.ts`(중심선 그래프), `terrainBoundaries.ts`(숲 윤곽·데칼, 밭 무리), `boundaryTolerance.ts`(①측정) |
| 도로 리본 | `src/render/drawRoadRibbons.ts`: 구간마다 스트립 패턴 변환을 바꿔 경로 따라 UV 반복, `fill()`만 사용. 흙길↔석재길 칸 경계 ±0.25칸 알파 섞기. 교차로·막다른 끝 원판, 다리 둑 반 칸 연결, 광장 윤곽 |
| 숲·밭 | `src/render/drawGroundBoundaries.ts`: 숲 윤곽 even-odd 채움 + 고사리 데칼 A·B·C(변 키 해시로 변형·반전·크기 ±10%, 이웃과 같은 변형 연속 회피), 밭 무리 흙 + 고랑(밭끼리 맞닿은 변) + 풀 가장자리(외곽) |
| 청크 캐시 | `src/render/groundChunkCache.ts`, `groundBoundaryScene.ts`, `drawTerrainBoundaryV2.ts` |
| 플래그 | `src/render/renderBoundaryFlag.ts`(URL `render-boundary-v2=1/0` > 설정 저장값 > 기본 끔), 설정 메뉴 토글 `BoundaryRenderToggle.tsx` |
| 온보딩 캐시 | `src/ui/onboardingWorldGuidance.ts` 메모(키·근거 주석) |
| 에셋 | `public/assets/road/{earth,stone}_strip-v1.png`, `public/assets/boundary/{forest_fringe_a,b,c,field_furrow,grass_edge}-v1.png`, 대장 `docs/provenance/assets.csv` 7행(`runtime`), 원본 `docs/asset-evidence/runtime-sources/{road,boundary}/`(SHA 일치), 프롬프트 `docs/provenance/prompts/` |
| 증빙 도구 | `scripts/boundaryEvidence.mjs`, `scripts/boundaryReport.ts`, `scripts/boundaryFixtureScene.ts`, `scripts/renderStageBenchmark.mjs --query/--label`, `renderCommitProbe.mjs --query`, `renderPixelCompare.mjs --query` |

## 지시서와 다르게 한 것 (보고)

1. **에셋 8장 → 7장.** 첨부 ZIP의 런타임 PNG는 7장이다(D1 5장 + D1b 2장, 대장 CSV의 `runtimeSha256`과 모두 일치). CSV의 나머지 4행(`checks/*`)은 오프라인 확인 그림이며 파일이 ZIP에 없고 게임 에셋도 아니다. 설치·대장 모두 7행.
2. **설정 토글 때문에 `src/ui/SpeedControls.tsx` 2줄**(import 1, 설정 팝오버 안 `<BoundaryRenderToggle />` 1). 토글 컴포넌트와 문구(`boundaryRenderCopy.ko.ts`)는 `src/render`에 두었다.
3. **밭 무리 윤곽은 칸 변 추적 + Chaikin2.** 칸 중심 표본 marching squares는 2×2 밭 하나를 타원으로 깎는다(첫 화면에서 확인). 숲은 지시서대로 marching squares.
4. **그림자는 청크에 넣지 않았다.** 나무 벌채·주택 등급·그림 로딩이 키를 넓히기 때문이다. B11 기준 약 1ms로 매 프레임 그린다. `townLandscape`·앞마당·다리 상판도 매 프레임.
5. 켬일 때 문제만 보기(`problemOnly`)의 밭 흙 흐림(0.4)은 청크 안이라 적용되지 않는다.

## 캐시 메모리·초기 비용 (`captures/captures.json`, DPR 1)

| 장면 | 청크 수 | 픽셀 | RGBA | 청크 1개 래스터 평균 | 장면 생성 |
|---|---|---|---|---|---|
| 12×12 줌 1.0 | 57 | 7.6M | 29 MB | 0.61 ms | 9 ms |
| seed 2 줌 1.0 | 78 | 10.5M | 40 MB | 0.42 ms | 14 ms |
| seed 2 줌 0.6(전체 지도) | 86 | 4.2M | 16 MB | 0.38 ms | 14 ms |

DPR 2는 픽셀이 약 4배(줌 1.0에서 약 160 MB). 상한 = 이번 프레임에 그린 청크 + 화면 밖 64개(가장 오래 안 쓴 것부터 프레임 사이에 퇴출). 장면 생성(도로·숲·밭 전체 재계산)은 지면이 바뀔 때만이며, Node 측정 seed 2 4.2 ms(숲 데칼 앵커를 전체 윤곽 탐색에서 Chaikin 창 탐색으로 바꿔 13.0→4.2 ms).

## 캡처 (`captures/`, JPEG, 준비 상태)

`fixed12-z1.0-{off,on}.jpg`, `fixed12-z0.6-{off,on}.jpg`, `seed2-town-z1.0-{off,on}.jpg`, `seed2-town-z0.6-{off,on}.jpg`.

## D1b·D3에 넘길 제안

1. **워커 중심선 오프셋(D1b/D2)**: 모퉁이에서 리본 중심선이 셀 중심 사슬에서 최대 0.625칸 떨어져 워커가 풀 위로 모서리를 도는 것처럼 보인다. 렌더 전용 오프셋(Fable A2, 한계 0.25)을 `roadCenterlineGraph`의 사슬에 맞춰 넣으면 된다(경로 판정 무변경).
2. **L자·대각 드래그(D1b)**: 중심선은 입력과 무관하게 셀 사슬에서 파생하므로 D1b는 셀 래스터만 만들면 된다. 평행 근접 도로는 지금도 2×2 광장이 되어 한 덩어리로 보인다(채택안 B의 "의도 없는 인접 접속 거절"과 함께 검토).
3. **도로 종류 필드**: 석재길이 성벽 안 규칙이라 성벽 완공 순간 성 안 모든 길이 한꺼번에 돌길로 바뀐다. 도로 종류가 생기면 `materialOf`만 바꾸면 된다.
4. **성벽·해안(D3)**: 같은 `cellContourLoops`와 변 키를 쓰면 물가도 공유선 하나가 된다. 성벽 곡선은 채택안대로 차단·운반 동치를 하드 게이트로.
5. **청크 캐시 DPR 2 메모리**: 화면 밖 64개 상한은 DPR 2 줌 1에서 약 160 MB까지 간다. Iris Xe급 기기에서 측정 후 상한을 픽셀 기준으로 바꿀지 결정.
6. **장면 생성 한 번 약 4~14 ms**: 도로 한 칸 놓을 때 한 프레임 비용이다. 필요하면 바뀐 칸 주변만 다시 계산(국소 갱신).

## 소요 시간

21:36 시작, 약 1시간 20분에 보고서 작성(측정·회귀 대기 포함). 최종 시각은 보고 메시지.
