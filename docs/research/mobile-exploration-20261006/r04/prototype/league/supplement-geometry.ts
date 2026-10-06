import { createCity, type City } from '../model/index.js';
import { simulateBattle, type BattleResult } from '../model/battle.js';
import type { GeometryTask } from './supplement-data.js';
function field(seed:number):City{
 const city=createCity(seed,'mountain');city.tiles=city.tiles.map(t=>({...t,water:false,elevation:0,road:true}));
 city.facilities=[{id:0,axis:'trade',x:10,y:10,workers:2,hp:100}];return city;
}
function metrics(result:BattleResult){return {route:result.route,steps:result.steps,exposure:result.trace.reduce((s,t)=>s+t.exposure,0),losses:result.attackerLosses,guardLosses:result.defenderLosses,deployed:result.deployed,loot:result.loot,remaining:result.attacker.stocks,success:result.success,reason:result.reason};}
export function runGeometry(task:GeometryTask){
 const attacker=field(task.seed),near=field(task.seed),far=field(task.seed);
 near.facilities=[{id:0,axis:'trade',x:10,y:2,workers:2,hp:100}];far.facilities=[{id:0,axis:'trade',x:10,y:18,workers:2,hp:100}];
 const command={seed:task.seed,mode:'raid',entry:'north',soldiers:6,supply:24} as const;
 const nearResult=simulateBattle(attacker,near,command),farResult=simulateBattle(attacker,far,command);
 const gateNear=field(task.seed),gateFar=field(task.seed);
 gateNear.facilities.push({id:1,axis:'military',x:10,y:1,workers:2,hp:100});gateFar.facilities.push({id:1,axis:'military',x:0,y:20,workers:2,hp:100});
 const guarded=simulateBattle(attacker,gateNear,command),unguarded=simulateBattle(attacker,gateFar,command);
 const fingerprint=(city:City)=>JSON.stringify({stocks:city.stocks,people:city.households.map(h=>h.people),services:city.services,facilities:city.facilities.map(({x:_x,y:_y,...rest})=>rest)});
 return {task,synthetic:'identical flat land/all-road fixture; positions are sole changed input',command,
  store:{near:metrics(nearResult),far:metrics(farResult),sameCountsStocksAndPeople:fingerprint(near)===fingerprint(far),pathDiffers:JSON.stringify(nearResult.route)!==JSON.stringify(farResult.route),farCostsMoreFood:farResult.attacker.stocks.food<nearResult.attacker.stocks.food},
  guard:{near:metrics(guarded),far:metrics(unguarded),sameCountsStocksAndPeople:fingerprint(gateNear)===fingerprint(gateFar),sameDeployed:guarded.deployed===unguarded.deployed,nearExposureHigher:metrics(guarded).exposure>metrics(unguarded).exposure},
  cosmetic:{status:'requires actual UI palette toggle evidence; no purchase product implemented',gameplayFlagAccepted:false}};
}
