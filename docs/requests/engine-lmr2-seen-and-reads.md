# 엔진 요청 — LM-R2 화면이 쓸 것 (렌더 A, 2026-10-06)

LM-R2(협상·약속 장부·영지 포트폴리오·소송·혼인 진행) 화면은 모두 새로 만든다. 화면이 엔진 규칙을 베끼지 않도록, 그리고 사용자 요청(2026-10-06)대로 이야기 칩의 "봤음"을 저장하도록 엔진에 넷을 요청한다. 렌더는 엔진 파일을 고치지 않는다.

## 1. 이야기 "봤음" 기록 (사용자 요청 — QA-032 장 결산 `mark_chapter_page_seen`과 같은 종류)
지금 칩·카드의 "봤음·열림·닫음"은 화면 메모리에만 있어(`src/ui/hud/useStoryPresentation.ts` 의 ref 넷) 저장을 불러오면 칩이 다시 뜨고, 시간을 다시 멈추고, 홈 청원·등록기 카드가 다시 스스로 열린다(EVENT-ART 보고서 6절).
- 상태: `GameState.seen?: { readonly marks: readonly { readonly id: string; readonly tick: number; readonly opened?: true; readonly dismissed?: true }[] }` — 첫 표시 전엔 없음. 모든 모드(칩은 어느 모드에나 있다). `id`는 화면의 이야기 id(불투명 문자열, ≤ 128자: `lord-moment:<기록 id>`, `registry:<발생 id>`, `home-petition:<청원 id>`, `petition:<id>`, `fire:<기록 id>`, `wet:<계절 번호>` 등).
- 명령: `{ type: "mark_story_seen", id, how: "seen" | "opened" | "dismissed" }` → `markStorySeen(state, id, how)`. 없으면 지금 틱으로 만들고, opened·dismissed는 그 표시를 더한다. 같은 표시를 다시 하면 **같은 상태 객체**를 돌려준다(`markChapterPageSeen`처럼). 결정이 아니다(`DECISION_KIND_BY_COMMAND` 밖, 기록 원장 줄 없음). 모르는 `how`는 무시.
- 읽기: `storySeen(state, id)`.
- 크기 한도: 쓸 때마다 `tick < state.tick − 8,000`(두 해; 이야기는 길어야 네 계절) 표시를 버리고 256개까지(오래된 것부터).
- 저장 v50(`v49ToV50`은 판만 올림 — v49 저장엔 표시가 없어 불러온 뒤 한 번 더 뜰 수 있음, 지금과 같음). 장 결산의 `seenTick`은 그대로.
- 결정성: 화면만 보낸다. 봇·하네스는 보내지 않고 규칙은 `seen`을 읽지 않는다 — seed 결과는 그대로.
- 렌더가 이어서: 칩이 처음 보이면 "seen"(멈춤은 그때만), 카드가 스스로 열리면 "opened", ×는 "dismissed"; 표시가 있으면 멈추지 않고, opened면 다시 스스로 열지 않고, dismissed면 숨긴다.

## 2. 소송·약속·역제안의 할 수 있는 일과 거절 까닭 (읽기 모델, 저장 변화 없음)
화면이 `estateConfig`의 비용·가중·관계 문턱을 베끼지 않게:
- `suitActions(state, suitId)` → `{ evidence: { kind, cost, weight, refusal: "stage" | "given" | "treasury" | null }[]; patrons: { factionId, support, refusal: "stage" | "chosen" | "relation" | null }[]; enforce: { cost, force, hold, refusal: "stage" | "treasury" | null } | null; nextStageTick: number | null }`
- `keepPromiseRefusal(state, promiseId)` → `"not_open" | "not_lord" | "late" | "treasury" | null` (지금 `keepPromise`는 거절하면 상태를 그대로 돌려줄 뿐 까닭을 말하지 않는다).
- `answerCounterRefusal(state, negotiationId)` → `"late" | "treasury" | "not_countered" | null`.
- 결정 카드(유언 변경·감사·지도 밖 청원)가 답마다 결과를 보이도록, 지금 모듈 안에 있는 계산을 읽기로:
  - `estatePetitionEffect(state, petitionId, grant)` → `{ income, tenants, merchants, neglect } | null` (`petitionEffect`를 그 청원의 영지 청지기 성향으로; 열린 청원이 아니면 null).
  - `auditAnswerEffect(state, auditId, choice)` → `{ recovered, tenants, loyalty, successorId: string | null } | null` (`answerAudit`가 할 일; 받아들여지지 않을 답이면 null).
  - `willChangeRefusal(state, choice)` → `"not_due" | "treasury" | null` (호의 120d가 모자라면 "treasury").

