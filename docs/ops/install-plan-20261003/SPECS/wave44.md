# wave44 설치 사양

분류 **다** · 13장 · LM-R1 · 예상 5–9 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `src/engine/stewardship.types.ts:42 HomePetitionKind`
- `src/engine/stewardship.ts:394 lordEstatePetitions`
- `src/engine/stewardship.ts:399 answerEstatePetition`
- `src/ui/petitionPresentation.ts:39 PetitionArt`
- `src/ui/petitionPresentation.ts:336 petitionPresentation`
- `src/ui/hud/StoryModals.tsx:72 PetitionArt`

## 연결·배치·선택 계약

중요: 기존 정치 청원 PetitionRecord.defId와 EstatePetition.kind는 다른 API. 홈 청원 전용 view adapter를 만들고 lordEstatePetitions/state→answerEstatePetition 명령을 연결한다. 01 boundary_dispute,02 mill_suit,03 heriot,04 merchet,05 ale_fines,06 road_bridge,07 stall_dispute,08 wardship,09 common_pasture,10 newcomer 정확 대응. 11 court_baron은 현재 kind 없음. 12 forest_trespass와 현재 pannage(돼지 방목권)는 동일 사건이 아니므로 자동 치환 금지. chancel_repair에는 대응 그림 없음. 13 by_precedent는 decidedBy=steward && precedent=true 기록에만. 이 세 불일치를 렌더/콘텐츠 확인 항목으로 남기고 10개 정확 대응부터 설치. 원본 비율16:9, object-fit contain, 글자 없는 그림 위에 청원 제목·선택지는 DOM. 겨울에도 사건 삽화 계절로 현재 게임 계절을 변경하지 않는다.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

boundary_dispute/wardship/newcomer 청원을 lordEstatePetitions에서열고 grant/refuse 각각명령확인; decidedBy=steward,precedent=true 기록은13번. pannage/chancel_repair의누락매핑을테스트하여엉뚱한court그림으로fallback하지않는지확인.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=LM-R1`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 13장: 메타데이터 제거 후 원본 합계 2.69 MiB, 원본 RGBA 한 벌 산술 합계 25.71 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
