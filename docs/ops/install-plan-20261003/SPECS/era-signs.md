# era-signs 설치 사양

분류 **나** · 8장 · ERA/LM-R1 · 예상 3–5 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `src/engine/scenarioState.ts:78 stateCalendar`
- `src/render/backyardDecals.ts:69 yardOccupation`
- `assets-inbox/era-pilot/candidates-20261003/records/pilot/signs/manifest.csv`

## 연결·배치·선택 계약

4직업×1300/1420 표지8. Wave37 front placement 후 year gate추가. 1400이전1300판,이후1420판 제안값이며 기록의시대키와 맞춘다. 빵/에일/대장/직조만 확실한 직업에. A/B와시대는별축이며 임의반전금지. source manifest 원본geometry/foot 값 보존. 0.6에서 그림표지가 점이면숨김,1.0/1.4에서비율확인.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

에일·빵·대장·직조직업각각1399/1400/1420,같은집위치에시대표지만바뀜.줌0.6작은점숨김·1/1.4크기와발좌표검사.새로운직업을랜덤부여하지않음.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=ERA`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 8장: 메타데이터 제거 후 원본 합계 0.15 MiB, 원본 RGBA 한 벌 산술 합계 0.57 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
