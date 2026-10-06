import { AXES, type Policy, type Stocks } from '../model/types.js';
import { random } from '../model/random.js';
export type Standing={readonly strategy:string;readonly population:number;readonly stocks:Readonly<Stocks>;readonly escrow:Readonly<Stocks>;readonly policy:Readonly<Policy>};
export type DuelScore={readonly strategy:string;readonly seed:number;readonly score:0|0.5|1};
export type WinSummary={readonly strategy:string;readonly games:number;readonly wins:number;readonly draws:number;readonly losses:number;readonly scoreRate:number;readonly interval95:readonly[number,number];readonly flag:'below-watch'|'watch'|'risk'};
export function value(city:Standing,populationWeight=12,resourceScale=1):number{
 const owned=(r:keyof Stocks)=>city.stocks[r]+city.escrow[r];
 return populationWeight*city.population+resourceScale*(owned('food')+2*owned('materials')+4*owned('tools')+owned('coin'));
}
export function duelScore(a:Standing,b:Standing,populationWeight=12,resourceScale=1):0|0.5|1{
 if(a.population===0&&b.population===0)return 0.5;
 if(a.population===0)return 0;if(b.population===0)return 1;
 const av=value(a,populationWeight,resourceScale),bv=value(b,populationWeight,resourceScale);
 if(Math.abs(av-bv)<=0.01*Math.max(1,(Math.abs(av)+Math.abs(bv))/2))return 0.5;
 return av>bv?1:0;
}
export function winnerShares(cities:readonly Standing[],populationWeight=12,resourceScale=1):readonly number[]{
 if(!cities.length)return [];
 const alive=cities.filter(c=>c.population>0);
 if(!alive.length)return cities.map(()=>1/cities.length);
 const best=[...alive].sort((a,b)=>value(b,populationWeight,resourceScale)-value(a,populationWeight,resourceScale))[0];
 if(!best)return [];
 const winners=cities.map(c=>c.population>0&&duelScore(c,best,populationWeight,resourceScale)===0.5);
 const count=winners.filter(Boolean).length;
 return winners.map(win=>win?1/count:0);
}
export function entropy(policyWeights:Readonly<Record<string,number>>):number{
 const values=Object.values(policyWeights).filter(v=>v>0),total=values.reduce((s,v)=>s+v,0);
 if(!total)return 0;
 return -values.reduce((s,v)=>s+(v/total)*Math.log(v/total),0)/Math.log(AXES.length);
}
export function dominantShares(policy:Readonly<Policy>):Policy{
 const max=Math.max(...AXES.map(axis=>policy[axis]));const tied=AXES.filter(axis=>Math.abs(policy[axis]-max)<1e-9);
 return {agriculture:tied.includes('agriculture')?1/tied.length:0,trade:tied.includes('trade')?1/tied.length:0,craft:tied.includes('craft')?1/tied.length:0,military:tied.includes('military')?1/tied.length:0,faith:tied.includes('faith')?1/tied.length:0,scholarship:tied.includes('scholarship')?1/tied.length:0,maritime:tied.includes('maritime')?1/tied.length:0,diplomacy:tied.includes('diplomacy')?1/tied.length:0};
}
function quantile(values:readonly number[],p:number):number{
 const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.floor((sorted.length-1)*p)]??0;
}
/** Whole seed blocks resampled jointly across strategies; not match-level IID. */
export function summarizeDuels(rows:readonly DuelScore[],replicates=2000):{readonly strategies:readonly WinSummary[];readonly maxDistribution95:readonly[number,number];readonly independentSeeds:number;readonly exploratory:true}{
 if(!rows.length||!Number.isInteger(replicates)||replicates<2)throw new RangeError('Need scores and bootstrap repetitions');
 const ids=[...new Set(rows.map(r=>r.strategy))].sort(),seeds=[...new Set(rows.map(r=>r.seed))].sort((a,b)=>a-b);
 const groups=new Map<string,{sum:number;count:number}>();
 for(const row of rows){const key=`${row.strategy}:${row.seed}`,g=groups.get(key)??{sum:0,count:0};g.sum+=row.score;g.count++;groups.set(key,g);}
 for(const id of ids)for(const seed of seeds)if(!groups.has(`${id}:${seed}`))throw new RangeError('Missing strategy in seed block');
 const samples=new Map(ids.map((id):[string,number[]]=>[id,[]])),maxima:number[]=[],rng={rng:93271};
 for(let i=0;i<replicates;i++){
  const picked=seeds.map(()=>seeds[Math.floor(random(rng)*seeds.length)]);let max=0;
  for(const id of ids){let sum=0,count=0;for(const seed of picked){const g=groups.get(`${id}:${seed}`);if(g){sum+=g.sum;count+=g.count;}}const rate=sum/count;samples.get(id)?.push(rate);max=Math.max(max,rate);}
  maxima.push(max);
 }
 const strategies:WinSummary[]=ids.map(strategy=>{
  const scores=rows.filter(r=>r.strategy===strategy),wins=scores.filter(r=>r.score===1).length,draws=scores.filter(r=>r.score===0.5).length;
  const rate=(wins+draws*0.5)/scores.length,distribution=samples.get(strategy)??[];
  return {strategy,games:scores.length,wins,draws,losses:scores.length-wins-draws,scoreRate:rate,interval95:[quantile(distribution,0.025),quantile(distribution,0.975)],flag:rate>0.6?'risk':rate>0.55?'watch':'below-watch'};
 });
 return {strategies,maxDistribution95:[quantile(maxima,0.025),quantile(maxima,0.975)],independentSeeds:seeds.length,exploratory:true};
}
