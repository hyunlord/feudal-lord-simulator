# 조건 6건 엔진 대조 결과

조회 HEAD: `5c16778d` (루트가 동결한 전체 SHA를 납품 때 적용). 저장소 원본은 읽기만 했으며 `graft build`가 만든 로컬 인덱스만 추가했다.

## 공통 계산 계약

새 저장 필드를 주장하지 않는다. 아래 대문자 이름은 등록기에서 계산할 **제안된 파생 별칭**이며 현재 엔진 API 이름이 아니다.

- `LIVE = state.houses.filter(h => h.residents > 0)` : 실재 거주 가구. `House.residents`는 `src/population/population.types.ts:22`.
- `TIMBER_AVAILABLE = state.treasuryTimber + state.buildings.reduce((s,b) => s + availableStock(b,'timber'), 0)` : 금고 목재와 창고 등 건물 재고 중 운송 예약되지 않은 목재, 단. `availableStock`는 `src/economy/storage.ts:184`, 실제 재고식은 `src/world/placement.ts:267`에서 검증했다. 공사에 이미 납품/예약한 목재는 중복 세지 않는다.
- `TIMBER_NEED = waitingTimberNeed(state)` : 현 공사 모든 종류의 미납품·미예약 목재 합계, 단. `src/engine/autoplayTimberDemand.ts:23`, `constructionDeliveryNeed`는 `src/economy/construction.ts:95`. 이것은 현재 실제 대기 수요이며 경과일이 아니다.
- `SEASON = stateCalendar(state).season` : 봄0 여름1 가을2 겨울3. `src/engine/scenarioState.ts:65`의 calendar, 같은 파일 `stateCalendar`.
- `SUB(kind) = state.agency?.subsidies.find(s => s.kind === kind)?.amount ?? 0` : 현재 지속 장려금 설정액, d. `src/engine/townAgency.ts:73`에서 총한도 확인.
- `LEGAL(kind) = autoplayBuildAction(state,kind)`가 `kind === 'place_building' && building === kind`인 경우. 현재 위치·자원·길·권리/시대 등 배치 조건과 연동된 **실제 기존 함수**이다(`src/engine/autoplay.ts:275`). 반환이 도로·도하·목재주문이면 이 엄격한 guard에서는 후보 없음이다. 장려금 지급/건설 성공을 뜻하지 않는다.
- A 범위형 입력은 한 번 정하고 모든 선택에 공유하거나, 편집자가 고정한다. 004는 A=40d, 반분20d가 간단하고 재현 가능하다. 008은 A=50d, 작은 안20d 제안. 숫자는 역사적 사실이 아닌 콘텐츠 밸런스 값이다.

주의: `placementSpendableResource`는 건물 공사의 미납품 필요를 이미 차감한다. 이것을 전체 `TIMBER_NEED`와 비교하면 같은 필요를 두 번 차감할 수 있다. 위 미예약 총량을 비교한다. 바람·긴 비·손상은 현재의 별도 날씨/피해 저장값으로 보증할 수 없으므로 이야기 속 보고로 한정한다. 'M일 기다림'을 새로 만들지 않는다. 기존 `expansionShortageSinceTick`는 목책/성벽 및 벌목·제재 증설 특화 계측이며 일반 공사 대기일로 쓰면 안 된다.

## 초안별 권고

### 004 물·곡물 저장 문턱

- `LIVE.length >= 2`.
- `const services = allocateHouseServices(state); LIVE.filter(h => services.houses.has(h.buildingId) && services.houses.get(h.buildingId).water.kind !== 'served').length >= 2`.
- `storageCapacityBlock(state.buildings,'wheat') !== null` (밀을 받는 기존 저장처의 반입 가능한 공간이 **0**).
- `state.agency !== undefined`, `SUB('well') === 0`, `SUB('granary') === 0`.
- A=40d로 고정하면 `L = max(0,floor(treasuryBalance(state)*250/1000)) - sum(다른 모든 장려금.amount)`에 `40 <= L && L < 80`.
- `LEGAL('well') && LEGAL('granary')`.
- 물은 게임의 물자 재고 숫자가 아니라 **실제 서비스 미공급 가구 수**로 확인한다. 곡창 부족은 총건물 저장률이 아니라 밀 반입 문턱을 본다.
- 근거: `src/population/serviceAllocation.ts:7`, `:53`; `src/economy/storage.ts:98`; `src/engine/townAgency.ts:73`; `src/ledger/ledger.ts:69`.

### 008 분산 주거/예배당 거리 문턱

**현 코드 중요한 차이:** `chapel.serviceRadius=0`(`src/content/buildingConfig.ts:200`), 가구의 `church` 서비스 제공 종류는 `church`뿐(`src/population/serviceAllocation.ts:34`). 예배당 장려금이 교회 서비스 부족을 해결한다고 쓰면 사실과 다르다.

