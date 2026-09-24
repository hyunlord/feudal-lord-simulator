관문: ①깨끗한 클론 2,442/2,442 · ②B8 통과 · ③상태 기록 완료(합격 판정 없음) · ④문서 지도 22/22

# S0 본선 정리

본선 `codex/phase15-organic-ground`. B8 merge와 이식성·공통 좌표 타입·설계 이관을 완료했다. 게임 성장/경제/목책 규칙, 기본 8필지, 기존 `baseline-7db9df85.json`은 바꾸지 않았다. `main` 병합·배포·브랜치 삭제 없음.

## 커밋과 검증

| 항목 | 커밋(각각 origin 푸시) |
|---|---|
| B8 merge, schema v2, v1 이행·체크섬 사전검사 | `7968bcf` (B8 `dd19986` merge) |
| 외부 테스트 입력·아트 원본 의존 해소 | `dba23cb` |
| TileEdgePoint 공유 타입, 동작 불변 | `afb3321` |
| 첨부 원본 30파일·문서 지도·결정 목록 | `172e925` |
| AGENTS 상시 규칙 | `b21fdac` |
| 판정 없는 seed 계측·중단 입력 보존 | `e97d6a8` |
| 비동기 저장 완료를 기다리는 브라우저 검증·PLAY 안내 | `3c52fa4` |
| 24필지 상태 기록·캡처 | `b8e9fb4` |
| 48필지 측정 | `ca70fbc` |
| 종료 보고·증빙 | 이 문서 포함 커밋 (`git log -1 -- output/trunk-baseline/REPORT.md`) |

**관문①:** `/tmp/fls-s0-clean-e97d6a8`에 origin에서 새로 clone, 로컬 node_modules 공유 없이 `npm ci && npm test`: **2442 pass / 0 fail / 0 skip**, Phase 9 포함. typecheck·build exit0. 최종 산출물 커밋도 별도 새 클론에서 같은 전체 검증을 실행하며 최종 해시·결과는 `/tmp/fls-s0-final-verification.json`에 기록한다. Node25.8.2/npm11.11.1/macOS26.4.1/M4 Max14코어.

**관문②:** schema 감시 포함 저장 테스트29/29. seed1(679251→703251)·newgame(10000→34000) 각각24,000틱, reload/autosave/reload-chain 모두 동일. 결정론 해시는 root `pathCache`만 제외하며 저장 checksum/실제 저장 payload에서는 빼지 않았다. 실제 Chrome153 빌드 화면에서 새로고침1210틱·탭 재열기1820틱의 GameState SHA와 재고 일치. [전](b8-final-browser/reload-0-before.jpg) / [후](b8-final-browser/reload-2-after-continue.jpg). 게임 상태 복원 검사이며 사람 플레이 기록이 아니다.

새 fixture 생성을 위한 자연 성장은96,360틱의 서비스 후보 탐색에서 오래 걸려 중단했다. v1 원본을 보존하고 `build:save-fixtures -- --from-version 1`로 실제 기존 상태를 v2 envelope로 이행했다. 관측 이력을 만들거나 성장 조건을 바꾸지 않았다. 독립 검토에서 찾은 잘못된 checksum 타입 허용을 수정·회귀검증했다([검토](review.md)).

**이식성:** 외부 autoplay 상태3개→출처·SHA가 있는105KB fixture, 원본 PNG 검사는 있을 때만(없으면 이유와 skip), 런타임 PNG 검사는 항상 실행. installer source/선택적sharp는 인자·환경변수·일반 모듈 해석으로 변경. `/Users/` 실행 참조0; `output/` 잔여17건은 출력·출처·명시적 CLI 입력. 파일별 표는 [이식성 기록](portability.md). TileEdgePoint 회귀 전후51/51.

## 현재 상태 기록

측정 source **`e97d6a8`**, clean source에서 각1회; 후속 커밋은 브라우저 QA 스크립트와 문서·증빙이며 측정 엔진/driver와 최종 제품 `src`가 동일하다. 24필지 seed1~5와48필지 seed1을 동시에 최대120만틱/25분으로 제한했다. 기존 검증용 opening 이동 방식이며 제품 seed 선택 기능·사람 플레이가 아니다. 시간 종료 시 미완료 결정 직전 상태를 보존했다. **아래 값은 성장 합격/불합격이나 지도 수용 한계 판정이 아니다.**

