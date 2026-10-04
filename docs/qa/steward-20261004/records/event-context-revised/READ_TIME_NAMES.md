# FIX-12 읽을 때 이름 계약

문맥 snapshot에는 표시 이름을 저장하지 않는다. 기록 ID, 사건 tick, 인물 ID, 사건 당시 역할/관계의 enum과 근거 참조만 저장한다. 후견 이름은 기존 `guardianId`→`historyParams(record,state)`→`guardian` 경로를 유지한다. 기존 코드가 제공하지 않는 신랑/신부 이름 슬롯은 이 초안에서 새로 만들지 않았다. 모든 후보는 requiredSlots=[]이며 기존 사실 행을 유지한다.

혼인 관계는 **계약 당시 영주**를 기준으로 동결한다. 그 인물이 후일 영주나 다른 직책이 되더라도 관계 enum을 현재 상태로 바꾸지 않는다. 표시 이름과 큰/작은 같은 수식어만 읽는 시점에 치환한다. 같은 이름의 다른 사람을 합치지 않고, 인물 조회 실패는 기존 fallback으로 처리한다.

후속 혼인 기록을 현재 혼인 계획이나 가장 가까운 계약 기록에 임의로 잇지 않는다. 제안된 immutable_contract_reference는 계약 기록 ID·negotiation ID·원래 신랑 ID·영주관으로 옮긴 신랑 ID·신부 ID·당시 영주 ID/가문 차수를 함께 검증해야 한다. 기록이 삭제됐거나 여러 후보가 맞으면 unknown이다. fixture의 referenceVerified는 이 검사를 마친 신뢰된 어댑터의 **출력 상태를 가정한 테스트 표지**이며 입력 JSON의 참값만 믿으라는 구현 지침이 아니다.

현재 baseline의 marriage.inherited는 '아내를 통해'라고 적는다. 아들/다른 혈족 맥락에서 사실 행과 충돌할 수 있으므로 사실 행을 관계 중립 문구로 검수하기 전 설치하지 않는다. 후견 baseline의 빈 guardian ID가 상위 영주를 뜻하는지도 capture provenance로 검증한다. 이 원고는 이미 엔진에 통합됐다는 주장을 하지 않는다.

오프라인 검사는 같은 ID의 이름을 로버트→큰 로버트로 바꾸어도 snapshot을 바꾸지 않는 계약 예시 4개이다. 실제 historyParams/formatter/UI 실행 검증은 아니다.
