import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceCity, createCity, population } from '../model/economy.js';
import { simulateBattle } from '../model/battle.js';
import { findRoute } from '../model/pathfinding.js';
import type { BattleCommand } from '../model/battle.types.js';
import type { City } from '../model/types.js';
const command:BattleCommand={seed:1,mode:'raid',entry:'north',soldiers:6,supply:24};
function field():City {
 const city=createCity(1,'mountain');
 city.tiles=city.tiles.map(t=>({...t,water:false,elevation:0,road:true}));
 city.facilities=[{id:0,axis:'trade',x:10,y:10,workers:2,hp:100}];
 return city;
}
test('same snapshot command is deterministic, input immutable, finite loot conserved',()=>{
 const attacker=field();const defender=field();const original=JSON.stringify([attacker,defender]);
 const a=simulateBattle(attacker,defender,command);const b=simulateBattle(attacker,defender,command);
 assert.deepEqual(a,b);assert.equal(JSON.stringify([attacker,defender]),original);assert.equal(a.success,true);
 for(const r of ['food','materials','tools','coin'] as const){
  assert.ok(a.loot[r]<=Math.floor((defender.stocks[r]-(r==='food'?population(defender)*2:0))*0.1));
  assert.equal(defender.stocks[r]-a.defender.stocks[r],a.loot[r]);
  assert.ok(Number.isSafeInteger(a.attacker.stocks[r]));
 }
 assert.ok(a.attacker.stocks.food+a.defender.stocks.food<attacker.stocks.food+defender.stocks.food);
 assert.ok(a.attacker.mobilized>0);advanceCity(a.attacker);assert.equal(a.attacker.mobilized,0);
});
test('moving the same store deeper changes actual path and supply consumption',()=>{
 const source=field();const near=field();const far=field();
 near.facilities=[{id:0,axis:'trade',x:10,y:2,workers:2,hp:100}];
 far.facilities=[{id:0,axis:'trade',x:10,y:18,workers:2,hp:100}];
 const a=simulateBattle(source,near,command);const b=simulateBattle(source,far,command);
 assert.ok(b.steps>a.steps);assert.ok(b.route.length>a.route.length);assert.ok(b.attacker.stocks.food<a.attacker.stocks.food);
});
test('water blocks routes unless an actual road bridge connects the bank',()=>{
 const city=field();city.tiles=city.tiles.map(t=>t.y===5?{...t,water:true,road:false}:t);
 assert.equal(findRoute({city,mode:'raid',guards:0},{x:10,y:0},{x:10,y:10}).length,0);
 city.tiles=city.tiles.map(t=>t.y===5 && t.x===2?{...t,road:true}:t);
 const route=findRoute({city,mode:'raid',guards:0},{x:10,y:0},{x:10,y:10});
 assert.ok(route.some(p=>p.x===2&&p.y===5));
});
test('siege consumes tools and breaches an actual gate, without raid payout',()=>{
 const attacker=field();const defender=field();
 defender.facilities=[{id:0,axis:'military',x:10,y:3,workers:2,hp:60}];
 const result=simulateBattle(attacker,defender,{...command,mode:'siege'});
 assert.equal(result.success,true);assert.equal(result.defender.facilities[0]?.hp,0);
 assert.deepEqual(result.loot,{food:0,materials:0,tools:0,coin:0});assert.ok(result.trace.some(t=>t.phase==='breach'));
});
test('policy labels cannot directly change combat and duration is bounded',()=>{
 const a=field();const b=field();const result=simulateBattle(a,b,command);
 a.policy.military=100;a.policy.agriculture=0;
 const changed=simulateBattle(a,b,command);assert.deepEqual(result.trace,changed.trace);
 assert.deepEqual(result.loot,changed.loot);assert.ok(changed.steps<=256);
});
test('moving the same guard post changes exposure without changing troop count',()=>{
 const source=field();const near=field();const far=field();
 near.facilities.push({id:1,axis:'military',x:10,y:1,workers:2,hp:100});
 far.facilities.push({id:1,axis:'military',x:0,y:20,workers:2,hp:100});
 const a=simulateBattle(source,near,command);const b=simulateBattle(source,far,command);
 assert.equal(a.deployed,b.deployed);
 assert.ok(a.trace.reduce((sum,t)=>sum+t.exposure,0)>b.trace.reduce((sum,t)=>sum+t.exposure,0));
});
test('poorly supplied sortie visibly turns around and does not award loot',()=>{
 const source=field();const target=field();
 const result=simulateBattle(source,target,{...command,supply:3});
 assert.equal(result.success,false);assert.ok(result.trace.some(t=>t.phase==='return'));
 assert.deepEqual(result.loot,{food:0,materials:0,tools:0,coin:0});
 assert.ok(result.attacker.stocks.food<source.stocks.food);
});
test('route tie order stays distance then y,x and retains the original entry object',()=>{
 const city=field();const entry={x:0,y:0,marker:'entry-metadata'};
 const route=findRoute({city,mode:'raid',guards:0},entry,{x:2,y:2});
 assert.equal(route[0],entry);
 assert.deepEqual(route,[entry,{x:1,y:0},{x:2,y:0},{x:2,y:1},{x:2,y:2}]);
});
test('battle copies all mutable branches; subsequent growth cannot mutate either input',()=>{
 const source=field();const defender=field();advanceCity(source,24);advanceCity(defender,24);
 const before=structuredClone([source,defender]);const result=simulateBattle(source,defender,command);
 assert.notEqual(result.attacker.ledger,source.ledger);assert.notEqual(result.attacker.receipts,source.receipts);
 advanceCity(result.attacker,24);advanceCity(result.defender,24);
 const tile=result.attacker.tiles[0];if(tile)tile.road=!tile.road;
 const household=result.attacker.households[0];if(household)household.skills.craft+=1;
 result.attacker.services.training+=1;result.attacker.policy.military=10;
 assert.deepEqual([source,defender],before);
});
