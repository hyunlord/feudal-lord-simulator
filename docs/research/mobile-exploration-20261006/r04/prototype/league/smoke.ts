import { performance } from 'node:perf_hooks';
import { BASE_STRATEGIES } from './strategies.js';
import { runGame, prepareGrowth } from './game.js';
const timings:number[]=[];
for(const seed of [1,2,3,4,5]){
 const start=performance.now();
 const result=runGame({strategies:BASE_STRATEGIES.slice(0,4),seed,terrain:'river',growthSteps:48,diplomacyEnabled:true});
 timings.push(performance.now()-start);
 if(result.recovery.length!==4)throw new RangeError('Incomplete smoke game');
}
console.log(JSON.stringify({trainingSeeds:[1,2,3,4,5],games:5,timingsMs:timings,totalMs:timings.reduce((a,b)=>a+b,0),outcomes:'not reported; timing-only budget probe'}));

const spec={strategies:BASE_STRATEGIES.slice(0,4),seed:1,terrain:'river',growthSteps:48,diplomacyEnabled:true} as const;
const phases:Record<string,number>={};
const growth=prepareGrowth(spec);
runGame(spec,{growth,onPhase:(phase,ms)=>{phases[phase]=(phases[phase]??0)+ms;}});
console.log(JSON.stringify({trainingSeed:1,cachedGrowth:true,phaseMs:phases,outcomes:'not inspected'}));
