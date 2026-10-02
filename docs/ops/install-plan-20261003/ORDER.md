# 설치 순서와 작업량

기준 HEAD `ce67158a7f2d24bf8d02cab45deb9b7209ed68e1`. 신규 744장: 가37 / 나425 / 다282. 기존 설치 장부 정리59장은 별도다. 수령 묶음38개를 렌더 연결 계약47개로 나눴다. 아래 시간은 렌더 엔지니어 1명의 구현·관련 QA 인시 추정이며 실측이나 납기 약속이 아니다. 같은 화면의 공통 기반 구현은 겹칠 수 있어 합계는 보수적 상한 성격이다. 그림 재제작·콘텐츠 기획 승인 대기는 제외한다.

## 0. 이미 설치된 59행 정리

0.5–1 인시. Wave7 사본58과 Wave17 피난 아동1의 public 바이트/기존 정본 작업을 확인하고 ledger만 정리한다. 신규 설치량에 더하지 않는다.

## 1. 영주 모드 수직 조각 먼저

**298장.** 첫 실행은 Wave38 버튼40·Wave35 영수증4·Wave37 집 앞 표지32·Wave44 청원13, 그리고 Wave12 영주관4와 빈 영주관2다. Wave44는 정확히 대응하는10개 청원부터 연결하고 장원 법정/숲 침범/선례의 별도 조건은 사양대로 분리한다. 빈 영주관은 Wave12 본체의 피벗 연결 뒤 진행한다.

1a. LM-R1: HUD(Wave18), 권리/인물 보조 UI(Wave14), 영주 부품24와 위 첫 묶음. 기존 화면 공간 예산·44px 조작 영역을 먼저 지킨다.

1b. LM-R2: Wave35 협상→약속→영지/소송 화면, Wave40 상태 전이 삽화. 같은 사건을 두 번 띄우지 않는 history ID 계약을 선행한다.

1c. LM-R3 지도/시작: 지역 지도 화면 기반(lord-components-region)→region-atlas20 및 거점 슬롯 JSON→실험 지도에서 승인된 표지/길23. Wave41 타이틀/인장 슬롯/결과/통행권4도 이 단계의 기존 UI 교체로 먼저 처리한다. 전체 지도20장을 동시 preload하지 않는다.

## 2. NAT-5·NAT-3 자연스러움

**178장.** NAT-5 기존그림 교체22+heath2 → Wave42 땅 변화50 → 모서리16·울타리2·굶주림 줄1 순서. NAT-3 봄 나무·과수9 → 땅/소품15·창고 눈3 → 날씨 지면19 → 월드 입자/접촉39 순서. 기존 숲 전이띠·폭1여울은 이미 설치되어 이번 대기에 다시 넣지 않았다.

바위 그림 교체는 QA-039의 칸 clipping을 자동 해결하지 않는다. 봄 강가 grass는 전역 grass 키로 등록하지 않고 지도 유형별 연결을 해야 한다. 비/발자국의 위치·가림은 움직이는 캡처로 확인한다.

## 3. 나머지 기존 기능 연결과 새 기능

**268장.** 기존 직물/워커/전쟁 표현 연결 → 시대별 집·표지·초상 → 새 사건 콘텐츠·시설·가축/운송 기능 순서. 새 시설 building kind가 없으면 그림을 다른 시설로 위장해 설치하지 않는다. 파일럿 초상·시대 변형은 양산 승인을 의미하지 않는다.

## 실행 묶음별 작업표

