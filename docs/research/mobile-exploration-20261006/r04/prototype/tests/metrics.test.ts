import { test } from 'node:test';
import assert from 'node:assert/strict';
import { duelScore, winnerShares, value, entropy, dominantShares, summarizeDuels, type Standing } from '../league/metrics.js';
import { policyPreset, emptyStocks } from '../model/rules.js';
const city=(coin:number,population=24):Standing=>({strategy:'test',population,stocks:{food:0,materials:0,tools:0,coin},escrow:emptyStocks(),policy:policyPreset('agriculture')});
test('rank respects survival, one-percent draws and fractional four-seat ties',()=>{
 assert.equal(duelScore(city(100),city(101)),0.5);assert.equal(duelScore(city(1000,0),city(0,1)),0);
 assert.equal(duelScore(city(500,0),city(0,0)),0.5);assert.deepEqual(winnerShares([city(500),city(500),city(10),city(0)]),[0.5,0.5,0,0]);
});
test('owned escrow has value exactly once and objective weights can change order',()=>{
 const a={...city(0,1),escrow:{...emptyStocks(),coin:100}},b=city(0,12);
 assert.equal(value(a),112);assert.equal(duelScore(a,b),0);assert.equal(duelScore(a,b,6),1);
});
test('dominant mixed axes split ties and normalized entropy is one for eight equal shares',()=>{
 assert.equal(dominantShares(policyPreset(['trade','maritime'])).trade,0.5);
 assert.ok(Math.abs(entropy(policyPreset(['agriculture','trade','craft','military','faith','scholarship','maritime','diplomacy']))-1)<1e-12);
});
test('bootstrap treats repeated games in same seed as a block, not independent observations',()=>{
 const rows=[{strategy:'a',seed:1,score:1},{strategy:'a',seed:2,score:0}] as const;
 const once=summarizeDuels(rows,200),repeated=summarizeDuels(Array.from({length:20},()=>rows).flat(),200);
 assert.deepEqual(once.strategies[0]?.interval95,repeated.strategies[0]?.interval95);assert.equal(once.independentSeeds,2);assert.equal(once.exploratory,true);
});
