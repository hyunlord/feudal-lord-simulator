# 엔진 요청 — DEC-CARD 화면이 쓸 것 (렌더 A, 2026-10-06)

사용자가 직접 해 보고 말했다: "선택지가 무슨 의미인지, 어떤 영향인지 모르고 고른다, 결과도 안 보인다." 렌더의 DEC-CARD는 이 셋을 고친다.
1. 카드마다 쉬운 말로: 상황, 걸린 것, 선택지마다 지금과 나중에 일어날 일, 누가 기억하나.
2. 결과 소식을 칩과 연대기에 "○○년 당신의 결정 때문에"로.
3. 해가 바뀔 때 "올해 당신의 결정이 바꾼 것" 한 장(10배속에서도 놓치지 않게).
4. 작은 일은 카드로 오지 않는다. "청지기가 처리한 일" 철 보고와, 종류별 상시 방침(관습대로·가볍게·엄하게)을 영주 화면에서 정한다(게임 원칙 v0.3 P-T3·P-D5, 결정 GP-7).

엔진의 **DEC-TRACE**와 **GP7-ENGINE**에 화면이 바라는 것만 적는다. 규칙(무엇이 무겁고, 방침이 무엇을 하고, 무엇이 기억되나)은 모두 엔진이 정한다. 렌더는 엔진 파일을 고치지 않는다. 근거는 렌더 조사의 요약이다(조사 전문은 DEC-CARD 보고서에 붙인다; 아래 줄 번호는 본선 `20a0dd70`).

## 지금 상태 (렌더 조사)
- `recordDecision`(`history.ts:222`)은 `BIG_DECISION_KINDS`에만 결정 기록(예측·실제)을 남긴다. 영주 모드의 답(청지기·등록기·혼인)은 철마다 수만 센다.
- 나중 기록에서 그 결정으로 거슬러 가는 연결은 마을 영수증의 `receipt.decisionIds` 하나뿐이다. `faction.relation`의 `reason`은 글(`petition:<defId>:<answer>` 등)이고 결정 id가 아니다.
- 해가 바뀌는 고리가 없다. 철 장부 카드는 알림 모드·건너뛰기 뒤에 열리지 않는다. 10배속에서 칩은 셋까지라 밀려난다.
- 청지기는 두 번 같은 답이 쌓인 홈 청원과 위임 영지의 청원만 처리한다. 지도 밖 영지 청원의 결과(금고·호감)는 철 합계에 녹아 항목별로 남지 않는다.

## 1. 모든 카드 답이 결정 기록 (DEC-TRACE)
- `famine_response`·`petition_response`·`answer_estate_petition`·`answer_registry_offer`·`answer_will_change`·`answer_audit`·`answer_counter`·`keep_promise`·도시의 요청 들어주기마다 `kind: "decision"` 기록 하나.
  - 필드: `params.decisionKind`·`params.subjectId`(청원·발생·감사·협상·약속 id)·`params.chosen`.
  - `decision: { chosen, alternatives, predicted, actualDueTick? }`(예측이 없으면 `{}`).
- 답하지 않아 지나간 것(기한 만료)도 같은 기록으로, `chosen: "lapsed"`(침묵도 결정).
- 결과: 안정된 `decisionId`(그 기록의 id).

## 2. 나중 기록에서 결정으로 (DEC-TRACE)
- `HistoryRecord.because?: { decisionId; key: ConsequenceKey; part?: true }[]`(네 개까지).
  - `part: true`는 그 결정이 여러 원인 중 하나일 때다(P-C2 "과장 금지").
- 붙는 곳(엔진이 고름): 세력 관계 변화(그때와 나중), 기근 답에 걸린 떠남, 반란 소문, 선례·상시 방침이 처리한 것, 약속(맺음·지킴·어김), 유언 "그대로 둠" 뒤의 청구·다툼, 권리 얻음·잃음, 청지기 교체, 마을 사업 시작(지금 `receipt.decisionIds`).
- `ConsequenceKey`는 화면이 쉬운 말로 바꿀 짧은 열쇠다(예: relation, households_left, treasury_cost, promise_broken, claim_raised, precedent_applied, lapsed_as_refusal, right_lost …). 목록은 엔진이 정한다.
- `because`가 있는 기록은 접히지 않는다(HL-10). 연결은 결정 뒤 몇 해까지만 둔다(P-T6). 규칙은 이것을 읽지 않는다(seed 결과 그대로).

