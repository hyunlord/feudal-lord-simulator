import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=(p)=>JSON.parse(fs.readFileSync(path.join(root,p),'utf8'));
const d=read('world/chronicle-sample.json'),r=read('world/rules.json');
const rules=new Map(r.rules.map(x=>[x.id,x]));const people=new Map(d.personTimeline.map(x=>[x.id,x]));
const errors=[];let checks=0;function ok(v,s){checks++;if(!v)errors.push(s);}
const ops={'==':(a,b)=>a===b,'<=':(a,b)=>a<=b,'>=':(a,b)=>a>=b,between:(a,b)=>a>=b[0]&&a<=b[1],allNonpositive:(a,b)=>Array.isArray(a)&&a.length===b&&a.every(x=>x<=0)};
ok(d.events.length===32,'32 major events');ok(people.size===d.personTimeline.length,'unique person IDs');ok(d.fortunes.length===18,'18 fortunes');
for(const p of people.values()){
 ok(p.deathYear>p.birthYear,p.id+' positive lifespan');ok(p.deathYear-p.birthYear<=95,p.id+' plausible lifespan');
 for(const pid of p.parentIds){const par=people.get(pid);ok(Boolean(par),p.id+' parent exists '+pid);if(par){ok(p.birthYear-par.birthYear>=18,p.id+' adult parent '+pid);ok(p.birthYear<=par.deathYear+1,p.id+' parent alive at conception '+pid);if(par.sex==='female')ok(p.birthYear-par.birthYear<=44,p.id+' maternal age '+pid);}}
}
const hundred=read('world/hundred.json');
const nativePeople=new Map([...hundred.engine.persons.people,...hundred.engine.persons.past,...hundred.engine.estates.people,...hundred.engine.factions.people].map(p=>[p.id,p]));
for(const initial of hundred.proposals.personProfiles){
 const p=people.get(initial.authorId); const native=nativePeople.get(initial.id);
 ok(Boolean(p),initial.authorId+' initial person represented');ok(Boolean(native),initial.id+' engine person present');
 if(p&&native){
  ok(p.birthYear===native.birthYear&&p.birthYear===initial.birthYear,p.id+' birth agrees with hundred');
  ok(p.sex===native.sex&&p.sex===initial.sex,p.id+' sex agrees with hundred');
  if(native.alive)ok(p.deathYear>=1301,p.id+' initially alive survives baseline snapshot');
  else ok(p.deathYear===native.deathYear&&p.deathYear===initial.deathYear,p.id+' already dead exact death year preserved');
 }
}
for(const f of hundred.proposals.finances)ok(d.initialTransactionTreasuryD[f.houseId]===f.treasuryD,f.houseId+' opening cash agrees with hundred finance');
for(const h of hundred.proposals.houses)ok(d.initialDebtSeparateD[h.id]===h.debtPounds*240,h.id+' initial debt agrees with hundred house');

