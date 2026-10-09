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

## 단일 seed 1 대조군의 실제 후속 연결 공백 — 2026-10-09

근거는 [보관 원자료](../verification/eb-weight/control-de3d9e2/seed-1.json.gz)와 [출처 기록](../verification/eb-weight/control-de3d9e2/provenance.json)이다. sourceRevision은 `de3d9e224636c5e69bc18e2ea7ccb7d7bd97c69d`, dirtyPaths는 비어 있다. 압축 해제 JSON SHA256은 `ad340b87763c4a44975b536fd2786df5b343e6d128581e1bb42bef174a9c9a69`, gzip SHA256은 `b64c4f698a9893f8a9e331ee0ef992da9a77b21b5c04c8f69ab0125575d47266`이며 둘 다 다시 계산했다. 이는 TRACE-KEEP 이전 seed 1 하나의 1300~1424년 대조군(끝 tick 500000)이다. 최신 소스의 seeds 1/2/3 검증 결과가 아니다.

아래 9개 결정은 각각 `decision.tick < history.tick <= decision.tick + 12000`(3년)에서 해당 decisionId를 because에 담은 기록이 0개임을 원자료로 재계산했다. 이 지표는 실제 효과가 없다는 뜻이 아니다. 현재 `src/engine/decisionTrace.ts:36`의 인과 선택 범위는 여전히 3년이며, TRACE-KEEP의 큰 결정 영구 보존·작은 결정 10년 보존(:38·:548)은 이 선택 정책을 바꾸지 않는다.

### 038: 성공한 집행 뒤의 오래된 선택지라는 판정은 철회

`h-002358@36037`은 `ck_evt_038:defer`, target `suit:suit-2`이며 occurrence에 `claim-2` 약화 5가 기록되어 있다. 직전 같은 tick의 `h-002356`은 `enforce_possession` **시도** 기록이다. 성공 기록으로 읽을 수 없다. 같은 소송의 추가 시도가 `h-002497@38455`, `h-002503@38533`에 실제 존재하며, `h-002561@39000`의 suit_rent 187은 h-002356을 원인으로 가리킨다. 최종 합쳐진 h-002356 trace의 `lastTick=38533`과 rent target도 tick 36037 당시 성공을 증명하지 않는다. 원자료에는 그 순간의 전체 소송 상태가 없어 최초 시도의 성공/실패를 직접 복원하지 못한다.

소스 `src/engine/estateSuits.ts:242`는 집행 저항을 넘지 못하면 enforcing 단계에 남고, 성공한 경우에만 closed로 바꾼다. `src/engine/registry.ts:505`는 답변 시 현재 상태로 다시 bind하고, `registryV4.ts:302`, :359에서 조건·선택 가능성을 검사한다. canonical `docs/design/content-drafts-20261002/v4.2/registry-v4.2.json:5222`의 038은 집행 대기 조건을 가지며 defer의 빈 commands는 `registryV4.ts:185`의 hold 처리로 이어진다.

별도 제한 fixture 대조(기존 `fixtures/saves/v49/chapter-two-town.save.json`, enforcing 소송의 저항만 100/0으로 구성; 자연 실행 재현 아님)에서는 실제 enforcePossession 후 저항 100은 enforcing/enforced=false, 재바인딩 가능, defer answered·약화 5였다. 저항 0은 closed/enforced=true, 바인딩 null·가능 선택 없음, defer invalid·hold 없음이었다. 따라서 성공 후 선택지를 무효화하는 어댑터 동작은 확인됐고, 이 자료로 stale binding 수정은 정당화되지 않는다. 콘텐츠/엔진 담당에는 **판결 뒤 claim 약화가 이후 소송에 어떤 효과와 읽을 수 있는 연결을 남겨야 하는지** 확인을 요청한다.

### 140: 감사는 발생했지만 해당 결정이 원인 목록에 없다

`ck_evt_140:b`인 `h-007606@117001`의 target은 `estate:estate-neighbour-3`다. 다음 세 감사가 같은 target에서 실제 발생했다.

| 감사 ID@tick | 관측 결과 | 실제 because decisionId 4개 |
| --- | --- | --- |
| h-007676@118320 | revealed 0, clean | h-006655, h-006890, h-006941, h-007020 |
| h-007909@122320 | revealed 0, clean | h-006655, h-006890, h-007216, h-007405 |
| h-008117@126320 | revealed 92, pending | h-006655, h-006890, h-007461, h-007600 |

