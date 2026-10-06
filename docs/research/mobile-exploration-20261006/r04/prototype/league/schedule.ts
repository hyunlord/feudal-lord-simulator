import { TERRAINS, type Terrain } from '../model/index.js';
import { BASE_STRATEGIES, type Strategy } from './strategies.js';
export type GameSpec={readonly strategies:readonly Strategy[];readonly seed:number;readonly terrain:Terrain;readonly growthSteps:number;readonly diplomacyEnabled:boolean};
export type ScheduledGame=GameSpec & {readonly id:string;readonly block:string;readonly rotation:number};
export const GROWTH_STEPS=[48,96,144] as const;
export const EVALUATION_SEEDS=[101,102,103,104,105,106] as const;
export function rotate<T>(values:readonly T[],offset:number):T[]{return [...values.slice(offset),...values.slice(0,offset)];}
export function combinations<T>(values:readonly T[],count:number):T[][] {
 if(count===0)return [[]];
 return values.flatMap((value,index)=>combinations(values.slice(index+1),count-1).map(rest=>[value,...rest]));
}
export function duelSchedule():ScheduledGame[]{
 const games:ScheduledGame[]=[];
 for(const pair of combinations(BASE_STRATEGIES,2))for(const terrain of TERRAINS)for(const seed of EVALUATION_SEEDS)for(const growthSteps of GROWTH_STEPS){
  const block=`duel:${pair.map(s=>s.id).join('/')}:${terrain}:${seed}:${growthSteps}`;
  for(let rotation=0;rotation<2;rotation++)games.push({id:`${block}:${rotation}`,block,rotation,strategies:rotate(pair,rotation),terrain,seed,growthSteps,diplomacyEnabled:true});
 }
 return games;
}
export function multiSchedule():ScheduledGame[]{
 const games:ScheduledGame[]=[];
 for(const group of combinations(BASE_STRATEGIES,4))for(const terrain of TERRAINS)for(const seed of [101,102]){
  const block=`multi:${group.map(s=>s.id).join('/')}:${terrain}:${seed}:96`;
  for(let rotation=0;rotation<4;rotation++)games.push({id:`${block}:${rotation}`,block,rotation,strategies:rotate(group,rotation),terrain,seed,growthSteps:96,diplomacyEnabled:true});
 }
 return games;
}