## 3. 읽기 모델
- `answerOutlook(state, command)` → `{ now: Row[]; later: LaterRow[]; remembers: { actor; delta }[] }`.
  - 카드의 "지금·나중·누가 기억하나"를 엔진이 직접 준다(P-D4). 지금 렌더가 하는 명령 시험 실행과 렌더 쪽 숫자 표 사본(`lordCardsModel.ts:67-82`, `petitionPresentation.ts:239-282`)을 대신한다.
  - `LaterRow = { key; tick | null; amount?; actor?; perSeason? }`.
  - 예: 떠날 수 있는 가구, 철마다 상인 기분, 실제가 적히는 날, 만료는 기각으로, 약속 기한, 반란 압력, 경쟁자의 청구.
- `traceInRange(state, fromTick, toTick)` → 결과 줄들 `{ recordId; tick; key; actor; delta; part; decisionId; decisionTick }`. 칩·연대기의 "○○년 당신의 결정 때문에"가 쓴다.
- `yearReview(state, year)` → `{ decisions: { decisionId; tick; kind; subjectId; chosen; predicted; actual | null; actualDueTick | null }[]; consequences: TraceRow[] }`. 한 해 카드가 쓴다.
- `decisionRemembers(state, decisionId)` → `{ actor; delta; tick; recordId }[]`.

## 4. 청지기와 상시 방침 (GP7-ENGINE)
- 상태: 종류별 `standing[kind]` = 관습대로(`customary`)·가볍게(`lenient`)·엄하게(`strict`)·직접(`lord`). 없으면 관습대로(P-T3 "처음부터").
  - 무거운 것(P-D5의 층: 권리·땅·혼인·상속·후견·큰 돈·여러 해 약속·세력 결렬·위기)은 방침과 상관없이 영주에게 온다.
- 처리한 항목마다: `policy`(따른 방침), `layer`(영주에게 왔다면 그 까닭), 지도 밖 영지 항목의 결과(금고·소작인·상인 호감·방치).
- 명령: `set_standing_policy { kind, setting }`(결정 기록, §1).
- 다툼 종류(경계·장터·공유지)는 "가볍게·엄하게"가 어느 편인지 엔진이 이름 붙이거나, 무거운 쪽에 둔다.
- 읽기 모델 둘:
  - `standingPolicies(state)` → 종류마다 `{ kind; family; heavy: boolean; heavyBecause; setting; answers: { customary; lenient; strict → 들어줌 여부·금고 범위·세력 변화·호감 } ; handledThisYear; last }`. 렌더가 "이 방침이면 이렇게 된다"를 숫자 사본 없이 보인다.
  - `stewardReport(state, fromTick, toTick)` → `{ handled: { petitionId; estateId; kind; policy; granted; amount; tick; treasury; relations; goodwill?; neglect? }[]; brought: { petitionId; kind; layer }[]; lapsed }`.
- 철 보고가 한 철 늦지 않게: 닫힌 철의 첫 틱을 창에 넣는다(지금 `precedentReport`는 한 철 늦음).

## 5. 한 해 카드의 "봤음"
- `mark_story_seen`(LM-R2 요청 1절)에 `year-review:<해>` id, 또는 `mark_year_review_seen(year)`(`mark_chapter_page_seen`처럼).
- 저장 판은 v51 이상(v50은 MANOR-1).
- 칩·카드를 다시 불러올 때 다시 뜨지 않게 하는 LM-R2 요청 1절과 같이 들이면 좋다.

## 렌더가 먼저 하는 것 (엔진을 기다리지 않음)
- 카드 문구를 쉬운 말로(상황·걸린 것·지금·나중). 지금 엔진이 노출한 기한·만료의 뜻·예측을 쓰고, 누가 기억하나는 `recordDecision` 시험 실행이 덧붙이는 세력 기록으로.
- 큰 결정의 "실제가 적혔다" 칩, 한 해 카드 첫 판(그해 결정 기록·실제·세력 변화). §1~§5가 들어오면 그 자리를 읽기 모델로 바꾼다.

## 엔진 답 (DEC-TRACE, 2026-10-06)
설계는 [dec-trace.md](../design/dec-trace.md), 결정은 DTR-1~10, 저장은 v52다. 영주 모드에서만 동작한다.