| seed / 상한 | 틱 | 필지 / L4 | 밭·방앗간·곡창·시장·교회 | 건물/필지 | 성내 밭% / 빈% | 캡처 |
|---|---:|---:|---|---:|---:|---|
| 1 / 24 | 330,000 | 24 / 0 | 17/7/3/2/0 | 2.67 | 16.8 / 19.1 | [seed1](records/seed1/final-city.jpg) |
| 2 / 24 | 366,960 | 24 / 0 | 18/8/3/2/0 | 2.71 | 13.5 / 3.0 | [seed2](records/seed2/final-city.jpg) |
| 3 / 24 | 28,080 | 13 / 0 | 6/3/1/0/0 | 2.31 | — | [seed3](records/seed3/final-city.jpg) |
| 4 / 24 | 431,880 | 24 / 0 | 20/7/4/2/0 | 2.92 | 13.0 / 16.6 | [seed4](records/seed4/final-city.jpg) |
| 5 / 24 | 439,680 | 24 / 0 | 18/7/7/2/0 | 2.88 | 15.4 / 28.1 | [seed5](records/seed5/final-city.jpg) |
| 1 / 48 | 152,160 | 48 / 0 | 25/10/7/2/0 | 2.25 | 15.9 / 23.7 | [48-seed1](records/48-seed1/final-city.jpg) |

밀도: 건물/필지, 선포된 **계획 둘레** 안 밭 점유/전체 타일, 같은 둘레 안 빈 grass/전체 타일. 빈 면적은 도로·건물·공사장을 제외하지만 실제 건설 가능한 footprint 보장은 아니다. 전체 농지 중 성내 비율은 JSON 별도 필드. [24필지 원시 지표](../../seeds/state-e97d6a8.json), [48필지 지표](../../seeds/capacity-48-e97d6a8.json).

| 실행 | 종료 / 마지막 진단(그 진단의 틱) | 10초 초과 결정 | 틱 평균 / 최근 p95 ms |
|---|---|---:|---:|
| seed1 | wall-time-budget / wheat_transport_blocked · none (330000) | 28 | 2.287 / 2.433 |
| seed2 | wall-time-budget / wheat_transport_blocked · none (366840) | 9 | 3.108 / 2.036 |
| seed3 | wall-time-budget / pending_chain · none (27960) | 4 | 0.186 / 0.561 |
| seed4 | wall-time-budget / wheat_transport_blocked · none (431760) | 10 | 1.696 / 1.797 |
| seed5 | wall-time-budget / wheat_transport_blocked · none (439680) | 0 | 2.907 / 4.970 |
| 48-seed1 | wall-time-budget / active_observation · none (152160) | 20 | 4.960 / 18.537 |

48필지 상한: **48/48**까지 도달, 계획 둘레 내부 빈 타일 **149**, 목책 **2/44** 완공. 나머지42공사장 모두 `reserve_held`(`constructionLifecycle.ts:recomputeConstructionStalls` → `constructionReserve.ts:wallReserveHeld`). 공간 수용은 관측됐지만 도시 완성은 아니다. 평균틱4.960ms, 최근240틱 p95 18.537ms.

seed3의28,080틱 결정은 **1,288초 이상** 끝나지 않았다. 실제 stack은 `autoplayServiceBudget.ts:findBudgetedServicePlan`의 재귀 search와 `housingAction`이다. seed1/2는 `projectGranaryAccess` → `serviceSafeRoadAction` → `findAutoplayServiceWitness` 경로도 관측했다. 마지막 완료 진단과 중단 중 stack을 구분한다.

10초 초과 결정 전부: [목록·호출 위치](slow-decisions.md). 수정 없는 입력·최종 상태는 [압축 기록](recorded-states.tar.xz), [SHA 목록](recorded-states-manifest.json). 71개 입력을 보존했다. 48필지의142,200/143,280틱 두 stack은 debugger 접속 전에 결정이 끝나 다음 tick을 가리키므로 결정 내부 위치로 쓰지 않는다. 시간은 부모 IPC 관측이며 순수 함수 CPU 시간은 아니다. 계측·동시 CPU 부하를 포함하므로 틱 시간은 게임 FPS나 성능 관문이 아니다.

## 문서·브랜치·남은 것

[문서 지도](../../docs/README.md)22/22·ZIP30파일 byte-identical. v3-B 원문 내부 보조 링크8개는 첨부 자체에 없어 누락 목록을 보존했다. 원문 유지와 현재 적용 규칙의 차이를 별도 표기했다. 원격 phase/stage/economy12개 모두 본선 조상이며 삭제하지 않았다([브랜치 전체 표](branches.md)).

다음 후보는 R1-fix의 성장/느린 탐색 복구, 튜토리얼 안내의 이어하기 상태, 누락된 v3-B 보조 원문 확보다. 기존 nanoid 전이 의존성 보안 경고1건과 Vite 번들770.58KB 경고는 범위 밖으로 남겼다. UI/밸런스 개선을 이어서 진행하지 않는다.

소요: 2026-09-24 08:51:26 UTC 시작. 최종 검증 완료 시각·소요·원격=로컬은 최종 receipt에 기록. 5시간 상한 이내.
