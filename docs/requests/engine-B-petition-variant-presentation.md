# 렌더 A 인계: 기존 청원의 문구 변형 읽기 API

상태: 인계 문서. 이 묶음은 화면 코드를 수정하지 않았으며 실제 표시 완료가 아니다.

엔진 B 두 번째 소규모 묶음은 `src/engine/registryVariants.ts`의 `estatePetitionVariantFor(state, petitionId)`를 제공한다. 홈 영지의 기존 `pannage`·`common_pasture`·`road_bridge` 청원에 대해 각각 041·048·056의 정본 제목·본문을 반환한다. 조건을 만족하지 않거나 원래 청원이 없으면 `null`이며 기존 문구를 유지해야 한다.

반환값 `occurrenceId`·`sourceEntryId`·`variantEntryId`는 연결 근거다. 표시를 붙일 때 제목·본문만 바꾸고, 원래 청원 ID·응답 명령·선택·대가·마감·관계 효과·결정 기록의 주체를 바꾸지 않는다. 변형을 별개의 등록기 사건으로 생성하거나 새 활성 사건으로 집계하지 않는다. API 읽기 자체는 상태를 바꾸지 않는다.

화면 소비자를 붙이는 렌더 작업의 확인 항목:

- 실제 홈 청원 카드에서 조건에 맞는 제목·본문이 보임.
- 저장 복원 후 같은 원 청원으로 응답하고 비용·관계·마감 효과는 원래 한 번만 적용됨.
- 원인·당사자 소멸, 기간 밖, 다른 영지 청원에서는 기존 문구로 돌아감.
- 그림 선택은 별도 계약을 유지. 문구 변형 ID만으로 새 그림이나 선택 동작을 억지로 바꾸지 않음.
- 준비 상태의 화면 검증과 자연 플레이 노출 횟수를 구분해 기록.

근거 시험은 `tests/registryWoodlandPetition.test.ts`, `tests/registryPasturePetition.test.ts`, `tests/registryMarketRoadPetition.test.ts`. 현재 시험은 읽기와 원래 동작 보존을 증명하며 화면 소비자나 플레이어 노출을 증명하지 않는다.