const cash={...d.initialTransactionTreasuryD};const ids=new Set(),transactions=new Set();let prevYear=1300;const state=new Map(),exposure=new Set();const deferred=[];
function applyChange(c,context){if(state.has(c.key))ok(JSON.stringify(state.get(c.key))===JSON.stringify(c.before),context+' before-state '+c.key);state.set(c.key,c.after);}
for(const e of d.events){
 for(const q of deferred.filter(q=>!q.done&&q.year<=e.year)){applyChange(q,e.id+' deferred');q.done=true;}
 ok(!ids.has(e.id),e.id+' unique');ok(e.year>=prevYear,e.id+' ordered');prevYear=e.year;ok(e.year>=1301&&e.year<=1450,e.id+' interval');ok(e.tick===(e.year-1300)*4000,e.id+' tick');
 for(const id of e.causalParentIds)ok(ids.has(id),e.id+' earlier causal parent '+id);ids.add(e.id);
 const rule=rules.get(e.ruleId);ok(Boolean(rule),e.id+' registered proposal rule');
 let range=rule.probability.rangePermille;
 if(e.phase==='resolution')range=[rule.parameters.annualResolutionPermille,rule.parameters.annualResolutionPermille];
 if(e.ruleId==='NW12'&&e.year>1349)range=rule.parameters.laterWaveRangePermille;
 if(e.ruleId==='NW01'){const p=people.get(e.actorIds[0]);const age=e.year-p.birthYear;const band=rule.parameters.ageBands.find(b=>age>=b.min&&(b.max===null||age<=b.max));range=[band.p,band.p];}
 ok(e.probabilityPermille>=range[0]&&e.probabilityPermille<=range[1],e.id+' rule probability range');ok(e.manualDraw>=0&&e.manualDraw<e.probabilityPermille,e.id+' chosen draw passes');
 for(const q of rule.eligibility.all)ok(e.eligibilityEvidence[q.predicate]?.satisfied===true&&e.eligibilityEvidence[q.predicate]?.evidence.length>5,e.id+' predicate evidence '+q.predicate);
 for(const q of e.checks)ok(ops[q.op]?.(q.left,q.right),e.id+' condition '+q.label);
 for(const id of e.actorIds){const p=people.get(id);ok(Boolean(p),e.id+' actor exists');if(p){ok(p.birthYear+18<=e.year&&e.year<=p.deathYear,e.id+' adult actor alive '+id);}}
 for(const t of e.transactions){ok(!transactions.has(t.transactionId),e.id+' idempotent transaction');transactions.add(t.transactionId);ok(t.amountD>0&&Number.isInteger(t.amountD),e.id+' integer amount');ok(cash[t.fromHouseId]===t.fromBeforeD&&cash[t.toHouseId]===t.toBeforeD,e.id+' ledger before');ok(t.fromAfterD===t.fromBeforeD-t.amountD&&t.toAfterD===t.toBeforeD+t.amountD,e.id+' double entry');ok(t.fromAfterD>=0,e.id+' no negative treasury');cash[t.fromHouseId]=t.fromAfterD;cash[t.toHouseId]=t.toAfterD;}
 for(const q of e.stateChanges)applyChange(q,e.id);
 for(const q of e.deferredEffects??[]){ok(q.year>e.year,e.id+' genuinely deferred possession');deferred.push({...q});}
 for(const q of ['settlementDraw','meritsDraw','disputeDraw'])if(e[q])ok(e[q].u>=0&&e[q].u<e[q].p,e.id+' '+q);
 if(e.branchDraw)ok(e.branchDraw.draw>=e.branchDraw.intervalInclusive[0]&&e.branchDraw.draw<=e.branchDraw.intervalInclusive[1],e.id+' branch');
 for(const q of e.conditionalDraws??[])ok((q.u<q.p)===q.result,e.id+' conditional draw');
 if(e.ruleId==='NW12')for(const id of [...e.actorIds,...(e.additionalPersonDraws??[]).map(x=>x.personId)]){const wave=e.year<=1349?'plague1348_49':String(e.year),key=wave+'|'+id;ok(!exposure.has(key),e.id+' once per exposure');exposure.add(key);ok(people.get(id)?.deathYear===e.year,e.id+' plague death year '+id);}
 if(e.ruleId==='NW04')for(const t of e.transactions)ok(t.amountD<=t.fromBeforeD*.5,e.id+' settlement cash ceiling');
}
for(const q of deferred.filter(q=>!q.done)){applyChange(q,'final deferred');q.done=true;}
for(const [h,n] of Object.entries(cash))ok(n===d.finalTransactionOnlyTreasuryD[h],h+' final transaction-only ledger');
ok(Object.values(cash).reduce((a,b)=>a+b,0)===Object.values(d.initialTransactionTreasuryD).reduce((a,b)=>a+b,0),'all cash transactions globally conserve');
for(const h of d.fortunes.map(x=>x.houseId))for(const y of [1300,1350,1400,1450]){const terms=d.leadershipTerms.filter(t=>t.houseId===h&&t.fromYear<=y&&y<t.untilYear);ok(terms.length===1,`${h} ${y} exactly one representative`);for(const t of terms){const p=people.get(t.personId);ok(p.birthYear+18<=y&&p.deathYear>y,`${h} ${y} representative alive/adult`);}}
const result={status:errors.length?'FAIL':'PASS',checks,majorEvents:d.events.length,initialPersons:d.personTimeline.filter(p=>p.origin==='1300_roster').length,futurePersons:d.personTimeline.filter(p=>p.origin!=='1300_roster').length,transactions:transactions.size,limits:'Validates this hand-authored trace, not the engine, all annual no-events, full accounts or historical probabilities.',errors};
fs.writeFileSync(path.join(root,'records/chronicle-validation.json'),JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));if(errors.length)process.exitCode=1;
