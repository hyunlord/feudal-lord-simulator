# people-pilot1 설치 사양

분류 **나** · 18장 · PORTRAIT · 예상 3–5 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `assets-inbox/people-pilot1/candidates-v1/records/WORK_ORDER.md:16`
- `src/content/portraitPool.ts:6 PortraitEntry`
- `src/engine/portraits.ts:105 choosePortraitIdentity`
- `src/ui/portraitArt.ts:37 portraitUrl`

## 연결·배치·선택 계약

6인물18PNG는 게임용원본6+96/128파생12. 지금 PORTRAIT_POOL/PORTRAIT_IMAGES에 pt_pilot 키없음. 같은P01 기존풀과 충돌 피하려 pilot1_P1…P6 identity키를 사용. 성별·classBand·band·occupation은 WORK_ORDER 표를 근거로 content import행추가. renderer 256/96만 소비하므로128파생은대체해상도보관으로명시하고unused파일을active라쓰지않는다. 원본을256으로buildderivative한뒤96주어진파일과시각확인. 같은사람노화자료없으므로현재portraitFor fallback정책유지,아이에게성인배정금지.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

6얼굴이merchant남여/clerical남/labour남여/artisan과부의명시밴드에서선택되는지.96/256개인카드와노화시fallback;128은현재소비자가없음을보고.기존P01얼굴이덮어써지지않음.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=PORTRAIT`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 18장: 메타데이터 제거 후 원본 합계 0.64 MiB, 원본 RGBA 한 벌 산술 합계 2.09 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
