# 읽을 때 인명 치환 계약

Wave2 후보에는 개인 이름을 박아 넣거나 새 이름 슬롯을 만들지 않는다. 후속 확장에서도 사건 시점에는 stable person ID·당시 역할·관계만 고정한다. 표시 이름과 별칭은 읽을 때 기존 historyParams(record,state)로 치환한다. 현재 직책·관계로 과거를 덮어쓰지 않는다. 조회가 실패하면 기존 이름 fallback을 따른다.

referenceVerified는 임의 JSON을 신뢰하라는 뜻이 아니라 검증된 어댑터 출력이라는 테스트 가정이다. 실제 구현은 record ID·tick·template·source provenance를 검증해야 한다. 어댑터는 미구현이다. 4개 이름 fixture는 ID가 같을 때 표시 이름이 바뀌고 원본은 유지되는 계약 모형이며 실제 포매터 실행이 아니다.
