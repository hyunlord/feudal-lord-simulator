import type { City, Stocks } from './types.js';
export type Point = { readonly x:number; readonly y:number };
export type BattleCommand = {
 readonly seed:number; readonly mode:'raid'|'siege'; readonly entry:'north'|'east'|'south'|'west';
 readonly soldiers?:number; readonly supply?:number;
};
export type BattleStep = {
 readonly step:number; readonly x:number; readonly y:number; readonly phase:'advance'|'breach'|'objective'|'return';
 readonly soldiers:number; readonly food:number; readonly exposure:number; readonly losses:number;
};
export type BattleResult = {
 readonly attacker:City; readonly defender:City; readonly command:BattleCommand;
 readonly trace:readonly BattleStep[]; readonly route:readonly Point[]; readonly objective:Point;
 readonly success:boolean; readonly loot:Readonly<Stocks>; readonly attackerLosses:number;
 readonly defenderLosses:number; readonly steps:number; readonly reason:string; readonly deployed:number;
};
export type BattleMap = { readonly city:City; readonly mode:BattleCommand['mode']; readonly guards:number };
