# 사건의 주체와 읽을 때 이름

이5종의 history subject는 TOWN이다. house.withdrew/arrived의 old/new house order는 인물ID나 물리적 가구 이동이 아니다. resettled의 house는 실제 주택 가구이며 가문과 구분한다. 가문 이름은 역사상 해당 가문의 정체성으로 보존하며 현재 영주 가문 이름으로 바꾸지 않는다.

협상의 groom/bride/counterpart/negotiation ID를 정확히 고정한다. 이 초안은 이름 문자열을 새로 저장하지 않으며 requiredSlots=[]다. 추후 인명 슬롯이 필요하면 당시 인물ID를 저장하고 historyParams(record,state)로 읽을 때 현재 표시 이름과 별칭을 가져온다. 현재 살아 있는 사람을 과거 협상 당사자로 대신 넣지 않는다. ID 조회 실패는 기존 fallback이다. 이름4fixture는 계약 모형이며 실제 formatter 실행이 아니다.

referenceVerified=true는 검증된 capture 출력에 대한 시험 가정이다. 외부 JSON의 true를 무조건 믿으라는 뜻이 아니다. 원본 enum으로 변환하기 전 record ID/tick·producer·계약·가문/건물ID를 확인해야 한다. 모르면 unknown이다.
