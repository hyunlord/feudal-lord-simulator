# 역사 재현 exact40: 원인 분류 검토

**관측된 선행 조건/선택지 병목33, 가중 경쟁4, 시대 제외2, 요청 범주 귀속 미정1(147).** 누락 producer나 adapter 버그로 확정한 사례는 없다. 병목33은 조건이 과도하다거나 특정 하위 조건이 원인이라는 판정이 아니다.

원본 저장 run의 바이트 일치, report 일치와 부모의 외부 실행·소스 검증을 확인했다. 다만 저장 run 일치는 전체 게임 상태나 매 tick 동일성의 증명이 아니다. 현대 세 seed 원인은 차용하지 않았다.

## 실제 선택 경쟁

모든 통과 기회5회에서 다른 후보가 선택됐다. 아래 구간은 **[시작, 끝)**이며, 분류는 `cooldown-conflict`의 **단일 슬롯 가중 경쟁** 세부 유형이다. 실제 cooldown이나 dedup 거부로 바꾸어 설명하지 않는다.

| ID | tick | 자기 선택 구간 | pick / total | 실제 승자 |
|---|---:|---|---|---|
|ck_evt_010|184000|[0,100)|115/200|ck_evt_051|
|ck_evt_033|15000|[200,300)|36/400|ck_evt_009|
|ck_evt_042|26000|[100,200)|59/300|ck_evt_005|
|ck_evt_042|28000|[0,100)|183/200|ck_evt_211|
|ck_evt_163|450000|[0,60)|71/160|ck_evt_204|

033/009는 같은 suit-2·claim-2,010/051은 같은 claim-16을 기록한다. 하지만 해당 탈락 분기는 target 충돌 검사가 아니라 가중 선택이다. 승자의 실제 constructed offer와 layer 결과까지 JSON에 보존했다.

## exact40 한 행 요약

Gate 약어: **B** binding/context/entry-condition null, **K** calendar, **P** 일회성 pace, **H** 청원 준비 실패, **E** 실행 가능한 선택지 기준 미달, **D** chance 실패, **A** 후보 통과, **O** 가중 선택 목록 등재. 역사40의 P는 원문에서 모두 `alreadyUsed=false, oneShotsOpen=false`로 확인했다. A와 O는 같은 후보의 서로 다른 단계이므로 합쳐 기회 수로 세지 않는다.

