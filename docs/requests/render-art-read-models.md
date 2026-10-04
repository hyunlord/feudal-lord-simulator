# 그림 계약을 위한 엔진 읽기 정보 요청

2026-10-04, Render B / ASSET-ARCH-1. 이 요청은 엔진·저장 형식을 바꾸거나 해당 그림을 설치했다는 기록이 아니다. 현재 계약은 없는 사실을 선택 조건으로 만들어 내지 않는다.

## 직업 물자의 실제 운반자: 40장

대상은 `assets-inbox/trade-world/candidates-20261003/records/assets/assets.csv`의 cargo 10종 × 네 방향이다. `src/agents/walker.types.ts`의 `WalkerCargo`는 `ResourceType`을 사용한다. `src/content/trades.ts`의 `TradeGood` 및 `src/engine/trades.types.ts`의 stock/haulage는 이와 별개이며, 도시 합계만으로 어느 사람이 지금 무엇을 들었는지 결정할 수 없다.

필요한 사실은 실제 운반 actor의 안정 ID, 현재 운반 물자와 수량, 출발/도착 대상, 운반 시작·종료 상태다. 기존 워커에 이미 붙일 수 있는 정보라면 그 연결을 알려 주면 된다. 방향·보행 프레임·손 위치와 몸 앞/뒤 그리기 순서는 기존 워커 그리기 정보에 연결해 Render B가 처리한다. 엔진이 그림 좌표나 PNG 이름을 저장할 필요는 없다.

검수 조건: 운반하지 않는 사람에게 짐이 생기지 않음, 같은 직업이어도 빈손과 실제 운반 상태가 구별됨, 운반 종료 시 짐이 사라짐, 게임 저장/재개 후 같은 사실을 그림으로 나타냄. 이 읽기 정보가 없으면 40장은 미연결 상태로 남는다.

## 중립 지원 마당의 적격 대상: 12장

대상은 같은 CSV의 `institution`, `no_shop_labor`, `itinerant` 각 A/B × 여름/겨울이다. `WorkshopArchetype` 열거형에는 이름이 있지만 현재 `TRADES`가 가구에 배정하는 원형은 아홉 가지다. `chooseTrades`가 이 세 원형을 자연 발생시키는 연결은 없다.

원본 `records/provenance/TRADE_CONTRACT.md`는 중립 지원 장면을 새 직업으로 세지 않도록 제한한다. 따라서 다음 중 실제 게임에 있는 의미를 확인할 수 있는 읽기 정보가 필요하다.

| 그림 의미 | 필요한 사실 | 금지하는 대체 |
|---|---|---|
| 기관 지원 마당 | 어떤 기관의 어떤 지원 활동이 활성인지와 대상 장소 | 여관주라는 이유만으로 기관 지원으로 표시 |
| 점포 없는 노동의 준비 장소 | 작업·하역 준비를 하는 가구/사람과 실제 대상 장소 | `carter`의 `big_yard`를 `no_shop`이라고 바꾸기 |
| 순회 수리 지원 | 실제 방문/수리 활동과 머무르는 대상 | 새 순회 직업이나 상시 작업장을 렌더에서 생성 |

적격 대상이 있어도 길·문·물·이웃 건물을 가리지 않는 빈 지면 배치는 별도의 렌더 관문이다. 대상 사실과 배치 여건을 모두 충족해야 설치했다고 기록한다.

## 당장 사용할 수 있는 사실과 회계 경계

기존 `TradeHousehold.houseId/tradeId/workshop`, `TradeStreet.tradeId/houseIds`는 일반 직업 마당·집 앞·거리 표지의 후보 선택에 사용할 수 있다. 물레방아 마당 그림은 원본이 요구하는 **축융 작업**에만 해당하므로 `water_mill` 원형이라는 이유로 제분업자에게 적용하지 않는다.

전체 직업 묶음은 128장(마당 48, 집 앞 20, 거리 20, 짐 40)으로 유지한다. 이 문서의 52장에 대한 정보 부족을 나머지 76장의 설치 완료로 해석해서는 안 된다. 실제 선택·배치·요청·디코드·그리기 증거는 각 설치 회차에서 따로 기록한다.

76장 내부에도 납품 원형과 현재 `TRADES` 정의가 다른 10장이 있다. `cooper`·`brewer`·`fuller`의 마당 B 각 여름·겨울 6장, `shoemaker`·`carrier`의 집 앞 A/B 4장이다. 이는 엔진 결함이나 새 직업 요청으로 단정하지 않으며, Render B가 원본의 의미와 현재 배치를 대조할 항목이다. 서로 다른 직업을 나타내는 A/B를 무작위 외형 변형으로 합치지 않는다. 나머지도 합법적인 빈 자리·문/길 비움·실제 소비자 연결이 필요하므로 현재 설치 가능 수량으로 올리지 않는다.

