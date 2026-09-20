# 자유 도시 0단계: 한정된 시뮬레이션 교정

2026-09-21, 기준 커밋 `ec80d314`. **식량 관측·우물 배치·검증 도구를 교정했지만 0단계 전체는 미충족이다.** 5개 seed를 같은 최종 소스로 최대 1,200,000틱 실행해 24필지·기존 승리·24,000틱 연속 안정을 모두 통과한 증거는 없다. 곡선·자유 배치·저장 변환·Three.js/3D·모델 제작·배포는 시작하지 않았다.

## 변경 결과

- 식량: 자동 건설 수락과 완공을 구분하고 생산 주기·경로에 따른 관측 기한을 기록한다. 정상 엔진에서 해당 건물의 실제 생산과 해당 곡창의 실제 배송만 효과로 인정한다. 관측 중 기다리고, 효과 없는 같은 종류 증설을 차단한다. 다른 곡창의 배송·굶주림 감소를 잘못 귀속하던 결함을 수정했다.
- 배치: 우물 후보의 합법성을 `canPlaceBuilding`으로 통일했다. 자재 접근로가 없으면 기존 도로 계획을 재사용하고, 연결된 도로망의 마지막 확장 출구를 건물로 막지 않도록 구성요소별로 확인한다. 숲 우물·도로 우선·국소 출구 회귀는 저장 원본을 외부에서 읽지 않는 작은 fixture로 검증한다.
- 검증: seed 2의 암석 0을 초기 차단 사유로 보고한다. 채석장 후보 0은 점유 때문에 생길 수도 있어 진단값으로만 둔다. 자연 수용량 초과·회복은 필수 합격 조건 밖에서 따로 보고하고, 미달 CLI는 비정상 종료한다. 기존 출력 디렉터리 덮어쓰기를 거부한다.
- 단순화: 배치 규칙과 경로 계산을 재사용하고 반려한 재고 기반 식량 guard를 제거했다. 새 의존성이 없다. 기본 8필지·비용·생산·소비·인력·서비스 범위와 기존 ID·화물·예약·재고 처리 계약은 유지한다. 역사적 실패 저장 상태는 수정하지 않는다.

22개 코드·시험 변경 파일(문서 제외):

| 범위 | 파일 |
| --- | --- |
| 식량 판단·관측 | `src/engine/autoplayFoodThroughput.ts`, `autoplayFood.ts`, `autoplayActions.ts`, `constructionLifecycle.ts`, `engine.types.ts`, `tick.ts` |
| 실제 배송 귀속 | `src/agents/roaming.ts`, `roamingStep.ts`, `roamingTypes.ts`, `roamingService.ts` |
| 배치 수락 | `src/state/gameStore.ts`, `gameStore.types.ts` |
| 우물·도로 출구 | `src/engine/autoplayWater.ts`, `autoplayExpansion.ts` |
| 검증 실행 | `scripts/phase19NaturalGrowth.ts` |
| 회귀 | `tests/autoplayFoodThroughput.test.ts`, `autoplaySustainability.test.ts`, `phase20GrowthHarness.test.ts`, `autoplayFoodGranaryAttribution.test.ts`, `autoplayFoodObservation.test.ts`, `autoplayWaterRecovery.test.ts`, `helpers/autoplayFoodFixtures.ts` |

## 확인한 증거

