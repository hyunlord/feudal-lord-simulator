import test from 'node:test';
import assert from 'node:assert/strict';
import { createCity, book } from '../model/economy.js';
import { RESOURCES, type Stocks } from '../model/types.js';
import { createDiplomacy, proposeContract, answerContract, advanceContracts, ownedEscrow, breachContract, hasPact, autoOffer, recordAvoidedRaid } from '../model/contracts.js';
import type { ContractContext, OfferTerms } from '../model/contracts.types.js';
function fixture(enabled=true):ContractContext {
 const a=createCity(1,'river'),b=createCity(1,'river');
 const targets:readonly Stocks[]=[{food:500,materials:20,tools:20,coin:100},{food:20,materials:200,tools:20,coin:100}];
 for(const [i,city] of [a,b].entries()){const target=targets[i];assert.ok(target);for(const r of RESOURCES)assert.ok(book(city,{resource:r,amount:target[r]-city.stocks[r],reason:'fixture-stock'}));}
 return {cities:{a,b},diplomacy:createDiplomacy(enabled),now:0};
}
function terms():OfferTerms{return {id:'0:a:b',from:'a',to:'b',give:{food:20,materials:0,tools:0,coin:0},take:{food:0,materials:10,tools:0,coin:0},offerUntil:1,deliverAt:2,pactUntil:6};}
function total(ctx:ContractContext):Stocks{
 const out={food:0,materials:0,tools:0,coin:0};for(const [seat,city] of Object.entries(ctx.cities)){const escrow=ownedEscrow(ctx.diplomacy,seat);for(const r of RESOURCES)out[r]+=city.stocks[r]+escrow[r];}return out;
}
test('reservation conserves owned goods and consumes one envoy coin',()=>{
 // Given two finite cities; When one reserves its offered goods; Then ownership is conserved except the stated envoy cost.
 const ctx=fixture(),before=total(ctx);assert.ok(proposeContract(ctx,terms()).ok);
 assert.deepEqual(total(ctx),{...before,coin:before.coin-1});assert.equal(ownedEscrow(ctx.diplomacy,'a').food,20);
});
test('delivery swaps finite goods once and expires the actual pact',()=>{
 // Given an accepted contract; When delivery is settled twice; Then no duplication occurs and the pact has a deadline.
 const ctx=fixture();proposeContract(ctx,terms());const reply=answerContract(ctx,terms().id,true);assert.ok(reply.ok);assert.equal(reply.contract.status,'accepted');
 const before=total(ctx),later={...ctx,now:2};advanceContracts(later);advanceContracts(later);
 assert.deepEqual(total(ctx),before);assert.equal(ctx.cities['a']?.stocks.food,480);assert.equal(ctx.cities['a']?.stocks.materials,30);assert.equal(ctx.cities['b']?.stocks.food,40);
 assert.equal(ownedEscrow(ctx.diplomacy,'a').food,0);assert.equal(hasPact(ctx.diplomacy,{from:'a',to:'b',now:5}),true);assert.equal(hasPact(ctx.diplomacy,{from:'a',to:'b',now:6}),false);
});
test('unanswered offer releases goods on deadline but does not refund envoy',()=>{
 // Given a pending offer; When its deadline is reached; Then goods return and the paid action remains a cost.
 const ctx=fixture();proposeContract(ctx,terms());advanceContracts({...ctx,now:1});
 assert.equal(ctx.cities['a']?.stocks.food,500);assert.equal(ctx.cities['a']?.stocks.coin,99);assert.equal(ctx.diplomacy.contracts[0]?.status,'expired');
});
test('scarcity utility refuses an exploitative offer despite diplomacy policy',()=>{
 // Given expensive requested food and token payment; When an AI is asked to accept; Then negative utility rejects.
 const ctx=fixture(),b=ctx.cities['b'];assert.ok(b);b.policy.diplomacy=100;
 const bad={...terms(),give:{food:0,materials:0,tools:0,coin:1},take:{food:5,materials:0,tools:0,coin:0}};
 assert.ok(proposeContract(ctx,bad).ok);const result=answerContract(ctx,bad.id,true);assert.ok(result.ok);assert.equal(result.contract.status,'rejected');
});
test('breach transfers compensation and releases both owners escrow',()=>{
 // Given a shipped agreement; When one side breaches; Then the other receives compensation without minted resources.
 const ctx=fixture();proposeContract(ctx,terms());answerContract(ctx,terms().id,true);const before=total(ctx);
 const result=breachContract(ctx,terms().id,'a');assert.ok(result.ok);assert.equal(result.contract.status,'breached');assert.deepEqual(total(ctx),before);
 assert.equal(ctx.diplomacy.reputation['a'],-4);assert.equal(hasPact(ctx.diplomacy,{from:'a',to:'b',now:0}),false);assert.equal(ownedEscrow(ctx.diplomacy,'a').coin,0);
});
test('same contract ID and over-reservation cannot spend twice',()=>{
 // Given a pending reservation; When the same command is retried; Then ownership and costs remain unchanged.
 const ctx=fixture();proposeContract(ctx,terms());const before=total(ctx);assert.equal(proposeContract(ctx,terms()).ok,false);assert.deepEqual(total(ctx),before);
 const other=fixture();assert.equal(proposeContract(other,{...terms(),give:{food:126,materials:0,tools:0,coin:0}}).ok,false);
});
test('enabled trade finds useful finite partner while disabled control has no effect',()=>{
 // Given identical cities in ON/OFF worlds; When the bot searches a partner; Then only enabled diplomacy consumes goods and can prevent a raid.
 const on=fixture(),off=fixture(false),result=autoOffer(on,'a','b');assert.ok(result.ok);answerContract(on,result.contract.id,true);
 assert.equal(recordAvoidedRaid(on,'a','b'),true);assert.equal(autoOffer(off,'a','b').ok,false);assert.equal(recordAvoidedRaid(off,'a','b'),false);assert.equal(off.diplomacy.receipts.length,0);
});
test('acceptance reevaluates current scarcity rather than trusting old quote',()=>{
 // Given a once-useful offer; When receiver stock changes before acceptance; Then current utility can refuse it.
 const ctx=fixture();proposeContract(ctx,terms());const b=ctx.cities['b'];assert.ok(b);book(b,{resource:'food',amount:10000,reason:'fixture-new-harvest'});
 const result=answerContract(ctx,terms().id,true);assert.ok(result.ok);assert.equal(result.contract.status,'rejected');
});
test('late answers cannot revive expired offers or a finished pact',()=>{
 // Given a pending offer; When acceptance arrives at the deadline; Then it expires and releases ownership.
 const ctx=fixture();proposeContract(ctx,terms());const result=answerContract({...ctx,now:1},terms().id,true);
 assert.equal(result.ok,false);assert.equal(ctx.diplomacy.contracts[0]?.status,'expired');assert.equal(ctx.cities['a']?.stocks.food,500);
});
