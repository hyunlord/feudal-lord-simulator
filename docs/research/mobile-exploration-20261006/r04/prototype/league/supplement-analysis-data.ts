import { AXES, RESOURCES, type Policy, type Stocks } from '../model/index.js';
import { value, type Standing } from './metrics.js';
function isRecord(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
export function object(value:unknown):Record<string,unknown>{if(!isRecord(value))throw new TypeError('Expected object');return value;}
export function array(value:unknown):unknown[]{if(!Array.isArray(value))throw new TypeError('Expected array');return value;}
export function number(value:unknown):number{if(typeof value!=='number'||!Number.isFinite(value))throw new TypeError('Expected finite number');return value;}
export function text(value:unknown):string{if(typeof value!=='string')throw new TypeError('Expected string');return value;}
export function boolean(value:unknown):boolean{if(typeof value!=='boolean')throw new TypeError('Expected boolean');return value;}
export function stocks(value:unknown):Stocks{const v=object(value);return {food:number(v['food']),materials:number(v['materials']),tools:number(v['tools']),coin:number(v['coin'])};}
export function policy(value:unknown):Policy{const v=object(value);return {agriculture:number(v['agriculture']),trade:number(v['trade']),craft:number(v['craft']),military:number(v['military']),faith:number(v['faith']),scholarship:number(v['scholarship']),maritime:number(v['maritime']),diplomacy:number(v['diplomacy'])};}
export type GrowthPoint={readonly id:string;readonly seed:number;readonly terrain:string;readonly strategy:string;readonly tick:number;readonly population:number;readonly employed:number;readonly stocks:Stocks;readonly facilityCounts:Policy;readonly policy:Policy;readonly radius:number;readonly flows:Readonly<Record<string,Stocks>>};
export function growthRows(result:unknown):GrowthPoint[]{
 const r=object(result),task=object(r['task']),strategy=object(task['strategy']);
 return array(r['points']).map(raw=>{const point=object(raw),flows:Record<string,Stocks>={};for(const [key,value]of Object.entries(object(point['flows'])))flows[key]=stocks(value);
  return {id:text(task['id']),seed:number(task['seed']),terrain:text(task['terrain']),strategy:text(strategy['id']),tick:number(point['tick']),population:number(point['population']),employed:number(point['employed']),stocks:stocks(point['stocks']),facilityCounts:policy(point['facilityCounts']),policy:policy(point['policy']),radius:number(point['radius']),flows};});
}
export type GamePoint=Standing & {readonly seat:string;readonly value:number};
export function gameRows(result:unknown):GamePoint[]{return array(object(result)['recovery']).map(raw=>{const r=object(raw);const point={seat:text(r['seat']),strategy:text(r['strategy']),population:number(r['population']),stocks:stocks(r['stocks']),escrow:stocks(r['escrow']),policy:policy(r['policy']),value:number(r['value'])};
 if(!Number.isSafeInteger(point.population)||point.population<0||RESOURCES.some(resource=>!Number.isSafeInteger(point.stocks[resource])||point.stocks[resource]<0||!Number.isSafeInteger(point.escrow[resource])||point.escrow[resource]<0))throw new RangeError('Invalid standing inventory/population');
 if(point.value!==value(point))throw new RangeError('Recorded V differs from population and owned stock/escrow');return point;});}
export function deltas(a:GrowthPoint,b:GrowthPoint){return {population:a.population-b.population,employed:a.employed-b.employed,stocks:Object.fromEntries(RESOURCES.map(r=>[r,a.stocks[r]-b.stocks[r]])),facilityCountL1:AXES.reduce((s,axis)=>s+Math.abs(a.facilityCounts[axis]-b.facilityCounts[axis]),0),radius:a.radius-b.radius};}
export function average(values:readonly number[]):number{return values.length?values.reduce((a,b)=>a+b,0)/values.length:0;}
export type DiplomacyMetrics={readonly offered:number;readonly accepted:number;readonly rejected:number;readonly delivered:number;readonly breached:number;readonly expired:number;readonly avoidedRaids:number;readonly raids:number;readonly sieges:number;readonly knownEnvoyShippingFees:number;readonly flow:readonly {seat:string;strategy:string;netContractResources:number;nominalOwnedEscrow:number}[]};
export function diplomacyMetrics(result:unknown):DiplomacyMetrics{
 const r=object(result),m=object(r['metrics']),d=object(r['diplomacy']),receipts=array(d['receipts']).map(object),contracts=array(d['contracts']).map(object);
 // proposeContract consumes one envoy coin; shipping paid only on accepted receipt, not predicted utility.
 const knownEnvoyShippingFees=contracts.reduce((sum,c)=>sum+1+(receipts.some(receipt=>receipt['event']==='accepted'&&receipt['id']===c['id'])?Object.values(object(c['costs'])).reduce<number>((s,cost)=>s+number(cost),0):0),0);
 return {offered:number(m['offered']),accepted:number(m['accepted']),rejected:number(m['rejected']),delivered:number(m['delivered']),breached:number(m['breached']),expired:number(m['expired']),avoidedRaids:number(m['avoidedRaids']),raids:number(m['raids']),sieges:number(m['sieges']),knownEnvoyShippingFees,
  flow:array(m['ledgerProfit']).map(raw=>{const f=object(raw);return {seat:text(f['seat']),strategy:text(f['strategy']),netContractResources:number(f['netContractResources']),nominalOwnedEscrow:number(f['nominalOwnedEscrow'])};})};
}
