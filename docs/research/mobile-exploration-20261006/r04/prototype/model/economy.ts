import { AXES, RESOURCES, type Axis, type Booking, type Candidate, type City, type Household, type Policy, type Stocks, type Terrain, type Tile } from './types.js';
import { COSTS, emptyStocks, policyPreset, support, validPolicy } from './rules.js';
import { random } from './random.js';
import { connectRoad, makeTiles, siteAccess } from './terrain.js';
export function population(city:City):number { return city.households.reduce((n,h)=>n+h.people,0); }
export function createCity(seed:number,terrain:Terrain):City {
 if(!Number.isSafeInteger(seed)) throw new RangeError('Seed must be an integer');
 const stocks={food:180,materials:100,tools:30,coin:160};
 const market={food:4000,materials:2500,tools:1200,coin:6000};
 const city:City={seed,rng:seed>>>0,terrain,tick:0,policy:policyPreset([]),stocks:{...stocks},externalMarket:{...market},initialStocks:stocks,initialMarket:market,households:[],facilities:[],tiles:makeTiles(seed,terrain),ledger:[],receipts:[],services:{knowledge:0,care:0,influence:0,transport:0,training:0},mobilized:0,migrantsRemaining:24,starvation:0};
 for(let id=0;id<8;id++) {
  const skills:Policy=policyPreset([]);for(const axis of AXES)skills[axis]=Math.floor(random(city)*4);
  city.households.push({id,people:3,x:9+id%3,y:9+Math.floor(id/3),skills,facilityId:null});
 }
 return city;
}
export function setPolicy(city:City,policy:Policy):boolean {
 if(!validPolicy(policy))return false;city.policy={...policy};return true;
}
export function book(city:City,entry:Booking):boolean {
 const account=entry.account??'city';const stock=account==='city'?city.stocks:city.externalMarket;
 if(!Number.isSafeInteger(entry.amount) || stock[entry.resource]+entry.amount<0)return false;
 stock[entry.resource]+=entry.amount;
 city.ledger.push({tick:city.tick,account,resource:entry.resource,amount:entry.amount,reason:entry.reason});return true;
}
function pay(city:City,cost:Readonly<Stocks>,reason:string):boolean {
 if(RESOURCES.some(r=>city.stocks[r]<cost[r]))return false;
 for(const resource of RESOURCES)if(cost[resource]>0)book(city,{resource,amount:-cost[resource],reason});return true;
}
function demand(city:City,axis:Axis):number {
 switch(axis){
  case 'agriculture':return Math.min(16,Math.max(0,population(city)*5-city.stocks.food)/8);
  case 'craft':return Math.max(0,30-city.stocks.tools)/3;
  case 'trade':return city.stocks.coin<80?8:2;
  case 'military':return city.services.training<12?3:0;
  case 'faith':return city.services.care<10?3:0;
  case 'scholarship':return city.services.knowledge<15?3:0;
  case 'maritime':return city.services.transport<10?3:0;
  case 'diplomacy':return city.services.influence<10?3:0;
  default:return assertNever(axis);
 }
}
function affinity(axis:Axis,tile:Tile):number {
 switch(axis){
  case 'agriculture':return tile.fertility*1.8+(Math.abs(tile.x-10)+Math.abs(tile.y-10))*0.3;
  case 'craft':return tile.wood*1.5;
  case 'military':return tile.elevation*2+(tile.x===10?3:0)-Math.abs(tile.y-3)*0.35;
  case 'maritime':return (tile.x<8?7:0)-tile.x*0.3;
  case 'faith':return 5-Math.hypot(tile.x-10,tile.y-10)*0.8;
  case 'scholarship':return 5-Math.hypot(tile.x-12,tile.y-9)*0.8;
  case 'trade':return tile.road?6:0;
  case 'diplomacy':return tile.road?5-Math.abs(tile.x-17)*0.3:0;
  default:return assertNever(axis);
 }
}
function assertNever(value:never):never { throw new RangeError(`Unknown axis ${String(value)}`); }
function settleHousehold(city:City,household:Household,funded:boolean):void {
 const candidates:Candidate[]=[];
 const incumbent=city.facilities.find(f=>f.id===household.facilityId && f.hp>0);
 for(const axis of AXES){
  if(incumbent && axis===incumbent.axis)continue;
  if(RESOURCES.some(r=>city.stocks[r]<COSTS[axis][r]))continue;
  const count=city.facilities.filter(f=>f.axis===axis && f.hp>0).length;
  let best:Candidate|null=null;
  for(const tile of city.tiles){
   if(tile.water || city.facilities.some(f=>f.hp>0 && f.x===tile.x && f.y===tile.y) || city.households.some(h=>h.x===tile.x && h.y===tile.y))continue;
   const reasons={policy:funded?support(city.policy[axis]):0,demand:demand(city,axis),skill:household.skills[axis],site:affinity(axis,tile),access:siteAccess(city,tile),competition:-count*3,commute:-Math.hypot(tile.x-household.x,tile.y-household.y)*0.3,seedPreference:random(city)*2};
   const score=Object.values(reasons).reduce((a,b)=>a+b,0);
   if(best===null || score>best.score)best={axis,x:tile.x,y:tile.y,score,reasons};
  }
  if(best)candidates.push(best);
 }
 candidates.sort((a,b)=>b.score-a.score);
 const chosen=candidates[0]??null;
 const costs=chosen?COSTS[chosen.axis]:emptyStocks();
 if(chosen && pay(city,costs,'household construction')){
  if(incumbent){incumbent.hp=0;incumbent.workers=0;}
  const id=city.facilities.length;
  city.facilities.push({id,axis:chosen.axis,x:chosen.x,y:chosen.y,workers:0,hp:100});household.facilityId=id;
  const tile=city.tiles.find(t=>t.x===chosen.x && t.y===chosen.y);if(tile)connectRoad(city,tile);
 }
 city.receipts.push({tick:city.tick,householdId:household.id,chosen,alternatives:candidates.slice(1,4),reason:chosen?(incumbent?'Business closed without salvage; alternative occupation and construction paid':'Highest feasible pre-decision score; construction paid'):'No affordable site; continues gathering',costs:{...costs},policy:{...city.policy}});
}
function produce(city:City,axis:Axis,workers:number):void {
 if(workers===0)return;
 const output=(resource:keyof Stocks,amount:number)=>book(city,{resource,amount,reason:`${axis} labor output (${workers})`});
 const cost=emptyStocks();
 switch(axis){
  case 'agriculture':{
   if(city.tick%6===0){cost.tools=Math.ceil(workers/2);if(!pay(city,cost,'agricultural tool wear'))break;}
   const land=city.facilities.filter(f=>f.axis===axis && f.hp>0).reduce((s,f)=>s+(city.tiles.find(t=>t.x===f.x && t.y===f.y)?.fertility??1),0);
   output('food',Math.floor(workers*(3+land/Math.max(1,city.facilities.filter(f=>f.axis===axis && f.hp>0).length)*0.25+Math.min(1,city.services.knowledge/200))));break;
  }
  case 'craft':cost.materials=workers; if(pay(city,cost,'craft inputs'))output('tools',workers);break;
  case 'trade':city.services.transport+=workers;break;
  case 'military':cost.food=workers;cost.coin=Math.ceil(workers/2);if(city.tick%6===0)cost.tools=Math.ceil(workers/2);if(pay(city,cost,'garrison maintenance'))city.services.training+=workers;break;
  case 'faith':cost.food=workers; if(pay(city,cost,'relief distribution'))city.services.care+=workers;break;
  case 'scholarship':cost.coin=Math.ceil(workers/2);if(pay(city,cost,'scholar wages'))city.services.knowledge+=workers;break;
  case 'maritime':cost.materials=Math.ceil(workers/3);if(city.terrain==='mountain'||city.terrain==='forest')cost.coin=workers;if(pay(city,cost,'boat upkeep or inland port haulage')){output('food',workers*3);city.services.transport+=workers;}break;
  case 'diplomacy':cost.coin=Math.ceil(workers/2);if(pay(city,cost,'envoy wages'))city.services.influence+=workers;break;
  default:assertNever(axis);
 }
}
function exchange(city:City):void {
 const capacity=2+city.facilities.filter(f=>f.axis==='trade' || f.axis==='maritime').reduce((n,f)=>n+f.workers,0);
 const target:Stocks={food:population(city)*4,materials:25,tools:12,coin:0};
 const price:Stocks={food:1,materials:2,tools:4,coin:1};
 for(const resource of ['food','materials','tools'] as const){
  const surplus=Math.max(0,city.stocks[resource]-target[resource]);
  const sold=Math.min(surplus,capacity,Math.floor(city.externalMarket.coin/price[resource]));
  if(sold>0){book(city,{resource,amount:-sold,reason:'export'});book(city,{resource,amount:sold,account:'market',reason:'import from city'});book(city,{resource:'coin',amount:sold*price[resource],reason:'export payment'});book(city,{resource:'coin',amount:-sold*price[resource],account:'market',reason:'purchase from city'});}
  const bought=Math.min(Math.max(0,target[resource]-city.stocks[resource]),capacity,city.externalMarket[resource],Math.floor(city.stocks.coin/price[resource]));
  if(bought>0){book(city,{resource,amount:bought,reason:'import'});book(city,{resource,amount:-bought,account:'market',reason:'export to city'});book(city,{resource:'coin',amount:-bought*price[resource],reason:'import payment'});book(city,{resource:'coin',amount:bought*price[resource],account:'market',reason:'city payment'});}
 }
}
export function advanceCity(city:City,steps=1):City {
 if(!Number.isSafeInteger(steps)||steps<0)throw new RangeError('Steps must be a nonnegative integer');
 for(let step=0;step<steps;step++){
  city.tick++;
  for(const f of city.facilities)f.workers=0;
  let labor=Math.max(0,city.households.reduce((s,h)=>s+Math.max(0,h.people-1),0)-city.mobilized);
  // Survival work takes precedence, but conscripted people remain unavailable.
  const forage=Math.min(labor,Math.max(0,Math.ceil((population(city)*3-city.stocks.food)/3)));
  labor-=forage;book(city,{resource:'food',amount:forage*3,reason:`emergency foraging labor (${forage})`});
  const gather=Math.min(labor,city.stocks.materials<35?3:0);labor-=gather;
  book(city,{resource:'materials',amount:gather*2,reason:`material gathering labor (${gather})`});
  const jobs=[...city.facilities].filter(f=>f.hp>0).sort((a,b)=>city.policy[b.axis]-city.policy[a.axis] || a.id-b.id);
  for(const facility of jobs){const workers=Math.min(2,labor);facility.workers=workers;labor-=workers;produce(city,facility.axis,workers);}
  if(labor>0)book(city,{resource:'food',amount:labor*3,reason:`unassigned subsistence labor (${labor})`});
  exchange(city);
  const need=population(city);const consumed=Math.min(need,city.stocks.food);
  book(city,{resource:'food',amount:-consumed,reason:'household meals'});
  city.starvation=consumed<need?city.starvation+1:0;
  if(city.starvation>=4){const h=city.households.find(h=>h.people>0);if(h)h.people--;city.starvation=0;}
  if(city.tick%4===0){
   const household=city.households.find(h=>h.people>1 && h.facilityId===null);
   if(household){const budget=Math.ceil(AXES.reduce((n,a)=>n+city.policy[a],0)/25);const funded=book(city,{resource:'coin',amount:-budget,reason:'public policy administration'});settleHousehold(city,household,funded);}
  }
  if(city.tick%12===0){
   const strongest=Math.max(...AXES.map(axis=>city.policy[axis]));
   const reconsider=city.households.find(h=>{const f=city.facilities.find(f=>f.id===h.facilityId && f.hp>0);return h.people>1 && f!==undefined && strongest-city.policy[f.axis]>=25;});
   if(reconsider){const budget=Math.ceil(AXES.reduce((n,a)=>n+city.policy[a],0)/25);const funded=book(city,{resource:'coin',amount:-budget,reason:'occupation review administration'});if(funded)settleHousehold(city,reconsider,true);}
  }
  city.mobilized=0;
  if(city.tick%12===0 && city.migrantsRemaining>0 && city.stocks.food>population(city)*4 && city.services.care>=2 && city.households.length<16){
   const id=city.households.length;const skills=policyPreset([]);for(const axis of AXES)skills[axis]=Math.floor(random(city)*4);
   city.households.push({id,people:3,x:8+id%5,y:12+Math.floor(id/5),skills,facilityId:null});city.migrantsRemaining=Math.max(0,city.migrantsRemaining-3);city.services.care-=2;
  }
 }
 return city;
}