| ID | 분류 | 실제 gate 계수 | 당시 전제와 해석 한계 |
|---|---|---|---|
|ck_evt_002|선행 조건/선택지 병목|B245 · K231|영지·감독·현 청지기·생존 인물, 감사 방식·방문 시점 전제|
|ck_evt_010|가중 경쟁|B475 · A1 · O1|청구권·재정 전제; claim-16 통과 후051에 선택 탈락|
|ck_evt_011|선행 조건/선택지 병목|B476|교섭·반대 제안·응답 기한 전제|
|ck_evt_013|선행 조건/선택지 병목|B476|감사·현 청지기·후임자, 유용액·충성·연줄·감독 전제|
|ck_evt_018|선행 조건/선택지 병목|B476|신랑·신부·본령·과부산, 기존 혼인·재정 전제|
|ck_evt_019|선행 조건/선택지 병목|B476|현 청지기와 농민·상인 대체 후보, 생존·재직·감독 전제|
|ck_evt_024|선행 조건/선택지 병목|P234 · K226 · B16|binding/context 없음: 영주권·좌판세·인구 조건식 실패까지 확인|
|ck_evt_025|선행 조건/선택지 병목|P436 · B40|감사·후임자, 유용액·능력·충성·소작인 전제|
|ck_evt_029|선행 조건/선택지 병목|B125 · K351|영지·현 청지기·유능 후보·인구 전제; 역사 기록은 선택지 검사에 미도달|
|ck_evt_031|선행 조건/선택지 병목|P436 · B40|직영 감독과 서로 다른 유능·충성 후보, 능력·충성 비교|
|ck_evt_033|가중 경쟁|B475 · A1 · O1|suit-2/claim-2 통과 후009에 선택 탈락; 다른475회 null의 세부 사유 미상|
|ck_evt_034|선행 조건/선택지 병목|P436 · B40|영지·감독 및 감독 방식 전제|
|ck_evt_035|선행 조건/선택지 병목|K250 · P202 · B24|binding/context 없음: 목재 주문·인구·재정 조건식 실패까지 확인|
|ck_evt_037|선행 조건/선택지 병목|P436 · B40|현 청지기·감사 방식·방문 시점·인구 전제|
|ck_evt_042|가중 경쟁|B474 · A2 · O2|binding/context 없음: 영주권·좌판세 조건식 실패474회; 통과2회 모두 선택 탈락|
|ck_evt_052|선행 조건/선택지 병목|B476|감사·현 청지기·후임자, 유용액·충성·연줄·감독 전제|
|ck_evt_057|선행 조건/선택지 병목|P436 · H40|청원 준비 실패: 헌장·시장/교회·세율·기존 청원·기한 중 정확한 거부항 미상|
|ck_evt_059|선행 조건/선택지 병목|B476|직영 감독과 서로 다른 유능·충성 후보 전제; 역사상 통과/invalid offer 없음|
|ck_evt_061|선행 조건/선택지 병목|B476|영지·청지기·감독 binding 및 small_rights context|
|ck_evt_075|선행 조건/선택지 병목|B476|소송·청구권 binding 및 old_possession context|
|ck_evt_076|선행 조건/선택지 병목|B476|두 영지·감독·유능 후보, parallel_accounts context와 감사 방식|
|ck_evt_077|선행 조건/선택지 병목|B476|small_rights context 및 혼인·권리 규칙 조건; 어느 단계 거부인지 미상|
|ck_evt_080|시대 제외|K476|시작1430: 원본 범위와 관측 경계1425 모두 밖|
|ck_evt_083|선행 조건/선택지 병목|B446 · E30|market_supply context/영주권; null446회, 선택지 기준2 미만30회|
|ck_evt_090|선행 조건/선택지 병목|B476|shop_repair context/영주권; 정확한 거부 전제 미상|
|ck_evt_124|선행 조건/선택지 병목|P436 · E1 · B39|신랑·상대·신부 binding; null39회, 선택지 기준 미달1회|
|ck_evt_128|선행 조건/선택지 병목|P436 · E1 · B39|신랑·상대·본령·과부산·신부 binding; null39회, 선택지 기준 미달1회|
|ck_evt_130|선행 조건/선택지 병목|P436 · B40|영지·감독·현 청지기·생존 인물 전제|
|ck_evt_131|선행 조건/선택지 병목|P436 · E1 · B39|신랑·상대·신부 binding; null39회, 선택지 기준 미달1회|
|ck_evt_132|선행 조건/선택지 병목|P436 · E1 · B39|신랑·상대·본령·과부산·신부 binding; null39회, 선택지 기준 미달1회|
|ck_evt_133|선행 조건/선택지 병목|P436 · E1 · B39|신랑·상대·신부 binding; null39회, 선택지 기준 미달1회|
|ck_evt_139|선행 조건/선택지 병목|P436 · E1 · B39|신랑·상대·신부 binding; null39회, 선택지 기준 미달1회|
|ck_evt_140|선행 조건/선택지 병목|P436 · B40|영지·감독·현 청지기·생존 인물·유능 후보 전제|
|ck_evt_143|선행 조건/선택지 병목|E5 · D403 · B68|소송·청구권·단계·영주권·인구 전제; null68회, 선택지 기준 미달5회|
|ck_evt_144|선행 조건/선택지 병목|P436 · D34 · E6|pace/chance 통과6회 모두 선택지 기준 미달; 개별 선택/명령 거부 사유 미상|
|ck_evt_147|귀속 미정|K446 · P28 · D2|창 내 pace28·chance2, budget2 실측; binding/context 미도달, 요청5범주 귀속 미정|
|ck_evt_150|선행 조건/선택지 병목|D412 · B64|소송·청구권·단계·영주권·인구 전제; chance 이후 null64회|
|ck_evt_157|선행 조건/선택지 병목|P436 · D37 · B3|청지기·농민/상인 후보·감독·감사·인구 전제; binding 도달3회만 관측|
|ck_evt_163|가중 경쟁|K356 · P109 · D10 · A1 · O1|가을의 유일 통과 후보가204에 선택 탈락|
|ck_evt_174|시대 제외|K476|시작1430: 원본 범위와 관측 경계1425 모두 밖|

