# event-art 설치 사양

분류 **다** · 34장 · CONTENT/LM-R2 · 예상 12–24 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `docs/design/content-drafts-20261002/v2/events.json`
- `src/ui/eventStory.ts:30 StoryKind`
- `src/ui/storyArt.ts:15 StoryIllustration`
- `src/engine/eventSchedule.ts`

## 연결·배치·선택 계약

ck_evt_*는 콘텐츠 초안에만 있고 src/content 런타임 ID에 없음. 승인34개 그림의 ID로 초안 events.json을 조인하되 초안 조건·효과를 런타임으로 간주하지 않는다. 먼저 사건 정의/스케줄/결과/이력 기능을 구현·검증한 뒤 art key 추가. 12개 재작업 사용,059 제외. 원본960×540 contain. 실제 발생→선택→연대기 재열람 캡처가 필요, dev강제 이미지만 성공으로 세지 않는다.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

초안34개ID별런타임정의와실제스케줄발동을먼저검증.002곡물사건,031/059혼동쌍중승인031만,057수정본과12재작업ID를선택결과·연대기재열람까지캡처.아직runtimeID가없으면미검증으로보고.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=CONTENT`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 34장: 메타데이터 제거 후 원본 합계 5.69 MiB, 원본 RGBA 한 벌 산술 합계 67.24 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