모두 h-007606보다 앞선 결정 4개를 가리키며 h-007606은 빠졌다. `src/engine/decisionTrace.ts:339`는 살아 있는 target 결정을 기존 순서로 고르고, :344의 becauseOf는 앞 4개만 남긴다(`BECAUSE_MAX`, :44). 이는 오래된 원인으로 목록이 차는 설명과 일치하지만, 원인 선택을 바꾼 대조 실행으로 확정한 원인은 아니다. 엔진 담당에는 감사 효과를 유지하면서 이 결정이 누락되는 선택·병합 경로와 원인 상한을 검증하도록 요청한다. ‘감사가 없었다’, ‘선택이 무효과였다’로 분류하지 않는다.

### 092/211: 늦은 7개 결정의 후속 dues 기록 자체가 보관 자료에 없다

| 선택 | 결정 ID@tick |
| --- | --- |
| ck_evt_092:a | h-022834@350065 |
| ck_evt_211:a | h-024261@373075 |
| ck_evt_211:c | h-024777@382045 |
| ck_evt_211:b | h-026011@401077 |
| ck_evt_211:b | h-027319@420031 |
| ck_evt_092:a | h-027390@421045 |
| ck_evt_211:b | h-028626@440077 |

각 3년 창에는 해당 결정의 because 연결뿐 아니라 `params.target === 'dues'`인 history가 어느 원인으로도 없다. 보관 history의 마지막 dues 결과는 `h-020166@309600`(stall_fee income 23, expense 0, because h-020165)이다. 원자료는 전체 ledger·매 tick 전체 상태를 보관하지 않았으므로 **이후 수수료가 없었다거나 방침이 무효과였다는 증거는 아니다**. `src/engine/decisionTrace.ts:466` 이후 수입 추적은 살아 있는 각 결정을 순회하므로 ‘새 답변이 이전 원인을 덮었다’만으로 설명해서도 안 된다. 엔진 담당에는 해당 구간 ledger와 dues 결과 생성 조건을 함께 남기는 제한 재현을 요청한다. 3년 이후 지속 방침의 연결 정책도 별도 판단 사항이다.

이 인계는 위 단일 대조군의 실제 연결 공백을 기록한다. 코어·canonical 변경이나 소식 등급 전환을 포함하지 않으며, 권리·지속 세율 결정의 무게를 낮출 근거로 사용하지 않는다.

### TRACE-KEEP 통합 후 최신125년 seed1 재확인

깨끗한2485af400의 실제125년 첫 판에서 위9건의 결정 ID·시각·선택과 엄격한3년 창 후속0이 모두 동일했다. [원본·독립 재계산](../verification/eb-weight/kept-2485af4/verification.md), raw SHA-256 `3cf11889398f36ac8dc8c0230dc509d5e46cbaa8abdcd1f568d7a0744600dbfd`. TRACE-KEEP 보존 정책 통합으로 이9공백이 해소됐다는 주장은 하지 않는다. seed2·3 합산은 아직 미완료다.

### 실제 답변별 추가 집계

[seed1 답변 감사](../verification/eb-weight/kept-2485af4/registry-answers.md)는 root38과 실제 영주 답변45를 구분한다. 성숙 답변의 직접 연결은26/42다.038의8답변 중 뒤의7개는 앞선 root에 합쳐지는 후보가 하나씩 있지만, 자체 answer ID를 because로 가리키는 후속은0/8이다. enforce2개만 해당 답변 이후의 root 결과 후보가 있다. 최종 alias는 정식 occurrence 멤버십이 아니므로 간접 연결을 직접 성공으로 합산하지 않는다. 엔진에는 각 후속 답변을 원래 root와 이어 표시할 수 있는 읽기 계약과 원인 귀속을 검토 요청한다. B가 코어 trace 형식이나 저장 계약을 바꾸지 않았다.

### seed2의 추가 공백046·209

[근거](../verification/eb-weight/kept-2485af4/seed2-trace-gaps.md):046 cancel h-007126@98047은 실제 주문 취소이며 이후 배송은 별도 재주문 h-007263@100855에 연결된다. 취소를 배송 원인으로 만들지 않는다.209 d h-007455@103039는 commons−2 hold와 faction target이 기록되지만 이후 세력 행동은 문턱·쿨다운 조건부다. 정확히 어느 조건이 막혔는지는 경계 상태가 없어 미확정이다. 두 답변 모두 성숙한 미래 연결0이며, 어댑터 결함은 입증되지 않았다. 취소의 즉시 완결 및 조건부 관계 결과를 사용자에게 보여 주는 엔진 읽기 계약이 필요하다.

### 세 판 완료: 전체 예산 초과와 seed3의 오래된 원인 귀속 위험

