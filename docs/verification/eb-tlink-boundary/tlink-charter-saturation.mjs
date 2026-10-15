import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { delegated, transition } from '../../tests/helpers/engineBTlinkFixtures.ts';
import { advanceStewardship } from '../../src/engine/stewardship.ts';
import { gameReducer } from '../../src/state/gameStore.ts';
import { hashSeed } from '../../src/engine/prng.ts';
import { cameHeavyToLord } from '../../src/engine/decisionLayer.ts';
const changes = (a,b,path='') => {
 if(JSON.stringify(a)===JSON.stringify(b))return [];
 if(a && b && typeof a==='object' && typeof b==='object')return [...new Set([...Object.keys(a),...Object.keys(b)])].flatMap(k=>changes(a[k],b[k],path+'/'+k));
 return [{path,before:a??null,after:b??null}];
};
const project = state => {
 const {history,trace,...rest}=state;
 return {...rest,stewardship:{...rest.stewardship,petitions:[]}};
};
const base=delegated();
let state={...base,seed:17,stewardship:{...base.stewardship,rules:{...base.stewardship.rules,rights:true},oversight:base.stewardship.oversight.map(row=>({...row,merchants:-100}))}};
const rows=[];
const ticks=Array.from({length:100},(_,i)=>(i+2)*1000).filter(t=>hashSeed(17,'estate-petition',0,t)%6===4).slice(0,2);
for(const tick of ticks){
 state=transition(state,tick,advanceStewardship).after;
 // Clamp at the tested boundary after seasonal rates; this is an explicit fixture condition.
 state={...state,stewardship:{...state.stewardship,oversight:state.stewardship.oversight.map(row=>row.estateId==='delegated-estate'?{...row,merchants:-100}:row)}};
 const petition=state.stewardship.petitions.find(p=>p.estateId==='delegated-estate'&&p.tick===tick&&p.kind==='charter_request');
 assert.ok(petition?.status==='open');
 const before=state,after=gameReducer(before,{type:'answer_estate_petition',petitionId:petition.id,grant:false});
 const own=after.trace.answers.at(-1);assert.ok(own);assert.equal(cameHeavyToLord(own),true);
 const delta=changes(before,after),actualDelta=changes(project(before),project(after));
 assert.deepEqual(actualDelta,[]);
 const nextTick=tick+1000;
 const control=advanceStewardship({...before,tick:nextTick,stewardship:{...before.stewardship,petitions:after.stewardship.petitions}});
 const next=transition(after,nextTick,advanceStewardship);
 const futureDelta=changes(project(control),project(next.actual));
 const links=next.after.history.records.filter(r=>r.tick>tick&&r.because?.some(c=>c.decisionId===own.id));
 assert.deepEqual(futureDelta,[]);assert.deepEqual(links,[]);
 rows.push({tick,petition,own,heavy:true,merchantsBefore:before.stewardship.oversight[0].merchants,merchantsAfter:after.stewardship.oversight[0].merchants,changedPaths:delta.map(x=>x.path),actualDelta,nextTick,futureDelta,futureLinks:links.map(r=>({id:r.id,template:r.template,because:r.because}))});
 state=after;
}
const report={source:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),scope:'Synthetic saturated estate boundary; two actual season-produced charter petitions, real reducer refusals, one actual next-season transition per refusal. Control copies only answered petition bookkeeping, excludes history/trace and petitions from domain comparison; no engine ticks or 125-year simulation.',rows};
writeFileSync('.omo/evidence/tlink-charter-saturation.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(rows.map(({tick,merchantsBefore,merchantsAfter,actualDelta,nextTick,futureDelta,futureLinks,own})=>({tick,merchantsBefore,merchantsAfter,actualDelta,nextTick,futureDelta,futureLinks,weights:own.weights,targets:own.targets})),null,2));
