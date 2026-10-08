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

## 추가 넘김: 상신 규칙은 바뀌지만 결정 target이 비어 있음

Node v25.8.2, Mac, 소스 HEAD a04f1e2023c2a6ac004308f303290b9f75767c37에서 기존 delegated fixture 구성으로 실제 reducer 응답을 대조했다. 디버거 연결·장기 실행·코어 수정 없이 실행했으며 종료 0이다. 가설은 ① 무효/무변화 명령 ② 규칙은 변경되지만 target 누락 ③ 세력 기억이 대신 연결함으로 구분했다.

| 실제 답 | 변경 뒤 규칙 | 같은 10d 권리 청원의 exceptionMatch | 실제 결정 무게 | changedTargets / 결정 targets / 연결 기억 / 즉시 인과 읽기 행 |
|---|---|---|---|---|
| 061:b | 금액40·권리true·혼인true·되풀이true | null→rights | land, rights | 모두 빈 배열 |
| 077:a | 금액80·권리true·혼인true·되풀이true | null→rights | rights | 모두 빈 배열 |
| 130:a | 금액100·권리true·혼인false·되풀이false | null→rights | land | 모두 빈 배열 |

세 경우 모두 원래 규칙은 금액100·권리false·혼인false이고 occurrence는 answered가 된다. 결정 기록 자체는 존재한다. 따라서 **무의미한 선택이나 기록 전체 부재가 아니라, 실제 상신 행동에 영향을 주는 규칙 변경의 target 공백**이다. ③ 즉시 세력 기억으로 메워진다는 가설도 이 fixture에서는 성립하지 않았다. 실제 미래 청원을 생성하거나 철을 진행하지 않았으므로 “미래의 모든 because 연결이 없다”는 결론은 내리지 않는다.

근거: src/engine/stewardship.ts:429는 실제 rules를 갱신하며 :252의 exceptionMatch가 권리·혼인·금액 상신을 정한다. src/engine/decisionTrace.ts:58의 changedTargets는 :89~95에서 감독 mode·stewardId·auditMode와 감사 변화를 비교하지만 rules는 비교하지 않는다. :302의 linkMemories도 이번 실행에서는 보완 target을 만들지 않았다.

엔진 담당 요청: 이 의미 있는 권리·상신 결정의 target과, 그 방침 때문에 뒤에 올라온 청원의 인과 연결 계약을 정한다. 기존 권리 무게를 낮추거나 소식으로 전환할 근거가 아니다. 아래 즉시 상태 재현을 회귀 기준으로 삼고, 후속 청원 발생·연결은 별도의 실제 실행으로 검증한다. 코어 소유권 때문에 이 문서에서는 수정하지 않는다.

다음 명령은 기존 tests/engineBBatch1Answers.test.ts의 delegated 구성을 재사용한 독립 대조다. 세계 틱을 진행하지 않는다.

```sh
node --import tsx --input-type=module <<'JS'
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decodeSave} from './src/save/saveCodec.ts';
import {initialAgency} from './src/engine/townAgency.ts';
import {estatesOf} from './src/engine/estates.ts';
import {EMPTY_STEWARDSHIP,exceptionMatch} from './src/engine/stewardship.ts';
import {bindEntry,boundIdentities,v4Entry,v4EnabledChoices} from './src/engine/registryV4.ts';
import {initialRegistry} from './src/engine/registry.ts';
import {weighOffer} from './src/engine/decisionLayer.ts';
import {changedTargets} from './src/engine/decisionTrace.ts';
import {traceInRange} from './src/engine/decisionReads.ts';
import {gameReducer} from './src/state/gameStore.ts';
const base=decodeSave(new Uint8Array(readFileSync('fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
const house=base.houses.find(h=>h.residents>0), person=base.persons.people.find(p=>p.alive);
assert.ok(house&&person);
const estates=estatesOf(base), original=estates.estates[0];assert.ok(original);
const estate={...original,id:'delegated-estate',offMap:true,titleHolder:'lord',possessor:'lord'};
const state={...base,agency:{...initialAgency(),duesPermille:1200},persons:{people:[{...person,householdId:house.buildingId,birthYear:1280,role:'head',classBand:'merchant'}],past:[],nextOrdinal:2},
 estates:{...estates,estates:[estate],people:[{...person,id:'current',birthYear:1300,alive:true}]},
 stewardship:{...EMPTY_STEWARDSHIP,stewards:[{personId:'current',estateId:estate.id,ability:40,loyalty:40,disposition:'greedy',connection:null,since:0,kept:0,errors:0,status:'serving'}],
 oversight:[{estateId:estate.id,mode:'steward',stewardId:'current',auditMode:'accounts',tenants:0,merchants:0,undetected:0,since:0}],rules:{amountAtLeast:100,rights:false,marriage:false},
 petitions:[{id:'small-right',estateId:estate.id,kind:'common_dispute',group:'tenants',amount:10,rights:true,marriage:false,tick:1,deadline:20,status:'granted',decidedBy:'steward'}]},trace:{decisions:[],acts:[]}};
for(const [id,choiceId] of [['ck_evt_061','b'],['ck_evt_077','a'],['ck_evt_130','a']]) {
 const entry=v4Entry(id),bound=bindEntry(state,entry);
 if(!bound){console.log(JSON.stringify({id,status:'fixture_not_bound',staticCommands:entry.choices.find(c=>c.id===choiceId)?.commands}));continue;}
 const offer={id:'rules:'+id,entryId:id,source:'v4',boundId:'',bound:boundIdentities(bound),offeredTick:state.tick,deadline:state.tick+1000,status:'offered',receipt:{draw:0,chancePermille:1000,conditions:[]}};
 const weighing=weighOffer(state,offer);assert.ok(weighing);
 const before={...state,registry:{...initialRegistry(),occurrences:[{...offer,weights:weighing.weights}]}};
 assert.ok(v4EnabledChoices(before,entry,bound).includes(choiceId));
 const after=gameReducer(before,{type:'answer_registry_offer',occurrenceId:offer.id,choiceId});
 const decision=after.trace.decisions.find(d=>d.source===`registry:${id}:${choiceId}`);assert.ok(decision);
 assert.notDeepEqual(after.stewardship.rules,before.stewardship.rules);
 const memories=after.factions.factions.flatMap(f=>f.memory.filter(m=>m.decisionId===decision.id).map(m=>({faction:f.id,...m})));
 console.log(JSON.stringify({id,choiceId,commands:entry.choices.find(c=>c.id===choiceId).commands,status:after.registry.occurrences[0].status,beforeRules:before.stewardship.rules,afterRules:after.stewardship.rules,exceptionBefore:exceptionMatch(before.stewardship.rules,{amount:10,rights:true,marriage:false}),exceptionAfter:exceptionMatch(after.stewardship.rules,{amount:10,rights:true,marriage:false}),changedTargets:changedTargets(before,after),decision,linkedMemories:memories,readModelRows:traceInRange(after,after.tick,after.tick+1).filter(r=>r.decisionId===decision.id)}));
}
JS
```
