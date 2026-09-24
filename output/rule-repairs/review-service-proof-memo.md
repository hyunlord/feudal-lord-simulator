# R9 completed service proof memo 검토

판정: 최종 source diff에서 확정 blocker 없음. 읽기 전용 정적 검토이며 테스트는 재실행하지 않았다.

검토 범위: autoplayServiceSpace.ts / autoplaySearchBudget.ts 및 실제 proof 종속 함수(autoplayServiceSpaceWitness/Routes, autoplayServiceBudget, autoplayConstructionSources, serviceAllocation, placement, autoplaySetback, marketService, routing). tests/serviceProofMemo.test.ts도 읽었다.

- 입력 키: 크기, 순서 있는 타일 좌표·지형·도로·점유 여부, 건물 ID/kind/좌표/점유/paused, 성벽·성벽 공사 경로, 자재 공급원 집합을 기존 signature에 포함한다. 추가 키는 실제 query의 건물/공급원 순서를 보존하므로 열거 순서·BFS 시작점 순서가 달라지는 경우 별도 memo다. 집 level/residents/bread는 할당에 쓰이지 않고 수요는 필지 면적이다. 시장·교회 workers는 proof에서 정규화하며 자재 shortfall은 법적 후보로 허용하므로 재고량 그 자체는 제외 가능하다. 공급 자격을 바꾸는 timber/stone 0 경계와 treasury의 집 자격은 공급원 키에 반영된다.
- 비용/이력: 첫 실제 계산의 active used 차이를 저장하고 다음 결정에서 동일 work를 spend한다. 부족하면 실제 proof를 실행했을 때와 같이 limit까지 사용하고 exhausted가 된다. 이후 해당 결정 내부에서 layout proof 재사용은 기존과 같이 무료다. witness 검색에는 내부 phase 전환이 없으므로 저장 비용은 같은 active context의 차이다.
- 불완전 결과: inactive 검색은 저장하지 않는다. local proof는 !exhausted, joint proof는 complete && !exhausted만 저장한다. 12분기 중단은 complete=false여서 저장하지 않으며, 정당한 완전 null 결과는 저장할 수 있다. 실패한 budget 재청구도 local layout에 저장하지 않는다.
- Set 별칭: memo가 반환한 pads/roads는 private layout에만 공유된다. 소비부는 has/순회뿐이고 add/delete/clear 경로가 없다. 외부에 proof 객체를 노출하지 않는 clear/stats API이므로 현재 diff에 변조 경로는 없다. ReadonlySet은 런타임 동결이 아니므로 향후 소비부가 이를 수정해서는 안 된다.
- 용량은 32 layout으로 제한된다. 주석에 키·제외 입력 근거·측정 참조가 있다. 테스트는 cold/warm/reset, 비용 경계, inactive/incomplete, 공급원/paused/road 변경, 순서 반전과 같은 결정 내 순서 혼합을 다룬다.

한계: 기존 per-decision layout 재사용 정책과 proof 검색의 완전성 자체를 새로 승인하는 검토는 아니다. 기록된 807→276ms 측정 및 전체 시뮬레이션 결과는 실행 담당자 증빙으로 확인해야 한다. 이 검토는 새로운 persistent memo 때문에 규칙·탐색 budget 또는 Set 내용이 달라지는 정적 경로를 찾지 못했다는 결론이다.
