# 1차 UI 그림 계약 인계 — B 그림 데이터 / A 화면 소비

**정적 준비·unbound, 설치/제품 표시 미검증** (2026-10-05). FND-4 UI-first를 세계 proof와 병행하는 준비로 반영한다. 범위는 원 설치계획 ORDER.md §1이다. 기계용 정본 `ui-contract-handoff.json`은 각 행의 canonical source 전체 경로, 예정 URL, SHA 기록, 치수 및 누락 필드를 담는다. 제품 코드는 변경하지 않았다.

## 범위와 수량

1차 298행 중 **UI surface 260행**(핵심 삽화/atlas 47 + 지원 213)을 이 초안이 다룬다. 세계 surface 38행(endings-manors2, wave12-manor4, wave37의32)은 이 UI 범위 밖이다. 이는 표면 분류이며 레인별 독점 backlog 수량이 아니다. §1 신규 초상은 **0**이며 기존 풀을 재사용 인계한다. era-portraits18·people-pilot1의18·event-art34는 §3으로 이번 범위 밖이다.

|묶음|행 수|예정 경로 파일 존재|계약 범위|
|---|---:|---:|---|
|experiments-region|23|0|ui-support-not-forced-into-art-kind|
|lord-components-region|16|0|ui-support-not-forced-into-art-kind|
|lord-components-ui|24|0|ui-support-not-forced-into-art-kind|
|region-atlas|20|0|regional-map|
|wave14-ui|15|0|ui-support-not-forced-into-art-kind|
|wave18-hud|41|0|ui-support-not-forced-into-art-kind|
|wave35-estates|9|0|ui-support-not-forced-into-art-kind|
|wave35-negotiation|11|0|ui-support-not-forced-into-art-kind|
|wave35-operations|17|0|ui-support-not-forced-into-art-kind|
|wave35-promises|9|0|ui-support-not-forced-into-art-kind|
|wave35-receipts|4|0|ui-support-not-forced-into-art-kind|
|wave38|40|0|ui-support-not-forced-into-art-kind|
|wave40|14|0|event-illustration|
|wave41-replacements|4|3|ui-support-not-forced-into-art-kind|
|wave44|13|0|event-illustration|

260행 중 3개 예정 대상만 존재하며 모두 Wave41의 **기존 교체 대상**이다. 나머지 257개는 원 계획의 예정 public 경로가 없다. **이것만으로 미설치를 판정하지 않는다.** 같은 원본을 다른 URL/빌드 파생 경로로 제공할 수 있다. 실제 Wave41 title 원본은 `scripts/keyartDerivatives.ts:52`에서 `assets/wave8/keyart/keyart_title_bg.jpg`로 이미 연결돼 있다. 존재는 새 후보 설치나 SHA 일치를 뜻하지 않는다. 초기 SHA는 inventory 기록을 보존했다. 후속 원본 검사에서 Wave40·44·atlas 47장의 현재 SHA·치수·엄격한 ffmpeg 디코드가 모두 통과했다. 나머지213행은 새 해시 검증을 하지 않았다.

## 소유권 — 파일 설치와 화면 구현을 구분

`AGENTS.md:99–107`, `foundation.md:79–81`, 최신 `DISPATCH_LEDGER.md:83–88`에 따라 **모든 그림 계약/catalog/파일/설치는 B**, UI·영주 화면·입력은 A다. 위 UI260행도 파일·계약은 B가 준비하고 A가 화면에서 소비한다. Wave37 32개는 세계 앞마당 그림이므로 B 세계 소비자/설치이며, 기존 DISPATCH :75의 LM-R1 과업 인계 때문에 A와 협업한다. LM-R1 표에 있다는 사실은 A의 세계 파일 독점 소유가 아니다. A 인계와 B 설치 양쪽에 신규32를 중복 합산하지 않는다.

## portrait — 기존 풀 인계

`src/ui/portraitArtManifest.generated.ts`는 630개 ID, 96/256 URL 1260개를 등록한다. checkout의 public URL 파일은 0개지만 이는 **생성 파생의 정상 구조이며 설치 누락이나 blocker가 아니다**. 630개 inbox source 경로가 모두 존재한다. 9개 canonical source root와 그룹별 수량은 JSON에 있다. 기존 공급 pipeline은 아래 소스로 정적 확인했으며 이번 브라우저/빌드 실행을 뜻하지 않는다.

`PORTRAIT_IMAGES` → `scripts/keyartDerivatives.ts:81`의 PORTRAIT_DERIVATIVES(각 원본 96/256 두 URL) → `:87` WEB_ART_DERIVATIVES → `:352` buildKeyartDerivative가 inbox를 읽고 SHA/version/format/quality cache와 JPEG quality82를 사용한다. `:379` configureServer는 URL 요청에 생성 바이트를 제공하고 `:389` generateBundle은 build output으로 emit한다. `vite.config.ts:77`에 plugin이 등록돼 있다. 소비자는 `src/ui/portraitArt.ts:21,37,43`의 base URL/96·256 image-set이다. 따라서 public에 사본을 설치하도록 요구하지 않는다.

`persons.ts:1054` personPortrait → `portraits.ts:162` portraitFor → `ui/portraitArt.ts:21,37` imageOf/portraitUrl의 기존 나이·identity·silhouette fallback과 steward 고정 표정(:33)을 보존한다. portraitIdentity는 person.id가 아니다. pool/ageStage/lineage/era 및 derivative provenance의 정식 변환이 필요하며 시대를 발명하지 않는다. 원 PNG와 기존 JPEG 파생에 무손실 RGBA 동일 조건을 강제해서는 안 된다.

