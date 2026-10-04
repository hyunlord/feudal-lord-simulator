# R06에서 읽는 R05 편집 결정 이력

아래는 R05 편집 인계문이다. 첫 문단의 ‘이 폴더’는 원 작성 위치를 뜻한다. R06에서는 [CONTRACTS](../records/editorial-resolutions-r05-inherited/CONTRACTS.json), [PATCH](../records/editorial-resolutions-r05-inherited/PATCH.json), [REVIEW](../records/editorial-resolutions-r05-inherited/REVIEW.md)를 읽는다. 누적판의 현재 계약은 [EDITORIAL_CONTRACTS_R05.json](EDITORIAL_CONTRACTS_R05.json)이다. 재생성 명령은 역사적 작성 절차이며 현 누적판에 실행하지 않는다.

# 편집 결정 인계 및 병행 초안 조정

최종 정본은 이 폴더의 `CONTRACTS.json`, `PATCH.json`, `REVIEW.md`이다. 이전 작업자와 인계가 겹친 기록을 대조하고 아래 불일치를 명시적으로 정리했다. 원본 R04는 수정하지 않았다.

- 011: pension/debt_assumption의 years 누락을 기본값으로 추정하지 않는다. 양쪽 모두 같은 금전 종류가 있으면 양수 금액 기간 bucket 집합이 같아야 한다. 기간 변화로 부담이 늘거나 줄었는지 임의 환산하지 않기 위해서다. 원안에 없던 종류의 금전 약속은 기간이 명시돼 있으면 추가를 허용한다. 현금은 기간이 없어야 한다. 나머지 약정은 완전한 다중집합으로 동일해야 한다. `counter.changes` 요약은 비교 자료로 쓰지 않는다.
- 011 selector 이름은 기존 `COUNTER_MATERIAL_BURDEN_INCREASE`에서 `_V1`으로 patch와 미지원 목록을 함께 바꾼다. 057은 filter 호환 키 `church_near_market`를 남기고 별도 V1 계약을 연결한다. 이름 존재가 런타임 지원을 뜻하지 않는다.
- 057/058 기한은 '첫 완전한 계절이 지난 끝'을 폐기하고 **도착 tick + 1000**, 1450 다음 해 첫 tick으로 상한을 둔다. 계절 내 도착 시점에 따라 응답 시간이 1~2철로 달라지는 모호함을 피한다. 상한까지 80tick 미만이면 발동하지 않는다. 1000tick=현행 한 철이나 이 청원 기한 처리 자체는 새 제안이다. 현재 PetitionDef에는 이 필드가 없다.
- 기존 `VALIDATION.json`의 10개 비교 실행/11개 소스라는 이전 보고는 최종 파일을 설명하지 않는다. 최종 검증 범위·개수는 `VALIDATION.json`을 직접 따른다. 비교 경계표는 명세이며 런타임 검증으로 세지 않는다.
- 재생성은 `ruby build_patch.rb`, `ruby finish.rb`, `ruby validate.rb` 순서다. finish 단계가 조건 동기화와 sidecar 정본을 만든다. 마지막에 SHA256SUMS를 다시 만든다.

역사 출처는 기존 사건의 것을 그대로 유지했고 새 역사 사실을 추가하지 않았다. 원전 외부 재검증은 하지 않았다. 편집 질문 네 개의 답은 마련했지만 엔진·UI·저장 검증은 남으며, 부모 독립 검수 후 누적판에 통합한다.

## 독립 검수 반영

011의 raw treasuryCoin AST를 정본 treasuryBalance 호출과 max(0, ...)으로 교체하고 해당 호출 이름을 unsupportedSelectors에 별도 기입했다. CONTRACTS의 engineFunctionExists=true와 registryAdapterVerified=false를 분리해 기록했다. 058 category를 이웃 가문에서 도시로 바꿨다. 두 수정은 효과 명령을 바꾸지 않는다.
