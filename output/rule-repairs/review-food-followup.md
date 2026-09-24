# strict-wheat-deficit 후속 코드 검토

- 대상: `5f05e7c..8fc019fd7c4b339662b24df98d4c772b00953483`, 변경 4개 파일.
- 판정: **PASS — 이 변경 범위의 구체적인 코드 차단 사항 없음.**
- 범위: 읽기 전용 source·test·doc 검토. R9 측정 중 CPU 간섭을 피하기 위해 추가 테스트·시뮬레이션·압축 해제는 실행하지 않았다. 장기 5seed 가드레일 및 최종 성능 판정은 대기 중인 별도 게이트다.

## 근거

1. `src/engine/autoplayFoodThroughput.ts:171`의 신규 경로는 `wheat_farm`의 완료된 기존 관측, `requiresDeliveredOutcome === true`, 실패 기록, 실제 `deliveredWheatDelta > 0`, 기존 기준값 존재를 그대로 요구한다. 신규 strict-deficit 허용에는 `outputDelta > 0`도 요구하므로 생산·운송 증거 없는 실패를 풀지 않는다.
2. 신규 허용은 `sample.wheatProduced < sample.wheatConsumed`를 사용한다. 같거나 단지 기존 5% 목표 여유가 모자라는 경우는 이 경로에 들어오지 않는다. 기존 빵 생산 개선 경로는 그대로 남아 있다.
3. 두 경로 모두 `sample.fullWindow && sample.known`과 현재 `measuredFoodDecision(state).reason === 'actual_wheat_deficit'`를 통과해야 한다. `foodEfficiencyMetrics`는 현재 tick과 기록의 `throughTick` 일치를 요구한다. `measuredFoodDecision`의 인력 부족·실경로 단절·운송 막힘 분기가 먼저 적용되므로 새 표현식이 이 기존 조건을 우회하지 않는다.
4. `foodAction`의 진행 중 관측 차단·시설 상한·건설 및 배치 조건은 수정되지 않았다. 저장 필드·경제 수치·생산/배송 코드도 변경되지 않았다. 반복 차단 함수는 기존 실패 기록을 성공으로 변경하거나 삭제하지 않는다.
5. 회귀는 과거 빵 최고치 아래의 strict deficit 해제, 생산=소비 및 margin-only 차단, 생산/운송 증거 0, 인력 부족, 운송 막힘, 미측정/오래된 창을 다룬다. 기존 늦은 빵 개선 경로와 legacy 차단도 유지한다. 자연 fixture 테스트는 실제 전체 advisor→game action→reducer를 통해 새 밀밭 공사 한 건이 생성됨을 확인하도록 구성돼 있다.
6. 문서는 204k 상태의 `5f05e7c` 출처와 240k 별도 작업 트리 기록을 구분하며, 선택·정상 착공 증거를 최종 장기 안정성 완료로 표현하지 않는다. 문서에 기록된 277개 통과를 이 리뷰의 독립 테스트 실행으로 주장하지 않는다.

## 남은 판정

현재 추가 코드 수정 요청 없음. 최종 소스의 5seed 자연 가드레일·R9 결과는 실행 담당자의 실제 결과에 따라 확정해야 한다.
