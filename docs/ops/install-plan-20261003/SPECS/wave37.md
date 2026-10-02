# wave37 설치 사양

분류 **나** · 32장 · LM-R1 · 예상 6–10 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `src/render/backyardDecals.ts:69 yardOccupation`
- `src/render/backyardDecals.ts:94 yardPictureKind`
- `src/render/backyardDecals.ts:106 yardVariant`
- `src/render/backyardDecals.ts:225 backyardDecals`
- `src/render/houseFrontage.ts:18 houseFrontage`
- `src/content/backyardConfig.ts`

## 연결·배치·선택 계약

새 front-prop 연결. backyard의 뒤칸 배치·mirror를 그대로 재사용하지 않는다. houseFrontage의 도로 접한 면에서 문 진입로·통행 폭을 비운 지면에 1개, 건물·수면 충돌 시 생략. trade→craft/Person.occupation 명시 대응; 형편은 hungry/strained/prosperous/newcomer 근거를 yardPictureKind와 같은 입력으로 읽는다. 20직업 LM-E6a 정의는 이 HEAD에 검색되지 않아 존재를 가정하지 않는다. 없는 직업은 억지 치환 대신 미표시. householdId+kind hash A/B 고정. foot CSV 좌표로 바닥을 맞추고 좌우 반전 금지. 0.6에서는 작은 형편 물건 생략, 직업 1개만 선택적으로 유지; 1.0/1.4에서 실제 발 위치 검증. 겨울 전용 그림 없음: 여름그림에 임의 눈 덧칠 금지.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

빵·대장·방앗간·직조4가구와 hungry/prosperous/newcomer 형편가구. 앞도로NE/NW, 문앞동선과필지부족으로생략한사례, 여름→겨울, 저장재개A/B고정. 줌0.6/1/1.4 같은camera에서발붙음·통행·반복검사.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=LM-R1`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 32장: 메타데이터 제거 후 원본 합계 0.43 MiB, 원본 RGBA 한 벌 산술 합계 1.27 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
