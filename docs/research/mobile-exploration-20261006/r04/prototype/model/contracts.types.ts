import type { City, Stocks } from './types.js';
export type OfferTerms = {
 readonly id:string; readonly from:string; readonly to:string;
 readonly give:Readonly<Stocks>; readonly take:Readonly<Stocks>;
 readonly offerUntil:number; readonly deliverAt:number; readonly pactUntil:number;
};
export type Utility = { readonly gain:number; readonly payment:number; readonly transport:number; readonly avoidedRaid:number; readonly risk:number; readonly total:number };
export type Contract = OfferTerms & {
 readonly createdAt:number; readonly costs:Readonly<Record<string,number>>;
 status:'offered'|'accepted'|'delivered'|'rejected'|'expired'|'breached';
 escrow:Record<string,Stocks>; bonds:Record<string,number>;
 readonly utility:Readonly<Record<string,Utility>>;
};
export type ContractReceipt = { readonly at:number; readonly id:string; readonly actor:string; readonly other:string; readonly event:string; readonly reason:string; readonly amount:Readonly<Stocks> };
// Mutable event accumulator alongside mutable City; serialize both for replay.
export type DiplomacyState = { readonly enabled:boolean; contracts:Contract[]; receipts:ContractReceipt[]; reputation:Record<string,number> };
export type ContractContext = { readonly cities:Readonly<Record<string,City>>; readonly diplomacy:DiplomacyState; readonly now:number };
export type Pair = { readonly from:string; readonly to:string; readonly now:number };
export type ContractResult = { readonly ok:true; readonly contract:Contract } | { readonly ok:false; readonly reason:string };
