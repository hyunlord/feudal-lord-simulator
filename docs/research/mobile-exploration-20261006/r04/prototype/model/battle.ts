import { book, population } from './economy.js';
import { emptyStocks, GRID_SIZE } from './rules.js';
import { random } from './random.js';
import { RESOURCES, type City } from './types.js';
import type { BattleCommand, BattleMap, BattleResult, BattleStep, Point } from './battle.types.js';
import { findRoute, guardExposure, movementCost } from './pathfinding.js';
export type { BattleCommand, BattleResult, BattleStep } from './battle.types.js';

// Copy every mutable branch. Ledger/receipt records and initial stock baselines are readonly.
// Add any future mutable City field here; explicit construction makes new required fields fail typecheck.
function copyBattleCity(city:City):City {
 return {seed:city.seed,rng:city.rng,terrain:city.terrain,tick:city.tick,policy:{...city.policy},
  stocks:{...city.stocks},externalMarket:{...city.externalMarket},initialStocks:city.initialStocks,initialMarket:city.initialMarket,
  households:city.households.map(h=>({...h,skills:{...h.skills}})),facilities:city.facilities.map(f=>({...f})),tiles:city.tiles.map(t=>({...t})),
  ledger:[...city.ledger],receipts:[...city.receipts],services:{...city.services},
  mobilized:city.mobilized,migrantsRemaining:city.migrantsRemaining,starvation:city.starvation};
}
function casualties(city:City,count:number):void {
 let remaining=count;
 for(const household of city.households) {
  const removed=Math.min(household.people,remaining); household.people-=removed;remaining-=removed;
 }
 for(const facility of city.facilities) {
  const residents=city.households.filter(h=>h.facilityId===facility.id).reduce((s,h)=>s+h.people,0);
  facility.workers=Math.min(facility.workers,residents);
 }
}
function entryPoint(city:City,entry:BattleCommand['entry']):Point {
 const border:Record<BattleCommand['entry'],(p:Point)=>boolean>={
  north:p=>p.y===0,east:p=>p.x===GRID_SIZE-1,south:p=>p.y===GRID_SIZE-1,west:p=>p.x===0,
 };
 const choices=city.tiles.filter(t=>border[entry](t) && (!t.water || t.road));
 choices.sort((a,b)=>Math.abs(a.x-10)+Math.abs(a.y-10)-Math.abs(b.x-10)-Math.abs(b.y-10) || a.y-b.y || a.x-b.x);
 return choices[0]??{x:0,y:0};
}
/** Local snapshot calculation. This is not authenticated server reservation/settlement. */
export function simulateBattle(source:City,target:City,command:BattleCommand):BattleResult {
 const attacker=copyBattleCity(source); const defender=copyBattleCity(target);
 const trace:BattleStep[]=[]; const loot=emptyStocks();
 const eligible=Math.max(0,Math.floor(population(attacker)*0.25)-attacker.mobilized);
 const deployed=Math.min(eligible,Math.max(0,Math.floor(command.soldiers??eligible)));
 const startingFood=Math.min(attacker.stocks.food,Math.max(0,Math.floor(command.supply??deployed*2)));
 const tools=Math.min(attacker.stocks.tools,command.mode==='siege'?deployed:Math.ceil(deployed/3));
 const guardCount=Math.min(Math.floor(population(defender)*0.25),defender.facilities.filter(f=>f.axis==='military' && f.hp>0).reduce((s,f)=>s+f.workers,0));
 const map:BattleMap={city:defender,mode:command.mode,guards:guardCount};
 const start=entryPoint(defender,command.entry);
 const targets=defender.facilities.filter(f=>f.hp>0 && (command.mode==='siege'?f.axis==='military':f.axis==='trade'||f.axis==='craft'));
 targets.sort((a,b)=>a.id-b.id);
 const objective:Point=targets[0]??{x:10,y:10};
 const route=findRoute(map,start,objective);
 let soldiers=deployed; let food=startingFood; let attackerLosses=0;let defenderLosses=0;
 let damage=0;let guardDamage=0;let reached=false;let returned=false;let reason='목표까지 갈 길이 없습니다';
 const state={rng:command.seed>>>0};
 if(!Number.isSafeInteger(command.seed) || !Number.isSafeInteger(deployed) || !Number.isSafeInteger(startingFood)) throw new RangeError('Battle command must have finite integer seed, soldiers and supply');
 if(deployed===0 || startingFood<deployed*0.25) reason='출정할 일손 또는 보급이 부족합니다';
 else if(route.length>0) {
  book(attacker,{resource:'food',amount:-startingFood,reason:'출정 보급 반출'});
  book(attacker,{resource:'tools',amount:-tools,reason:'출정 장비 소모'});
  const travel: {point:Point;phase:BattleStep['phase'];duration:number}[]=[];
  for(const point of route) travel.push({point,phase:'advance',duration:Math.ceil(movementCost(map,point))});
  travel.push({point:objective,phase:'objective',duration:command.mode==='siege'?12:4});
  for(const point of [...route].reverse()) travel.push({point,phase:'return',duration:Math.ceil(movementCost(map,point))});
  const visited:Point[]=[];let retreating=false;
  for(let legIndex=0;legIndex<travel.length;legIndex++) {
   const leg=travel[legIndex];if(!leg)break;
   if(leg.phase==='advance') visited.push(leg.point);
   const duration=leg.phase==='objective'?leg.duration:Math.ceil(movementCost(map,leg.point));
   for(let elapsed=0;elapsed<duration;elapsed++) {
    if(trace.length>=256 || soldiers===0 || food<=0) break;
    const gate=defender.facilities.find(f=>f.axis==='military' && f.hp>0 && f.x===leg.point.x && f.y===leg.point.y);
    const phase=leg.phase==='advance' && gate?'breach':leg.phase;
    const exposure=guardExposure(map,leg.point)*Math.max(0,guardCount-defenderLosses)/Math.max(1,guardCount);
    food=Math.max(0,food-soldiers*0.025);
    damage+=exposure*0.045*(0.85+random(state)*0.3)/(1+tools/Math.max(1,deployed));
    guardDamage+=exposure>0?soldiers*0.015*(1+Math.min(1,attacker.services.training/100)):0;
    const loss=Math.min(soldiers,Math.floor(damage));damage-=loss;soldiers-=loss;attackerLosses+=loss;
    const guardLoss=Math.min(guardCount-defenderLosses,Math.floor(guardDamage));guardDamage-=guardLoss;defenderLosses+=guardLoss;
    if(gate && command.mode==='siege' && tools>0) gate.hp=Math.max(0,gate.hp-Math.max(1,tools));
    trace.push({step:trace.length+1,...leg.point,phase,soldiers,food,exposure,losses:loss});
   }
   if(trace.length>=256 || soldiers===0 || food<=0) {reason='병력·보급·시간 한계로 출정이 중단되었습니다';break;}
   if(leg.phase==='advance' && !retreating && (food<startingFood*0.55 || trace.length>=110)) {
    retreating=true;travel.splice(legIndex+1);
    for(const point of [...visited].reverse())travel.push({point,phase:'return',duration:0});
    reason='귀환 보급을 남기기 위해 목표 도달 전 철수했습니다';
   }
   if(leg.phase==='objective') reached=command.mode==='raid' || !targets[0] || targets[0].hp===0;
   if(leg.phase==='return' && leg.point.x===start.x && leg.point.y===start.y) returned=true;
  }
  if(reached && returned) {
   let capacity=soldiers*2; // Carrying is finite; survival food remains with defender.
   for(const resource of RESOURCES) {
    const protectedStock=resource==='food'?population(defender)*2:0;
    const available=Math.max(0,defender.stocks[resource]-protectedStock);
    const taken=command.mode==='raid'?Math.min(Math.floor(available*0.1),capacity):0;
    loot[resource]=taken;capacity-=taken;
    book(defender,{resource,amount:-taken,reason:'약탈 반출'});book(attacker,{resource,amount:taken,reason:'약탈 반입'});
   }
   reason=command.mode==='raid'?'창고에 도달해 보호 재고를 제외한 한정 전리품을 운반했습니다':'관문을 돌파하고 귀환했습니다. 공성은 재고 약탈을 지급하지 않습니다';
  }
  if(returned)book(attacker,{resource:'food',amount:Math.floor(food),reason:'미소비 출정 보급 반환'});
  else if(soldiers>0) {attackerLosses+=soldiers;soldiers=0;reason+='; 귀환하지 못한 병력은 실종/포로 손실로 기록합니다';}
  casualties(attacker,attackerLosses);casualties(defender,defenderLosses);
  attacker.mobilized=Math.min(population(attacker),attacker.mobilized+soldiers);
  defender.mobilized=Math.min(population(defender),defender.mobilized+guardCount-defenderLosses);
 }
 return {attacker,defender,command,trace,route,objective,success:reached&&returned,loot,attackerLosses,defenderLosses,steps:trace.length,reason,deployed};
}
