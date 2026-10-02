# lord-components-region 설치 사양

분류 **다** · 16장 · LM-R2/LM-R3 · 예상 8–14 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `src/engine/estates.ts:96 estatesOf`
- `src/engine/stewardship.ts:473 oversightViews`
- `docs/ops/DISPATCH_LEDGER.md:77`
- `src/ui/lordshipModel.ts:56`

## 연결·배치·선택 계약

지역 지도와 좌측 영주 메뉴 새 화면. 지도 그림1600×1000 하나 위에 map_* 거점 하단y88, 깃발 pivot(14,90)로 배치. flag 직접/위임/이웃은 oversight/possessor로 선택하고 문장은 별도 레이어. nav 버튼은 실제 열리는 화면이 있을 때만 활성화. atlas20가 후속 다섯땅 배경이며 이 단일 지도는 기존 승인 대안; 두 바탕을 동시에 겹치지 않는다. 화면 fit scale에서 라벨12px, map zoom과 도시 zoom을 분리. 세계가 보이는 패널 방향 유지.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

영주 인물/가문/영지/지역탭을열고 map_manor/market/abbey/mill각1과직할·위임·이웃깃발선택.문장빈받침에만문장합성,세계화면이패널뒤로보임.활성탭이없는nav는disabled.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=LM-R2`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 16장: 메타데이터 제거 후 원본 합계 3.33 MiB, 원본 RGBA 한 벌 산술 합계 6.36 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