## 집 앞 목축·어업 표지: Wave37 4장

`trade_shepherd_{a,b}`와 `trade_fisher_{a,b}`는 실제 그 집 가구/구성원의 직업을 나타내야 한다. 현재 TradeId에 두 직업이 없고, 인물의 직장 master tag→occupation→household 연결도 목축·어업을 배정하지 않는다. 건물의 worker 수는 개별 인물/집 주소가 아니며, walker.homeBuildingId는 배달 출발 직장에 쓰이므로 주민의 집으로 읽지 않는다. 초상 풀의 fisherman 태그도 실제 직업 배정이 아니다.

본선 `57228cc1`에 포함된 렌더 A 구현 `b525d546`에는 이4개 파일/표지 종류가 선언되어 있지만, `backyardDecals.yardOccupation`의 정상 생산 경로에 두 직업이 없다는 제한을 `doorSigns.ts`도 명시한다. 엔진이 실제 가구/인물의 두 직업과 집 귀속을 제공하거나 해당 그림의 사용 의미가 달라지기 전에는 자동 도달/활성4장으로 세지 않는다. Wave37 나머지28장이나 별도 trade-world128과 중복 집계하지 않는다.

## 랜드마크 성장의 대상과 완료 상태: 44장

승인 정본은 `landmarks/candidates-20261003/assets/`의 32장과 `landmarks/rework-20261003/assets/`의 다리·길드홀 수정 12장이다. 수정판 manifest의 44행을 수정 폴더에 44개 파일이 있다는 뜻으로 읽지 않는다. 원본 다리·길드홀 12장은 superseded이며 함께 설치하지 않는다.

현재 사실은 교회 `legacy.naveRebuilt`, 시장 칙허, 길드 설립, 완성된 성문 재료, 영주관 점유, 실제 다리 span이다. 이 사실을 달력만으로 건축 완료나 부지 확장으로 바꾸지 않는다.

| 계열 | 현재 읽을 수 있는 사실 | 필요한 완료·대상 계약 |
|---|---|---|
| 교회 | `legacy.ts`의 naveRebuilt | 특정 건물 ID 귀속, 예배당/교회의 같은 건물 성장 관계, 4단계 완료와 3×3 부지 확보 |
| 시장 | market 건물과 market_charter 권리 | 권리 획득과 별개인 회관 공사 완료, 시장 ID와 최대 5×4 확장 |
| 성문 | PalisadeSegment의 완성 재료·축·통행구 | 3단계 방/문장 추가 완료. 기존 두 재료와 새 그림 단계의 대응, 포털·벽 접속 유지 |
| 다리 | `BridgeSpan`의 축·물칸·양쪽 둑 | 안정 ID, 목재/석재 및 예배당 단계. 승인 그림은 3물칸 한 축 규격이므로 다른 span으로 임의 늘리지 않음 |
| 영주관 | manor_house 존재와 가구 점유 | 건물 ID에 따른 3단계 완료와 3×2→6×5 점유 정책. 현재 2×2와 구별 |
| 길드홀 | GuildRecord의 설립 | 물리적 대상·부지·단계. 현재 시장 옆 렌더 소품 배치를 엔진 건물 점유권으로 간주하지 않음 |
| 여관 | L4 집의 inn 외형 변형 | 실제 여관 영업/건물 정체성과 3단계 완료. alehouse나 임의 L4를 여관으로 치환하지 않음 |

엔진은 그림 이름·픽셀 좌표를 저장할 필요가 없다. 안정된 대상 ID, 승인·공사 완료 상태, 점유/통행 변화를 공급하면 렌더 B가 단계 그림·계절·등록 피벗을 연결한다. 현재 generic landmark 계약의 growthStage 필드만으로 이런 게임 사실이 생기는 것은 아니다. 전체 44장 연결·실제 통행·가림·계절 검증은 아직 완료하지 않았다.

## 목축 시설·손도구·작업자의 실제 대상: 31장

2026-10-05 Render B. 감사 기준 `90d9b586`; `70c15321`에서도 31개 원본의 설치 표시·예정 public·provenance alias가 모두 없음을 재확인했다. 엔진 기능 구현 지시나 설치 기록이 아니다. 근거는 [목축 시설 명세](../ops/install-plan-20261003/SPECS/wave3-pasture.md), [손도구 명세](../ops/install-plan-20261003/SPECS/wave3-tools.md), [목축 작업자 명세](../ops/install-plan-20261003/SPECS/wave13-workers.md), [원425 회계](../verification/asset-architecture/recount-425.csv)다. 기존 요청 묶음과 별도31개 원본이며 중복 집계하지 않는다.