## 범위와 남은 한계

- 원본 occurrence 보고 범위는1300≤year<1425이다. **관측 계수는 tick500000/year1425/season0 경계까지 포함**한다.080/174의 시작1430은 경계를 포함해도 밖이다.
- B는 required binding 부재, context 거부, entry 조건 실패,64회 탐색 한도 등을 합친 결과다. 이름별 missing binding이나 거짓인 하위 조건은 관측하지 않았다.
- E는 당시 최소 기준2 미만만 입증한다. 정확히0개인지1개인지, 어느 선택/명령이 거부됐는지는 모른다. 특히029에 현대의 “선택지1개” 설명을 적용하지 않는다.
- 147의1348–1355 창32계절 중28회 pace·2회 chance 실패, 나머지198000/199000은 실제 outer budget 반환이다(NDJSON24437/24439). **이유는 실측됐지만 요청5범주 귀속은 미정**이다. downstream 적격성은 확인되지 않았다.
- 전역 budget/legacy skip은 해당 호출 경로를 설명할 뿐, 특정 사건이 다른 gate를 통과했을 것임을 증명하지 않는다. 누락 producer·adapter 버그는 추가 source/상태 근거 없이 추론하지 않는다.

## 세부 근거와 출처

[JSON](classification.json.gz)에 exact40의 모든 gate 수, first/last 원문 witness·행 번호, 경계틱 witness, 당시 full spec, 선택5회/동일 tick context38행, 소스 해시 및 부모 검증 결과를 보존했다.

당시 `56ee1d9…` 소스 기준:

- `src/content/registry/v4Entries.generated.ts:4`: ID별 binding·조건·choice·calendar 원문.
- `src/engine/registryV4.ts:301–336`: binding/context/entry 조건 탐색; `340–349`: 선택지 검사; `410–429`: 후보 gate.
- `src/engine/registry.ts:405–425`: 예산과 가중 선택.
- `src/engine/registryChapterPetitions.ts:35–59`:057 context/청원 준비 조건.
- `src/content/registry/petitionContextConfig.ts:2–11` → `src/engine/registryPetitionContext.ts:14–26`: custom context 연결.

Gameplay `56ee1d9d8259f89e6122153cedd82e783a74f5c7`; tool `27599bd5ace470476a8ee0be727535b34a0373a5`.
Manifest SHA256 `91bdcf3dd03e9e9d36b2bb06d138c90d29e386877ac9830ea47f0604363b2cfc`.
JSON SHA256 `fc3c9316ac4aebe333b5a96e7dd91166bdc3e99e265e694168bc347c62253f58`. 원문 stream63748행을 해시와 함께 재확인했다.

독립 검토에서 exact40·집계·당시 spec·소스 해시·선택5회 구간 계산에 차단 결함을 찾지 못했다. `cooldown-conflict` 키만 소비하지 않고 `single_slot_weighted_competition_not_literal_cooldown` 세부 유형을 함께 읽어야 한다.147의 범주 귀속과 하위 조건 원인은 미해결이므로 EB-FREQ 전체 완료 판정은 아니다. 추가 엔진·브라우저·시뮬레이션 실행 없음.
