import { advanceCity, createCity, emptyStocks, population, setPolicy, type City, type Stocks } from '../model/index.js';
import { simulateBattle, type BattleCommand, type BattleResult } from '../model/battle.js';
import { advanceContracts, answerContract, autoOffer, breachContract, createDiplomacy, hasPact, ownedEscrow, recordAvoidedRaid, type ContractContext, type DiplomacyState } from '../model/contracts.js';
import { policyFor } from './strategies.js';
import { rotate, type GameSpec } from './schedule.js';
export type Snapshot={readonly seat:string;readonly strategy:string;readonly city:City;readonly ownedEscrow:Stocks;readonly value:number;readonly flows:Readonly<Record<string,Stocks>>};
export type WarRecord={readonly round:number;readonly from:string;readonly to:string;readonly mode:BattleCommand['mode'];readonly success:boolean;readonly loot:Readonly<Stocks>;readonly attackerLosses:number;readonly defenderLosses:number;readonly exposure:number;readonly steps:number;readonly deployed:number;readonly netResources:number;readonly objective:Readonly<{x:number;y:number}>;readonly reason:string};
export type Decision={readonly round:number;readonly seat:string;readonly target:string|null;readonly action:'peace'|'raid'|'siege'|'honor-pact'|'breach';readonly utility:number;readonly reason:string};
export type GameResult={readonly spec:GameSpec;readonly growth:readonly Snapshot[];readonly foreign:readonly Snapshot[];readonly recovery:readonly Snapshot[];readonly diplomacy:DiplomacyState;readonly wars:readonly WarRecord[];readonly decisions:readonly Decision[];readonly order:readonly (readonly string[])[]};
export function resourceValue(stock:Readonly<Stocks>):number{return stock.food+2*stock.materials+4*stock.tools+stock.coin;}
export function cityValue(city:City,escrow:Readonly<Stocks>=emptyStocks()):number{return 12*population(city)+resourceValue(city.stocks)+resourceValue(escrow);}
function snapshots(ctx:ContractContext,spec:GameSpec):Snapshot[]{
 return Object.entries(ctx.cities).map(([seat,city],index)=>{
  const flows:Record<string,Stocks>={};
  for(const entry of city.ledger){const key=`${entry.account}:${entry.reason}`;const stock=flows[key]??emptyStocks();stock[entry.resource]+=entry.amount;flows[key]=stock;}
  const escrow=ownedEscrow(ctx.diplomacy,seat);
  return {seat,strategy:spec.strategies[index]?.id??'missing',city:structuredClone(city),ownedEscrow:escrow,value:cityValue(city,escrow),flows};
 });
}
function forecastUtility(before:City,target:City,result:BattleResult):number {
 const direct=cityValue(result.attacker)-cityValue(before);
 // Lost production and scarcity make the same finite loot less attractive to hungry towns.
 const foodNeed=Math.max(0,population(before)*2-result.attacker.stocks.food);
 const laborCost=result.deployed*0.5;
 const destroyed=target.facilities.filter(f=>f.axis==='military'&&f.hp>0&&result.defender.facilities.some(after=>after.id===f.id&&after.hp===0)).length;
 const deterrence=result.command.mode==='siege'?Math.min(12,result.defender.services.training*0.04)*destroyed:0;
 return direct-foodNeed*0.1-laborCost+deterrence;
}
export type PreparedGrowth={readonly strategy:string;readonly city:City};
export function prepareGrowth(spec:GameSpec):PreparedGrowth[]{
 return spec.strategies.map(strategy=>{
  const city=createCity(spec.seed,spec.terrain);
  for(let tick=0;tick<spec.growthSteps;tick++){setPolicy(city,policyFor(strategy,city));advanceCity(city,1);}
  return {strategy:strategy.id,city};
 });
}
export type Phase='growth'|'economy'|'contracts'|'forecast'|'battle'|'snapshots'|'recovery';
export type RunOptions={readonly growth?:readonly PreparedGrowth[];readonly onPhase?:(phase:Phase,milliseconds:number)=>void};
export function runGame(spec:GameSpec,options:RunOptions={}):GameResult {
 if(!Number.isSafeInteger(spec.seed)||!Number.isInteger(spec.growthSteps)||spec.growthSteps<0||spec.strategies.length<2||spec.strategies.length>4)throw new RangeError('Invalid game specification');
 // Mutable match accumulator. Each seat starts with identical finite market endowments.
 const cities:Record<string,City>={};
 let started=options.onPhase?performance.now():0;
 const prepared=options.growth??prepareGrowth(spec);
 if(prepared.length!==spec.strategies.length)throw new RangeError('Prepared growth seat count mismatch');
 prepared.forEach((entry,index)=>{
  if(entry.strategy!==spec.strategies[index]?.id||entry.city.seed!==spec.seed||entry.city.terrain!==spec.terrain||entry.city.tick!==spec.growthSteps)throw new RangeError('Prepared growth identity mismatch');
  cities[`seat-${index}`]=structuredClone(entry.city);
 });
 options.onPhase?.('growth',performance.now()-started);
 const diplomacy=createDiplomacy(spec.diplomacyEnabled);const wars:WarRecord[]=[];const decisions:Decision[]=[];const order:string[][]=[];
 started=options.onPhase?performance.now():0;
 const growth=snapshots({cities,diplomacy,now:0},spec);
 options.onPhase?.('snapshots',performance.now()-started);
 const seats=Object.keys(cities);
 for(let round=0;round<12;round++){
  const ordered=rotate(seats,round%seats.length);order.push(ordered);
  started=options.onPhase?performance.now():0;
  for(const seat of ordered){const city=cities[seat];const index=seats.indexOf(seat);const strategy=spec.strategies[index];if(city&&strategy){setPolicy(city,policyFor(strategy,city));advanceCity(city,1);}}
  options.onPhase?.('economy',performance.now()-started);started=options.onPhase?performance.now():0;
  const ctx:ContractContext={cities,diplomacy,now:round};advanceContracts(ctx);
  for(const from of ordered)for(const to of ordered){if(from===to)continue;const offered=autoOffer(ctx,from,to);if(offered.ok)answerContract(ctx,offered.contract.id,true);}
  options.onPhase?.('contracts',performance.now()-started);
  for(const from of ordered){
   const city=cities[from];if(!city)continue;
   started=options.onPhase?performance.now():0;
   let best:{to:string;command:BattleCommand;utility:number}|null=null;
   for(const to of ordered){const target=cities[to];if(to===from||!target||population(target)===0)continue;
    for(const mode of ['raid','siege'] as const){
     const command:BattleCommand={seed:spec.seed+round*31+seats.indexOf(from)*7,mode,entry:'north',supply:Math.min(city.stocks.food,Math.floor(population(city)*0.25)*4)};
     // One disclosed scout forecast, not access to the realized combat random stream.
     const result=simulateBattle(city,target,{...command,seed:command.seed+7919});
     const utility=forecastUtility(city,target,result);
     if(utility>0&&(!best||utility>best.utility))best={to,command,utility};
    }
   }
   options.onPhase?.('forecast',performance.now()-started);
   if(!best){decisions.push({round,seat:from,target:null,action:'peace',utility:0,reason:'forecast raid/siege return does not cover supplies, casualties, scarcity and labor'});continue;}
   if(hasPact(diplomacy,{from,to:best.to,now:round})){
    const contract=diplomacy.contracts.find(c=>hasPact({...diplomacy,contracts:[c]},{from,to:best.to,now:round}));
    const breachCost=(contract?.bonds[from]??0)+Math.min(2,city.stocks.coin)+8;
    if(best.utility<=breachCost||!contract){recordAvoidedRaid(ctx,from,best.to);decisions.push({round,seat:from,target:best.to,action:'honor-pact',utility:best.utility,reason:`paid peace: raid utility <= breach cost ${breachCost}, including disclosed future reputation opportunity estimate 8`});continue;}
    breachContract(ctx,contract.id,from);decisions.push({round,seat:from,target:best.to,action:'breach',utility:best.utility-breachCost,reason:'forecast raid gain exceeds compensation and future reputation opportunity estimate'});
   }
   const target=cities[best.to];if(!target)continue;
   started=options.onPhase?performance.now():0;
   const before=resourceValue(city.stocks);const result=simulateBattle(city,target,best.command);
   options.onPhase?.('battle',performance.now()-started);
   cities[from]=result.attacker;cities[best.to]=result.defender;
   decisions.push({round,seat:from,target:best.to,action:best.command.mode,utility:best.utility,reason:result.reason});
   wars.push({round,from,to:best.to,mode:best.command.mode,success:result.success,loot:result.loot,attackerLosses:result.attackerLosses,defenderLosses:result.defenderLosses,exposure:result.trace.reduce((s,t)=>s+t.exposure,0),steps:result.steps,deployed:result.deployed,netResources:resourceValue(result.attacker.stocks)-before,objective:result.objective,reason:result.reason});
  }
 }
 started=options.onPhase?performance.now():0;
 const foreign=snapshots({cities,diplomacy,now:12},spec);
 options.onPhase?.('snapshots',performance.now()-started);started=options.onPhase?performance.now():0;
 for(let recovery=0;recovery<24;recovery++){
  for(const [index,seat] of seats.entries()){const city=cities[seat],strategy=spec.strategies[index];if(city&&strategy){setPolicy(city,policyFor(strategy,city));advanceCity(city,1);}}
  advanceContracts({cities,diplomacy,now:12+recovery});
 }
 options.onPhase?.('recovery',performance.now()-started);started=options.onPhase?performance.now():0;
 const recovery=snapshots({cities,diplomacy,now:36},spec);options.onPhase?.('snapshots',performance.now()-started);
 return {spec,growth,foreign,recovery,diplomacy,wars,decisions,order};
}
