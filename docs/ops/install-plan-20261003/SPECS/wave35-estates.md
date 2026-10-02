# wave35-estates 설치 사양

분류 **다** · 9장 · LM-R2 · 예상 6–10 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `src/engine/estates.ts:96 estatesOf`
- `src/engine/estates.ts:305 estate portfolio builder`
- `src/ui/lordshipModel.ts:56 lordshipView only home rights/household`
- `docs/ops/DISPATCH_LEDGER.md:77`

## 연결·배치·선택 계약

영지 포트폴리오 카드 480×270. estate 유형은 Estate와 권리 조각으로 명시적으로 매핑하고 wealth/declining을 초상 계급에서 추측하지 않는다. integrated_overlay는 base와 같은 원점/같은 크기로 겹친다. 지도 썸네일과 실제 도시 타일 그림을 혼동하지 않는다. 영지 선택→권리·점유자·수입이 같은 estateId를 가리키게 한다.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

직할 home/가난한 이웃/부유한 이웃/위임 영지를 각각 선택하고 카드의 possessor·annualValue·권리조각을 estatesOf와 대조. 점유 획득 전후 integrated_overlay가 같은영지에만 나타나는지 캡처.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=LM-R2`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 9장: 메타데이터 제거 후 원본 합계 3.11 MiB, 원본 RGBA 한 벌 산술 합계 4.45 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
