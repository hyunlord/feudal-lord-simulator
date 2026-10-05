# HEATH main core30 독립 native 검토

판정: **PASS — NON_RUNTIME_DOCUMENT_DRIFT로 한정한 committed-product runtime 증거**. fresh main before `d367382392a4806e683b91463f3996b7654704d6` 대비 core `931d780e37307a7dd2f85a697b122656cb29359d`의 실제 원본 30장을 개별 열었다. 새 시각 회귀 또는 gate 차단 항목은 발견하지 않았다. DATA2 B/C 설치·runtime 승인과 최종 clean-export/publication 승인을 의미하지 않는다.

## 직접 확인

- chalk_downs 사계절 × zoom 1/0.6/1.4 12장, summer chunk/map edge 2장, open_field·forest_edge·fen_drainage·coastal_port 사계절 16장: native 30/30 확인. open_field는 실제 강변을 포함한다.
- 실제 before/core/repeat PNG 90개를 Pillow RGBA로 직접 읽고 비교: before→core 30/30 전체 RGBA 동일, core→repeat 30/30 동일, encoded PNG SHA도 세 벌 동일. 각각 1280×800. 이름뿐 아니라 state/save SHA/tick/season/tile/zoom/viewport/DPR/browser/renderer/고정 시간/protocol/expectedRequests 전체 identity가 동일하다.
- raw captures의 errors/repeatErrors 0, stable 및 A/A PASS. 각 expected URL의 request·decode·captured canvas paint lineage 직접 확인.
- absence-contract 16개를 raw 요청 pathname·decoded URL·draw lineage와 직접 비교: HEATH A/B/C 첫 진입 모두 부재. repeat 요청/draw 배열은 저장되지 않아 `UNPROVED_ARRAYS_NOT_PERSISTED`를 유지한다. A/A 동일성으로 repeat 부재를 대신 증명하지 않는다.
- startup freeze의 현재 로컬 4,308개 SHA와 부재 8개 재확인. remote 4,308개 일치는 고정 receipt의 PASS와 독립 doc-drift 검토를 함께 사용한다. runtime wrapper/checker 2개는 startup freeze에 포함된 것으로 합산하지 않고 supplemental attestation으로 구별한다.

## native 관찰

Chalk의 강 곡선·암석·땅무늬·관목과 legacy A가 기존 위치/크기를 유지한다. 저배율 A의 약한 대비는 baseline 그대로다. chunk edge에 새로운 절단선/직사각형 불투명 배경이 없고 map edge의 어두운 영역은 원래 지도 밖이다. 네 음성 archetype의 사계절 수목·기존 ground art·여름 비·겨울 snow/roof 표현이 유지된다. fen의 큰 수면/섬/갈대와 coastal의 강/해안/바위도 baseline과 같다. 보이는 얇은 대각 격자 및 계절 terrain 무늬는 before에도 존재하고 실제 전체 픽셀 동일로 확인되므로 core 신규 결함으로 분류하지 않았다.

## export 한정

`NON_RUNTIME_DOCUMENT_DRIFT`: FIELD proof `REPORT.md`, `SHA256SUMS.json` 두 tracked 문서만 committed 931과 다르다. `.omo/drafts/heath-core-doc-drift-review.md`의 독립 consumer 검토 및 4,308 runtime/fixture SHA 일치에 따라 이 실행은 한정된 제품 runtime 증거로 유효하다. 원래 startup dirty=false/clean 표기는 실제 두 문서 차이와 모순되므로 whole-export-clean 주장에 사용하지 않는다. 해당 원본 metadata는 소급 수정하지 않는다.

## 고정 근거와 다음 gate

- `.omo/evidence/heath-main-core-summary.json`: SHA `2fd772457dea27278363e7b91234ea69177582a02f6618652095123b360cfaab` (watcher 최종 고정값과 직접 일치). 이 receipt의 native PENDING은 기록 당시 상태이며 본 독립 검토가 별도로 닫는다.
- `output/art-architecture/heath-main-core-931d780e/captures.json`, `negative-first-open.json`; baseline은 `heath-main-before-d3673823` 실제 출력만 사용했다. historical detached HEATH는 대체하지 않았다.
- 각 view의 identity/PNG/RGBA SHA 및 고정 receipt SHA는 동명 JSON에 기록했다.

Core30 독립 시각 gate는 통과했다. 부모의 별도 DATA2 apply gate에는 이 정확한 보고서와 core receipt를 hash 고정해 연결할 수 있다. DATA2의 새 B/C 실제30, candidate ledger 상태, final geometry/clean clone/publication은 아직 별도 gate다. 본 작업은 보고서 두 파일만 기록했고 product 수정·runtime 재실행·원격 작업을 하지 않았다.
