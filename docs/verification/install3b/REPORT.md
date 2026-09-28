# INSTALL-3b 성벽 공사 이름표 묶기·사슬 캡처 대상 맞추기·결산 인구 줄·배부른 재생 — 보고서

관문: ① 성벽 공사 하나에 이름표 하나(2장 도시 32구간 → 줌 1에서 1개), 구간 이름표는 공사 선택·줌 1.35 이상에서만 · 면적 측정에 "2장 성벽 공사 중" 상태 — 캔버스 이름표 몫 5.8 % → 0.4 %(1280 × 800), 그 상태 합계 6.4 % / 6 %로 **예산 초과**(DOM 몫 6.0 %, 아래 2절 — 사용자 판정 대기) · ② 사슬 9단계 세계 사진 모두 대상이 화면 가운데(검사 9/9) · ③ "인구 469명 (이번 계절 +3 · 지난 계절 ±0)" · ④ 재생 12순간 모두 굶는 집 0, 첫 줄에 빵 문제 없음 · 스킨 감사 0 / 912 · 튜토리얼 22 = 22 · B9·TOUCH 14/14 · 병합 전 검사 · 로컬 3,394/3,394.

지시서: 사용자의 INSTALL-3b(INSTALL-3 관문 캡처에서 보인 넷). 엔진에 넘길 셋(가내 에일이 장부에 안 나옴, 1장에서도 보리 전환 가능, 자동 진행 시험의 고정 3초 제한)은 사용자가 엔진에 전달한다.

## 1. 성벽 공사 이름표(①)
- 원인: `drawPalisadeConstructionSite`가 공사 중인 성벽 구간마다 자기 이름표(`currentConstructionSiteLabel` — "벽을 따라 운반 · 도로 연결 구간에서 N칸", 대기 구간은 "성벽 N번째 대기")를 객체 그리기 안에서 띄웠다. v24 목책 공사 저장(2장)은 32구간 = 이름표 32개([before](walls/w1-before-zoom1.jpg)).
- 이제 `src/render/wallSiteLabels.ts`: **공사** = 같은 벽(`wallId`)·같은 재료(목책/석벽)의 구간들. 공사 하나에 이름표 하나 — 화면 안 구간 중 성문에 가장 가까운 구간(`gateDistance`, 같으면 화면 가운데에 가까운 쪽)에 "성벽 공사 32구간 · 목재 오는 중 (0/60)"(원인은 이름표가 있는 구간 중 성문에 가장 가까운 구간의 것)([after, 줌 1](walls/w2-after-zoom1.jpg)). 구간이 모두 화면 밖이거나 어느 구간에도 원인이 없으면 이름표 없음.
- 구간별 이름표는 그 공사의 구간을 선택했을 때([선택](walls/w4-after-selected.jpg) — 32개와 공사 카드) 또는 줌 1.35 이상([줌 1.35](walls/w3-after-zoom1.35.jpg) — 화면 안 21개)에서만.
- 이름표는 객체 그리기 뒤(`gameCanvasFrame.ts`)에 그린다 — HUD라 깊이 순서에 끼지 않는다. 대기 문구는 `wallCarryCopy.ko.ts`로 옮겼다.
- 시험 `tests/wallSiteLabels.test.ts`(4): 하나로 묶임·성문 가까운 구간·원인 / 1.35·선택에서 전부(다른 공사는 접힌 채) / 벽·재료마다 따로, 성문 쪽이 화면 밖이면 다음 구간 / 2장 저장 32 → ≤ 공사 수.

