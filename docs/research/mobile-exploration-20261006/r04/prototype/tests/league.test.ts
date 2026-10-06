import test from 'node:test';
import assert from 'node:assert/strict';
import { BASE_STRATEGIES, CHALLENGERS, policyFor } from '../league/strategies.js';
import { duelSchedule, multiSchedule } from '../league/schedule.js';
import { cityValue, runGame, prepareGrowth } from '../league/game.js';
import { AXES, createCity, emptyStocks, population, validPolicy } from '../model/index.js';
test('full schedules preserve seat rotations and declared counts',()=>{
 const duel=duelSchedule(),multi=multiSchedule();assert.equal(duel.length,11880);assert.equal(multi.length,19800);
 for(const [games,size] of [[duel,2],[multi,4]] as const){const blocks=new Map<string,typeof games>();for(const game of games)blocks.set(game.block,[...(blocks.get(game.block)??[]),game]);for(const group of blocks.values()){assert.equal(group.length,size);for(const strategy of group[0]?.strategies??[])assert.equal(new Set(group.map(g=>g.strategies.findIndex(s=>s.id===strategy.id))).size,size);}}
});
test('strategies are valid continuous policy vectors; adaptive can change',()=>{
 const city=createCity(1,'river');for(const s of [...BASE_STRATEGIES,...CHALLENGERS])assert.ok(validPolicy(policyFor(s,city)));
 const adaptive=CHALLENGERS.find(s=>s.adaptive);assert.ok(adaptive);const initial=policyFor(adaptive,city);city.stocks.food=0;assert.notDeepEqual(policyFor(adaptive,city),initial);assert.equal(AXES.length,8);
});
test('actual game deterministic, same initial seed, phases and rotating first seats',()=>{
 const spec={strategies:BASE_STRATEGIES.slice(0,2),seed:1,terrain:'river',growthSteps:4,diplomacyEnabled:true} as const;
 const first=runGame(spec);assert.deepEqual(runGame(spec),first);assert.equal(first.order.length,12);assert.deepEqual(first.order.slice(0,2),[['seat-0','seat-1'],['seat-1','seat-0']]);
 assert.ok(first.growth.every(s=>s.city.tick===4));assert.ok(first.foreign.every(s=>s.city.tick===16));assert.ok(first.recovery.every(s=>s.city.tick===40));
 for(const s of first.recovery)assert.equal(s.value,cityValue(s.city,s.ownedEscrow));
 const disabled=runGame({...spec,diplomacyEnabled:false});assert.equal(disabled.diplomacy.contracts.length,0);
});
test('value counts owned escrow exactly once; no building bonus',()=>{
 const city=createCity(1,'river'),escrow=emptyStocks();escrow.tools=3;assert.equal(cityValue(city,escrow)-cityValue(city),12);assert.equal(cityValue(city),12*population(city)+180+200+120+160);
});

test('cached immutable growth and telemetry preserve exact game',()=>{
 const spec={strategies:BASE_STRATEGIES.slice(0,2),seed:1,terrain:'river',growthSteps:4,diplomacyEnabled:true} as const;
 const growth=prepareGrowth(spec),copy=structuredClone(growth);let calls=0;
 assert.deepEqual(runGame(spec,{growth,onPhase:()=>{calls++;}}),runGame(spec));assert.deepEqual(growth,copy);assert.ok(calls>0);
 assert.throws(()=>runGame({...spec,seed:2},{growth}),RangeError);
});
