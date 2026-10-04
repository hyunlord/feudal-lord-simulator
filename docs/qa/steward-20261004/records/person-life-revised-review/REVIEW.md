# person-life 가드 수정 독립 재검수

**수정 가드 오프라인 통과. 문구18개 조건부 초안 통과와 fed2개 사실행 조합 차단을 유지한다.** 실제 엔진 통합이나 자연 발생 통과를 의미하지 않는다.

수정 `capture.rb`를 읽고 파일쓰기가 없는 함수만 불러 원래125개와 새 회귀11개, 합계136개 입력을 재평가했다. 예상 선택·반환 context·입력 불변 모두 일치했다.

- household subject가 잘못된 집이면 올바른 actor가 있어도 거부한다.
- 비어 있는 record ID와 공백 ID를 거부한다.
- person subject가 유효하고 정확히 한 household actor가 맞을 때 허용한다.
- household subject만 정확한 정상 입력도 허용한다.
- unknown/missing/빈 person subject를 actor로 구제하지 않는다. 다른 집 actor·복수 household actors·별칭은 거부한다.
- 명시적 올바른 household subject가 있으면 다른 actor는 식별 기준으로 쓰지 않는 계약이다. 이 우선순위는 README에 명시됐으며 회귀검사로 고정했다. 일반적인 참조 모순 검증기라고 넓혀 주장하지 않는다.

이로써 최초 검수의 '잘못된 household subject를 actor로 구제' 및 '빈 record ID 허용' 두 캡처 결함은 **제안 Ruby helper 범위에서** 해소됐다. producer/저장/UI 연결까지 고쳐진 것은 아니다.

원본 PROPOSALS.json과 수정본은 바이트가 같다. 20개 문구·선택조건·상태 모두 유지됐고, 원래125개 fixture도 바이트가 같다. `person.fed.r06life.brief`, `person.fed.r06life.long`은 BLOCKED_BASELINE_FACT_LINE_AND_CONTEXT로 남아 있다. guard 수정은 기존 사실행 '배불리'를 입증하지 않는다. 다른18개도 새 emitter가 필요한 초안이라는 상태를 유지한다.

소스8파일12구간·수정본 manifest·원본 입력 manifest를 현재 바이트와 대조했다. 모두 일치했다. 동결 baseline650 및 현재 정본은 검사 시점 모두 `7314050459321e78ea19257fd4376ff80ab803586b0adfdaf2dd8ee159666dbf`였다. 이 후보가 정본650에 병합되었다는 뜻은 아니다.

기존 source 의미 검토는 최초 독립 검수에서 수행했고 이번에도 동일 source SHA를 확인했다. 추가 graft 호출 없음. 경량 Ruby만 실행했으며 후보·정본·엔진은 수정하지 않았다. 이 폴더의 검수 기록만 작성했다.
