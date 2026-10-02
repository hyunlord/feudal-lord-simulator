# wave35-operations 설치 사양

분류 **다** · 17장 · LM-R2 · 예상 8–14 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `src/engine/stewardship.ts:60 attention`
- `src/engine/stewardship.ts:473 oversightViews`
- `src/engine/stewardship.ts:468 pendingAudits`
- `src/engine/estateSuits.ts:108 suitHearing`
- `src/engine/townAgency.ts:64 setEstatePolicy`

## 연결·배치·선택 계약

운영·소송 트랙 화면 신규. office 32/64는 동일 직책 아이콘 DPR/크기에 따라 선택, 동시에 중복 생성하지 않는다. attention.capacity/load, oversight mode, audit record와 litigation stage를 보여준다. 정책 4개는 EstatePolicy growth/revenue/stability/defence 키와 직접 대응. subsidy_notice는 실제 ProjectSubsidy 존재 시. 소송 결과를 진행도 장식만으로 예측하지 않는다.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

위임0/1/주의력초과, pendingAudits 계정감사/현지방문, fileSuit 제기→증거→판결→enforcePossession 각각. 정책4종전환과보조금상한거절도캡처.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=LM-R2`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 17장: 메타데이터 제거 후 원본 합계 1.63 MiB, 원본 RGBA 한 벌 산술 합계 2.56 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