## event-illustration — Wave40 14 + Wave44 13

Wave44 01–10은 `engine/stewardship.types.ts:42` HomePetitionKind와 정확 대응한다. JSON에 개별 매핑을 기록했다. 11 court_baron은 kind 없음, 12 forest_trespass는 pannage와 다름, 13은 decidedBy=steward && precedent=true 기록 조건이다. chancel_repair 대응 그림도 없다. 정치 PetitionRecord.defId와 EstatePetition.kind를 합치지 않는다.

Wave40은 `marriage.ts:273,468,471,486,489`의 contracted/bride_arrived/child_born/father_ill/will_change, `estateSuits.ts:78,137,151`의 제기/판결/집행 사실을 확인했다. 이 단계명 자체가 14개 그림의 eventId는 아니다. 후견·상속·형제 탄생 등 원 사양의 개별 전이를 실제 history ID와 연결하고 재열람 중복 알림을 막는 UI read model이 필요하다. `ui/storyArt.ts:15`는 아직 Wave16/17/21/31/33만 받는다.

원본 CSV는 제목을 제공하지만 ArtContract 필수 `altTextKey`를 공급하지 않는다. eventIds namespace도 합의 전이다. 따라서 validArtBundleDrafts=[]이며 placeholder로 valid bundle을 만들지 않았다. 960×540 비율, Wave44 contain, DOM 제목/선택지와 실제 사건/재열람/빈·오류 상태를 Render A가 검증한다.

## regional-map — atlas20 + sidecar20

20개 JPG의 동명 JSON에 실제 authored mapId·archetype·1600×1000 좌상단 pixel 좌표가 있다. 다섯 archetype은 `content/scenario/archetypes.ts:11`의 core:open_field/coastal_port/chalk_downs/forest_edge/fen_drainage와 대응한다. 실제 seed→01–04 mapId 선택과 저장 유지 adapter는 별도다. 각 sidecar 전체 경로와 slotCount를 JSON에 기록했다.

원본 slot에는 allowedKinds·clearance·landmarkRefs가 있지만 **landType은 없다**. manor/abbey 같은 allowedKinds를 땅 유형으로 바꾸지 않는다. 현재 RegionalMapEntry는 원본 배치 제약 전체를 표현하지 못하므로 sidecar를 보존하고 Render A/계약 소유자가 slot.landType 의미와 placement 읽기 모델을 확정해야 한다. `engine/estates.ts:69,96`의 실제 이웃18을 seed/estateId에 안정적으로 배정하고 저장재개·clearance·슬롯 부족을 검증한다. authored mapId를 이미 엔진에 있는 값이라 주장하지 않는다.

lord-components-region16은 대안 바탕 하나와 표지/깃발/nav를 포함한다. atlas와 두 배경을 겹치지 않는다. experiments-region23은 승인 표지3+거점9+길8+도하3이다. 길/도하11은 실제 지역 edge/crossing 공급이 없으므로 도시 tile road를 투영하지 않는다. 지원213행의 버튼·프레임·표지 등을 세 의미 kind에 억지로 넣지 않고 원 사양의 별도 UI adapter로 인계한다.

## 인계 후 관문

1. 실제 context·event/history namespace·alt key·slot semantics를 확정한다. 미공급 항목은 unbound 유지.
2. 완전한 ArtBundle을 작성하고 schema/registry 검증 후 startup-only catalog 배열에 데이터로 추가할 수 있는지 확인한다. 현재 JSON은 ArtBundle이 아닌 준비 inventory다.
3. 원본/예정 runtime SHA를 실제 파일로 대조한다. `scripts/checkArtCatalog.ts`는 PNG와 승인 JPEG의 실제 디코드·치수·SHA·동일 픽셀을 검사하며 JPEG 바이트 보존을 요구한다. JPG 핵심47개의 파일 설치에 적용할 수 있으나 이번 인계가 그47개를 실제 설치·검사했다는 뜻은 아니다. 기존 PNG→축소 JPEG 초상 파생은 별도 생성 관문을 유지한다.
4. 실제 선택→요청→decode→표시, 사건 중복 방지/재열람, 지도 선택/저장재개, DPR1/2·1280×800/태블릿·빈/오류 상태를 증명한 뒤 설치 장부를 판단한다. 지도20 동시 preload 금지. 무거운 캡처는 실행기 두 slot 규약을 따른다.

후속 [원본 검사](ui-jpeg-source-validation.json)는 핵심 JPEG47개를 엄격한 ffmpeg 경로로 실제 디코드하고 현재 해시·치수를 inventory와 대조해47/47 통과했다. 나머지213개 및 기존 초상 파생은 이 검사 밖이다. 이 인계에서 UI 실행/캡처·이미지 눈 검토·복사·설치는 하지 않았으며 catalog/public/provenance/ledger 수정도 없다.

추가 탐색: Graft ask로 keyartDerivativesPlugin 경로를 먼저 찾고 위 현재 소스 줄을 대조했다. Graft가 응답 전 생성 그래프 1개를 자동 refresh했다고 보고했다. 제품 소스는 수정하지 않았다. 기존 pipeline에 대한 HTTP 응답·실제 JPEG decode·빌드 emit·브라우저 표시 검증은 이번 read-only 인계에서 실행하지 않았다.
