# R1-fix 독립 코드 검토

판정: **PASS — 이전 HIGH 1건 수정 확인, 남은 확정 중대 결함 0건**

검토 기준: `/Users/rexxa/github/feudal-lord-simulator-playable`, `1c09e99..666374ab7f1ecbd52497f5ef73e060edf29019c9` 및 2026-09-24 R9 미커밋 변경. `AGENTS.md`, `docs/design/rule-repairs/WORK_ORDER.md`와 항목별 규칙을 읽고 실제 호출 경로 및 회귀 테스트를 대조했다. 제품 파일은 수정하지 않았다.

## 수정 확인: 공동 서비스 탐색의 지역 상한 도달을 완료된 불가능 판정으로 취급하던 HIGH

- 위치: `src/engine/autoplayServiceBudget.ts:84`, `src/engine/autoplayServiceSpace.ts:79`, `src/engine/autoplayServiceSpace.ts:126`, `src/engine/autoplaySearchBudget.ts:18`.
- 재현 조건/경로: `findBudgetedServicePlan()`이 합법 공동 배치를 찾기 전에 12번째 재귀 분기를 소모하지만 단계 전체 192회 예산에는 아직 여유가 있는 상태. 지역 중단은 `markAutoplaySearchLimit()`만 호출한다. 이는 `hit=true`만 설정하고 `exhausted`는 false로 남는다. 반환되는 `null`을 `budgetFor()`는 완료된 불가능 결과와 구별하지 않고 저장한다. 그 뒤 비주택 배치 또는 도로 조언에서 기존 상태 `witness === null`이면 투영 상태의 공동 서비스 계획 검사 자체를 건너뛰고 `allowed=true`를 반환할 수 있다.
- 영향: 기존 집별 독립 증인은 존재하더라도 시장/교회의 공동 배치 공간은 충돌할 수 있다. 예산 때문에 아직 확인하지 못한 기존 공동 계획을 '원래 불가능'으로 간주하면 이를 보호하는 마지막 공동 검사에서 fail-open한다. S8-R9 명세 3의 '소진 때문에 끝나지 않은 검사를 기존 불가능의 증거로 캐시하지 않는다'를 위반한다.
- 수정 방향: 지역 상한과 전역 소진 모두에 대해 결과를 `found / impossible / incomplete`로 구별하거나 검사 호출별 불완전 상태를 추적한다. 완료된 불가능 결과만 음성 캐시하고, 기존 결과가 불완전하면 다음 상태의 완전한 증인 없이는 해당 배치를 허용하지 않는다. 이미 완료한 유효 증인은 보존한다.
- 최초 확인: 소스 경로로 확정했으며 R9 담당 에이전트도 같은 원인을 독립 확인했다. 아래 수정본을 독립적으로 다시 읽었다.
- 수정 확인: `autoplayServiceBudget.ts:21`의 `ServiceBudgetSearch`가 `witness`와 `complete`를 함께 반환한다. 지역 분기 상한과 전역 예산 소진은 모두 `truncated=true`이며, `:128`에서 유효한 증인이 있거나 탐색이 끝난 경우에만 complete가 참이다. `autoplayServiceSpace.ts:76`의 `budgetFor()`는 complete인 결과만 저장한다. `:127`의 기존 baseline 불완전 분기는 투영 상태의 증인을 반드시 요구하고, `:138`은 불완전 결과에서 유도한 false 결정을 저장하지 않는다. 이 수정으로 지적한 fail-open과 음성 캐시 오염 경로는 닫혔다.
- 회귀 검사 확인: `tests/autoplaySearchBudget.test.ts:54`는 실제 기존 `service-space-normal-97560` fixture에서 제한 탐색 null/complete=false, 제한된 곡창 배치 거절, 무제한 탐색 null/complete=true, 이후 동일 곡창 배치 허용을 검증한다. 따라서 미완료 결과가 완전한 기존 불가능 판정을 대신하지 않고 후속 검사를 오염시키지 않는다는 분기를 직접 보호한다. 테스트 소스는 검토했으며 실행 결과는 담당 로그로 별도 연결한다.
- 검증 경계: 조용한 CPU 성능 replay를 보호하기 위해 리뷰어는 실행 재현과 무거운 테스트를 돌리지 않았다. PASS는 수정된 소스 경로에 대한 코드 검토 판정이다.

## 나머지 검토

R1 서비스 선착순·재배정, R2 준비된 성벽 부지 인력, R3 중지/재개·공사 인력 하한·식량/목재 우선순위, R4 석벽 병렬 순서, R5 취소 화물 창고 변경·초과 하역·예약 해제, R6 공사 수요 판매 비축, R7 목재 부족 관측·확장, R8 원본 밀 운송 상태 복구에서 추가 확정 중대 결함은 발견하지 못했다. 명세로 요청된 동작 변경 자체를 회귀로 지적하지 않았다.

후속 캐시 보강도 확인했다. `autoplayServiceSpace.ts:43`의 레이아웃 키는 `operationPaused === true`를 포함한다. `autoplaySearchBudget.test.ts:71`은 동일 geometry·타일에서 기존 시장 가동/중지/재개 시 직접 구조 검사 결과가 true/false/true임을 검증하여 R3의 새 입력이 캐시에 빠지는 경우를 보호한다.

담당 실행 로그 `/tmp/r1-search-owned-final.log`를 직접 읽어 지역 상한 unknown·캐시 오염·시설 중지/재개 회귀를 포함한 24/24 통과를 확인했다. 리뷰어가 별도 실행한 결과는 아니다.

검토 한계: 최종 전체 테스트, 깨끗한 클론 검사, 5-seed 가드레일 및 최종 R9 69개 성능 replay의 종합 확정은 리더/담당 책임이다. 이 검토는 그 관문들의 통과를 대신하지 않는다.
