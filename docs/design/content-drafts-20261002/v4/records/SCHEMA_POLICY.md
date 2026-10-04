# 검증 계약

원본 A의 `events-expansion.schema.json`과 `registry-normalized.schema.json`에 A 200개를 각각 검증하여 두 파일 모두 통과했다.

v4 원고 스키마는 A 구조·필수 필드·additionalProperties 제한을 유지하고 다음 세 부분만 바꾼다.

1. 배열은 정확히200개(minItems=maxItems=200).
2. period: B v3.1의 연도 구간 pattern을 사용한다. 실제1300~1450 경계·순서·years와 일치는 추가 검사한다.
3. choices.effects.parameters.rules.amountAtLeast: B v3.1처럼0 이상의 정수도 허용한다. 새 엔진 데이터 추가가 아니라 기존 명령 입력표현이다.

registry 스키마는 A의 조건AST·바인딩·실행차단·최소 실질선택2 규칙을 유지하고 건수만 정확히200으로 제한한다. 이 스키마는 실제 LM-E9 JSON 입출력 스키마가 아니라 A의 미설치 중간명세 검증이다. 실제 게임의 빈도·저장복원·클릭 시 재검증을 증명하지 않는다.

기간의 단일 의미: v4 events.years와 calendar의 authoredYears/eligibilityYears/yearMinInclusive/yearMaxInclusive는 v4 발동창으로 동기화한다. A의 이전 집필 창은 records/inputs/A-events.json 및 필드별 변경기록에서 보존한다.

독립 검사: ID001~200 유일성, number 일치, 원고/등록기 선택ID 일치, 문구·sourceConditions 일치, 달력/AST 동기화, 실제2선택 규칙·enabledfalse·미지원 차단 보존, 소송 새대상 쿨다운, 조건 경계 fixture, 원본 해시 및 ZIP 재추출 검증.
