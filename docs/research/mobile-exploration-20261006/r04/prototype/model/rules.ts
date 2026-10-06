import { AXES, type Axis, type Policy, type Stocks } from './types.js';
export const RULE_VERSION = 'growth-1';
export const GRID_SIZE = 21;
export const AXIS_LABELS: Readonly<Record<Axis, string>> = { agriculture:'농업',trade:'교역',craft:'제작',military:'군사',faith:'신앙',scholarship:'학문',maritime:'해상',diplomacy:'외교' };
export function emptyStocks(): Stocks { return { food:0,materials:0,tools:0,coin:0 }; }
export function policyPreset(axes: Axis | readonly Axis[]): Policy {
 const chosen = typeof axes === 'string' ? [axes] : axes;
 const result: Policy = { agriculture:0,trade:0,craft:0,military:0,faith:0,scholarship:0,maritime:0,diplomacy:0 };
 for (const axis of chosen) result[axis] += 100 / Math.max(1, chosen.length);
 return result;
}
export function support(weight: number): number { const w=weight/100; return 30*w/(0.35+w); }
export const COSTS: Readonly<Record<Axis, Readonly<Stocks>>> = {
 agriculture:{food:0,materials:8,tools:1,coin:4},trade:{food:0,materials:10,tools:1,coin:8},
 craft:{food:0,materials:12,tools:2,coin:6},military:{food:0,materials:14,tools:3,coin:8},
 faith:{food:0,materials:10,tools:1,coin:8},scholarship:{food:0,materials:8,tools:1,coin:12},
 maritime:{food:0,materials:14,tools:2,coin:8},diplomacy:{food:0,materials:8,tools:1,coin:10},
};
export function validPolicy(policy: Policy): boolean {
 return AXES.every(axis=>Number.isFinite(policy[axis]) && policy[axis]>=0 && policy[axis]<=100) && AXES.reduce((sum,axis)=>sum+policy[axis],0)<=100.0000001;
}
