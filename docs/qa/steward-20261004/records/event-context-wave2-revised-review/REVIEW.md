# Wave2 수정본 독립 재검수

**PASS_REVISED_DRAFT_WITH_COMPOSITION_HOLDS**. 9유형·22문구·9필드의 초안 수용은 유지한다. 원문·필드 계약·176개 fixture는 원본과 바이트 동일하며, 정본650은 변경하지 않았다.

## 실제로 수정 완료된 부분

- 이전 검수에서 schema가 받았던 음수 tick, safe integer 초과 tick, template의 필드 누락·다른 template 필드, 빈 sourceHead를 이제 거부한다. 9개 template 각각에 독립 mutation을 만들어 **45건** 모두 거부함을 확인했다.
- 작성자의 negative mutation 입력 **127건**을 별도로 작성한 Ruby schema 판정기로 검사해 모두 거부했다. 작성자 판정 함수나 그 결과 JSON을 신뢰해 통과 처리한 것이 아니다. 정상 context **22건**, tick **0 및 9007199254740991 두 경계**, unknown/빈 fields도 의도한 대로 통과했다. 원 선택 fixture **176건**도 참조 선택기에서 다시 통과했다.
- `ADOPTION_LIMITS.json`은 expiry **1건**을 `BLOCK_FACT_LINE_CONFLICT`, 시장도시 **2건**을 `HOLD_COMPOSED_LINE_COMPLETION_AMBIGUITY`로 구분한다. 세 ID가 blocks와 compositionReviewRequired에 모두 정확히 들어 있다. 기존 사실 줄·대안 문구·해제 조건·engineModified:false가 있어 채택 보류가 명확하다.
- `PROPOSAL.json`, `FIELD_CONTRACTS.json`, `FIXTURES.json`, `SOURCE_EVIDENCE.json`, `READ_TIME_NAMES.md`, `NOT_AUTHORED.json`, `baseline647.ko.json` **7파일**은 원본과 바이트 동일하다. 새 문장을 추가하거나 승인된 문구를 은밀히 교체한 수정이 아니다.
- 실제 소스 **13파일 SHA·24구간**과 수정본 manifest를 다시 대조했다. 후보·정본 파일이 검수 중 바뀌지 않은 것도 확인했다.

## 그대로 남는 한계

- schema는 기록 ID가 실제 해당 캠페인·tick·template에 연결되었다는 사실을 증명하지 않는다. referenceVerified=true나 올바른 SHA 문자열은 외부 검증을 대신하지 않는다. 원시 숫자·좌표·상태에서 enum을 캡처하는 어댑터는 미구현이다.
- 선택기는 h-test/1000 기준 참조 모형이다. engine/historyParams/formatter/저장복원/UI를 실행하지 않았다. 독립 Ruby 판정기는 이 두 schema가 사용하는 키워드의 부분 구현이며 전체 JSON Schema 적합성 인증이 아니다.
- expiry와 시장도시 기본 사실 줄은 **고쳐진 것이 아니라 조합 출력 사용을 보류한 것**이다. 제안 사실 줄은 아직 엔진에 반영되지 않았다. 최종 조합 검수를 통과하기 전 세 후보를 설치 가능한 목록으로 승격하면 안 된다.
- none_ready의 자연 플레이 도달은 미측정이고 negotiation.rejected의 추가 문맥 초안도 아직 없다. 이전의 달력/시대→역사 인과 오용 없음 및 FIX-12 보존 판단은 문구·필드 계약 바이트 동일성을 전제로 유지한다.

검증 재현: `ruby records/event-context-wave2-revised-review/check.rb`. 결과는 RESULT.json·SCHEMA_RESULTS.json이며 입력 SHA는 INPUT_SHA256SUMS다. 쓰기는 이 검수 폴더 안에서만 수행한다. 이번 재검수는 추가 graft 조회 없이 변경 schema·문서와 해시가 보존된 기존 소스 근거를 확인했다.