- 제목은 유지 가능. 본문은 예배당이 멀어진 주민의 새 예배당 요청으로 유지하되 기계적인 주택 예배 서비스 개선을 약속하지 않는다.
- `CHAPELS = state.buildings.filter(b => b.kind === 'chapel')`, `CHAPELS.length >= 1`.
- `REMOTE = LIVE` 중 실제 대응 house 건물이 있고 **모든** 기존 chapel과 `buildingFootprintDistance(home,chapel) > 8`인 가구. `REMOTE.length >= 3`.
- 이 거리8은 편집 문턱(맨해튼 방식 건물 외곽 간격 타일 수)이며 실제 chapel 서비스 반경이라는 주장이 아니다. 함수 `src/geometry/buildingDistance.ts:12`.
- A=50d, `SUB('chapel')===0`, `subsidyRefusal(state,'chapel',50)===null`, agency 존재.
- 최종안은 `LEGAL('chapel')`만 요구한다. 근거리 후보 callback 조건은 채택하지 않았다. 실제 거주지와 기존 예배당의 거리로 청원 맥락을 확인하되 새 예배당의 위치·서비스 개선을 보장하지 않는다.
- **현 townProposals(state)에 chapel이 이미 있어야 한다는 옛 문구는 제거**: 장려금0에서 chapel의 policyWeight는 최대15이고 기회제안 문턱20 미만이다. 이미 chapel1개이면 시대 요구도 충족해 사실상 카드가 죽을 수 있다. LEGAL로 자리 확인하거나, 선택 장려금을 적용한 복사 상태의 townProposals로 가능성만 검사한다. 실제 게임에 장려금을 미리 쓰지 않는다.

### 015 목재 부족

- 기존 연도1326–1347년을 유지한다. `SEASON===0 || SEASON===1` (봄·여름).
- agency 존재, `timberTradeMarket(state)!==null`, `(state.timberOrder??0)===0`, `state.treasuryCoin>=180`.
- `TIMBER_AVAILABLE < 10 && TIMBER_NEED > TIMBER_AVAILABLE`.
- '습한 계절 동시 확인'은 삭제. 본문 비 이야기는 가공 보고라고 명시하거나 날씨를 단정하지 않는 문장으로 변경.
- 근거: `src/engine/timberTrade.ts:19`, `:28`, `:42`; `src/content/timberTradeConfig.ts:5`(시장18d/단); 위 공통 재고·수요 계산.

### 028 병 소식

- 원본1361–1363년 '다시 병이 돈다'에 맞추어 **두 번째 유행**만: `state.plague?.second !== undefined && state.plague.second.arrivalTick <= state.tick && state.plague.second.endTick === undefined && state.plague.endedTick === undefined`.
- `state.population>=1`, agency 존재, `['growth','defence'].includes(state.agency.policy)`.
- 셋째 안에만 `SUB('granary')===0 && subsidyRefusal(state,'granary',32)===null && LEGAL('granary')`.
- `plagueActive`는 시나리오에 역병 연쇄가 있다는 뜻이므로 현재 유행 문턱으로 사용하면 안 된다. `rumourTick` 존재도 오래된 첫 소문을 영구 참으로 만들 수 있다. 현재 second 도착/끝 필드를 직접 검사한다.
- 근거: `src/engine/plague.types.ts:9` Pestilence, `:28` PlagueState; `src/engine/plague.ts:77` raging, `:551` 두번째 유행 생성(1361년 봄). 새 감염·사망률 효과는 없음.

### 035 목재 부족

- `state.population>=1`, `SEASON===2 || SEASON===3` (가을·겨울).
- `timberTradeMarket(state)!==null`, `(state.timberOrder??0)===0`.
- `TIMBER_AVAILABLE < 12 && TIMBER_NEED > TIMBER_AVAILABLE`.
- 두 주문이 실제 매입 가능하도록 `state.treasuryCoin>=72`(시장4단분, 큰12단216d 완납은 미보장) 제안. 좀 더 강한 카드 전제는≥216이지만 의미상 재정 선택 폭이 줄어든다.
- '실재 제안 또는 필요' OR는 지우고 실제 진행 공사 수요 한 가지로 좁힌다. 새 '대기일' 필드를 만들지 않는다.
- 바람은 가공 보고, 시설 손상·수선 성공 효과 없음.

### 046 미입고 주문 검토

- `SEASON===1 || SEASON===2`, `timberTradePoint(state)!==null`, `(state.timberOrder??0)>=8`, `state.treasuryTimber>0`(먼저 사서 금고에 받은 목재 존재).
- 셋째 유지안만: `8 <= state.timberOrder && state.timberOrder <= 60 && TIMBER_NEED > TIMBER_AVAILABLE`.
- 첫/둘째는 재고 부족이 아니어도 '주문을 줄이거나 취소'할 수 있다. 셋째 '추가 비축 수요'를 실제 대기 공사 미충족량>0으로 고정한다.
- 유지안이 같은 order_timber 값을 다시 보내면 no-op이다. 콘텐츠 차이는 **향후 주문을 취소하지 않음**. 이를 상태변경 명령 성공이라고 기록하면 안 된다. 기존 `no_op` 카탈로그로 유지안을 명시하는 것은 콘텐츠 차원의 안전한 대안이며 원장에는 지급 거래를 생성하지 않는다.
- 현 엔진 일반시장 maxOrder=400, 촌락maxOrder=60(`src/content/timberTradeConfig.ts:12,24`). 셋째의8–60은 엔진 전체 허용범위가 아닌 이 카드의 좁은 편집 범위다.

## 남은 엔진 몫

위 값/함수는 실제 존재하지만 이 표현을 LM-E9 등록기 predicate로 노출·바인딩하는 것은 엔진 통합 작업이다. v2 registry.schema의 허용 enum과 다르면 새 predicate ID를 기존 구현으로 주장하지 않는다. 조건 평가와 명령 실행 사이 상태가 바뀔 수 있으므로 실행 직전 재검사 필요. 거리 계산·후보 탐색은 캐시해도 되나 현재 배치 상태와 일치해야 한다.

## graft

build 1회, 조회11회(성공9회, 잘못된 파일prefix scope2회). 성공질의 추정 절감 합계 **113,412 tokens**. dollars 미제공.
