# 독립 검수: 차단 조건을 유지한 DRAFT로 안전, 직접 정본 병합은 불가

3유형6문구의 의미와 source6파일·12구간을 대조했다. 후보 파일14개 manifest가 일치한다. 독립 검사기는 작성자 select_variant의 ID 하드코딩을 재사용하지 않고, **실제 ADDITIONS.when + GUARD_CONTRACT**를 해석하여 46fixture와 비유한수6개를 통과했다. 원고·정본·엔진은 변경하지 않았다.

## 판단
- 숫자4문구: 양의 finite safe integer를 먼저 검사한 뒤 eq1/gt1을 적용하면 서로 겹치지 않는다. 1.0은 정수값으로 처리하고 bool/string/null/NaN/Infinity/소수/0/음수/unsafe값은 baseline이다. 현재 condition schema의 eq/gt 모양만 통과하는 것은 이 가드를 보증하지 않는다. ADDITIONS만 복사하면 안전 계약을 잃으므로 INSTALL_BLOCKS 유지가 필수다.
- candidateId2문구: 타입 string 검사 후 정확한 빈 문자열 여부만 읽는 것은 source 의미와 맞는다. 빈 값은 기록에 후보를 특정하지 않았다는 뜻이며 후보 사망·후보 전체 부재를 의미하지 않는다. nonempty는 ID가 기록됐다는 사실만 말하므로 현재 검색실패/사망과 모순되지 않는다. whitespace를 trim하지 않는 계약도 명시돼 있다. 정상 엔진의 whitespace ID 도달성까지 주장하지 않는다.
- schema: 실제 후보5개는 현 schema 모양에 맞고 identified1개는 neq 때문에 거부된다. proposed schema는6개 모두 받는다. **proposed schema 자체는 neq를 string 전용으로 강제하지 않으므로** GUARD_CONTRACT와 결합해서만 해석해야 한다. 문서가 이를 명시했고6개 모두 설치차단했다. 일반 숫자 neq 기능 구현 완료로 취급하지 않는다.
- 사실줄/FIX-12: requiredSlots 없음, 고정인명 없음, retainFactLine:true. legacy baseline은 historyParams의 읽기 시점 candidate 해석을 유지한다. 추가 headline은 새 이름을 만들지 않는다. plague.dead는 해당 전이의 누적 town 사망자 수, houses는 빈집 수라 새 문구가 무덤 그림 개수·전원 사망·장원 인구로 과장하지 않는다. 기존 graves 사실줄의 ‘교회 묘지’ 표현은 기존 copy이며 이번 후보가 실제 묘지 그림 생성까지 검증한 것은 아니다. guard 실패 시 기본사실줄 자체의 입력건전성을 교정해 준다는 주장도 하지 않는다.

## fixture 실질과 한계
작성자 validator는 template→ID 분기를 별도 구현하여 선언 when을 직접 평가하지 않는 제한이 있다. 이번 독립 검사는 실제 조건 배열을 평가해 같은46결과를 얻어 그 틈을 보완했다. schema 검사기는 후보 구조 검사에 사용했으며 런타임가드 구현 증거로 계산하지 않았다. 엔진 선택기·formatter·저장복원·UI는 실행하지 않았다. 이 미설치 상태를 DRAFT 요청의 실패로 보지 않는다.

권고: 6개를 현재 정본650에 바로 더하지 말고 **조건부 초안6개**로 보존한다. 실제 selector 입력가드와 typed neq 구현/검증 후 별도 통합 검수에서 정본 병합을 결정한다. 현 범위 내 수정요구는 없다.
