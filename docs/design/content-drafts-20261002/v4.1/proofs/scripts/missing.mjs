import {e,delta,fixture} from './fixture-core.mjs';import {writeFileSync} from 'node:fs';
const results=[];for(const entry of delta){let state=fixture(entry);const id=Number(entry.id.slice(-3));
 if(id===11)state={...state,diplomacy:{...state.diplomacy,negotiations:state.diplomacy.negotiations.map(n=>{const x={...n};delete x.counter;return x;})}};
 if(id===201||id===204)state={...state,buildings:state.buildings.filter(b=>b.kind!=='market')};
 if(id===202||id===207)state={...state,houses:state.houses.map(h=>{const x={...h};delete x.foodShortSinceTick;return x;})};
 if(id===203||id===208){const labour={...state.labour};delete labour.idle;state={...state,labour};}
 if(id===205)continue;
 if(id===206||id===210)state={...state,events:{...state.events,records:state.events.records.map(r=>{const x={...r};delete x.arrivalTick;return x;})}};
 if(id===209||id===214)state={...state,constructionSites:[]};
 if([211,212,213,215].includes(id))state={...state,factions:{...state.factions,factions:state.factions.factions.map(f=>{const x={...f};delete x.leaderId;return x;})}};
 results.push({id:entry.id,missingRelevantContextClosed:e.bindEntry(state,entry)===null});
}
writeFileSync('/tmp/astra-content41-harness/missing-results.json',JSON.stringify({scope:'Missing optional pressure/context fields, existing engine-valid outer state',results},null,2));console.log(JSON.stringify(results));