## 2. 면적 예산 — "2장 성벽 공사 중"(①)
- `scripts/measureHudCoverage.ts`에 상태 `normal:chapter2-wall-works`: v24 목책 공사 저장을 2장으로, 카메라는 성벽 구간들의 가운데, 줌 1, 1배속, 튜토리얼 끔, 처음 뜨는 계절 카드(모달 — 예산 밖)는 닫고 잰다. 예산은 기본 화면(6 % / 태블릿 8 %).
- 이름표는 캔버스에 그려져 기존 방식(DOM을 숨긴 사진과 비교)으로는 안 잡힌다. 그래서 증명 포트 두 가지(`src/render/constructionTagProbe.ts`, `phase10ProofRuntime.ts`): `constructionLabels(false)`는 숨긴 사진에서 공사 이름표(성벽 공사·건물 공사 명판)도 숨기고, `constructionTagBoxes()`는 첫 사진 프레임의 이름표 상자 — DOM 상자와 함께 세는 상자가 된다. 전체 화면을 상자로 쓰면 눈송이·걷는 워커가 섞여 들어가서(처음 시도 7.3 %) 이름표 상자로 좁혔다.
- DGX(`gates/hud-coverage.json`, [사진](gates/hud-1280-wall-works.jpg)·[마스크](gates/hud-1280-wall-works-mask.png)):

  | 해상도 | 합계 / 예산 | 캔버스 이름표 | INSTALL-3b 전 구간 이름표(같은 화면, 추정) |
  |---|---|---|---|
  | 1280 × 800 | **6.4 % / 6 % 초과** | 1개 · 0.4 % | 32개 · 5.8 % |
  | 1920 × 1080 | 3.1 % / 6 % | 1개 · 0.2 % | 32개 · 2.9 % |
  | 태블릿 1180 × 820 | 7.0 % / 8 % | 1개 · 0.4 % | 32개 · 6.1 % |

  "전" 열은 옛 규칙의 이름표(화면 안 앵커 32개)의 상자 넓이 합(페이지에서 글자 폭을 잰 18 px 상자, 겹침은 두 번 셈) — 옛 빌드에는 증명 포트가 없어 픽셀로는 못 잰다.
- **초과는 DOM 몫**: 1280 × 800의 6.4 % 중 이름표는 0.4 %, 나머지 6.0 %는 2장 화면의 DOM(새 게임 기본 화면 5.9 %에 2장 목표 패널 "제2장 · 전쟁의 그늘 0/2 · 목표 보기" 등). 이름표를 없애도 6.0 %로 예산 끝이다. 판정 대기: 2장 기본 화면 예산을 따로 두거나, 2장 목표 패널을 접을지.
- 다른 상태는 모두 예산 안(1280 1장 기본 5.9 %, 태블릿 6.5 % 등 — `gates/hud-coverage.json`).

## 3. 사슬 캡처 대상(②)
- 원인: INSTALL-3에서 세계 사진 직전에 호버 카드를 피하려고 포인터를 (4, 4)에 두었는데, 그 자리가 화면 가장자리 이동 띠(20 px, `gameCanvasRuntimeInput.ts` `EDGE_PAN_MARGIN_PX`)라 카메라가 왼쪽 위로 끌려갔다 — "보리 익음"이 숲, "가마 가동"이 바위만 보인 이유. 로컬에서 포인터를 옮기지 않으면 가마는 (800, 500)에 정확히 있었다.
- 고침(`scripts/install3ChainCaptures.ts`): 포인터는 HUD 날짜 띠(200, 40 — 캔버스 밖, 띠 밖), 건물은 발판 가운데(2 × 2 가마는 원점 + 1)로 카메라를 맞추고, **세계 사진마다 대상 검사** — 찍은 뒤 대상 칸의 화면 좌표를 읽어 잘라 낸 영역(640 × 400) 안인지, 밖이면 그 단계 실패(`captures.json` `framing`). 줌은 1.3: 1.4에서는 새 규칙대로 화면 안 성벽 구간이 모두 이름표를 달아 사슬 대상 위를 덮었다.
- DGX([chain/](chain/), 17장): 9장 모두 대상 (800, 500), 검사 9/9, 오류 0.
  1. [헛간 — 아직 밀](chain/g01a-world-barn-wheat.jpg) → [보리 선택](chain/g01b-ui-barn-barley-chosen.jpg)
  2. [가마 공사장](chain/g02a-world-kiln-site.jpg) → [배치 칩](chain/g02b-ui-kiln-chip.jpg)
  3. [보리 자람](chain/g03a-world-barley-growing.jpg) → [헛간 카드 보리](chain/g03b-ui-barn-barley.jpg)
  4. [보리 익음](chain/g04a-world-barley-ripe.jpg)
  5. [헛간 보리 자루](chain/g05a-world-barn-barley-sacks.jpg) → [헛간 재고 보리 150](chain/g05b-ui-barn-stock.jpg)
  6. [가마 가동·연통 연기](chain/g06a-world-kiln-working.jpg) → [가마 재고](chain/g06b-ui-kiln-stock.jpg)
  7. [양조하는 집](chain/g07a-world-house-brewing.jpg) → [장부 서랍](chain/g07b-ui-ledger.jpg)
  8. [에일하우스](chain/g08a-world-alehouse-stake.jpg) → [집 카드](chain/g08b-ui-house-served.jpg)
  9. [첫 판매](chain/g09a-world-ale-sold.jpg) → [계절 카드](chain/g09b-ui-season-ale.jpg)

