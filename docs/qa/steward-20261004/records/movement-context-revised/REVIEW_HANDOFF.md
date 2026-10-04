# 독립 재검수 인계

검수자는 작성자와 별도로 배정한다. 이 문서는 검수 판정이 아닌 입력·재실행 위치 안내다.

- 원본: `../movement-context/` (동결)
- 최초 독립 검수: `../movement-context-review/REVIEW.md` 및 `RESULT.json` (동결)
- 이번 수정: `CHANGES.json`의 3개 headline만. 조건·계약·schema·fixture 변경 없음.
- 보존 증거: `PRESERVATION.json`, 원본 manifest 사본 `ORIGINAL_SHA256SUMS`.
- 작성자 검사: `VALIDATION.json`, `FIXTURE_RESULTS.json`, `NEGATIVE_SCHEMA_RESULTS.json`, `SCHEMA_GATE_REGRESSION.json`.
- 전체 파일 무결성: 이 폴더에서 `shasum -a 256 -c SHA256SUMS` (읽기 전용).

## 판단할 세 문장

1. `house.withdrew.r06move.family_extinct`: 현재 도시 기록 및 대기 중인 후계 후보로 범위를 한정했는가. 지도 밖 혈족의 전멸을 주장하지 않는가. 실제 근거는 `lordship.ts:40–54`.
2. `house.withdrew.r06move.decline_elapsed`: 약속된 기한이나 통지를 주장하지 않고 쇠퇴 경과만 쓰는가. 근거는 `lordship.ts:186–194`.
3. `house.resettled.r06move.split`: 일부 또는 모든 이주 가구에 빵을 나눌 수 있다는 소스와 모두 양립하는가. `bread=12, stored=11`, 필요량 `[4,4,4]`일 때 분배 `[1,0,0]`인 최초 반례도 배제하지 않는가. 근거는 `lordship.ts:229–255`.

원문 스팬 및 소스 SHA는 `SOURCE_EVIDENCE.json`에 보존돼 있다. CHANGES의 after를 before로 되돌린 JSON이 원본 PROPOSAL 전체와 같은지 확인하면 숨은 계약 변경을 독립적으로 검사할 수 있다.

## 실행 경계

`validate.rb`는 결과 JSON과 manifest를 쓰므로 읽기 전용 독립 검수에서는 그대로 실행하지 않는다. 별도 검수 소유 폴더에 순수 `validate_schema`·`select_candidate` 함수만 옮겨 기존104 선택·75 schema음성·26추가필드·15envelope를 재검사할 수 있다. selector는 네 번째 인자로 CONTEXT schema를 받는다. 현재 정본650 SHA는 `7314050459321e78ea19257fd4376ff80ab803586b0adfdaf2dd8ee159666dbf`다.

문장 교정이 capture 어댑터 구현·자연 발생·저장복원·UI 성공을 뜻하지 않는다. 수정본 독립 검수는 아직 대기 중이다.
