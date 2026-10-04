# 설치 순서 갱신안 — R01

기준 HEAD `5ad4b8340b2ca14bfe99fb3e17b950e2cb064e0b`. 저장소 본문을 덮어쓰지 않는 제안본이다. 이전 문서의 시간 추정은 재사용하지 않는다. 상태·계약이 달라졌으므로 담당 세션이 실제 연결 단위별로 다시 산정한다.

## 제거와 추가

- 기존803행: 이미 설치126(legacy59+NAT-5신규67), retired16을 `REMOVED.csv`로 이동. **661행 유지**.
- 새승인: 랜드마크44(초판정본32+재작업12), 직업128, 세계사건25. **197행 추가**.
- 현재후보 **858행**. `EXCLUSIONS.csv`의1,363행은 게임설치대상이 아닌 기록·확인자료 등이다.
- Wave41교체는인장슬롯1장만남음. Wave42는길8·통나무4·무너진울타리2=14장남음. 창고눈3과성벽모서리16을다시설치하지않음.

## 실행 순서

1. 영주첫청원→도시결과→인과영수증·기존UI그림. Wave35-receipts, Wave37, Wave44, Wave38 및HUD·권리/인물화면. 이벤트종류와그림선택을서로확인한다.
2. 직업128: LM-E6a tradeId/workshop mapping을현재코드에명시하고기존마당중복을제거한다. 코드삭제를이번문서가수행하지않는다.
3. 랜드마크44: 성장저장상태·공사완료·발판확장·다리span계약후한계열씩설치한다. 원화는전부승인되었으나runtime는별도다.
4. 세계사건25: personId/eventId/estateId귀속·1회성historyID·해결후제거조건부터. 기존운구/장날/반란을중복그리지않는다.
5. 협상·약속·영지·지도기반, 남은자연표현을기능우선순위에따라연결. 단순계절색보다행동의원인과결과를드러내는표현우선.
6. 기능없는시설·가축·운송·미세시대표현은계약완료전보류. 보류는원화승인취소가아니다.

## 현재 묶음별 수량

|묶음|남은파일|설치계약|
|---|---:|---|
|endings-manors|2|SPECS/endings-manors.md|
|era-houses|3|SPECS/era-houses.md|
|era-portraits|18|SPECS/era-portraits.md|
|era-signs|8|SPECS/era-signs.md|
|event-art|34|SPECS/event-art.md|
|experiments-region|23|SPECS/experiments-region.md|
|landmarks|44|새 연결 계약 필요; ASSET_STRATEGY.md 참조|
|lord-components-region|16|SPECS/lord-components-region.md|
|lord-components-ui|24|SPECS/lord-components-ui.md|
|people-pilot1|18|SPECS/people-pilot1.md|
|region-atlas|20|SPECS/region-atlas.md|
|trade-world|128|새 연결 계약 필요; ASSET_STRATEGY.md 참조|
|walker-pilot2-final|20|SPECS/walker-pilot2-final.md|
|wave12-facilities|49|SPECS/wave12-facilities.md|
|wave12-icons|3|SPECS/wave12-icons.md|
|wave12-manor|4|SPECS/wave12-manor.md|
|wave12-quay|1|SPECS/wave12-quay.md|
|wave13-animals|14|SPECS/wave13-animals.md|
|wave13-transport|8|SPECS/wave13-transport.md|
|wave13-workers|12|SPECS/wave13-workers.md|
|wave14-bordure|1|SPECS/wave14-bordure.md|
|wave14-ui|15|SPECS/wave14-ui.md|
|wave17-war|27|SPECS/wave17-war.md|
|wave18-hud|41|SPECS/wave18-hud.md|
|wave20-era|32|SPECS/wave20-era.md|
|wave22-heath|2|INSTALL_LISTS/wave22-heath.md|
|wave3-cloth-hall|1|SPECS/wave3-cloth-hall.md|
|wave3-pasture|3|SPECS/wave3-pasture.md|
|wave3-tools|16|SPECS/wave3-tools.md|
|wave35-estates|9|SPECS/wave35-estates.md|
|wave35-negotiation|11|SPECS/wave35-negotiation.md|
|wave35-operations|17|SPECS/wave35-operations.md|
|wave35-promises|9|SPECS/wave35-promises.md|
|wave35-receipts|4|SPECS/wave35-receipts.md|
|wave37|32|SPECS/wave37.md|
|wave38|40|SPECS/wave38.md|
|wave39-particles-contact|39|SPECS/wave39-particles-contact.md|
|wave39-weather-ground|19|SPECS/wave39-weather-ground.md|
|wave40|14|SPECS/wave40.md|
|wave41-replacements|1|INSTALL_LISTS/wave41-replacements.md|
|wave42-land-stages|14|SPECS/wave42-land-stages.md|
|wave43-ground-props|15|SPECS/wave43-ground-props.md|
|wave43-season-variants|9|INSTALL_LISTS/wave43-season-variants.md|
|wave44|13|SPECS/wave44.md|
|world-events|25|새 연결 계약 필요; ASSET_STRATEGY.md 참조|

## 공통 완료 관문

원본SHA→메타데이터제거/단일축소→runtimeSHA→manifest ID→선택상태→게임그리기호출→실제장면이 이어져야 완료다. 정적CSV정리는 설치완료가 아니다. 세줌·계절·피벗·문/길침범·깊이가림·상태종료·저장불러오기 이후같은선택을확인한다. 장부와provenance갱신도같은설치작업에서한다. 원화는보존하고임의확대·반전·타기능위장은하지않는다.
