import { AXES, RESOURCES } from '../model/types.js';
import { dominantShares, duelScore, entropy, summarizeDuels, value, winnerShares, type DuelScore } from './metrics.js';
import type { Game, Observation } from './analysis-input.js';
type Sum={count:number;total:number;wins:number;draws:number};
function increment(target:Record<string,number>,key:string,amount=1):void{target[key]=(target[key]??0)+amount;}
function score(target:Map<string,Sum>,key:string,amount:number):void{const row=target.get(key)??{count:0,total:0,wins:0,draws:0};row.count++;row.total+=amount;row.wins+=amount===1?1:0;row.draws+=amount===0.5?1:0;target.set(key,row);}
function rates(target:ReadonlyMap<string,Sum>){return [...target].sort(([a],[b])=>a.localeCompare(b)).map(([key,row])=>({key,...row,mean:row.total/row.count}));}
function distance(a:Readonly<Record<string,number>>,b:Readonly<Record<string,number>>):number{
 const at=Object.values(a).reduce((s,v)=>s+Math.abs(v),0),bt=Object.values(b).reduce((s,v)=>s+Math.abs(v),0);
 return [...new Set([...Object.keys(a),...Object.keys(b)])].reduce((s,key)=>s+Math.abs((a[key]??0)/(at||1)-(b[key]??0)/(bt||1)),0)/2;
}
function flowVector(city:Observation):Record<string,number>{return Object.fromEntries(Object.entries(city.flows).flatMap(([key,stock])=>RESOURCES.map(resource=>[`${key}:${resource}`,stock[resource]])));}
/** Streaming accumulator: only scores and sufficient-statistic sums survive each game. */
export class Analysis {
 private games=0;
 private readonly rows:DuelScore[]=[];
 private readonly strata=new Map<string,Sum>();
 private readonly multi=new Map<string,Sum>();
 private readonly ranks=new Map<string,Sum>();
 private readonly phases=new Map<string,{count:number;totals:Record<string,number>}>();
 private readonly changes=new Map<string,{count:number;totals:Record<string,number>}>();
 private readonly sensitivity=[6,12,24].flatMap(population=>[0.5,1,2].map(resources=>({population,resources,duel:new Map<string,Sum>(),multi:new Map<string,Sum>()})));
 private readonly topAxes:Record<string,number>={};private readonly allAxes:Record<string,number>={};
 private readonly topPolicies:Record<string,number>={};private readonly allPolicies:Record<string,number>={};
 private readonly pairDistances=new Map<string,Sum>();
 private readonly attacks=new Map<string,{attempts:number;successes:number;netResources:number;attackerLosses:number;defenderLosses:number;exposure:number;steps:number;deployed:number;loot:number}>();
 private readonly defenses=new Map<string,Sum>();private readonly decisions:Record<string,number>={};private readonly receipts:Record<string,number>={};
 private readonly peaceByStrategy=new Map<string,Sum>();private opportunities=0;private readonly seeds=new Set<number>();
 private sums(target:Map<string,{count:number;totals:Record<string,number>}>,key:string,values:Readonly<Record<string,number>>):void{
  const row=target.get(key)??{count:0,totals:{}};row.count++;for(const [name,value] of Object.entries(values))increment(row.totals,name,value);target.set(key,row);
 }
 add(game:Game):void{
  this.games++;this.seeds.add(game.seed);const cities=game.recovery;this.opportunities+=cities.length*12;
  if(cities.length!==2&&cities.length!==4)throw new RangeError('Only two/four seat games supported');
  const first=cities[0],second=cities[1];if(!first||!second)throw new RangeError('Missing seats');
  const shares=winnerShares(cities);
  cities.forEach((city,index)=>{
   const share=shares[index]??0;
   if(cities.length===2){const other=index===0?second:first;const result=duelScore(city,other);this.rows.push({strategy:city.strategy,seed:game.seed,score:result});
    for(const stratum of [`terrain=${game.terrain}`,`age=${game.age}`,`seat=${city.seat}`,`opponent=${other.strategy}`,`terrain=${game.terrain};age=${game.age};seat=${city.seat}`])score(this.strata,`${city.strategy}|${stratum}`,result);
   }else{
    score(this.multi,city.strategy,share);for(const stratum of [`terrain=${game.terrain}`,`seat=${city.seat}`,`seed=${game.seed}`])score(this.multi,`${city.strategy}|${stratum}`,share);
    score(this.ranks,city.strategy,cities.filter(c=>c!==city).reduce((sum,other)=>sum+duelScore(city,other),0)/(cities.length-1));
    const dominant=dominantShares(city.policy);for(const axis of AXES){increment(this.topAxes,axis,dominant[axis]*share);increment(this.allAxes,axis,dominant[axis]);}
    const vector=JSON.stringify(AXES.map(axis=>city.policy[axis]));increment(this.topPolicies,vector,share);increment(this.allPolicies,vector);
   }
   const peaceful=game.decisions.filter(d=>d.seat===city.seat&&(d.action==='peace'||d.action==='honor-pact')).length;
   score(this.peaceByStrategy,city.strategy,peaceful/12);
   for(const variant of this.sensitivity){if(cities.length===2)score(variant.duel,city.strategy,duelScore(city,index===0?second:first,variant.population,variant.resources));else score(variant.multi,city.strategy,winnerShares(cities,variant.population,variant.resources)[index]??0);}
  });
  for(const [phase,observations] of [['growth',game.growth],['foreign',game.foreign],['recovery',game.recovery]] as const){
   if(observations.length!==cities.length)throw new RangeError('Phase seat count mismatch');
   for(const city of observations){const values:Record<string,number>={population:city.population,value:value(city)};for(const r of RESOURCES){values[`stocks:${r}`]=city.stocks[r];values[`escrow:${r}`]=city.escrow[r];}for(const a of AXES)values[`facilities:${a}`]=city.facilities[a];Object.assign(values,flowVector(city));
    this.sums(this.phases,`${city.strategy}|${game.terrain}|${game.age}|${phase}`,values);
   }
  }
  for(const end of cities){const start=game.growth.find(c=>c.seat===end.seat),foreign=game.foreign.find(c=>c.seat===end.seat);if(!start||!foreign)throw new RangeError('Phase identity mismatch');this.sums(this.changes,end.strategy,{foreignValue:value(foreign)-value(start),recoveryValue:value(end)-value(foreign),totalValue:value(end)-value(start),foreignPopulation:foreign.population-start.population,recoveryPopulation:end.population-foreign.population});}
  for(let i=0;i<cities.length;i++)for(let j=i+1;j<cities.length;j++){const a=cities[i],b=cities[j];if(!a||!b)continue;const group=[a.strategy,b.strategy].sort().join('/');for(const [name,amount] of [['policy',distance(a.policy,b.policy)],['facilities',distance(a.facilities,b.facilities)],['spatial',distance(a.spatial,b.spatial)],['flows',distance(flowVector(a),flowVector(b))]] as const){score(this.pairDistances,`${group}|${name}`,amount);score(this.pairDistances,`ALL|${name}`,amount);}}
  for(const war of game.wars){const attacker=cities.find(c=>c.seat===war.from),defender=cities.find(c=>c.seat===war.to);if(!attacker||!defender)throw new RangeError('Unknown war seat');
   const key=`${attacker.strategy}|${war.mode}`,row=this.attacks.get(key)??{attempts:0,successes:0,netResources:0,attackerLosses:0,defenderLosses:0,exposure:0,steps:0,deployed:0,loot:0};row.attempts++;row.successes+=war.success?1:0;for(const name of ['netResources','attackerLosses','defenderLosses','exposure','steps','deployed'] as const)row[name]+=war[name];row.loot+=war.loot.food+2*war.loot.materials+4*war.loot.tools+war.loot.coin;this.attacks.set(key,row);score(this.defenses,`${defender.strategy}|${war.mode}`,war.success?0:1);
  }
  for(const decision of game.decisions)increment(this.decisions,decision.action);for(const receipt of game.receipts)increment(this.receipts,receipt);
 }
 finish(){
  const means=(map:ReadonlyMap<string,{count:number;totals:Record<string,number>}>)=>[...map].sort(([a],[b])=>a.localeCompare(b)).map(([key,row])=>({key,count:row.count,mean:Object.fromEntries(Object.entries(row.totals).map(([name,total])=>[name,total/row.count]))}));
  return {games:this.games,seeds:[...this.seeds].sort((a,b)=>a-b),duel:this.rows.length?summarizeDuels(this.rows):null,duelStrata:rates(this.strata),multi:rates(this.multi),multiNormalizedRank:rates(this.ranks),
   sensitivity:this.sensitivity.map(v=>({populationWeight:v.population,resourceScale:v.resources,duel:rates(v.duel),multi:rates(v.multi)})),
   diversity:{topAxes:this.topAxes,participantAxes:this.allAxes,topEntropy:entropy(this.topAxes),participantEntropy:entropy(this.allAxes),topPolicyVectors:this.topPolicies,participantPolicyVectors:this.allPolicies,pairDistances:rates(this.pairDistances)},
   war:{opportunities:this.opportunities,decisions:this.decisions,peaceByStrategy:rates(this.peaceByStrategy),attacks:[...this.attacks].map(([key,row])=>({key,...row,successRate:row.successes/row.attempts,meanNetResources:row.netResources/row.attempts})),defenseStopRate:rates(this.defenses)},diplomacyReceiptCounts:this.receipts,phaseMeans:means(this.phases),phaseChanges:means(this.changes),limitations:['탐색적 시제품 측정이며 상용 밸런스의 증명이 아니다.','1:1 승점은 회복 후 V 비교이며 군사 승률과 다르다.','단일 seed 블록 95% bootstrap 2000회; 다자 2 seed에는 확증적 구간을 붙이지 않는다.','봇은 북쪽 출정만 탐색한다. 전체 연속 전략 공간과 인간 숙련을 대표하지 않는다.']};
 }
}
export type AnalysisResult=ReturnType<Analysis['finish']>;
