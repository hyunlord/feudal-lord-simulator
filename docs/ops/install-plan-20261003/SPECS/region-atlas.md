# region-atlas 설치 사양

분류 **다** · 20장 · LM-R2/LM-R3 · 예상 10–16 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `src/engine/estates.ts:69 neighbourEstates`
- `src/engine/estates.ts:96 estatesOf`
- `src/engine/scenarioState.ts:17 scenarioOf`
- `assets-inbox/region-atlas/candidates-20261003/assets/maps/open_field-01.json:1`

## 연결·배치·선택 계약

다섯 archetype×4 배경. scenario archetype를 open_field/coastal_port/chalk_downs/forest_edge/fen_drainage에 명시 매핑하고 seed 해시로01~04를 최초 고정. 각 JPG와 동명 JSON을 함께 복사한다. 슬롯 좌표는 등각 tile이 아닌1600×1000 좌상단 pixel, bottom-center anchor. estateId 정렬+seed로 allowedKinds와 clearance 조건에 맞게 고정 매칭, 부족하면 보고하고 수면/지도 여백에 억지 배치 금지. 18이웃 모두 중복 없이 보이고 선택·저장재개 뒤 같은 위치. JPG는 계절 중립 지도: 여름겨울에서 위치 고정. source20 JPG 외20 JSON 필수 부속.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

다섯땅×각4개seed선택으로20배경전체,18이웃위치와선택estateId매칭.동일seed저장재개슬롯불변,clearance/allowedKinds위반0,라벨겹침,fit및2배지도확대.여름겨울지도위치불변.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=LM-R2`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 20장: 메타데이터 제거 후 원본 합계 17.92 MiB, 원본 RGBA 한 벌 산술 합계 122.07 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
