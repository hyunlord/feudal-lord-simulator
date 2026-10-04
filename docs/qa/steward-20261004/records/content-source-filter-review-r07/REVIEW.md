# R07 189번 접근 필터 제거 사후 독립검수

판정: **통과 — 근거 접근 보류 한 항목만 제거한 수정**.

적용 전 registry SHA가 선행 독립감사의 INPUTS.json과 일치한다. 그 객체에서 189번 `NE_SR01_KI09_source_fulltext` 하나만 제거한 예상 객체를 만들고 현재 registry 전체와 비교하여 정확히 일치함을 확인했다. 부모 RESULT의 판정을 그대로 인용하지 않고 verify.rb로 다시 계산했다.

- 다른 199개 사건과 189번의 조건·선택·비활성 상태는 동일하다.
- KI09_context 보류와 `literal:false`, 3개 빈 commands/false 선택 조건이 유지된다.
- SOURCE_CATALOG를 포함한 허용 변경 밖의 23개 입력 파일이 선행 감사와 바이트 동일하다. CS09는 `LIMITED_TO_CONFIRMED_CLAIM`이다.
- 200개 중 사건 전체 핵심효과 보류 61개, 전 선택 효과 미지원 60개, sidecar 활성 0개로 불변이다.
- content/SHA256SUMS의 25항목 전부 일치한다. 과거 CHANGES 본문은 그대로 보존되고 현재 수정 설명만 추가되었다.

엔진 실행·설치·수정은 하지 않았다. 검수자가 바꾼 것은 이 검수 폴더뿐이다. 이 통과는 사건의 실행 가능 또는 역사 일반화 승인이 아니다. RESULT.json에 입력/결과 registry SHA와 재검산 지표, verify.rb에 반복 가능한 좁은 검사가 있다.
