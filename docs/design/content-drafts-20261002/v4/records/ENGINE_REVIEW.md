# v4 정본 편집용 엔진 계약 검토

- 검토 시각: 2026-10-04. 전용 clone HEAD `5fb1aebfe735592c1424c947e88388d4ffe21742`.
- 범위: 읽기 전용 소스·문서 검토. 런타임 재현·등록·코드 수정 없음.
- 이 HEAD에는 요청한 A 및 v3.1 디렉터리가 아직 없다. 유입 뒤 A 계약과 재대조해야 한다.
- 경로는 `/Users/rexxa/fls-astra-canon/` 기준.

## 병합 결정에 바로 쓸 근거

| 항목 | 현재 지원 및 결정 기준 | 소스 |
|---|---|---|
| 넓은 발생 창 | `years.fromYear/toYear` 양끝 포함. 실제 역사적 단발 사건이 아니라면 B 창 확대를 그대로 표현 가능. | `src/content/registry/registryTypes.ts:68`, `src/engine/registry.ts:349` |
| 세율 범위 | `all` + `market.duesPermille gte/lte` 지원. 단위는 통상 좌판세 대비 ‰이며 세율 설정은 정수 250~2000. 같은 값 설정은 거절되므로 각 선택 requires에 `ne` 필요하거나 남은 유효 선택 2개인지 확인. | `registryTypes.ts:17,24,27`, `src/engine/registry.ts:126,157`, `src/engine/townAgency.ts:94` |
| 소송 상시 후보 | 연도 창을 1300~1450으로 넓히는 것은 지원. 절차 단계 조건을 지우면 안 됨: 증거 제출은 filed/evidence만, 집행은 enforcing만. | `src/engine/estateSuits.ts:86,142` |
| open_suit의 범위 | bind는 closed/judged 제외; 전역 suit.open 카운트는 closed만 제외. 다만 판결 후 실행 대상은 enforcing이라 현행 ck_evt_038은 맞음. judged를 집행 단계 이름으로 만들지 말 것. | `src/engine/registry.ts:144,184`, `src/content/registry/draftEvents.ts:63`, `src/engine/estateSuits.ts:137` |
| 직접 감독 | `set_estate_oversight(mode=direct)` 지원. pending_audit로 묶으면 estateId를 자동 추출한다. 단, 직접 감독 대상만 선택하는 bind나 대상 감독 방식 read field는 없음. 전역 estates.direct>=1은 묶인 영지가 direct라는 증거가 아님. | `src/engine/registry.ts:140,179,194`, `src/content/registry/registryTypes.ts:11,34,44` |
| 직접 감독 감사 | 엔진 michaelmas는 보유 원격 영지의 oversight 전체를 순회하며 direct를 제외하지 않음. 감사 레코드는 실제 존재 가능. 하지만 registry는 bound oversight.mode·revealedErrors·auditMode를 읽을 수 없어서 '직접 감독 중인 영지의 수납 담당자 오류'를 구별할 어댑터 필요. 감사 command가 존재한다는 것만으로 B의 별도 갈래를 지원한다고 하면 안 됨. | `src/engine/stewardship.ts:350`, `src/content/registry/registryTypes.ts:11` |
| 후보 비교 | 엔진 setEstateOversight는 stewardId를 받을 수 있지만 registry effect에는 stewardId/후보 selector가 없음. 능력/충성 또는 소작인/상인 성향 비교는 실재 데이터지만 현행 registry 등록만으로 특정 후보를 선택 못 함. | `src/engine/stewardship.ts:401`, `src/content/registry/registryTypes.ts:44` |
| 019/031/059 | 031은 현직 교체, 059는 직접→최초 위임으로 분리하라는 사용자 판정 존재. 019는 성향, 059는 자질 축. 중복이라 합치거나 ID 삭제하지 말 것. | `docs/verification/lm-e9/AMBIGUOUS.md` 사용자 판정·겹치는 초안 절, `docs/design/content-drafts-20261002/v3/CHANGES.md:13,17,23` |

## 조건·효과 계약

- 조건은 all/any/not 또는 `{field,op,value,faction?}`. 허용 op: eq, ne, gte, lte, in, has, lacks. has/lacks는 bound.evidence에만 허용. 임의 JS 식, gt/lt, arbitrary nested state field는 불가. 정확한 전체 목록: `src/content/registry/registryTypes.ts:11–31`.
- bind: none, delegated_estate, held_estate, pending_audit, open_suit, open_claim. `held_estate`는 **원격** 보유 영지이며 홈 영지 아님 (`src/engine/registry.ts:181`).
- effects: set_project_subsidy, set_market_dues, set_estate_policy, set_audit_mode, answer_audit, set_estate_oversight, add_suit_evidence, file_suit, order_timber, faction_relation, treasury, term, rights_scope, set_exception_rules, enforce_possession, none (`registryTypes.ts:38–54`).
- registry에서 혼인 협상·약속 ID·새 청원·자율 사업 후보·특정 청지기 후보 selector는 아직 없음. A의 엔진 계약이 이 확장 필드를 정의해도 현행 소스와 다르면 제안/어댑터 대기로 명시해야 한다.
- 문구는 RegistryEntry 밖의 `registryCopy.ko.ts`에 분리되어 있음. A 교환 형식에 title/body를 넣는 것은 편집 envelope일 수 있으므로 RegistryEntry 직접 등록과 구분.

