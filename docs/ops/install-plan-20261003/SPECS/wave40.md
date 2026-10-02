# wave40 설치 사양

분류 **다** · 14장 · LM-R2 · 예상 6–10 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `src/engine/marriage.ts:137 proposeMarriage`
- `src/engine/marriage.ts:374 answerWillChange`
- `src/engine/marriage.ts:401 marriageDecisionDue`
- `src/engine/estateSuits.ts:72 fileSuit`
- `src/engine/estateSuits.ts:142 enforcePossession`
- `src/ui/storyArt.ts:15 StoryIllustration`
- `src/ui/eventStory.ts:30 StoryKind`

## 연결·배치·선택 계약

960×540 사건 카드의 새 영주 사건 라우팅. 혼인 01~08은 제안/봉인/도착/출생/병상/유언/상속의 실제 상태 전이와 history type로 연결. 09~12는 소송 제기·증거·점유거부·점유인도의 다른 상태. 13/14는 lordship의 후견 시작/종료. 단순 tick마다 반복해서 카드를 띄우지 않고 history record id로 dedupe. StoryIllustration union 및 storyArtStyle에 공급자 추가, preload도 소비자와 같은 집합으로. 사건이 없는 화면에 장식 랜덤 사용 금지.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

실제 marriage stage contracted/bride_arrived/child_born/father_ill/will_change/inherited/contested와소송filed/evidence/possession거부·완료 및후견시작종료. history record id 재열람시중복알림없음.14개이미지중트리거없는것은연결완료로세지않음.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=LM-R2`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 14장: 메타데이터 제거 후 원본 합계 2.81 MiB, 원본 RGBA 한 벌 산술 합계 27.69 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
