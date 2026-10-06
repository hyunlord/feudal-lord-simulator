import { AXES, policyPreset, population, type City, type Policy } from '../model/index.js';
export type Strategy = { readonly id:string; readonly policy:Readonly<Policy>; readonly adaptive:boolean };
export const BASE_STRATEGIES:readonly Strategy[]=[
 ...AXES.map(axis=>({id:axis,policy:policyPreset(axis),adaptive:false})),
 ...([['trade','maritime'],['faith','military'],['craft','scholarship'],['agriculture','diplomacy']] as const)
 .map(pair=>({id:pair.join('+'),policy:policyPreset(pair),adaptive:false})),
];
export const CHALLENGERS:readonly Strategy[]=[
 {id:'continuous-1',policy:{agriculture:23,trade:17,craft:13,military:19,faith:7,scholarship:5,maritime:11,diplomacy:5},adaptive:false},
 {id:'continuous-2',policy:{agriculture:9,trade:11,craft:19,military:7,faith:17,scholarship:13,maritime:9,diplomacy:15},adaptive:false},
 {id:'adaptive-shortage',policy:policyPreset(AXES),adaptive:true},
];
export function policyFor(strategy:Strategy,city:City):Policy {
 if(!strategy.adaptive)return {...strategy.policy};
 const policy={...strategy.policy};
 const needs={food:population(city)*3,materials:40,tools:16,coin:80};
 policy.agriculture+=Math.max(0,needs.food-city.stocks.food);
 policy.craft+=Math.max(0,needs.tools-city.stocks.tools)*4;
 policy.trade+=Math.max(0,needs.coin-city.stocks.coin);
 policy.maritime+=Math.max(0,needs.materials-city.stocks.materials);
 const sum=AXES.reduce((s,a)=>s+policy[a],0);
 for(const axis of AXES)policy[axis]=100*policy[axis]/sum;
 return policy;
}
