import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadEngine} from './load-engine.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const root='/tmp/astra-content-v4.1-20261005';
const canon='/Users/rexxa/fls-astra-content41/docs/design/content-drafts-20261002/v4';
const delta=read(`${root}/registry-v4.1.json`).entries;
const events=read(`${root}/events-v4.1.json`);
const merge=(a,b)=>[...new Map([...a,...b].map(x=>[x.id,x])).values()];
const e=await loadEngine({entries:merge(read(`${canon}/registry-v4.json`).entries,delta),events:merge(read(`${canon}/events-v4.json`),events),label:'qa'});
const raw=e.decodeSave(new Uint8Array(readFileSync('/tmp/astra-content41-harness/snapshot/fixtures/saves/v49/chapter-two-town.save.json'))).envelope.state;
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const results=[];
function fixture(entry){
 const year=entry.calendar.yearMinInclusive>1319?entry.calendar.yearMinInclusive:1319;
 const tick=(year-1300)*4000+entry.calendar.seasonIndices[0]*1000+100;
 let state={...raw,tick,agency:{...e.initialAgency(),policy:'defence'},registry:e.initialRegistry()};
 const funds=e.postLedgerEntries(state,[{account:'cash',category:'rent',amount:500-e.treasuryBalance(state),sourceRefs:[{type:'actor',id:'fixture'}]}]);state={...state,ledger:funds.ledger,treasuryCoin:funds.treasuryCoin};
 if(entry.id==='ck_evt_204')state={...state,buildings:[...state.buildings,{...state.buildings[0],id:'fixture-weaver',kind:'weaver_house'}]};
 if(['ck_evt_202','ck_evt_207'].includes(entry.id))state={...state,houses:state.houses.map((h,i)=>i===0?{...h,foodShortSinceTick:tick-100}:h)};
 if(entry.id==='ck_evt_205')state={...state,buildings:state.buildings.filter(b=>b.kind!=='well'&&b.kind!=='water_carrier')};
 if(['ck_evt_206','ck_evt_210'].includes(entry.id)){const kind=entry.id==='ck_evt_206'?'fire':'dearth';const template=state.events.records.find(r=>r.kind===kind);state={...state,events:{...state.events,records:[{...template,id:'fixture-event-1',arrivalTick:tick-100,season:Math.floor(tick/1000)}]}};}
 if(entry.id==='ck_evt_011'){const diplomacy=e.ENGINE_CALLS.diplomacyOf(state);const grooms=e.ENGINE_CALLS.marriageGrooms(state);const negotiation={id:'fixture-negotiation',proposer:'lord',counterpart:'neighbour_3',purpose:'marriage',terms:[],counter:{terms:[{kind:'cash',giver:'proposer',amount:10}]},status:'countered',tick:tick-10,deadline:tick+500,groomId:grooms[0]?.id??'fixture-groom',brideId:'fixture-bride'};state={...state,diplomacy:{...diplomacy,negotiations:[negotiation]}};}
 return state;
}
for(const entry of delta){
 const state=fixture(entry),before=hash(state);const support=e.registryV4Support().find(x=>x.id===entry.id);const bound=e.bindEntry(state,entry);const enabled=bound===null?[]:e.v4EnabledChoices(state,entry,bound);const row={id:entry.id,supported:support.runs,calendar:e.stateCalendar(state),bound:bound!==null,context:bound===null?null:e.contextKey(entry,bound),enabled,commands:[],originalUnchanged:false};
 if(bound!==null)for(const choice of entry.choices.filter(c=>enabled.includes(c.id))){const next=choice.commands.length===0?e.applyHold(state,entry,bound):e.runCommands(state,choice.commands,{state,bound,vars:{}});row.commands.push({id:choice.id,success:next!==null,changed:next!==null&&hash(next.state??next)!==before,hold:choice.commands.length===0});}
 row.originalUnchanged=hash(state)===before;
 const without={...state};delete without.agency;row.missingAgencyClosed=entry.id==='ck_evt_011'?null:e.bindEntry(without,entry)===null;
 if(bound!==null&&entry.bindings.lowerDues){const altered={...state,agency:{...state.agency,duesPermille:1100}};row.duesChangedInvalidates=e.bindEntry(altered,entry,e.boundIdentities(bound))===null;}
 if(entry.id==='ck_evt_205'){row.waterless=e.evaluate({derived:'WATERLESS',args:[]},{state,bound:{},vars:{}});row.wellAction=e.evaluate({field:'selectors.autoplayBuildAction.well'},{state,bound:{},vars:{}});}
 results.push(row);
}
writeFileSync('/tmp/astra-content41-harness/fixture-results.json',JSON.stringify({scope:'Synthetic condition fixtures derived from real chapter-two-town save; no simulation ticks executed',inputHashes:{events:hash(events),registry:hash(delta)},results},null,2));
console.log(JSON.stringify(results));
const recurrence=[];const windows=[];
function atYear(state,year){const tick=(year-1300)*4000+(state.tick%4000),offset=tick-state.tick;return {...state,tick,houses:state.houses.map(h=>h.foodShortSinceTick===undefined?h:{...h,foodShortSinceTick:h.foodShortSinceTick+offset}),events:{...state.events,records:state.events.records.map(r=>({...r,arrivalTick:r.arrivalTick+offset}))},...(state.diplomacy===undefined?{}:{diplomacy:{...state.diplomacy,negotiations:state.diplomacy.negotiations.map(n=>({...n,deadline:n.deadline+offset}))}})};}
function candidate(state,id,past=[]){return e.v4Candidates(state,past).find(c=>c.entry.id===id);}
function search(state,id,past=[]){for(let seed=1;seed<=160;seed++){const test={...state,seed};const got=candidate(test,id,past);if(got)return {state:test,candidate:got};}return null;}
for(const entry of delta){
 const original=fixture(entry);const found=search(original,entry.id);
 if(found===null){recurrence.push({id:entry.id,found:false});continue;}
 const past={entryId:entry.id,offeredTick:found.state.tick,status:'answered',key:found.candidate.key,context:found.candidate.context};
 let next=atYear(original,e.stateCalendar(original).year+4);
 if(entry.bindings.event)next={...next,events:{...next.events,records:next.events.records.map(r=>({...r,id:r.id+'-next'}))}};
 if(entry.bindings.faction&&!entry.bindings.seasonContext)next={...next,factions:{...next.factions,factions:next.factions.factions.map(f=>({...f,leaderId:f.leaderId+'-next'}))}};
 if(entry.bindings.negotiation)next={...next,diplomacy:{...next.diplomacy,negotiations:next.diplomacy.negotiations.map(n=>({...n,id:n.id+'-next'}))}};
 const nextFound=search(next,entry.id,[past]);
 const noContextChange={...next,...(entry.bindings.event?{events:{...next.events,records:original.events.records.map(r=>({...r,arrivalTick:next.tick-100}))}}:{}),...(entry.bindings.faction&&!entry.bindings.seasonContext?{factions:original.factions}:{}),...(entry.bindings.negotiation?{diplomacy:{...next.diplomacy,negotiations:next.diplomacy.negotiations.map(n=>({...n,id:'fixture-negotiation'}))}}:{})};
 const persistent=entry.bindings.event||entry.bindings.negotiation||(entry.bindings.faction&&!entry.bindings.seasonContext);
 recurrence.push({id:entry.id,found:true,oldContext:past.context,sameContextBlocked:candidate(found.state,entry.id,[past])===undefined,newContextEligible:nextFound!==null,newContext:nextFound?.candidate.context??null,persistentSameContextAfterGapBlocked:persistent?search(noContextChange,entry.id,[past])===null:null});
 for(const year of [1380,1381,1398,1399,1414,1415,1424,1450,1451]){const test=atYear(original,year);const eligible=year>=entry.calendar.yearMinInclusive&&year<=entry.calendar.yearMaxInclusive;const observed=search(test,entry.id)!==null;windows.push({id:entry.id,year,expected:eligible,observed,pass:observed===eligible});}
}
writeFileSync('/tmp/astra-content41-harness/recurrence-results.json',JSON.stringify({scope:'Candidate/recurrence unit fixtures; dates and states rebased, no game simulation ticks',recurrence,windows},null,2));
console.log(JSON.stringify({recurrence,windowCount:windows.length,windowFailures:windows.filter(x=>!x.pass)}));
