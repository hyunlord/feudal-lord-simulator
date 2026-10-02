# wave38 설치 사양

분류 **나** · 40장 · LM-R1 · 예상 5–8 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `src/ui/uiArtManifest.generated.ts`
- `src/styles/uiConsole.css:48`
- `src/ui/hud/StoryModals.tsx:115`
- `docs/ops/DISPATCH_LEDGER.md:74`

## 연결·배치·선택 계약

기존 HTML 버튼/입력 상태에 9-slice 스킨 연결. records/assets.csv의 slice LTRB/text_safe를 사용, 128×40 버튼은 touch hit target 44px 확보. disabled 우선, pointer hover/active 및 keyboard focus를 별도 유지. 재작업 primary 4개/tab_hover 채택. primary 글자 #f1e4c6 권장. 카메라 줌과 무관한 CSS pixel; 1280×800/태블릿/DPR2에서 text_safe 벗어남과 포커스 확인. scrollbar/select는 native 플랫폼 기능을 가리는 배경만 붙이지 말고 현재 DOM 동작 유지.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

주/보조/위험/아이콘버튼 각각 normal→hover→pressed→disabled와키보드focus. checkbox/radio/select닫힘열림/slider최소최대/scrollbar긴목록.1280×800및좁은1024가로, DPR1/2에서한국어긴라벨·44pxhitbox·tab_hover보다selected가밝음확인.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=LM-R1`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 40장: 메타데이터 제거 후 원본 합계 0.18 MiB, 원본 RGBA 한 벌 산술 합계 0.56 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