## 4. 결산 카드 인구 줄(③)
- 전: "인구 0 (전 계절 0)" — 변화량 0이 인구 0으로 읽혔다.
- 이제: "인구 469명 (이번 계절 +3 · 지난 계절 ±0)"([g09b](chain/g09b-ui-season-ale.jpg)). 인구 수는 결산 순간의 인구(엔진이 계절을 닫을 때 여는 다음 집계의 시작 인구 `seasons.current.population`), 변화가 없으면 "±0". 같은 카드의 다른 변화량(수입·지출·남음, 빵·밀·목재·석재)도 0이면 "±0"(`seasonLedgerCopy.ko.ts` `signed`) — 증감 줄에서 0이 수량으로 읽히지 않게.
- 시험 `tests/seasonLedgerScenes.test.ts` 한 개 더(±0, 부호, 지난 계절이 없을 때).

## 5. 배부른 재생(④)
- 원인: INSTALL-3의 v22 목책 공사 저장은 집들의 식량 창고가 빈 순간에 저장돼 있었고(빵집 0, 방앗간이 빵을 내 곡창에서 배급), 재생 동안 첫 줄이 "식량이 부족합니다"(굶는 집 최대 24채 — v24 같은 저장으로 재 봄).
- 시험한 것(v24 저장, 2,400틱 중 빵 문제 틱): 그대로 1,659 · 곡창 하나 더 짓는 명령 1,779 · **집 식량 창고를 용량(`houseBreadCapacity`, 세 끼)까지 한 번 채움 0**. four-farms·population-176 저장은 엿기름 가마를 놓을 자리가 없어 사슬이 안 된다.
- 이제 `scripts/install3States.ts`: v24 timber-shortage 저장(2장으로), 명령 전에 한 번만 모든 집 식량 창고를 용량까지 — 유일한 준비, 명령 사이 편집 없음. 순간마다 식량 기록(`gates/moments.json` `food`, `gates/food.json`): 12순간 모두 굶는 집 0, 문제 표시에 빵 없음(첫 줄은 "정착지는 안정적입니다" 또는 일손 줄). 틱: 명령 92,684 → 파종 92,698 → 자람 93,198 → 가마 완공 94,090 → 익음 94,198 → 헛간 보리 150 94,211 → 엿기름 94,280 → 양조·에일하우스 94,400 → 첫 판매 95,000.

## 6. 회귀
- UI-6 묶음(`ui6/`): 스킨 감사 0 / 912(`ui6/audit/audit.json`), 튜토리얼 22 = 22, 터치 대상 통과, B9 입력 재생 14/14, TOUCH 재생 14/14, 패드·포커스 통과. `gates.json`의 `hudArea: false`는 위 2절의 1280 × 800 2장 성벽 상태 하나.
- 병합 전 검사(`check:merge`) 통과. 로컬 `npm test` 3,394/3,394.
- 렌더 파일 줄 수: `drawPalisadeConstructionSites.ts`는 이름표 코드가 빠져 줄었고, 새 `wallSiteLabels.ts`·`constructionTagProbe.ts`는 250줄 아래.

## 7. 결정
- INSTALL3B-D1: 성벽 공사 = 같은 `wallId`·같은 재료, 이름표는 화면 안 성문 가장 가까운 구간에 하나(원인은 이름표 있는 구간 중 성문 가장 가까운 것), 구간 이름표는 선택·줌 1.35부터, 객체 그리기 뒤에 그림.
- INSTALL3B-D2: 캔버스 이름표를 면적에 넣는 증명 포트(숨김·상자), 2장 성벽 상태의 1280 × 800 초과(DOM 6.0 %)는 판정 대기.
- INSTALL3B-D3: 사슬 캡처 포인터는 HUD 날짜 띠, 건물은 발판 가운데, 사진마다 대상 검사, 줌 1.3.
- INSTALL3B-D4: 사슬 재생은 v24 timber-shortage 저장 + 명령 전 식량 창고 한 번 채움.
- INSTALL3B-D5: 결산 카드의 0 변화는 "±0", 인구 줄에 인구 수.
