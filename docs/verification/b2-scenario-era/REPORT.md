관문: ①가드레일 5/5 · ②샌드박스 24,000틱 승리·실패 0 · ③석벽 선택(석벽 없이 승리, off면 닫힘) · ④결정론 · ⑤클론 __CLEAN__ — 통과

# B2 시나리오·정착 단계·역사 시대·달력 데이터화

본선 `codex/phase15-organic-ground` 위의 작업 브랜치 `claude/b2-scenario-era`. 기준 `d7ad548`. `src/render/**`, `src/world/boundary/**`, `public/assets/**`는 수정하지 않았다(D1a 세션 소유).

## 착수 시 사용자 결정 (K4-1)

지시서대로 번영 승리 조건만 빼면 석벽은 선택이 되지 않는다. L4에는 교회가 필요하고, 교회는 석조 선포로만 해금되며, 석조 선포는 석벽 교체 공사를 곧바로 만들기 때문이다. 세 가지 안을 묻고 사용자가 1안을 골랐다.

- **석벽만 선택화한다.** 교회 해금을 시장도시 단계로 옮기고, 석조 선포를 전제조건이 있는 선택 석벽 프로젝트로 바꾸며, 번영 승리에서 석조 시대와 석벽 완공을 뺀다.
- **목책 선포는 시장도시 진입 방식으로 둔다.** 지시서의 "기본 시나리오 목책 optional"은 철회했다. `WallPolicy.palisade`는 데이터 자리만 두고 로더가 `required`만 허용한다.
- **K4-2는 C1로 미룬다.** 목책까지 선택화하고 L4의 '성벽 안' 조건을 재검토하는 일이다.

결정 기록은 [결정 목록](../../decisions/README.md) K4-1·K4-2에 있다.

## 0절 로드맵 정정

지시서의 전제("B1에서 ROADMAP.md가 v2.3으로 남았다")는 저장소와 달랐다. B1이 이미 v3를 설치했고, 그 바이트가 이번 첨부와 같았다(SHA `9cf46da3…`). 남은 일이던 v2.3 "결정 기록(D1~D7)" 절만 v3 끝에 옮겨 붙였다(`5e44035`). 결정 목록의 D1~D7 출처도 `ROADMAP.md`로 고쳤다.

## 커밋

| 커밋 | 내용 |
|---|---|
| `5e44035` | 로드맵 D1~D7 절 이관, 결정 K4-1·K4-2 |
| `21caf65` | 시나리오 데이터·로더·조건 술어, 단계 해금, 석벽 정책, 승리·실패·목표 데이터화, 달력·역사 시대, 저장 v5, 명세·시나리오 테스트 (**가드레일 대상 커밋**) |
| `8d98207` | 목표판·자원바 달력·시대 콘솔·안내·새 게임 모드 선택·저장 요약 (화면만, 자동 조언은 이 행동을 쓰지 않음) |
| 보고서 커밋 | `PALISADE_REQUIREMENT_TARGETS`를 단계 데이터에서 파생(값 동일, 온보딩 문구만 읽음), 설계서·STATUS, 증빙 |

**저장 스키마**: v4→**v5**. `GameState.scenarioId` 하나를 추가하고, 봉투 헤더 `scenarioId`는 상태의 시나리오와 맞춘다. v4→v5 이주는 `core:campaign_market_town`을 채운다. 알 수 없는 id는 불러오기 오류다. v5 픽스처 4개는 v4를 이주해서 만들었다(새 성장 실행이 아님). 지문 변화는 `$.scenarioId:string`과 `declared:scenarioId` 두 경로뿐이다.

## 관문

**① 기본 시나리오 seed 1~5 가드레일 5/5** (`21caf65`, `scripts/efficientGrowthRun.ts 24 1200000`, 기준선 `7db9df85` 조건, 5개 병렬, seed별 실제 시간 1,500초 이내). 원자료는 [guardrails-21caf65.json](guardrails-21caf65.json).

