# 사건 시점 문맥 제안: 저자 초안

32개 문맥 필요 유형 중 사람이 아닌 8유형에 한국어 후보 20개와 문맥 필드 6개를 제안했다. 정본647·엔진·R05 동결물은 변경하지 않았다. 기존 나이 문맥20개를 복제하거나 포함하지 않았다. 나머지24유형은 NOT_AUTHORED.json에 명시했다.

- PROPOSAL.json: 문장 전문·선택 조건·fallback. 현재 엔진이 모르는 context 확장이다.
- FIELD_CONTRACTS.json: 각 필드의 source capture 지점, 현재 저장 상태, 불변 참조 복원 가능성, 캡처 규칙.
- PROPOSAL.schema.json: 별도 제안 형식. 기존 canonical schema를 수정하지 않는다.
- READ_TIME_NAMES.md: FIX-12 이름과 당시 관계를 분리하는 계약 및 기존 사실 행 검수 제한.
- SOURCE_EVIDENCE.json: 독립 검수 가능한 실제 소스 구간·SHA.

선택 문맥은 기록 ID/tick/template/sourceHead에 묶고 unknown·누락·타입 오류·근거 불일치는 기존 baseline으로 돌린다. 현재 인물 상태나 현재 협상/왕실 답변 장부를 읽어 과거 역할·이유를 덮지 않는다. runtime capture와 불변 계약 연결은 구현하지 않았다. fixture는 그러한 캡처가 제대로 된 경우의 선택 계약을 검증할 뿐 실제 캡처 정확도를 보증하지 않는다.

초기 감독은 실제 생산기가 direct로만 생성하므로 위임 시작 변형을 만들지 않았다. 자동 목재 주문 역시 기존 주문0 전제라 추가 주문 변형을 만들지 않았다. 왕실 신임 상실은 실제 요구 거절/미응답, 혼담 철회는 명시 거절/기한 만료라는 서로 다른 생산 경로를 사용했다. 혼인3형은 계약 당시 본인/아들/다른 혈족을 구별한다.

모든 새 문맥은 미설치 상태다. 사용자가 요청한 결과는 문장 초안·선택 데이터 형식 제안이므로, 엔진 설치·통합을 이 초안 납품의 추가 완료 조건으로 삼지 않는다. 독립 검수는 수행하지 않았으며 저자 검증 결과만 보고한다. 실제 엔진 변경은 별도 권한·작업 범위에서 결정할 제안이다.

`ruby validate.rb`는 제안 스키마, 647 보존 SHA, 선택/fallback fixture, 출처 파일·구간, 읽을 때 이름 계약을 가볍게 검사한다. `build.rb`는 자료를 재생성하므로 수동 원고 변경 전에 주의한다.

## 수정판 R06 검수 반영

원본 proposal는 그대로 두고 이 폴더에서만 수정했다. calendar 문구는 **상인과 직인 무리의 요구가 올라왔다.**로 바꾸었다. 내부 최종 연도 조건을 역사 속 합의된 마감으로 쓰지 않으며 산업·경제적 원인도 덧붙이지 않는다.

`marriage.inherited.r06ctx.son` 및 `.kin`은 **BLOCK_FACT_LINE_CONFLICT**다. 관계 중립 사실행의 독립 검수가 끝날 때까지 headline+기존 사실행을 조합하지 않는다. 모든20개는 미설치 문맥 제안이며 조건 선택 fixture 일치가 설치 허용은 아니다.

검증 기준은 현재 정본이 아니라 `../event-context-independent-review/baseline647.ko.json` 사본(SHA ac1bde4a2c92381f8adaed3b3e5c6a4cd6dbe5745098639754bb6389919aba88)이다. 이후 정본650과 혼동하지 않는다. 원본166fixture를 변경 없이 재검사하고 부정 schema74개·known26개·unknown빈문맥1개를 검사했다. 기존24개 공격 입력과 이름4계약도 유지한다.

schema는 fields6개·fallback필수 계약·조건 최소1·도메인·op값형식·템플릿과 필드/캡처출처 일치를 강제한다. known 빈문맥은 거부하고 unknown은 빈문맥만 허용한다. Ruby 검증기는 이 문서에 실제 사용한 keyword 집합을 명시하고 minimum을 지원하며 지원하지 않은 keyword를 거부한다. 전체 JSON Schema 표준 적합성 제품이라는 뜻은 아니다. referenceVerified=true 및 형식 통과만으로 불변 계약의 진실성을 입증할 수 없다. 기존 읽을 때 이름·사건 당시 관계·과거 저장 복원 한계를 그대로 유지한다.

재실행: `ruby validate.rb`. revise.rb는 원본에서 수정판을 만드는 준비 이력이다. 동결 뒤에는 재실행하지 않는다.
