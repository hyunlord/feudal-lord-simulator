import test from 'node:test';
import assert from 'node:assert/strict';
import { createCity, advanceCity, setPolicy, policyPreset, RESOURCES, population } from '../model/index.js';
test('same seed and commands reproduce all economic state',()=>{
 const a=createCity(1,'river'),b=createCity(1,'river');
 setPolicy(a,policyPreset('craft'));setPolicy(b,policyPreset('craft'));
 advanceCity(a,96);advanceCity(b,96);
 assert.deepEqual(a,b);
});
test('all stock changes reconcile to the source ledger',()=>{
 const city=createCity(2,'forest');setPolicy(city,policyPreset(['craft','scholarship']));
 advanceCity(city,144);
 for(const resource of RESOURCES) for(const account of ['city','market'] as const) {
  const initial=account==='city'?city.initialStocks:city.initialMarket;
  const final=account==='city'?city.stocks:city.externalMarket;
  assert.equal(final[resource],initial[resource]+city.ledger.filter(e=>e.resource===resource && e.account===account).reduce((sum,e)=>sum+e.amount,0));
  assert.ok(Number.isInteger(final[resource]) && final[resource]>=0);
 }
});
test('policy differences change autonomous built composition',()=>{
 const a=createCity(3,'river'),b=createCity(3,'river');setPolicy(a,policyPreset('agriculture'));setPolicy(b,policyPreset('military'));
 advanceCity(a,96);advanceCity(b,96);
 assert.notDeepEqual(a.facilities.map(f=>f.axis),b.facilities.map(f=>f.axis));
 assert.ok(b.facilities.some(f=>f.axis==='military'));
});
test('mobilized workers cannot also produce',()=>{
 const a=createCity(4,'river'),b=createCity(4,'river'); b.mobilized=population(b);
 advanceCity(a,1);advanceCity(b,1);
 assert.ok(a.stocks.food>b.stocks.food);
 assert.equal(b.facilities.reduce((n,f)=>n+f.workers,0),0);
});
test('invalid policy budget leaves prior command unchanged',()=>{
 const city=createCity(1,'river');const before={...city.policy};
 assert.equal(setPolicy(city,{...before,agriculture:101}),false);
 assert.deepEqual(city.policy,before);
});
test('exhausted external market cannot create free imports',()=>{
 const city=createCity(2,'mountain');for(const resource of RESOURCES)city.externalMarket[resource]=0;
 city.stocks.food=0;city.mobilized=population(city);
 advanceCity(city,1);
 assert.equal(city.stocks.food,0);
 assert.equal(city.ledger.filter(e=>e.reason==='import').length,0);
});
test('a sortie consumes one settlement of unavailable labor then returns survivors',()=>{
 const city=createCity(1,'river');city.mobilized=6;
 advanceCity(city,1);
 assert.equal(city.mobilized,0);
});
test('late policy changes can pay to rebuild existing occupations without free conversion',()=>{
 const city=createCity(3,'river');setPolicy(city,policyPreset('agriculture'));advanceCity(city,96);
 const before=city.facilities.filter(f=>f.hp>0 && f.axis==='military').length;
 setPolicy(city,policyPreset('military'));advanceCity(city,48);
 assert.ok(city.facilities.filter(f=>f.hp>0 && f.axis==='military').length>before);
 assert.ok(city.facilities.some(f=>f.hp===0));
 assert.ok(city.receipts.some(r=>r.tick>96 && r.reason.includes('without salvage') && r.costs.materials>0));
});
test('agricultural output depends on paid tools at the maintenance boundary',()=>{
 const supplied=createCity(1,'river');setPolicy(supplied,policyPreset('agriculture'));advanceCity(supplied,35);
 const exhausted=structuredClone(supplied);exhausted.stocks.tools=0;for(const r of RESOURCES)exhausted.externalMarket[r]=0;
 const beforeSupplied=supplied.stocks.food,beforeExhausted=exhausted.stocks.food;
 advanceCity(supplied,1);advanceCity(exhausted,1);
 const output=(city:typeof supplied)=>city.ledger.filter(e=>e.tick===36 && e.reason.startsWith('agriculture labor')).reduce((s,e)=>s+e.amount,0);
 assert.ok(output(supplied)>0);assert.equal(output(exhausted),0);
 assert.ok(supplied.stocks.food-beforeSupplied>exhausted.stocks.food-beforeExhausted);
});