| seed | 가드레일 | 승리 틱 (R1-fix `0725764`) | 승리 때 석벽 | 최종 단계 | L4/필지 | 방앗간/밀밭 · 교회 | 밀0 방앗간 | 실행 |
|---|---|---|---|---|---|---|---|---|
| 1 | 통과 | 628,273 (752,220) | **없음**(석조 선포 656,757 > 승리) | 요새 도시 | 24/24 | 17/26 · 2 | 0 | 1,295초 |
| 2 | 통과 | 294,126 (471,223) | **없음**(끝까지 시장도시) | 시장도시 | 24/24 | 20/28 · 2 | 0.05 | 865초 |
| 3 | 통과 | 277,437 (277,437) | 완공(석재 20/20, [재생 확인](seed3-victory-replay-21caf65.json)) | 요새 도시 | 24/24 | 19/26 · 2 | 0 | 1,077초 |
| 4 | 통과 | 342,833 (446,602) | **없음**(석조 선포 412,895 > 승리) | 요새 도시 | 24/24 | 19/27 · 1 | 0 | 960초 |
| 5 | 통과 | 465,791 (621,111) | **없음**(끝까지 시장도시) | 시장도시 | 24/24 | 18/25 · 2 | 0 | 909초 |

모든 seed의 판정 항목은 참이었다: `efficiency`, `baselineL4`, `serviceGap`, `newDeadlock`, `zeroWheatRegression`. 실패 목록은 비어 있고, 정지 이유는 `target-scale-stable`이다. 승리는 seed 1·2·4·5에서 14~38% 빨라졌고 seed 3은 같다. 석벽을 기다리지 않아서다. 가드레일 스크립트의 승리 예측 `prosperityEligible`도 엔진의 `victoryConditionsMet`을 쓰도록 바꿔, 조건을 두 곳에 두지 않는다.

**② 샌드박스 24,000틱**: `tests/scenarioEra.test.ts` "T2 SC-10". 승리 조건을 이미 충족한 24필지 L4 도시를 샌드박스로 두고 실제 틱 24,000개를 진행했다. 매 틱 결과는 `ongoing`이었고 목표판에 목표가 없었다. 빈 정착지 600틱도 샌드박스에서는 `abandoned`가 되지 않는다(SC-9 테스트).

**③ 석벽 선택**
- 석벽 없이 번영 승리: "T1 SC-7"은 seed 1 도시를 목책 시장도시로 되돌린 뒤 실제 시뮬레이션만으로 승리에 도달한다. 가드레일 자연 성장에서도 5개 중 4개 seed가 석벽 없이 이겼다. seed 3만 승리 시점에 석벽이 완공되어 있었다(같은 커밋에서 승리 틱까지 다시 재생해 확인).
- 요새 도시 조건이 있을 때만 석벽 프로젝트가 열린다: "T3"는 `optional`이면 전제조건을 충족할 때만 열림, 금화가 모자라면 닫힘, `off`이면 요건 행이 없고 동작도 비활성이며 사유 문구가 뜨는지 본다(`tests/scenarioPresentation.test.ts`).

**④ 결정론**: 달력 경계(299→300, 1199→1200, 1일·360일), 시대 전이 연도(1314/1315·1336/1337·1347/1348·1379/1380), 저장→불러오기 뒤 달력·시대 동일, 이어서 1,200틱 진행한 전체 상태 JSON 동일, v4 저장 4개 → 기본 시나리오·단계·시대 정상. `tests/scenarioEra.test.ts` T4·T5.

**⑤ 깨끗한 클론**: __CLEAN_DETAIL__

## 하드코딩 제거 목록 (기준 `d7ad548` 파일:행 → 데이터 키)

