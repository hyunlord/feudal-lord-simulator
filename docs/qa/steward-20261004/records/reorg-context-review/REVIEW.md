# 독립 검수: 5종11문구 DRAFT 합격, 이주2문구 사실행 BLOCK 유지

작성자 동결 원고·schema·source를 검토했다. 원본 validate.rb의 결과쓰기 두 경로만 독립검수 폴더로 돌려 전체 검사를 재실행했으며, 원고 전체 파일 SHA가 실행 전후 불변임을 확인했다. source4파일9구간, 양성11·문맥음성99·레코드결합불일치22·unknown11·원고반례7이 재현됐다. manifest14파일도 통과했다. 엔진/정본 수정, 브라우저·DGX 실행은 하지 않았다.

## 의미 검토
- 임금경쟁: producer는 첫 wageCompetitionTick 생성과 같은 전이에 wageLeavers를 늘릴 수 있다. 전후 해당 카운터 delta0/>0만 말하므로 전체 도시 이주 없음으로 과장하지 않는다. 원고의 ‘그 첫 시점의 임금 경쟁 이주 기록’ 범위가 적절하다. before 미생성 기본0은 생성입증 조건으로만 허용한다.
- 길드: accept 경로가 guildHead를 기록하며 후보없음은 null이다. assigned는 exact ID의 당시 people 참조를 추가 요구하므로 현재대표로 과거를 채우지 않는다. unassigned를 영구무대표로 읽히지 않게 ‘아직’이라고 쓴 점도 적절하다. 대표가 반드시 특정계급이라는 주장은 없다.
- weavers_left: refuse/expired 후 leave는 직조소 가까운 **거주가구**를 고른다. 구성원의 실제 직업이나 목적지를 계산하지 않는다. history params.households도 해당전이 delta가 아니라 누적 weaverLeavers다. 따라서 두 중립 headline은 타당하지만 기존 사실행 ‘직조공…길드가 있는 도시로’를 retain하면 과장이 남는다. 두 개의 BLOCK_FACT_LINE_OCCUPATION_DESTINATION은 반드시 유지해야 한다. 이를 현재 E 원고수나 UI통과로 우회할 수 없다.
- 상위영주경고: guild 존재 여부는 경고 원인이라고 쓰지 않고 당시 동시상황으로만 쓴다. source는 guild petition과 town influence로 경고를 발동하므로 이 인과구분이 맞다.
- 자치요구: autonomyDue는 chased를 먼저, 아니면 guild accept 여부를 본다. 제안캡처도 같은 우선순위를 지켜 branches가 중복되지 않는다. ‘길드설립을 받아들이지 않은 상태’는 미응답/거절 등을 포괄하며 모두 ‘거절’이라고 바꾸지 않아 정확하다. 실제 청원 생성 가드와 과거사건시점 확인은 캡처 구현 때 필요하다.

## schema/selector/FIX-12
selector가 CONTEXT.schema 통과 후 recordId/tick/template와 known을 결합하고 실제 when.field/op/value를 평가한다. unknown이 fields={}로 baseline에 떨어지는 것과 known empty의 거부가 구분돼 있다. 이 schema는 동결원고 정확성 검사용 const계약이며 범용 문법으로 주장하지 않는다. sourceHead/referenceVerified 문구 자체는 진짜 기록시점 캡처를 증명하지 않으므로 FIELD_CONTRACTS의 실제producer 책임은 남는다.

추가 인명슬롯이 없고 retainFactLine:true이며 현재이름·직책으로 과거분기를 만들지 않는다. 상위영주·자치특허·인두세 용어가 정본과 맞는다. 새 외부역사관행을 덧붙이지 않았다. 원고는 다소 설명적이지만 주체와 기록범위를 분명히 하며 사실을 과장하지 않는다.

baseline647 사본은 이 제안의 고정비교자료이며 현재정본650을 덮거나 현재개수로 주장하지 않는다. 초안 제출은 합격이고, 전체11의 provenance adapter·저장/formatter/UI 통합은 별도 미검증이다. 이주2는 그에 더해 사실행 수정 검토가 필요하다. 현재원고 수정요구는 없다.