[seed3 원본 대조](../verification/eb-weight/kept-2485af4/seed3-trace-gaps.md), [정확한 ID·명령·후속 기록](../verification/eb-weight/kept-2485af4/seed3-trace-gaps.json.gz).1349년에 중대 root5건(임금·211a·토지 재분배·감사·영지 수리)이 응답됐다. 등록기1건 외4건은 등록 제시 시점의 rolling heavyLoad 관문 밖에서 들어온다. 실제 전체 답변 수 누락과 무관하게 P-T1 초과가 확인됐으며 엔진 전체 결정 유입 예산의 검토가 필요하다. B는 무게·조건을 낮추지 않는다.

seed3 성숙 등록 root14건의 엄격한3년 후속이 없다(관계 hold8, 세율 변경6). 추가로083c h-018126@367069는800을 설정했지만449000–453000의10개 dues_held:1100:1000 기록이 이를 원인으로 가리킨다. 중간의 실제1100 설정 h-020065@407083은 무게 없는 root이며, source의40000tick 보존 경계와 duesMind의 최신 **남아 있는** dues target 선택이 맞물리는 설명과 일치한다. 정확한 prune 경계 상태는 재현하지 않았으므로 그 전환은 소스에 부합하는 추론으로 남긴다. 엔진에는 현재 세율을 실제 설정한 결정의 소유권을 오래된 보존 root와 혼동하지 않는 읽기/원인 계약을 요청한다. 늦은10개를083의3년 성과나 인과 증명으로 세지 않는다.

### 무효 답변 시도의 기록·trace 불일치 — 세 판 원자료 확인

[원자료 진단](../verification/eb-weight/invalid-attempts/report.md), [정확한 occurrence·동일 tick 명령·history·trace](../verification/eb-weight/invalid-attempts/evidence.json.gz), [SHA·출처](../verification/eb-weight/invalid-attempts/provenance.json). 전체 invalid는 seed1 1건(051), seed2 2건(053·010), seed3 2건(059·010)이다. 010·051·059의 합계4회 제시는 모두 invalid이며 성공한 답변은0이다. 따라서 이 세 ID를 **성공 답변의 UI 캡처 누락**으로 분류하지 않는다. 다만 무효 시도에도 `decision.card` history가 남으므로 기록 자체가 없다고 해석해서도 안 된다.

010·051의 세 사례는 동일 tick에서 해당 bound claim의 `file_suit` 기록이 registry 답변 시도보다 먼저 있다. `estateSuits.ts:100`은 claim을 open에서 suing으로 바꾸므로 open 청구를 요구하는 재바인딩을 막기에 충분하다. 059도 같은 영지에 대한 `set_estate_oversight(steward)` h-002125가 시도 h-002131보다 먼저 있어 direct 조건과 충돌한다. `lordBot.ts:60`은 한 상태에서 명령 목록을 만들고 소송·청지기 명령 뒤에 registry 답변을 넣으며, 실행기는 이를 순서대로 적용한다. 이는 **실제 선행 명령 기록과 소스로 확인한 충분한 차단 조건**이다. 명령 직전 상태를 재현하거나 최초 실패 predicate를 직접 관측한 것은 아니며, 어댑터 바인딩 결함을 입증하지 않는다. 053의 정확한 재검사 실패는 아래 원본 장부 후속 확인으로 해결했다.

별도 엔진 검토점: invalid5건 모두 시도 선택지를 담은 history card가 있으나 자체 answer trace와 이를 가리키는 후속 because는0이다. `history.ts:255,278`의 `recordDecision`은 invalid 상태 변경도 변경된 상태로 받아 card를 쓰지만, `decisionTrace.ts:193`의 `traceCommand`는 answered가 아니면 trace를 만들지 않는다. 무효 시도를 성공한 결정처럼 기록하지 않는 history 계약 검토가 필요하다. B는 코어·UI를 수정하지 않았고, 이 관찰을 새 재현이나 실제 화면 검증으로 확대하지 않는다.

### 실제 전체 답변 세 판 재현과 선언 분류 공백

[완료된 재현 증거](../verification/eb-weight/answer-replay-92bbc7d/README.md):2485af4 원본과 중간87·최종3 상태가 일치한92bbc7d 도구 재현은 종료0이다. 고정 trace 분류표의 실제 무거운 답변836건, 연간 중앙값2·최대6·0인 해46/375·4건 초과26년이다. 기존 root345건의 연간 지표와 혼용하지 않는다. 등록 답변198건은 연간 최대2건이다.

