import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {loadEngine} from './load-engine.mjs';
const read=p=>JSON.parse(readFileSync(p,'utf8'));
const root='/tmp/astra-content-v4.1-20261005';
const canon='/Users/rexxa/fls-astra-content41/docs/design/content-drafts-20261002/v4';
const delta=read(`${root}/registry-v4.1.json`).entries;
const events=read(`${root}/events-v4.1.json`);
const merge=(a,b)=>[...new Map([...a,...b].map(x=>[x.id,x])).values()];
const e=await loadEngine({entries:merge(read(`${canon}/registry-v4.json`).entries,delta),events:merge(read(`${canon}/events-v4.json`),events),label:'core'});
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

export {e,delta,fixture,root,events,hash};
