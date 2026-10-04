# person-life 후보: 캡처 가드 수정본

원본 `../person-life-context/` 및 독립 검수 결과 `../person-life-independent-review/RESULT.json`은 그대로 동결했다. 이 폴더만 수정본이며 후보 문장20개·조건·사실 줄 보류2개는 바꾸지 않았다.

## 독립 검수 결과의 정확한 반영

원본 판정은 **18개 조건부 초안 통과, fed 2개 사실 줄 보류, 캡처 가드 2개 결함**이다. 아직 엔진 설치나 최종 UI 통과가 아니다. 수정 후 독립 재검수는 대기 중이며 저자의 136개 경량 검사만 완료했다.

## 변경점

1. `capture.rb`: `record.id`가 문자열이고 공백 제거 후 비어 있지 않아야 한다. 빈 문자열·공백 문자열을 거부한다.
2. 명시적 `subject.type=household`가 있으면 그 subject ID를 우선한다. before/after의 buildingId와 다르면 actors에 올바른 ID가 있어도 거부한다.
3. `subject.type=person`이고 유효한 비어 있지 않은 ID일 때만 actors의 household 참조를 사용한다. household actor는 정확히 하나이며 ID가 before/after와 정확히 같아야 한다. 알 수 없는 subject·subject 누락·빈 person ID는 actors로 구제하지 않는다. 가구 ID 별칭·유사 문자열은 인정하지 않는다.
4. 올바른 household subject가 있을 때 actors에 다른 가구가 있어도 가구 subject를 따른다. 이는 명시적 subject 우선 계약이다. 별도 인물명 슬롯이나 현재 인물조회 fallback은 추가하지 않았다.

나머지 전이 판정·기간·수량·이름 읽기 계약은 원본과 같다. 현재 프로덕션 코드 수정은 없다. 캡처 함수의 입력이 실제 신뢰 가능한 즉시 before/after라는 런타임 출처 보증은 이 오프라인 검사로 증명되지 않는다.

## 검증

```sh
ruby check.rb
```

- 원본125개 fixture의 선택 결과와 context를 그대로 재검사.
- 발견된2개 결함의 거부 회귀검사.
- 정상 person subject + household actor, 올바른 household subject 단독 대조검사.
- 공백ID·unknown subject·누락 subject·빈 person ID·모호한 복수 household actors·명시적 subject 우선·별칭 거부까지 총11개 추가검사.
- 합계136개 통과. 입력 객체 불변, 원본 후보/검수 입력 SHA, 고정 baseline650 SHA, 소스8개·12개 span, 현재 canonical 검사 전후 SHA 확인.
- `fed` 두 ID는 `BLOCKED_BASELINE_FACT_LINE_AND_CONTEXT` 유지. 수정된 가드가 “배불리” 사실 줄의 과장을 해결하지 않는다.

`baseline650.ko.json`은 독립 검수자가 고정한 원본 비교용 정본 복사본이다. 현재 정본을 덮어쓰는 파일이 아니다. 현재 정본이 이후 다른 작업으로 진전되어도 frozen baseline과 후보 provenance는 유지하며, 검사 실행 중 현재 정본이 바뀌지 않았는지만 별도로 확인한다.

`REGRESSION_RESULTS.json`에 모든 추가 입력/예상/결과/context를 공개했다. `INPUT_MANIFEST.json`으로 원본 폴더와 검수 결과를 수정하지 않았음을 확인한다. 프로덕션 선택기·새 필드 저장/재로드·자연 발생·UI·독립 재검수는 아직 미검증이다.