## 원자성과 no-op 함정

1. `applyChoice`는 effects를 순서대로 상태 사본에 적용하고 어느 하나 null이면 전체 null: 기존 입력 상태를 커밋하지 않음 (`src/engine/registry.ts:229–238`). 복합 효과를 전부 '미지원'으로 적은 오래된 v2 제안서는 현행 사실이 아님.
2. 그러나 boundId는 **각 효과에 동일하게 전달**된다. `file_suit` 후 `add_suit_evidence`는 앞 효과가 새 소송 ID를 다음 효과에 넘기지 않으므로 일반 복합 원자성만으로는 구현되지 않음 (`registry.ts:234`, `:204–205`). 이 경우 전용 대상 전환 어댑터가 필요.
3. 일반 effect는 `next===state`를 실패로 본다. 감사 방식·감독 방식·세율·예외 규칙을 같은 값으로 재설정하는 '현상 유지'를 성공한 변화로 표현하지 말 것. 현상 유지는 `none`으로 명시. `setAuditMode`의 같은 값 거절: stewardship.ts:472; `setEstateOversight`:408.
4. `answer_audit punish/replace`는 후임이 없으면 실패한다 (`stewardship.ts:490–492`). 따라서 단순 pending audit만으로 유효 선택 2개를 보장 못함.
5. 유효 선택이 2개 미만이면 카드 안 나옴 (`registry.ts:395–396`). 답할 때 bind와 entry conditions 재검사 (`:425`); choice requires도 적용 당시 재검사 (`:231`).
6. faction_relation은 여기서는 faction 존재만 검사하고 상태 그대로 반환하며 history/ledger 경로가 관계 변화를 읽는 설계다 (`registry.ts:207–209`). 일반 엔진 직접 mutation 효과와 혼동 금지.

## JSON Schema와 검증 한계

- 현행 runtime registry의 기준은 TypeScript `RegistryEntry` (`registryTypes.ts:63–88`)와 `entryProblem/registryLoad` (`registry.ts:58–88`). 이 함수는 field/command allowlist, 창 역전, choice 중복, 일부 수치만 검사하고 parameter별 exhaustive JSON Schema가 아님.
- 발견된 `docs/design/content-drafts-20261002/v2/registry.schema.json`은 title에 **proposal v2 (not implemented)**, implementationStatus=proposal_only이며 현행 runtime과 필드가 다르다. v4에 이 스키마를 억지 적용하지 말 것.
- `docs/design/content-drafts-20261002/v3/events-v3.schema.json`은 최대 number=60인 편집 초안 스키마이며 현행 registry shape와 다름.
- A가 들어오면 A의 공식 교환 스키마를 우선 사용. 없다면 A 구조를 엄격히 기술한 v4 편집 교환 스키마를 동봉하고 '자체 교환 스키마 통과'와 '엔진 등록 검증 통과'를 반드시 구분해야 함. 허용되지 않는 필드를 조용히 runtime 스키마 allowlist에 추가해 통과 처리하면 안 됨.
- 정적 검증은 200개 ID 유일성·키 형식·조건/선택의 일관성까지. 발생 분포, 선택 적용, 저장 복원은 미실행으로 보고.

## 원문 보고의 오래된 상태

`docs/verification/lm-e9/REPORT.md`는 신규 11개만 등록, 나머지 24개 보류, 125년 seed 1 신규 2건만 발생한 실패를 보고한다. 이를 200개 정본의 현재 등록 상태로 오인하지 말 것. 새 A 계약은 소스 HEAD와 함께 별도 재평가해야 한다.

## 탐색 기록

기존 galeocerdo 그래프 1회 사용. 해당 그래프는 현행 registry를 못 찾았으므로 전용 clone의 명시된 문서 및 실제 source로 검증했다. graft 출력 추정 절감 17,060 tokens (1 call), 금액 미표시.

## A 도착 후 추가 검토 및 정정 (HEAD 7e0c93c34b1c6e090716f88ed7337a33cf5400f2)

앞의 'A/B 미도착'은 첫 검토 시점 기록이다. 현재 A 계약을 읽었으며, 아래 내용이 앞 단정보다 우선한다.

### 가장 중요한 구조 구분

A `events.json`은 **200개 편집 원고 배열**이다. 필드: number/id/category/period/years/conditions/sender/title/body/choices/recurrence/illustration/history/integration/newEffectLinks/contentClass/choiceDepthNote. RegistryEntry 직접 형식이 아니다.