### 요청 범위와 정확한 원본 ID

N번호는 기존 `docs/verification/asset-architecture/recount-425.csv`의 1-based 원래 행 번호다. 정확한 원본 경로와 sourceSHA는 위 추적되는 회계 CSV에서 대조한다. 방향 순서는 모든4장 묶음에서 **NE, NW, SE, SW**다.

| 묶음 | 원래 ID와 그림 | 수량 |
|---|---|---:|
| wave3-pasture | N0244 shearing_pen, N0245 sheepfold, N0246 wash_pool | 3 |
| wave3-tools | N0247–N0250 work_distaff; N0251–N0254 work_dye_paddle; N0255–N0258 work_shears; N0259–N0262 work_shepherd_crook | 16 |
| wave13-workers | N0116–N0119 work_goad; N0120–N0123 work_whip; N0124 wk_drover_m; N0125 wk_goosegirl_f; N0126 wk_packhorse_leader; N0127 wk_swineherd_m | 12 |

### 1. 목축 시설3: 실제 대상과 사용 가능한 공간

**현재 사실:** `src/engine/cloth.ts:42–76`의 pasture zone membership, pastoral_farm 위치와 담당 셀 수, `src/content/buildingConfig.ts:398–400`의 2×1 footprint 및 fleece 보관 기능은 존재한다. `pastureTending`은 농장별 **개수**를 반환한다. 담당 pasture와 보유 마당은 같은 개념이 아니며 이 함수가 마당 소유권을 제공하지 않는다. 실제 물 terrain도 읽을 수 있으나 물 인접은 양 씻기 활동의 증거가 아니다.

**엔진 담당자에게 필요한 최소 응답:** 이미 제공 가능한 selector가 있다면 그 경로와 의미만 알려주면 된다. 아래 명칭은 요청하는 의미이며 신규 저장 필드나 API 형식을 확정한 것이 아니다.

| 필요한 조회 의미 | 최소 내용 | 부재 시 처리 |
|---|---|---|
| 목축 시설 대상 | 안정된 실제 farm/building ID, 해당 농장과 목축 공간의 관계 | 적격 농장 없이 그림 생성 금지 |
| 시설을 둘 수 있는 범위 | 대상 ID에 귀속되는 유효 영역/셀 또는 기존 규칙으로 판정하는 질의, 그것이 소유 마당인지 사용 허용 공간인지의 명시 | nearest farm·빈 grass·담당 셀 수로 소유권 추정 금지. 원래 “보유 마당” 계약을 충족 못하면 미연결 유지 |
| 전모 시설에 그려진 fleece의 의미 | 기존 `building.inventory.fleece`로 보관 중 양털을 표현해도 되는지 확인. 실제 전모 진행을 의미해야 한다면 실제 대상에 귀속되는 활동 상태가 필요 | 달력 여름만으로 진행 중 전모나 fleece 보유를 생성하지 않음 |

빈 sheepfold와 wash_pool은 정적 시설로 연결할 수 있다면 새 동물 actor가 필수는 아니다. 모든 시설에 새 활동 read-model을 일괄 요구하지 않는다. shearing_pen에 포함된 양털 더미의 의미만 기존 재고와 맞춰 확인한다. 보유 공간 자체가 게임에 없다면 이를 읽기 정보만으로 생성할 수 없으므로 엔진 사실 추가와 원본 사용 의미 변경 중 어느 것도 렌더에서 임의 결정하지 않는다.

**Render B 책임:** 적격 공간 내 실제 빈자리 선정, 도로/건물/공사/벽/물 및 다른 소품 충돌 제외, 문·진입 gap 비움, wash_pool의 실제 물 인접 확인, native pivot/scale/depth/clip 등록. 기존 `backyardDecals.ts:124–180`의 기하 규칙을 참고할 수 있지만 현재 house-only이며 비burgage zone을 제외하므로 farm 마당 구현이라고 간주하지 않는다. 현재 농장 fit art (`historicalFacilityManifest.ts:278–307`, 272×136, displayWidth107/108)와 맞춰 교정하고 임의0.5배를 적용하지 않는다.

### 2. 직물 손도구16: 누가 지금 어떤 작업을 하는가

**현재 사실:** `clothWorkerSheet.ts:21–30`은 homeBuildingId가 pastoral_farm인 **carter의 외형**을 wk_shepherd로 선택한다. `walkerComposer.ts:205–210`도 외형만 바꾸며 기존 held-prop 선택을 사용한다. `walker.types.ts:3–36`의 actor ID·위치·cargo·출발 건물 및 운반 mission/phase가 존재하지만 전모/실잣기/염색/양 관리 작업 상태는 이 경로에 없다. `walkerLook.ts:166–202`에 해당4종 작업 selector가 없고, cloth 총량 생산이나 house spinningSlot을 개인 손 작업으로 읽을 수 없다.

