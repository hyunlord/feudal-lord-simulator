# FIX-12와 당사자 식별

이 원고의 history subject는 TOWN이다. 사건 제목의 인물과 동일한 뜻이 아니다. 신랑은 우리 가문의 계약 당사자, 신부의 아버지는 상대 영지의 계약 당시 영주, 새 아들은 상대 영주의 아들이며 신부의 남동생이다. '조카'는 새 유언을 남긴 이웃 영주의 조카다. 우리 영주의 조카인 신랑 후보와 혼동하지 않는다.

계약 당시 신랑 관계는 당시 영주 ID·가문 차수·신랑의 원래/영주관으로 옮긴 ID·신부 ID·negotiation ID·contract record ID로 고정한다. 친족 신랑의 ID가 바뀌는 groomToManor 전에 실제 marriageCandidates의 relation을 캡처한다. 기존 history의 신랑 조회 실패→son 기본값은 문맥 근거로 쓰지 않는다.

신부 아버지의 ID와 상대 영지도 계약 시점에 고정한다. 후속 출생·질병 사건에서 실제 oldLord ID가 다르면 관계 문구는 unknown이다. 다른 생존자를 아버지로 끼워 넣거나 현재 생존 여부로 과거 상속 분기를 재계산하지 않는다.

표시 이름은 저장하지 않는다. 미래 이름 슬롯을 추가할 때도 stable ID를 기존 historyParams(record,state)에서 읽을 때 현재 표시 이름·별칭으로 치환한다. 역할과 관계는 사건 시점 사실로 남긴다. 현재 원고는 requiredSlots=[]이며 새 이름 슬롯을 만들지 않는다. 이름 fixture4개는 ID↔표시문자열의 순수 계약 모형이며 실제 historyParams/엔진 실행은 아니다.

willAllowedRoute는 immutable_contract_reference라는 기존 envelope 타입을 재사용하지만 그 참조 대상은 계약 자체만이 아니다. 정확한 will answer 사건(negotiationId/rivalId/answer tick/명령 또는 자동만료 경로)을 고정한 참조가 추가로 필요하다. 현재 기록에는 이 경로가 없으며 어댑터 없이 유추할 수 없다. referenceVerified=true라는 외부 JSON을 곧바로 신뢰하지 않는다.