- **§1 결정 기록**:
  - 영주 모드의 카드 답은 명령 하나에 기록 하나다(`decision.card`; `params.decisionKind`·`command`·`subjectId`·`chosen`, `decision.alternatives`).
  - 큰 다섯은 지금처럼 `decision.<kind>`다.
  - 청지기의 답은 `decision.steward`(`params.policy`), 기한이 지난 것은 `decision.lapsed`(`chosen: "lapsed"`)다.
  - 결정 id는 그 기록의 id다. `trace.decisions[].id`도 같다.
- **§2 나중 기록에서 결정으로**:
  - `HistoryRecord.because?: { decisionId; key; part? }[]`(넷까지, 주원인 먼저)다.
  - 열쇠(`CONSEQUENCE_KEYS`): `faction_act`, `households_left`, `households_arrived`, `suit_turned`, `marriage_turned`, `promise_made`, `promise_kept`, `promise_broken`, `project_started`, `goods_delivered`, `audit`, `estate_mood`, `right_income`, `crisis_prepared`, `crisis_outcome`.
  - 결정이 그 자리에서 움직인 세력 마음은 기록 대신 세력 기억(`FactionMemory.decisionId`)에 붙는다. `traceInRange`가 `key: "relation"`으로 함께 준다.
  - `because`가 있는 기록은 접히지 않는다.
- **§3 읽기 모델**:
  - `answerOutlook(state, command)`(`src/state/decisionOutlook.ts`): `{ now, later, remembers }`. 명령을 사본에 돌린다.
  - `traceInRange(state, from, to)` → `{ recordId, tick, key, actor, delta, part, decisionId, decisionTick }`.
  - `yearReview(state, year)` → `{ house, decisions, consequences }`. `house`는 가문의 큰 변화(상속·혼인 상속 등)로 맨 앞에 둘 것이다.
  - `decisionRemembers(state, decisionId)`.
  - 모두 `src/engine/decisionReads.ts`에 있다.
- **§4 청지기와 상시 방침**:
  - 상태는 `stewardship.standing[kind]`다. 값은 `customary`·`lenient`·`strict`·`lord`이고, 없으면 관습대로다.
  - 명령은 `set_standing_policy { kind, setting }`이고 결정으로 기록된다.
  - 종류: 장원 청원 12종, 지도 밖 영지 청원 6종, 사건은 `sender:<세력>`.
  - `standingPolicies(state)`: 종류마다 `{ kind, family, heavy, heavyBecause, setting, answers{customary,lenient,strict → granted, treasury, factions}, handledThisYear, last }`.
  - `stewardReport(state, from, to)`: `{ handled[petitionId, estateId, kind, policy, granted, amount, tick, treasury, relations], events[청지기가 답한 사건], brought[subjectId, kind, layer], lapsed }`.
  - 철 창은 `[from, to)`로 주면 닫힌 철의 첫 틱이 들어간다.
  - 다툼 종류의 편: 가볍게 = 청원한 쪽(소작인·공동체), 엄하게 = 영주 금고·권리 쪽. 관습 답은 `HOME_PETITION_CUSTOM`(데이터)이다.
- **§5 한 해 카드의 "봤음"**: `mark_story_seen`에 `year-review:<해>` id를 그대로 쓰면 된다(`storySeen`은 아무 id나 받는다).
- **함께 넣은 것**:
  - 금고 내역 `treasuryBreakdown(state, from, to)`(`src/engine/treasuryReads.ts`).
  - 그 철에 정산이 있었는지 `settlementIn(start, end)`(`src/ledger/ledger.ts`).
  - 위기 `crisisReview(state)`(`src/engine/crisisReads.ts`).
  - 상속 기록 `house.succession`.
- **렌더가 넘겨받을 것**:
  - 장원 청원이 이제 기본적으로 청지기 몫이다. 홈 청원 카드 시험은 "영주에게" 방침으로 카드를 띄운다(`tests/lmr1Petitions.test.ts`의 준비만 바꿈).
  - 선례 그림·문구(`precedentView`)는 상시 방침 화면으로 바꿀 것이다. `precedentReport`는 방침으로 답한 것도 준다.
  - 시장 칙허가 열린 촌락의 건설 메뉴 잠금 표시(`eraLockReason`, `buildMenuGroups`)와 칙허 카드 문구.
  - 사건 그림 40장. 꺼진 31장의 설치 표시와 프롬프트 파일은 엔진이 예외로 거두었다.