seed2에서 상태 변경·영주 agency가 관측된 선언2건은 trace kind/weight가 없어 미분류다: `confirm_palisade_proclamation` tick84163(1321년,h-006167), `confirm_stone_town_proclamation` tick393043(1398년,h-028971). history의 큰 결정 분류와 실제 시대/성벽 진행 의미를 trace 분류가 놓치는지 엔진 검토를 요청한다. B가 코어 분류표를 임의로 바꾸지 않는다. 둘을 추가 무거운 결정으로 보는 보충 계산은838건·4건 초과27년(1321년4→5,1398년2→3)이며 중앙값·최대·0인 해와 등록 지표는 같다. 명령별 전체 상태 전후 비교는 저장되지 않았으므로 정확한 효과량을 복원했다는 주장은 하지 않는다.

이 결과로 게임 전체 P-T1 상한 미충족은 확인되지만 특정 등록 사건의 등급 하향이 정당화되지는 않는다. 지속 권리·세율·큰돈·가문·소송의 의미를 보존하면서 전체 영주 결정 배분을 검토해야 한다. 실제 계절 UI와 전수 because/가시성은 별도 미완료다.

### 초과 연도 구성: 반복 영지 청원과 도착 조정

[실제 답변133행](../verification/eb-weight/answer-replay-92bbc7d/over-cap-answers.json.gz)는 초과26년의 실제133답변을 seed/year/ordinal/tick/history ID와 함께 보존한다. 영지 청원68·등록31·감사20·장 청원14건이다. 영지 청원68건은 모두 estate-neighbour-3의 헌장 거부31·수리 허가31·임대료 감면6건으로, 실제 rights/large_sum 무게를 갖는다. 자동 명령이라고 해석하지 않는다.

등록 사건이0인 초과 연도는3개다. 등록 답변을 산술적으로 빼도 seed2 1337/1376/1403 및 seed3 1338의4개 연도가4건을 넘는다. 이는 사건을 제거하고 다시 실행한 반사실 실험이 아니다. 엔진에는 반복 영지 청원과 연간 도착 조정을 함께 검토 요청한다. 의미 있는 B 선택을 무조건 낮추는 근거로 쓰지 않는다.


### 실제 계절 보고 네 사례와 표시 제한

[실제 DGX 증거](../verification/eb-weight/season-report-f731537/README.md):058·034·144·163은 기존 정상 속도 조작으로 닫힌 철에 진입했고 해당 청지기 보고 행4/4가 나타났다. 독립 한 틱 출력과 presentation이 일치했다. 청지기 보고 자체 누락은 이 네 사례에서 재현되지 않았다.034·163 하단 결과는 캡처 밖이고058 결과의 행위자가 영주로 쓰인다. 렌더/콘텐츠의 전체 내용 접근성·행위자 문구 검토가 필요하다. 전수10회 보고·56건 because/가시성 완료로 확대하지 않는다.


### 053 후속 확인: 같은 배치 지출 뒤1d

[원본 보존 장부](../verification/eb-weight/invalid-attempts/053-retained-ledger.json.gz)는 seed2의9049 저장에서1015까지 모든 현금5행과 빈 rollups를 확인한다. 시작60−접수60+영지수입55−증서30−증인24=1d. claim1에는 증서·증인만 있고 court_roll은 없으므로, 이미 가진 증서 경로와20d가 필요한 재판기록 경로가 모두 실패한다. h-000049 registry.invalid가 앞선 증거 구매와 attempted roll h-000050 사이에 있다. 어댑터 실행 전 재바인딩 실패이며 own adapterbug는 입증되지 않았다. 새 시뮬레이션 없이 원본 보존 자료로 해결했다. 무효 시도 decision.card와 성공 trace의 기록 불일치 인계는 그대로 남는다.


### 전체 무거운 답변의 자체 ID 연결과 합쳐진 root

[836답변 전수 파일 대조](../verification/eb-weight/answer-replay-92bbc7d/README.md): 충분한3년 창816건 중 자체 답변 ID 직접 연결292건(35.78%), 관측 기간 부족20건 중 발견5건이다. 자체 root 성숙337건 중292건, 별도 root가 없는 성숙479건 중0건이다. 후자의469건에는 source/also·시각 범위로 맞는 유일한 root 후보의 답변 후 후속이 있으나 정식 멤버십/개별 답변 원인 증명은 아니다. 반복 답변의 실제 소속과 개별 결과를 연결하는 엔진 읽기 계약 요청을 유지한다. 직접 연결 부재를 게임 효과 부재로 바꾸지 않는다.
