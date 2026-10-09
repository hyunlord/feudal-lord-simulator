# 과거 관측 기록 집계

createHistoricalObservations(reference.absentEntryIds)는 관측 레코드를 하나씩 받아 원본 부재40개 각각의 경로별 기록 수와 최초·최종 tick을 집계한다. 수락·후보 순서·선정·제시 구성·처리 층위 기록 수를 구분한다. 외부 예산과 legacy 억제는 전역 집계로 보존하며 개별40개 원인으로 배분하지 않는다. 대상 밖 ID도 별도 합계에 남긴다.

입력 검증 실패는 누적값을 바꾸지 않으며 snapshot은 내부 상태와 분리된다. 메모리는40행과 고정 경로 계수에 한정되고 원문 레코드를 저장하지 않는다. 원문 NDJSON은 별도로 보존해야 한다.

이는 기록 수이며 고유 계절·기회·발생 수가 아니다. 원본 인증·스트림 완전성·관측 실패·실행 소스·결과 일치 검증은 호출자 몫이다. applicabilityAllowed·fullStateComparable·originalRuntimeVerified는 항상 false이며, 실제 과거 원인 분류는 미완료다.

검증: node --test tests/engineBHistoricalObservations.test.mjs 9/9 통과, 저장소 ESLint 통과. 입력 오류의 누적값 보존·스냅샷 분리·전역/대상 밖 기록·반복 기록·선택 범위 오류를 확인했다. 실제 시뮬레이션 없음.