A `registry.json`이 별도 실행 중간명세다. status=`proposal_only_not_runtime_registry`, bindingAdapterStatus=`not_installed`, 모든 entry.enabledInEngine=false. 따라서 v4는 A의 편집 원고 모양을 유지하고, 변경한 창·조건·선택이 sidecar와 어떻게 동기화되는지 별도로 명시하는 것이 맞다. 가공 AST가 있다는 이유로 엔진 형식이라 주장하면 안 된다.

- `READ_MODEL.json`: status=`merged_candidate_spec_not_runtime`. 기존 순수 engineCalls와 새 derived 계산 명세를 구분한다. derived 각 runtimeImplementation은 not_installed. `compare`, `call`, `derived`, lexical bindings는 기존 RegistryCondition과 다르다.
- `COMMAND_CONTRACT.json:4`: 기존 GameCommand 이름·필드 계약이지 runtime 검증이 아니다. 혼인/약속/후견 명령은 게임 명령으로 존재하더라도 현행 RegistryEffect allowlist에는 없을 수 있다. `forbiddenPayload`에 따라 초안 효과의 예측 결과 parameters를 명령 인자로 그대로 펼치면 안 된다.
- `ADAPTER_CONTRACTS.json`: status=not_installed. 중앙 dedup 13종, 선택별 optional binding, defaults, missing→block, minimumEnabledConsequentialChoices=2 모두 어댑터 계약이다. runtime의 단순 enabledChoices>=2는 no_op도 세므로 실질 선택 2개 보장과 다르다.
- `EDITORIAL_CONTRACTS_R05.json:3–5,172`: 편집 답변은 정리됐으나 engineEnabling=false/runtimeVerified=false. 011 의무 증가 비교, 049 장려금 안전성, 057 교회/시장 공간 필터·새 청원 수명주기, 058 시장 selector·새 청원 수명주기는 구현 대기다. 옛 unsupportedFilters ID는 호환 키이며, 새 의미 계약을 가리켜도 block을 유지한다.
- `KNOWN_DEBT.md`: 020 최소 실질선택 2개 문제, 135 재판 외 중재 모델, 166 급류/다리 맥락, 181 후견재산 수선·대여 모델 차단 유지. 161 사업 필요 adapter도 미구현이다.

### 원자성 단정 정정 — 중요

앞 절의 '복합 효과는 원자적'은 **실패가 null로 전달되는 경우에만** 참이다. 일반 보장은 없다. 실제 `setProjectSubsidy`는 거절 시 lastRefusal을 넣은 **새 상태 참조**를 반환한다 (`src/engine/townAgency.ts:88`). `applyEffect`의 changed 검사는 이를 성공으로 판단한다 (`src/engine/registry.ts:193`). 따라서 첫 장려금 성공 뒤 두 번째 거절이 와도 첫 효과가 남고 선택 전체가 성공으로 처리될 수 있다.

A `ENGINE_SUPPORT.json:216`은 이 결함과 `004/c`, `030/divide`, `049/share` 차단을 명시한다. 문서는 HEAD5fb1aeb의 DGX 합성 재현(4사례·8검사,15d 한도에서7+9)의 성공 결과를 보고하지만, 참조 `../records/registry-atomic-executed/result.json`은 이번 checkout 위치에서 발견되지 않았다. 이번 검토는 소스에서 결함 경로를 확인했으며 DGX 재현은 **A 문서가 보고한 결과**로만 인용한다. 현재 turn에 런타임 재실행하지 않았다.

원고의 장려금 금액·전제조건을 바꾸어도 이 차단을 자동 해제하지 말 것. 실행 전후 조건, 명시적 command 실패 전달과 rollback 검증이 필요하다.

### A의 Schema 위치와 적용 범위

`content/validation/`에는 `pre-final-cumulative.json` 검증 결과 하나만 있다. 스키마는 다음에 있다.

1. `content/originals/baseline/events-expansion.schema.json`: 편집 원고용 array 스키마, number 최대200. A 및 v4 편집 원고 스키마의 출발점으로 적합하다. v4 구조 확장 시 변경 내용을 문서화하고 기존 조건을 느슨하게 풀어 무조건 통과시키지 말 것.
2. `content/originals/baseline/registry-normalized.schema.json`: 제목 `Structured registry intermediate, not engine runtime schema`, status는 proposal_only_not_runtime_registry, enabledInEngine은 false 강제. 따라서 이 스키마 통과는 engine loader 통과가 아니다.

`content/VALIDATION.json`은 R05_NARROW_CHECKS_ONLY, eventCount200, runtimeEnabled0, fullEngineRevalidation=false. 과거 검증을 v4 전체 검증으로 승계하지 말고 새 정본에 직접 schema 검증을 실행해야 한다.
