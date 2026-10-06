import { AXES, TERRAINS, advanceCity, createCity, emptyStocks, policyPreset, population, setPolicy, type Axis, type City, type Terrain } from '../model/index.js';
import { BASE_STRATEGIES, CHALLENGERS, policyFor, type Strategy } from './strategies.js';
import { compactGame } from './compact.js';
import { runGame, resourceValue } from './game.js';
import type { ScheduledGame } from './schedule.js';
export type SupplementKind='growth'|'challenge'|'diplomacy'|'geometry';
export type GrowthTask={readonly kind:'growth';readonly id:string;readonly seed:number;readonly terrain:Terrain;readonly strategy:Strategy};
export type GameTask={readonly kind:'challenge'|'diplomacy';readonly id:string;readonly game:ScheduledGame};
export type GeometryTask={readonly kind:'geometry';readonly id:string;readonly seed:number};
export type SupplementTask=GrowthTask|GameTask|GeometryTask;
const MIXES:readonly (readonly [Axis,Axis])[]=[['trade','maritime'],['faith','military'],['craft','scholarship'],['agriculture','diplomacy']];
const DIPLOMACY_PAIRS=[['diplomacy','agriculture'],['diplomacy','trade'],['diplomacy','military'],['agriculture+diplomacy','military']] as const;
function strategy(id:string):Strategy {const result=BASE_STRATEGIES.find(s=>s.id===id);if(!result)throw new RangeError(`Missing strategy ${id}`);return result;}
export function supplementSchedule(kind:SupplementKind):SupplementTask[]{
 const tasks:SupplementTask[]=[];
 switch(kind){
  case 'growth':{
   const mixtures:Strategy[]=MIXES.flatMap(([a,b])=>[75,50,25].map(weight=>{const policy=policyPreset([]);policy[a]=weight;policy[b]=100-weight;return {id:`mix:${a}${weight}:${b}${100-weight}`,policy,adaptive:false};}));
   const strategies=[...BASE_STRATEGIES,...mixtures,{id:'policy-off',policy:policyPreset([]),adaptive:false}];
   for(const seed of [1,2,3,4,5])for(const terrain of TERRAINS)for(const selected of strategies)tasks.push({kind,id:`growth:${seed}:${terrain}:${selected.id}`,seed,terrain,strategy:selected});break;
  }
  case 'challenge':
   for(const challenger of CHALLENGERS)for(const base of BASE_STRATEGIES)for(const terrain of TERRAINS)for(const seed of [201,202,203,204,205,206])for(const rotation of [0,1]){
    const block=`challenge:${challenger.id}:${base.id}:${terrain}:${seed}`,id=`${block}:${rotation}`;
    tasks.push({kind,id,game:{id,block,rotation,strategies:rotation===0?[challenger,base]:[base,challenger],seed,terrain,growthSteps:96,diplomacyEnabled:true}});
   }break;
  case 'diplomacy':
   for(const pair of DIPLOMACY_PAIRS)for(const terrain of TERRAINS)for(const seed of [1,2,3,4,5])for(const rotation of [0,1])for(const enabled of [true,false]){
    const block=`diplomacy:${pair.join('/')}:${terrain}:${seed}:${rotation}`,id=`${block}:${enabled?'on':'off'}`;
    tasks.push({kind,id,game:{id,block,rotation,strategies:(rotation===0?[pair[0],pair[1]]:[pair[1],pair[0]]).map(strategy),seed,terrain,growthSteps:96,diplomacyEnabled:enabled}});
   }break;
  case 'geometry':for(const seed of [1,2,3,4,5])tasks.push({kind,id:`geometry:${seed}`,seed});break;
  default:return exhaustive(kind);
 }
 return tasks;
}
function exhaustive(value:never):never {throw new RangeError(`Unknown supplement kind ${String(value)}`);}
function growthPoint(city:City){
 const facilities=city.facilities.filter(f=>f.hp>0);
 const flows:Record<string,ReturnType<typeof emptyStocks>>={};
 for(const entry of city.ledger){const key=`${entry.account}:${entry.reason}`,stock=flows[key]??emptyStocks();stock[entry.resource]+=entry.amount;flows[key]=stock;}
 return {tick:city.tick,population:population(city),stocks:{...city.stocks},externalMarket:{...city.externalMarket},services:{...city.services},policy:{...city.policy},
  facilityCounts:Object.fromEntries(AXES.map(axis=>[axis,facilities.filter(f=>f.axis===axis).length])),
  employed:facilities.reduce((s,f)=>s+f.workers,0),mobilized:city.mobilized,migrantsRemaining:city.migrantsRemaining,starvation:city.starvation,
  facilities:facilities.map(f=>({...f})),roads:city.tiles.filter(t=>t.road).map(t=>({x:t.x,y:t.y})),
  radius:facilities.length?facilities.reduce((s,f)=>s+Math.hypot(f.x-10,f.y-10),0)/facilities.length:0,
  flows,decisions:city.receipts.map(r=>({tick:r.tick,household:r.householdId,chosen:r.chosen,costs:r.costs,reason:r.reason}))};
}
export function runGrowth(task:GrowthTask){
 const city=createCity(task.seed,task.terrain);const points:ReturnType<typeof growthPoint>[]=[];
 for(let tick=1;tick<=144;tick++){setPolicy(city,policyFor(task.strategy,city));advanceCity(city);if([48,96,144].includes(tick))points.push(growthPoint(city));}
 return {task,controlId:`growth:${task.seed}:${task.terrain}:policy-off`,points};
}
export function runSupplementGame(task:GameTask){
 const result=runGame(task.game),compact=compactGame(result,task.game);
 const snapshots=(phase:typeof compact.growth)=>phase.map(s=>({seat:s.seat,strategy:s.strategy,tick:s.tick,population:s.population,stocks:s.stocks,escrow:s.ownedEscrow,value:s.value,policy:s.policy,facilityCounts:s.facilityCounts,services:s.services}));
 const ledgerProfit=result.recovery.map(s=>({seat:s.seat,strategy:s.strategy,
  nominalOwnedEscrow:resourceValue(s.ownedEscrow),netContractResources:resourceValue(s.city.ledger.filter(e=>e.account==='city' && e.reason.startsWith('contract:')).reduce((stock,e)=>{stock[e.resource]+=e.amount;return stock;},emptyStocks()))}));
 const events=(event:string)=>new Set(result.diplomacy.receipts.filter(r=>r.event===event).map(r=>`${r.at}:${r.id}`)).size;
 return {task,growth:snapshots(compact.growth),foreign:snapshots(compact.foreign),recovery:snapshots(compact.recovery),wars:compact.wars,decisions:compact.decisions,order:compact.order,
  diplomacy:compact.diplomacy,metrics:{offered:events('offered'),accepted:events('accepted'),rejected:events('rejected'),delivered:events('delivered'),breached:events('breached'),expired:events('expired'),avoidedRaids:result.decisions.filter(d=>d.action==='honor-pact').length,raids:result.wars.filter(w=>w.mode==='raid').length,sieges:result.wars.filter(w=>w.mode==='siege').length,ledgerProfit}};
}
