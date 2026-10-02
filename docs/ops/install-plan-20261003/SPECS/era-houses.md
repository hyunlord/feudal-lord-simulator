# era-houses 설치 사양

분류 **나** · 3장 · ERA · 예상 4–6 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `src/engine/scenarioState.ts:78 stateCalendar`
- `src/render/historicalHouseAssets.ts:69 historicalHouseAssetMeta`
- `src/render/historicalHouseAssets.ts:90 drawHistoricalHouse`
- `src/render/buildingVariants.ts:73 eligibleVariants`

## 연결·배치·선택 계약

1420 변형3개 L2/3/4: year>=1400에만 후보. 현재 historicalHouseAssetMeta는 level만 읽고 year를 안 받으므로 데이터 추가만으로는 조기1300에도 보이거나 전혀 선택 안 됨. 렌더 frame 입력에 calendar year를 전달하고 year gate를 캐시 키에 포함. 캔버스137/142/161px 원본 alphaBounds/pivot 기반 재등록, 비율 그대로. 1399→1400 변경을 같은camera에서 검증. 기존 겨울 눈/condition overlay와 alpha맞춤 확인 전 눈을 새로 조작하지 않는다.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

1399→1400 같은L2/L3/L4집,1300기본및1420상태에서각1.여름겨울·줌0.6/1/1.4,낡음overlay/짝집제외·같은foot바닥불변검사.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=ERA`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 3장: 메타데이터 제거 후 원본 합계 0.09 MiB, 원본 RGBA 한 벌 산술 합계 0.25 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