|단계|실행 묶음|분류|장수|예상 인시|사양|
|---|---|---|---:|---:|---|
|0|legacy-reconcile|장부정리|59|0.5–1|[사양](INSTALL_LISTS/legacy-reconcile.md)|
|1|endings-manors|다|2|6–10|[사양](SPECS/endings-manors.md)|
|1|experiments-region|다|23|5–8|[사양](SPECS/experiments-region.md)|
|1|lord-components-region|다|16|8–14|[사양](SPECS/lord-components-region.md)|
|1|lord-components-ui|나|24|4–7|[사양](SPECS/lord-components-ui.md)|
|1|region-atlas|다|20|10–16|[사양](SPECS/region-atlas.md)|
|1|wave12-manor|나|4|5–9|[사양](SPECS/wave12-manor.md)|
|1|wave14-ui|나|15|6–12|[사양](SPECS/wave14-ui.md)|
|1|wave18-hud|나|41|7–14|[사양](SPECS/wave18-hud.md)|
|1|wave35-estates|다|9|6–10|[사양](SPECS/wave35-estates.md)|
|1|wave35-negotiation|다|11|8–14|[사양](SPECS/wave35-negotiation.md)|
|1|wave35-operations|다|17|8–14|[사양](SPECS/wave35-operations.md)|
|1|wave35-promises|다|9|6–10|[사양](SPECS/wave35-promises.md)|
|1|wave35-receipts|나|4|3–5|[사양](SPECS/wave35-receipts.md)|
|1|wave37|나|32|6–10|[사양](SPECS/wave37.md)|
|1|wave38|나|40|5–8|[사양](SPECS/wave38.md)|
|1|wave40|다|14|6–10|[사양](SPECS/wave40.md)|
|1/2|wave41-replacements|가|26|3–5|[사양](INSTALL_LISTS/wave41-replacements.md)|
|1|wave44|다|13|5–9|[사양](SPECS/wave44.md)|
|2|storehouse-snow|나|3|2–4|[사양](SPECS/storehouse-snow.md)|
|2|strip-corners|나|16|6–10|[사양](SPECS/strip-corners.md)|
|2|wave22-heath|가|2|1–2|[사양](INSTALL_LISTS/wave22-heath.md)|
|2|wave39-particles-contact|다|39|16–24|[사양](SPECS/wave39-particles-contact.md)|
|2|wave39-weather-ground|나|19|6–10|[사양](SPECS/wave39-weather-ground.md)|
|2|wave41-hurdles|나|2|1–2|[사양](SPECS/wave41-hurdles.md)|
|2|wave41-queue|나|1|2–4|[사양](SPECS/wave41-queue.md)|
|2|wave42-land-stages|나|50|10–16|[사양](SPECS/wave42-land-stages.md)|
|2|wave43-ground-props|나|15|5–9|[사양](SPECS/wave43-ground-props.md)|
|2|wave43-season-variants|가|9|1.5–3|[사양](INSTALL_LISTS/wave43-season-variants.md)|
|3|era-houses|나|3|4–6|[사양](SPECS/era-houses.md)|
|3|era-portraits|나|18|4–6|[사양](SPECS/era-portraits.md)|
|3|era-signs|나|8|3–5|[사양](SPECS/era-signs.md)|
|3|event-art|다|34|12–24|[사양](SPECS/event-art.md)|
|3|people-pilot1|나|18|3–5|[사양](SPECS/people-pilot1.md)|
|3|walker-pilot2-final|나|20|4–8|[사양](SPECS/walker-pilot2-final.md)|
|3|wave12-facilities|다|49|24–56|[사양](SPECS/wave12-facilities.md)|
|3|wave12-icons|다|3|2–4|[사양](SPECS/wave12-icons.md)|
|3|wave12-quay|나|1|2–4|[사양](SPECS/wave12-quay.md)|
|3|wave13-animals|다|14|20–40|[사양](SPECS/wave13-animals.md)|
|3|wave13-transport|다|8|16–32|[사양](SPECS/wave13-transport.md)|
|3|wave13-workers|나|12|5–10|[사양](SPECS/wave13-workers.md)|
|3|wave14-bordure|나|1|4–8|[사양](SPECS/wave14-bordure.md)|
|3|wave17-war|나|27|10–20|[사양](SPECS/wave17-war.md)|
|3|wave20-era|나|32|8–16|[사양](SPECS/wave20-era.md)|
|3|wave3-cloth-hall|다|1|12–24|[사양](SPECS/wave3-cloth-hall.md)|
|3|wave3-pasture|나|3|4–8|[사양](SPECS/wave3-pasture.md)|
|3|wave3-tools|나|16|3–6|[사양](SPECS/wave3-tools.md)|

Wave41 교체26장은 1단계4장/2단계22장으로 나눴다. 묶음 추정3–5인시는 중복 합산하지 않고 위 합산에서 1단계에 한 번만 넣었다.
- 0단계 묶음 합산: 0.5–1 인시(겹치는 기반 작업 미공제).
- 1단계 묶음 합산: 107–185 인시(겹치는 기반 작업 미공제).
- 2단계 묶음 합산: 50.5–84 인시(겹치는 기반 작업 미공제).
- 3단계 묶음 합산: 140–282 인시(겹치는 기반 작업 미공제).

## 완료 조건

각 묶음은 source→public→catalog→선택→실제 캡처가 연결된 뒤에만 완료다. [공통 설치 계약](INSTALL_PROTOCOL.md)에 따라 provenance와 해당 행 installed_by를 갱신한다. 이번 ZIP은 설치 계획으로, 실행되지 않은 UI·날씨·성능 관문을 통과로 표시하지 않았다.
