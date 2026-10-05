# HEATH DATA2 실제 runtime 독립 native 검토

**PASS.** DATA `fd68f124cf6f8f0b60e6c05049cd03cfc6b817b5` 원본 30장과 실제 core `931d780e37307a7dd2f85a697b122656cb29359d`의 양성 이전 화면 14장을 개별 열어 비교했다. 이번 B/C 시각 수용을 막는 회귀는 발견하지 않았다. 검토 범위는 이 고정 fixture/camera/season/zoom이며 최종 geometry·장부 승격·publication 완료를 뜻하지 않는다.

## 시각 결과

- 사계절 × zoom 1/0.6/1.4 12쌍: B/C는 기존 작은 A에 비해 넓고 짙은 낮은 갈색/자줏빛 덤불 군집으로 나타난다. 중앙 강 오른편 약 (635,392), 위쪽 나무 뒤 약 (675,205)의 변화가 1배율에서 구별된다. 기존 바위·강·나무·지면 배열은 유지된다. 나무 뒤 일부 가림은 정상적인 장면 중첩으로 보이며 모든 source 픽셀의 노출을 주장하지 않는다.
- 여름/겨울 1배율 및 0.6배율: 색이 과하게 튀거나 불투명 사각 배경이 생기지 않는다. 겨울은 눈밭에 낮은 갈색 덤불로 읽히며 새 눈 사실이나 별도 계절 sprite를 주장하지 않는다. 0.6배율에서는 세부 꽃/잎 식별이 제한되지만 지면 군집의 위치와 크기는 유지된다.
- summer chunk/map edge 2쌍: B/C가 보이는 군집을 만들며 신규 직선 이음·경계 절단·지도 밖 돌출은 보이지 않았다. 기존 어두운 지도 밖 영역과 미세 대각 terrain/water 선은 baseline이다.
- open_field(실제 강변 포함), forest_edge, fen_drainage, coastal_port × 사계절 16장: 모두 열어 봤으며 기존 수목·건물·눈·비·수면 표현을 유지한다. 뒤의 전체 RGBA 비교로 무변경을 별도 확인했다.

## 직접 재검증

실제 core/data/repeat PNG 90개를 로컬에서 RGBA로 읽었다. 음성 16장 전체 RGBA 차이 0, 양성 14장 변경 픽셀 수는 각각 고정 summary 값과 일치한다. data/repeat 30장은 RGBA 및 PNG bytes 동일(A/A 30). 모든 원본 SHA 및 capture의 RGBA SHA를 재계산했다. errors/repeatErrors 0, stable PASS.

30장 state/save SHA/tick/season/tile/zoom/viewport/DPR/browser/renderer/고정시간/protocol identity는 동일하다. 양성 14장의 expectedRequests는 의도적으로 B/C를 포함하므로 전체 identity 동일이라고 표현하지 않는다. 음성 16장은 expectedRequests까지 전체 동일하다.

raw capture의 실제 request pathname·decoded URL·draw lineage를 대조했다. 양성 14장 B와 C 모두 요청·decode·captured canvas paint lineage에 있다. 이것은 화면 최종 가림 이후 모든 source 픽셀의 가시성 증명이 아니다. 음성 16장은 A/B/C 요청·decode·draw 모두 부재다. repeat 배열은 저장되지 않아 `UNPROVED_ARRAYS_NOT_PERSISTED`를 유지하며 A/A로 이를 대신 증명하지 않는다.

DATA runtime freeze 4,310개 현재 로컬 SHA 및 retired 부재 6개가 일치한다. remote freeze PASS와 exact tracked export attestation을 확인했다: DATA는 `TRACKED_CLEAN_EXACT_COMMIT`, tracked diff 0이다. 임의 untracked 산출물 전체가 git-clean이라는 주장은 아니다. 이전 core 증거의 `NON_RUNTIME_DOCUMENT_DRIFT`(proof 문서 2개 차이, runtime 4,308 동일) 한정은 그대로 유지되며 이번 DATA clean 결과로 과거 판정을 소급 변경하지 않는다.

## 고정 근거

- `.omo/evidence/heath-main-data-summary.json`: `80fa09f0feaa64b755cb995d7e6f00294ced353ee0cf68258c9aa297083697e5`
- `output/art-architecture/heath-main-data-fd68f124/captures.json`: `088c89e1c4c97091b115f817f562743cadfc2e33eea334e984ed8e103b07972f`
- input freeze: `371e835ca77dc45d7190d63e8c99f4d0dda0fd08ba90d0397ca6b640b42df3c2`
- export attestation: `b848a8d4ee2208f93947ff72248d2c47bfc8f867c32f7a446de48ee592499327`

동명 JSON에 30개 개별 identity/PNG/RGBA/변경 픽셀 수를 기록했다. summary의 native PENDING은 당시 기록이며 이 별도 독립 보고서가 native gate를 닫는다. 보고서 두 파일 외에는 변경하지 않았고 원격 실행·재촬영·제품 수정은 하지 않았다.
