# endings-manors 설치 사양

분류 **다** · 2장 · LM-R1 · 예상 6–10 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `src/engine/lordship.ts:96 declineCause`
- `src/ui/lordshipModel.ts:56 lordshipView`
- `src/render/storyWorldProps.ts:66 event_crowd_manor_gate`
- `docs/ops/DISPATCH_LEDGER.md:74`

## 연결·배치·선택 계약

빈영주관A/B 두장. 현재render에manor_house sprite catalog/occupied↔empty선택경로없음. 소유영주·출가/퇴거·빈상태를 lordship의실제상태로연결할영주관세계object와명시자리규칙이필요. 일반keep를무조건교체하지않는다. 원본occupied A/B와동일canvas/pivot로전환, B는v2만. 원본영주관설치가선행조건. 확정metadata는 A canvas416×328/pivot(249,319), B-v2 canvas416×328/pivot(251,319); 원본JSON은 METADATA/lord.json에수록. 줌0.6/1/1.4 여름겨울모두빈상태장식이문을가리지않는지검증.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

occupied A→empty A,occupied B→empty B-v2 전환을같은camera로;집이빈상태여도영주가재실중이면전환금지.여름겨울줌0.6/1/1.4실루엣pivot고정·문닫힘·뜰풀캡처.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=LM-R1`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 2장: 메타데이터 제거 후 원본 합계 0.34 MiB, 원본 RGBA 한 벌 산술 합계 1.04 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
