# R06 문맥 제안 수정본 독립 재검수

**초안 채택18 / 사실행 조합 보류2로 판정한다.** 설치 완료나 실제 문맥 포착 검증이라는 뜻은 아니다. 사용자 요청은 문장 초안과 선택 형식 제안이므로 엔진 설치를 납품 관문으로 추가하지 않는다.

원본20과 수정20의 PROPOSAL을 구조 비교했다. 바뀐 것은 `reorg.petitions_surge.r06ctx.calendar`의 headline 한 개뿐이다. '상인과 직인 무리의 요구가 올라왔다.'는 엔진 마감시점을 세계 속 약속으로 표현하지 않으며, 산업 성장 같은 미입증 원인을 보태지 않는다. 최초 보류를 해제한다. 나머지 필드 계약·조건·문구는 원본과 같다.

`marriage.inherited.r06ctx.son`과 `marriage.inherited.r06ctx.kin`은 `BLOCK_FACT_LINE_CONFLICT`로 유지된다. 맥락 headline 자체의 의미와 별개로 retainFactLine이 기존 '아내를 통해'와 결합하면 모순이다. ADOPTION_LIMITS의 두 블록을 별도 채택 소비자가 반드시 적용해야 한다. JSON Schema가 이 편집 판단까지 집행한다고 해석하면 안 된다.

## 스키마 실측

저자의 negative 생성 함수는 읽기만 하고, 검증 자체는 별도 Ruby evaluator로 수행했다. 74개 변형 모두 거부됨을 재현했다. 양성26개 및 unknown+빈필드는 통과했다.

- PROPOSAL 10개: 빈 fields, 빈 fallback, 계약 외 enum, 빈 when, 조건 외 enum, 템플릿/문맥 필드 불일치, in과 문자열 조합, 빈 in 배열, retainFactLine 누락, 미허용 이름 슬롯.
- CONTEXT 8유형×8개: known 빈필드, fields 누락, enum 오류, 다른 템플릿 결합, 출처 종류 뒤바꿈, 미검증 참조, 음수tick, unknown에 사실필드 잔존.

이는 문서가 사용한 JSON Schema 키워드 범위의 검증이다. 전체 표준 적합성 시험이 아니며 referenceVerified=true의 진실성, 실제 사건 발생, 불변 계약 참조 연결을 증명하지 않는다. h-test/tick1000 selector fixture를 운영 어댑터로 오해하지 않는 원본 제한도 계속 유효하다.

## 기준 분리와 무변경

소스9파일19구간을 현재 파일 바이트와 재대조하여 모두 일치했다. 후보 SHA256SUMS도 전부 일치했다. 추가 graft 호출은 필요하지 않았다. 앞 검수에서 확인한 같은 source SHA이므로 코드 의미를 다시 추측하지 않았다.

- 검수 기준647: `../event-context-independent-review/baseline647.ko.json`, SHA `ac1bde4a2c92381f8adaed3b3e5c6a4cd6dbe5745098639754bb6389919aba88`.
- 현재 누적 정본650: SHA `7314050459321e78ea19257fd4376ff80ab803586b0adfdaf2dd8ee159666dbf`.
- 이 차이는 별도 누적 병합에 따른 기준 차이이며 수정 후보 검수 실패가 아니다. 이번20개가650에 포함됐다는 주장도 하지 않는다.

원본·수정후보·정본·엔진을 수정하지 않았다. 이 폴더의 검사/보고서만 기록했다. 무거운 실행과 실제 formatter/UI 실행 없음.