| 이전 위치 | 옮긴 곳 |
|---|---|
| `src/engine/settlementProgress.ts:18` 자립(인구 20·공급·600틱) | `ScenarioDef.objectives[selfSufficient].conditions` |
| `settlementProgress.ts:20,24` 목책 마을(인구 60·시대·성벽 완공) | `objectives[palisade].conditions` |
| `settlementProgress.ts:21-22` 번영(L4 4·공급·인구 140·**석조 시대·석벽**·1,200틱) | `ScenarioDef.victory`(석조·석벽 제거) |
| `settlementProgress.ts:32` 주민 0 600틱 = 버려짐 | `ScenarioDef.failure`(`settlement_empty_for`) |
| `src/engine/settlementView.ts:16,22,28` 목표 제목·설명·기준 행 | `SCENARIO_COPY.objectives` + 조건 데이터에서 행 파생 |
| `src/engine/era.ts:7-20` 목책·석조 선포 목표치 | `StageDef[market_town].enterWhen`, `WallPolicy.stoneWallPrereq` |
| `src/content/buildingConfig.ts` `unlockEra` 14곳, `src/world/placement.ts:60` | `StageDef.unlocks`(유일 원천) |
| `src/ui/buildMenuModel.ts:84-85` "목책마을 이후"·"석조 도시 이후" | `SCENARIO_COPY.unlockedAfter` + 단계 이름 |
| `src/ui/EraConsole.tsx:58` 현재 시대 이름 | `SCENARIO_COPY.stages` |
| `src/ui/SettlementPanel.tsx:34` "번영하는 성곽 도시 달성" | `SCENARIO_COPY.victoryTitle` + `objectives.prosperity.title` |
| `SettlementPanel.tsx:50` 이정표 분모 3 | `objectives.length + victory` |
| `SettlementPanel.tsx:51` 석재 400 비축 | `stoneWallPrereq`의 석재 조건 |
| `SettlementPanel.tsx:41,48` 안내 문장 | `SCENARIO_COPY` |
| `src/ui/settlementGuidanceModel.ts:40,45` 인구 60/140 | 시장도시 진입·승리 조건의 인구 |
| `src/ui/onboardingTaskModel.ts:143` "기초 운영 완료" 상시 안내 | `openGoalFitsScenario`: 목표형 촌락이고 남은 목표가 있을 때만 표시 |
| `scripts/phase19GrowthMetrics.ts:68-72` 복제된 승리 조건 | `victoryConditionsMet` |

남은 하드코딩은 `src/render/placementFeedback.ts:86`의 "목책마을 이후 건설할 수 있습니다"(렌더 영역), `src/engine/autoplayEra.ts:17`의 자동 조언 인구 60 휴리스틱, `onboardingTaskModel.ts`의 튜토리얼 힌트 속 "인구 60명"·"목재 250"이다.

## 관찰

- 방앗간/밀밭 17~20/25~28, 건물/필지 3.88~4.08로 R1-fix와 같은 범위다(STATUS 알려진 문제에 추가, C1에서 판단).
- 교회가 시장도시에서 해금되면서 자동 조언이 목책 시대에 교회를 짓는다. 옛 해금표로 찍은 자연 스냅샷 테스트 3개(방앗간 보충·창고 회복)는 그 해금표를 명시한 시험 시나리오(`tests/preK4UnlockScenario.ts`)로 재생해 원래 규칙 검사를 유지했다. seed3 경로 캐시 테스트의 상태 해시는 번영 유지 틱이 세어지게 되어(0→120) 바뀌었고, 냉·온 동일성 검사는 그대로다.

## 다음 후보 (B3 장부에 넘길 것)

- 석벽 프로젝트의 재원(금화 200·석재 400 전제조건)과 유지비, `ScenarioDef.economyRules`의 실제 내용.
- `stoneWallPrereq`의 해안·전략 플래그는 술어가 없어 비워 두었다(새 술어 금지). archetype·지도 데이터가 생기면 추가.
- 역사 시대의 상태 조건(`EraDef.enterWhen.state`)과 효과값은 C 단계 콘텐츠에서 채운다. 파이프(`historicalEraEffectRegistry`)는 연결했고 지금은 0개다.
- 렌더 영역의 남은 문구와 옛 `tone` 줄(`placementPredictionRuntime.ts:30`).
- `TICKS_PER_YEAR = 1200`은 잠정값이다. 사람 플레이로 한 판 시간을 잰 뒤 조정한다.

소요 시간: __ELAPSED__
