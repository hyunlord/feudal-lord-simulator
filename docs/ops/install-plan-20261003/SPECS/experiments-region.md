# experiments-region 설치 사양

분류 **다** · 23장 · LM-R2/LM-R3 · 예상 5–8 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `src/engine/estates.ts:96 estatesOf`
- `assets-inbox/experiments/region-map-kit-20261003/records/kit/manifest.json`
- `docs/ASSET_INBOX.md 지역 지도 키트 실패 실험 기록`

## 연결·배치·선택 계약

승인23개만: 표지3/거점9/길8/도하3. 실패한 조립 지형을 재도입하지 않는다. region-atlas 슬롯 위 거점/깃발을 추가. road strips는 손그림 바탕에 이미 있는 길을 덮는 일반 roads가 아니라 새로 생긴 길 오버레이. 엔진의 지역 도로 생성 데이터가 현재 없으므로 해당11개는 기능 부재로 분류: 도시 tiles roads를 지도 pixel로 억지 투영 금지. 실제 연결 edge 데이터 정의 후 베지어/방향별 piece를 배치하고 bridge/ferry/ford는 해당 crossing 상태가 있을 때만.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

atlas바탕위site9종/marker3종개별배치.신규지역road edge기능완성후major/minor 직선·굽이·갈림·교차와bridge/ferry/ford11개를물경계에서확인.실패한terrain tile이로드되지않음검사.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=LM-R2`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 23장: 메타데이터 제거 후 원본 합계 0.30 MiB, 원본 RGBA 한 벌 산술 합계 3.20 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
