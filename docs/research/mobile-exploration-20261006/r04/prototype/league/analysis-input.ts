import { AXES, RESOURCES, type Policy, type Stocks } from '../model/types.js';
import type { Standing } from './metrics.js';
function isObject(value:unknown):value is Record<string,unknown>{return typeof value==='object'&&value!==null&&!Array.isArray(value);}
export function object(value:unknown):Record<string,unknown>{if(!isObject(value))throw new RangeError('Expected object');return value;}
export function number(value:unknown):number{if(typeof value!=='number'||!Number.isFinite(value))throw new RangeError('Expected finite number');return value;}
export function text(value:unknown):string{if(typeof value!=='string')throw new RangeError('Expected string');return value;}
export function array(value:unknown):unknown[]{if(!Array.isArray(value))throw new RangeError('Expected array');return value;}
export function stocks(value:unknown):Stocks{const row=object(value);return {food:number(row['food']),materials:number(row['materials']),tools:number(row['tools']),coin:number(row['coin'])};}
export function policy(value:unknown):Policy{const row=object(value);return {agriculture:number(row['agriculture']),trade:number(row['trade']),craft:number(row['craft']),military:number(row['military']),faith:number(row['faith']),scholarship:number(row['scholarship']),maritime:number(row['maritime']),diplomacy:number(row['diplomacy'])};}
export type Observation=Standing & {readonly seat:string;readonly recordedValue:number;readonly facilities:Readonly<Policy>;readonly spatial:Readonly<Record<string,number>>;readonly flows:Readonly<Record<string,Stocks>>};
export type War={readonly from:string;readonly to:string;readonly mode:'raid'|'siege';readonly success:boolean;readonly netResources:number;readonly attackerLosses:number;readonly defenderLosses:number;readonly exposure:number;readonly steps:number;readonly deployed:number;readonly loot:Stocks};
export type Game={readonly id:string;readonly block:string;readonly rotation:number;readonly seed:number;readonly terrain:string;readonly age:number;readonly growth:readonly Observation[];readonly foreign:readonly Observation[];readonly recovery:readonly Observation[];readonly wars:readonly War[];readonly decisions:readonly {readonly seat:string;readonly action:string}[];readonly receipts:readonly string[]};
function observation(input:unknown):Observation{
 const row=object(input),spatial:Record<string,number>={};
 for(const input of array(row['facilities'])){const facility=object(input);if(number(facility['hp'])<=0)continue;const x=number(facility['x']),y=number(facility['y']);if(x<0||y<0||x>20||y>20)throw new RangeError('Facility outside map');const key=`${Math.floor(x/3)}:${Math.floor(y/3)}`;spatial[key]=(spatial[key]??0)+1;}
 const flows=Object.fromEntries(Object.entries(object(row['flows'])).map(([key,value])=>[key,stocks(value)]));
 const result={seat:text(row['seat']),strategy:text(row['strategy']),population:number(row['population']),stocks:stocks(row['stocks']),escrow:stocks(row['ownedEscrow']),policy:policy(row['policy']),recordedValue:number(row['value']),facilities:policy(row['facilityCounts']),spatial,flows};
 if(result.population<0||!Number.isInteger(result.population)||RESOURCES.some(r=>result.stocks[r]<-1e-8||result.escrow[r]<-1e-8)||AXES.some(a=>result.policy[a]<0||result.facilities[a]<0))throw new RangeError('Invalid population, stocks or policy');
 const expected=12*result.population+result.stocks.food+result.escrow.food+2*(result.stocks.materials+result.escrow.materials)+4*(result.stocks.tools+result.escrow.tools)+result.stocks.coin+result.escrow.coin;
 if(Math.abs(result.recordedValue-expected)>1e-7*Math.max(1,Math.abs(expected)))throw new RangeError('Recorded value does not reconcile with owned stocks');
 return result;
}
export function parseGame(input:unknown):Game{
 const row=object(input),spec=object(row['spec']);
 const wars:War[]=array(row['wars']).map(input=>{const w=object(input),mode=w['mode'],success=w['success'];if((mode!=='raid'&&mode!=='siege')||typeof success!=='boolean')throw new RangeError('Invalid war variant');return {from:text(w['from']),to:text(w['to']),mode,success,netResources:number(w['netResources']),attackerLosses:number(w['attackerLosses']),defenderLosses:number(w['defenderLosses']),exposure:number(w['exposure']),steps:number(w['steps']),deployed:number(w['deployed']),loot:stocks(w['loot'])};});
 return {id:text(row['id']),block:text(row['block']),rotation:number(row['rotation']),seed:number(spec['seed']),terrain:text(spec['terrain']),age:number(spec['growthSteps']),growth:array(row['growth']).map(observation),foreign:array(row['foreign']).map(observation),recovery:array(row['recovery']).map(observation),wars,decisions:array(row['decisions']).map(input=>{const d=object(input);return {seat:text(d['seat']),action:text(d['action'])};}),receipts:array(object(row['diplomacy'])['receipts']).map(input=>text(object(input)['event']))};
}
