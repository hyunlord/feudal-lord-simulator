# Engine B → 엔진: 비세율 답의 좌판 수입 인과 연결

판정: **083의 실제 응답과 합성 원장 단위 대조에서 오귀속 재현**. 자연 발생 후속 수입·화면 검증은 아니다. P-C3의 다른 원인을 숨기지 않는 인과 설명에 걸리는 결함이며, Engine B는 코어를 수정하지 않았다.

`ck_evt_083:a`의 실제 명령은 `order_timber(16)`뿐이다. 기존 v49 도시 fixture와 `tests/engineBBatch1Answers.test.ts:36`의 수선 청원 구성을 사용해 실제 reducer로 답하면 목재 주문은 0→16, 좌판세는 1200→1200이다. 그런데 결정 target은 `dues`와 `timber` 둘이다. 그 뒤 **합성한** 다음 틱의 좌판 수입 7d를 실제 `advanceTrace`에 주면, 해당 목재 결정에 연결된 `payment_flow/dues` because 기록이 생긴다. Mac 단위 대조 종료 0, 장기 시뮬레이션 없음.

원인은 `src/engine/decisionTrace.ts:223`~226의 사건 전체 선택 검색이다. `set_market_dues`가 다른 답에만 있어도 영주 응답에 `dues`를 붙인다. `src/engine/decisionTrace.ts:466`~480은 그 target을 이후 원장 수입에 연결한다. `ck_evt_144`·`ck_evt_150`도 비세율 답과 세율 답을 함께 가지지만, 이 두 ID는 **정적 후보만 확인**했으며 개별 실행은 하지 않았다.

엔진 담당 요청: 실제 선택한 명령을 기준으로 추가 target을 결정한다. 선택한 답 자체가 현 세율을 유지하는 세율 답일 때의 LP2-E 추적은 보존해야 한다. 사건의 다른 답에 세율 명령이 있다는 이유만으로 목재·소송 답에 좌판 수입을 붙이지 않는다. 083의 회귀와 실제 세율 유지 답을 함께 검증하고 144·150도 같은 기준으로 점검한다. 저장·분포·정본 콘텐츠 수정 요청은 아니다.

## 재현

저장소 루트에서 실행한다. 첫 단계는 실제 reducer 응답이며, 두 번째 단계에서 삽입하는 원장 항목은 재현용 합성 입력이다. trace를 비워 이전 결정과의 혼합을 제거한다.

```sh
node --import tsx --input-type=module <<'JS'
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { decodeSave } from './src/save/saveCodec.ts';
import { initialAgency } from './src/engine/townAgency.ts';
import { bindEntry, boundIdentities, v4Entry } from './src/engine/registryV4.ts';
import { initialRegistry, offerChoices } from './src/engine/registry.ts';
import { gameReducer } from './src/state/gameStore.ts';
import { advanceTrace } from './src/engine/decisionTrace.ts';
const base = decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
const house = base.houses.find(h => h.residents > 0);
const person = base.persons.people.find(p => p.alive);
assert.ok(house && person);
let state = { ...base, agency: { ...initialAgency(), duesPermille: 1200 },
  persons: { people: [{ ...person, householdId: house.buildingId, birthYear: 1280, role: 'head', classBand: 'merchant' }], past: [], nextOrdinal: 2 },
  timberOrder: 0, trace: { decisions: [], acts: [] },
  constructionSites: [{ id: 'repair', kind: 'house', tx: 1, ty: 1, required: { timber: 20 }, delivered: {}, reserved: {},
    builderTicks: 0, requiredBuilderTicks: 100, assignedBuilders: 1, stall: 'awaiting_materials', startedTick: 2, rebuildOf: house.buildingId }],
  trades: { households: [{ houseId: house.buildingId, tradeId: 'carpenter', sinceTick: 0, workshop: 'front_shop',
    productivityPermille: 1000, idleSeasons: 0, receipt: { tick: 0, reasons: [], score: 1, chancePermille: 1000, of: 1 } }],
    stock: {}, chains: {}, streets: [], haulage: { season: 0, last: 0 }, quits: [] } };
const entry = v4Entry('ck_evt_083');
const bound = bindEntry(state, entry);
assert.ok(bound);
const offer = { id: 'proof:083', entryId: entry.id, source: 'v4', boundId: '', bound: boundIdentities(bound),
  offeredTick: state.tick, deadline: state.tick + 1000, status: 'offered', receipt: { draw: 0, chancePermille: 1000, conditions: [] } };
state = { ...state, registry: { ...initialRegistry(), occurrences: [offer] } };
assert.ok(offerChoices(state, offer).includes('a'));
assert.deepEqual(entry.choices.find(c => c.id === 'a').commands, [{ type: 'order_timber', args: { amount: 16 } }]);
const answered = gameReducer(state, { type: 'answer_registry_offer', occurrenceId: offer.id, choiceId: 'a' });
const decision = answered.trace.decisions.find(d => d.source === 'registry:ck_evt_083:a');
assert.ok(decision);
assert.equal(answered.agency.duesPermille, 1200);
assert.equal(answered.timberOrder, 16);
assert.ok(decision.targets.includes('dues'));
const ledger = answered.ledger;
const syntheticPosting = { id: 'probe-stall-posting', tick: answered.tick + 1, account: 'cash', category: 'stall_fee',
  amount: 7, sourceRefs: [{ type: 'actor', id: 'market' }] };
const next = { ...answered, tick: answered.tick + 1, ledger: { ...ledger,
  entries: [...ledger.entries, syntheticPosting], nextEntryOrdinal: ledger.nextEntryOrdinal + 1 } };
const traced = advanceTrace(answered, next);
const consequence = traced.history.records.find(r => r.params?.key === 'payment_flow' && r.params?.target === 'dues'
  && r.because?.some(b => b.decisionId === decision.id));
assert.ok(consequence);
console.log(JSON.stringify({ decision, syntheticPosting, consequence }, null, 2));
JS
```

위 assertion은 현재 결함을 재현한다. 수정 뒤에는 `dues` target과 해당 because가 없음을 검증하는 회귀 시험으로 바꾼다.
