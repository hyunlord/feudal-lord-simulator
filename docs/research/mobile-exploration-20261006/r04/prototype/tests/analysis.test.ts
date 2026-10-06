import test from 'node:test';
import assert from 'node:assert/strict';
import { parseGame } from '../league/analysis-input.js';
import { compactGame } from '../league/compact.js';
import { runGame } from '../league/game.js';
import { BASE_STRATEGIES } from '../league/strategies.js';
import { Analysis } from '../league/analysis-summary.js';
const spec={id:'test:training',block:'test',rotation:0,seed:1,terrain:'river',growthSteps:12,diplomacyEnabled:true,strategies:BASE_STRATEGIES.slice(0,2)} as const;
const compact=compactGame(runGame(spec),spec);
test('analysis rejects owned-value mismatch at input boundary',()=>{
 const changed=structuredClone(compact);const city=changed.recovery[0];assert.ok(city);city.value+=100;
 assert.throws(()=>parseGame(changed),/value does not reconcile/);
});
test('analysis conserves duel points and produces all nine sensitivities',()=>{
 const analyzer=new Analysis();analyzer.add(parseGame(compact));const output=analyzer.finish();
 assert.equal(output.games,1);assert.equal(output.duel?.strategies.reduce((s,row)=>s+row.scoreRate,0),1);
 assert.equal(output.sensitivity.length,9);assert.equal(output.war.opportunities,24);
});