- [식량 코드리뷰](evidence/food-code-review.md): APPROVE, 관련 시험 52개·typecheck·build·diff 검사 통과. [최신 식량 split 재리뷰](evidence/food-maintainability-split-code-review.md): APPROVE, 최종 물 fixture 해시 `d0354cbef03d334a2efc770dcf4d1be195377c89bee13b3f7a38957139ca16a2`, 수정 후 관련 19개 시험·typecheck·targeted non-null scan 통과. [배치 리뷰](evidence/placement-code-review.md): APPROVE/WATCH, 배치 19개·도로 관련 11개 통과. [하네스 최종 리뷰](evidence/harness-gate-review.md): APPROVE, 관련 16개 통과와 CLI 미달/원본 보호 확인. 서로 겹치는 시험 수는 합산하지 않는다.
- [보존성 리뷰](evidence/security-review.md)와 [의도 리뷰](evidence/context-review.md): 한정된 변경 PASS. 검토 대상 [17개 파일 해시](evidence/security-context-source.json)에 한정되며 전체 0단계 승인과 다르다.
- [정상 엔진 관측](evidence/food-normal-engine-probe.json): 통제한 방앗간에서 실제 `advanceTick` 생산 `outputDelta: 1`. [reducer 검사](evidence/reducer-placement-qa.json): 숲 우물·도로 우선·출구 보호 PASS. [브라우저 검사](evidence/browser-ui-placement-qa.json): 통제된 시작 상태에서 실제 메뉴·마우스로 도로와 우물 공사 배치 PASS. 자연 성장·공사 완공·5지도 승리 증거가 아니다.
- 전체 시험은 **1,610/1,610 PASS**, fail 0·skip 0, 726,179.408ms이며 Phase9를 포함한다. 마지막 동작 보존 파일 분리 전 실행이다. 분리 후 최종 소스에서 확장 6개 시험 파일 **52/52**, typecheck·build·diff 검사와 정상 엔진 생산 probe 재실행은 모두 PASS다. [시험 수](evidence/verification-count-summary.json), [종료 코드](evidence/exit-summary.json), [검증 명세](evidence/manualQa.json). 기존 Vite 큰 번들 경고가 남는다.
- [최종 bounded 목표 리뷰](evidence/goal-review.md)는 구현된 Stage 0 repair subset을 APPROVE한다. 전체 0단계와 자유 건설 로드맵은 계속 미완료다. 17개 파일 해시는 분리 전 보존성 스냅샷이므로 위 최신 split 리뷰와 goal 리뷰를 보충 증거로 함께 읽는다.
- QA 서버·브라우저 정리를 확인했고 3218 환경에는 손대지 않았다. 마지막 확인에서 3218 리스너는 없었으므로 실행판 설치·서비스 중이라고 주장하지 않는다.

검증 명령은 이 저장소 루트에서 실행한다. CLI 출력은 매번 새로운 빈 경로로 지정한다.

```sh
node --import tsx --test tests/autoplayFoodGranaryAttribution.test.ts tests/autoplayFoodObservation.test.ts tests/autoplayWaterRecovery.test.ts tests/autoplayFoodThroughput.test.ts tests/autoplaySustainability.test.ts tests/phase20GrowthHarness.test.ts
npm run typecheck
npm run build
npm test
node --import tsx scripts/phase19NaturalGrowth.ts 24 1 output/stage0-new-seed2-preflight 2
```

마지막 명령의 예상 결과는 seed 2 `rockTiles: 0`, `invalid-run`, tick 0, exit 1이다. 한 틱 CLI 점검을 1,200,000틱 성장 검증으로 해석하지 않는다. evidence의 기존 절대 경로는 당시 실행 위치를 보존한 이력이며 위 명령의 외부 의존성이 아니다. 대형 원시 상태·이미지는 이 간결한 문서 묶음에 중복 저장하지 않았다.

## 남은 조건

seed 2는 초기 암석이 없어 현재 자원 규칙으로 석재 승리 조건을 만족할 수 없다. 지형 생성기 변경 여부는 사용자 결정 대기이며 암석 주입·seed 교체·수입 추가·판정 완화는 하지 않았다. seed 3의 성벽 제안 `out_of_bounds` 및 대안 둘레의 `building_clearance`는 별도 미해결 항목이다. 이 항목은 담당자의 함수 호출 진단 요약이며 원시 probe 파일이 없는 한 독립 재현 증거로 간주하지 않는다.

기존에 막힌 저장 상태를 자동 복구한 것이 아니다. 모든 농지·성벽·배송·인력 문제 해결, 완전한 생산망 인과 분석, 새 배치 정책의 장기 회복 효과는 아직 증명하지 않았다. 우물은 reducer 기준상 암석에도 합법이며 별도 지형 정책이 필요하면 추가 결정 대상이다. 0단계 합격 전에는 1~4단계로 넘어가지 않는다.