**필요한 최소 조회 의미:** 기존의 실제 world actor ID에 연결되는 작업 종류(양 관리/전모/실잣기/염색 중 실제 지원되는 것), 작업 대상 ID 또는 장소, 현재 그 작업에 종사 중인지와 종료/중단 여부. actor가 실제로 개인과 연결돼 있다면 그 관계를 공급하되 가상의 person ID를 요구하지 않는다. 기존 운반·건설 등과 작업 상태가 충돌하지 않는 의미/우선순위도 필요하다. 양 관리와 전모는 구별하며 crook와 shears를 한 직업의 무작위 소품으로 섞지 않는다.

기존 기능이 이 사실을 공급하지 않는다면 “지원 없음”이라는 명시적 응답이면 충분하다. 이름만 있는 occupation 문자열이나 새 enum으로 도달성을 꾸미지 않는다. 엔진이 그림 종류·손 좌표·프레임을 저장할 필요는 없다.

**Render B 책임:** 현재 작업이 허용하는 도구 선택, cargo/이미 도구를 든 body와의 중복 방지, 방향4×보행2frame 손점 등록, 앞/뒤 hand layer, 32×32 grip(16,20), noMirror, 로더 준비·실패 시 생략. 실제 작업자 생산이 없는 상태에서 장식 인구를 만들어16장을 보여주지 않는다.

### 3. 목축 작업자12: 세부 역할과 실제 동물 유도 관계

**현재 사실:** `farmProps.ts:43–69` 등의 양/소/돼지는 zone 기반 정적 렌더 표현이다. 실제 drover/goosegirl/swineherd/packhorse leader의 임무 actor나 동물 유도 관계로 볼 수 없다. `persons.types.ts:45–57`은 실제 person ID·householdId·occupation을 갖지만 `persons.ts:65–70,493–505`의 건물 관리인 연결이 이 네 역할을 생산하지 않는다. 문자열 타입의 허용 범위를 현재 게임 직업의 존재와 혼동하지 않는다.

**필요한 최소 조회 의미:** 실제 화면 actor의 안정 ID, 현재 담당 역할/임무, 동물 종류와 관련된 실제 대상 또는 무리·운송 임무 참조, 활동의 시작/종료·유효성. 개별 동물 ID가 원래 모델에 없다면 만들어 달라는 요청이 아니다. 기존 집합/무리 임무가 있다면 그 실제 참조로 충분하다. goad/whip은 단지 직업이나 동물이 근처에 있다는 이유가 아니라 현재 유도 작업이 해당 도구 표현을 허용하는지 판단 가능한 의미가 필요하다. 몸 외형에 필요한 실제 성별 정보도 기존 actor/person 관계가 있으면 그것을 따른다.

**Render B 책임:** 승인4body의 실제 역할 한정 선택, 남녀 template·74×74×8cell foot/hand 등록, goad/whip48×48 pivot(24,24)의 실제 손접점 검증, 방향·프레임·layer·scale·noMirror. 기존 farmer 풀에4명을 무조건 섞거나 기존 sheep carter를 drover로 재명명하지 않는다.

### 응답·검수와 회계 경계

엔진 담당 응답은 각 묶음에 **현재 공급 가능한 selector/실제 producer 경로, 값의 의미, 미지원 항목**을 적어 주면 된다. 신규 엔진 구현 방식·저장 버전·스케줄러를 이 요청에서 제안하지 않는다. 장소·역할·행동을 명시적으로 지원하지 않으면 해당 조건은 false/없음으로 처리하며 렌더 fallback이 사실을 생성하지 않는다.

검수는 같은 저장 상태 재개 시 대상/작업 의미 유지, 작업 종료·취소·화물 운반 시 거짓 도구 표시 없음, 물/유효 공간 없는 시설 생략, 기존 인구·생산·이동 변경 없음이 기준이다. 이후 Render B가 실제 selector→loader→paint와 계절/줌별 before/after를 따로 증명한다. 준비 fixture의 임의 occupation/action 주입은 실제 producer 증거를 대신하지 않는다.

**우선순위:** pasture3의 공간 의미 확인 및 렌더 배치 preflight → 가능할 때3 전체 계약 구현. tools16/workers12는 실제 작업/역할 공급 전 보류. 3+16+12=31을 그대로 유지하며 일부 방향·body만 보여도 전체 완료로 계산하지 않는다. 기존 cargo40·Wave37표지4와 의미가 겹쳐도 동일 원본으로 중복 계산하지 않는다. 이 항목은 읽기 정보 요청이며 제품 구현·설치·장부 승격이 아니다.
