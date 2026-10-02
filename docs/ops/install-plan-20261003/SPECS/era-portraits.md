# era-portraits 설치 사양

분류 **나** · 18장 · ERA · 예상 4–6 인시(구현+해당 기능 QA, 실제 측정 아님).

## 코드 근거

- `src/engine/portraits.ts:162 portraitFor`
- `src/engine/persons.ts:1054 personPortrait`
- `src/ui/portraitArt.ts:37 portraitUrl`
- `src/ui/portraitArtManifest.generated.ts:3 PORTRAIT_IMAGES`

## 연결·배치·선택 계약

6identity×3시대 초상18. identity/나이 단계는 유지하고 의상 시대만 year별1300/1380/1420 선택. 현재 portraitFor와 portraitUrl은 시대 URL 선택이 없으므로 year전달이 필요. 1340은1300판 fallback을 명시. 나이단계가 일치하지 않는 얼굴을 노년기 그림처럼 쓰지 않는다. 96/256 파생을 기존keyartDerivatives 경로로 만들되128요구 없음. 아동·성인·노년 일관성은 별도검증, 파일럿 정식양산이 승인됐다고 간주하지 않는다.

## 자산 규격·복사

`../INVENTORY.csv`의 이 group 행을 전부 사용한다. 원본 경로는 assets-inbox/ 접두를 붙인다. 픽셀 크기는 실제 파일 측정값이다. `../METADATA/lord.json`은 원 납품 CSV 행을 보존한다. foot/pivot/nine-slice 값이 없으면 중앙·하단을 추정하여 정본처럼 쓰지 말고 기존 원본의 registration을 확인한다. 화면 삽화는 pivot 불필요, world art는 필수. source status candidate는 납품 당시 값이며 지금 설치 승인 여부는 INBOX_LEDGER confirmed가 우선이다. 이 사양서의 target은 제안이며 아직 설치하지 않았다.

## 캡처 관문

I037/I040/I043/I046/I049/I060 각각1300/1340/1380/1420의96·256portrait를비교.1340fallback,동일identity유지,child/elder나이불일치fallback,저장재개초상선택확인.

UI는 1280×800/태블릿과 DPR1/2, 세계 그림은 줌0.6·1.0·1.4와여름·겨울을필수로확인한다. 캡처는구현후렌더세션의검증사항이며이번감사에서실행한것이아니다.

## 설치 후 장부

각 행 SHA를 원본과 대조하고 로더→선택→실제 화면 캡처까지 확인한 뒤만 `installed_by=ERA`를 기록한다. 이 감사에서는 installed_by를 쓰지 않았다. public 복사만으로 installed로 세지 않는다. 정상·빈·에러 상태 검증과 docs/provenance/assets.csv 추적이 필요하다.


## 용량과 공통 처리

이 실행 묶음 18장: 메타데이터 제거 후 원본 합계 1.60 MiB, 원본 RGBA 한 벌 산술 합계 4.50 MiB. 실제 GPU/캐시 피크 측정이 아니다. 그림별 실측은 [INVENTORY.csv](../INVENTORY.csv), 실패 처리·장부·롤백은 [공통 계약](../INSTALL_PROTOCOL.md)을 따른다.