## 3. 같은 말 (복사 표)
`src/content/historyCopy.ko.ts`의 모듈 안 표 `TIER_KO`·`TERM_KO`(jointure·debt_after_inheritance 포함)·`HOLDER_KO`·`PIECE_KO`·`CLAIM_BASIS_KO`·`SUIT_STAGE_KO`를 내보내 주면(또는 화면 쪽 사본을 허락하면) 화면과 원장이 같은 말을 쓴다.

## 4. 확인만 (코드 없음)
- (a) 혼인 "다툼(contested)"은 자기 명령이 없고 `plan.claimId`의 소송을 이기면 풀린다 — 화면은 소송 트랙으로 보낸다.
- (b) 이웃 가문이 영주에게 거는 회복 소송(ER-21)은 영주가 막을 명령이 없다 — 화면은 보여 주기만.
- (c) 협상 목적은 지금 혼인 하나이고 제안은 그 자리에서 답이 난다 — 화면은 보낸 뒤 바로 답을 보인다.

## 나중에 (LM-R2를 막지 않음)
이웃 18가문(LM-E10, 지역 지도 전체용), 지역 길 연결(실험 지역 길·건넘), 청지기 기질 셋 밖의 성향 열거(영주 부품 성향 그림 넷), 청지기 "직책"(주의력 까닭).

## 엔진 답 ① (LM-R2-E, 가지 `claude/lmr2-e`, 저장 v51)
- **이야기 "봤음"**: 요청대로다.
  - 상태 `GameState.seen?.marks`, 명령 `{ type: "mark_story_seen", id, how }`, 읽기 `storySeen(state, id)`(`src/engine/storySeen.ts`).
  - 같은 표시를 다시 하면 같은 상태 객체를 돌려준다. 모르는 `how`, 빈 id, 128자 넘는 id는 무시한다.
  - 쓸 때마다 두 해(8,000틱) 넘은 표시를 버리고 256개까지 둔다. 결정이 아니고(`DECISION_KIND_BY_COMMAND` 밖), 규칙은 읽지 않는다(시험: 300틱 동안 표시 유무와 상관없이 같은 상태).
  - **저장은 v51이다.** v50은 MANOR-1(영주관 3×3·가문 하나)이 썼다. `v50ToV51`은 판만 올린다.
- **이웃 가문 문장**: 이웃 영주 가문 이름 여덟(`NEIGHBOUR_SURNAMES`)마다 정확한 문장(blazon)을 데이터로 두었다. seed로 만들지 않는다.
  - `src/content/neighbourArms.ts`의 `neighbourArms(name)` → `{ field, ordinary?, charges?, en }`. 한국어 읽기는 `NEIGHBOUR_ARMS_KO`(`neighbourArmsCopy.ko.ts`).
  - 늙은 영주 가문(`estate-neighbour-3`의 `house.name`)을 포함해, 영지·세력의 이웃 가문 이름으로 찾는다.
  - 규약(neighbor-world SOURCES): 담비 없음(백작·왕실만), 왕실 조합 없음(붉은 바탕 금 사자, 청색 바탕 금 백합), 색과 금속의 대비. 모두 창작 도안이다.
  - 그림으로 그리는 법(조합 표)은 렌더 몫이다. 이웃 세계 16가문(LM-E10)이 들어오면 그 문장 표로 바뀐다.
- ②·③·④는 이어서 한다(사용자 지시: ① 먼저).
