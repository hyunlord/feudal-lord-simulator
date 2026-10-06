import { RESOURCES, type City, type Stocks } from './types.js';
import { emptyStocks } from './rules.js';
import { book } from './economy.js';
import type { Contract, ContractContext, ContractResult, DiplomacyState, OfferTerms, Pair, Utility } from './contracts.types.js';
export type * from './contracts.types.js';
export function createDiplomacy(enabled=true):DiplomacyState { return {enabled,contracts:[],receipts:[],reputation:{}}; }
const BOND=2;
function move(city:City, bundle:Readonly<Stocks>, sign:number, reason:string):void {
 for(const resource of RESOURCES) if(bundle[resource]) book(city,{resource,amount:sign*bundle[resource],reason});
}
function receipt(ctx:ContractContext, c:OfferTerms, event:string, reason:string):void {
 for(const [actor,other] of [[c.from,c.to],[c.to,c.from]]) {
  if(actor===undefined || other===undefined) continue;
  const amount=emptyStocks();
  if(event==='delivered') for(const r of RESOURCES) amount[r]=(actor===c.from?c.take[r]-c.give[r]:c.give[r]-c.take[r]);
  ctx.diplomacy.receipts.push({at:ctx.now,id:c.id,actor,other,event,reason,amount});
 }
}
function price(city:City, resource:typeof RESOURCES[number]):number {
 const population=city.households.reduce((sum,h)=>sum+h.people,0);
 const needs:Stocks={food:Math.max(10,population*2),materials:30,tools:12,coin:40};
 const base:Stocks={food:1,materials:2,tools:4,coin:1};
 return base[resource]*(0.5+2*needs[resource]/(needs[resource]+city.stocks[resource]));
}
function transport(city:City):number { return Math.max(1,4-Math.floor(city.services.transport/10)); }
function utility(city:City, other:City, terms:OfferTerms, reputation:number):Utility {
 const gain=RESOURCES.reduce((s,r)=>s+terms.take[r]*price(city,r),0);
 const payment=RESOURCES.reduce((s,r)=>s+terms.give[r]*price(city,r),0);
 const cost=transport(city);
 const exposed=city.stocks.food+city.stocks.materials*2+city.stocks.tools*4+city.stocks.coin;
 const avoidedRaid=Math.min(8,other.services.training*0.04,exposed*0.02);
 const risk=Math.max(0,-reputation)*0.5;
 return {gain,payment,transport:cost,avoidedRaid,risk,total:gain+avoidedRaid-payment-cost-risk};
}
function validBundle(bundle:Readonly<Stocks>):boolean { return RESOURCES.every(r=>Number.isFinite(bundle[r]) && bundle[r]>=0 && Number.isInteger(bundle[r])); }
function affordable(city:City, bundle:Readonly<Stocks>, fee:number):boolean {
 return RESOURCES.every(r=>city.stocks[r]>=bundle[r]+(r==='coin'?fee+BOND:0));
}
function release(ctx:ContractContext,c:Contract):void {
 for(const seat of [c.from,c.to]) {
  const city=ctx.cities[seat]; const escrow=c.escrow[seat];
  if(city && escrow) move(city,escrow,1,`contract:${c.id}:release`);
  if(city && c.bonds[seat]) book(city,{resource:'coin',amount:c.bonds[seat]??0,reason:`contract:${c.id}:bond-return`});
 }
 c.escrow={}; c.bonds={};
}
export function proposeContract(ctx:ContractContext,terms:OfferTerms):ContractResult {
 const from=ctx.cities[terms.from], to=ctx.cities[terms.to];
 if(!ctx.diplomacy.enabled) return {ok:false,reason:'diplomacy-disabled'};
 if(!from || !to || terms.from===terms.to) return {ok:false,reason:'invalid-partner'};
 if(ctx.diplomacy.contracts.filter(c=>c.from===terms.from&&c.createdAt===ctx.now).length>=diplomacyCapacity(from)) return {ok:false,reason:'envoy-capacity'};
 if(RESOURCES.reduce((sum,r)=>sum+terms.give[r]+terms.take[r],0)>40+Math.floor((from.services.transport+to.services.transport)/5)) return {ok:false,reason:'cargo-capacity'};
 if(ctx.diplomacy.contracts.some(c=>c.id===terms.id)) return {ok:false,reason:'duplicate-command'};
 if(!validBundle(terms.give)||!validBundle(terms.take)||RESOURCES.every(r=>terms.give[r]===0)||RESOURCES.every(r=>terms.take[r]===0)) return {ok:false,reason:'invalid-bundle'};
 if(![ctx.now,terms.offerUntil,terms.deliverAt,terms.pactUntil].every(Number.isInteger)||!(ctx.now<terms.offerUntil && terms.offerUntil<=terms.deliverAt && terms.deliverAt<terms.pactUntil && terms.pactUntil<=ctx.now+8)) return {ok:false,reason:'invalid-deadline'};
 if(ctx.diplomacy.contracts.some(c=>(c.status==='offered'||c.status==='accepted'||(c.status==='delivered'&&c.pactUntil>ctx.now))&&[c.from,c.to].includes(terms.from)&&[c.from,c.to].includes(terms.to))) return {ok:false,reason:'pair-already-contracted'};
 if(!affordable(from,terms.give,1+transport(from)) || RESOURCES.some(r=>terms.give[r]>from.stocks[r]*0.25)) return {ok:false,reason:'reservation-limit-or-inventory'};
 const reversed={...terms,give:terms.take,take:terms.give};
 const c:Contract={...terms,give:{...terms.give},take:{...terms.take},createdAt:ctx.now,status:'offered',escrow:{[terms.from]:{...terms.give}},bonds:{[terms.from]:BOND},costs:{[terms.from]:transport(from),[terms.to]:transport(to)},utility:{[terms.from]:utility(from,to,terms,ctx.diplomacy.reputation[terms.to]??0),[terms.to]:utility(to,from,reversed,ctx.diplomacy.reputation[terms.from]??0)}};
 move(from,c.give,-1,`contract:${c.id}:reserve`);
 book(from,{resource:'coin',amount:-BOND-1,reason:`contract:${c.id}:bond-and-envoy`});
 ctx.diplomacy.contracts.push(c); receipt(ctx,c,'offered','finite goods reserved; envoy consumed'); return {ok:true,contract:c};
}
export function answerContract(ctx:ContractContext,id:string,accept:boolean):ContractResult {
 const c=ctx.diplomacy.contracts.find(v=>v.id===id);
 if(!c || c.status!=='offered') return {ok:false,reason:'not-open-offer'};
 const from=ctx.cities[c.from],to=ctx.cities[c.to];
 if(!from||!to) return {ok:false,reason:'missing-city'};
 if(ctx.now>=c.offerUntil) { release(ctx,c);c.status='expired';receipt(ctx,c,'expired','answer deadline passed');return {ok:false,reason:'offer-expired'}; }
 const feeFrom=c.costs[c.from]??0,feeTo=c.costs[c.to]??0;
 const u=utility(to,from,{...c,give:c.take,take:c.give},ctx.diplomacy.reputation[c.from]??0);
 if(!accept || !u || u.total<0 || !affordable(to,c.take,feeTo) || from.stocks.coin<feeFrom || RESOURCES.some(r=>c.take[r]>to.stocks[r]*0.25)) {
  release(ctx,c);c.status='rejected';receipt(ctx,c,'rejected',`utility=${u?.total??0}; consent=${accept}; inventory and costs required`);return {ok:true,contract:c};
 }
 move(to,c.take,-1,`contract:${id}:reserve`);c.escrow[c.to]={...c.take};c.bonds[c.to]=BOND;
 book(to,{resource:'coin',amount:-BOND-feeTo,reason:`contract:${id}:bond-and-transport`});
 book(from,{resource:'coin',amount:-feeFrom,reason:`contract:${id}:transport`});
 c.status='accepted';receipt(ctx,c,'accepted',`recipient utility=${u.total.toFixed(3)}; shipping paid`);return {ok:true,contract:c};
}
export function advanceContracts(ctx:ContractContext):void {
 for(const c of ctx.diplomacy.contracts) {
  switch(c.status) {
   case 'offered': if(ctx.now>=c.offerUntil){release(ctx,c);c.status='expired';receipt(ctx,c,'expired','unanswered offer released');}break;
   case 'accepted': if(ctx.now>=c.deliverAt){
    const from=ctx.cities[c.from],to=ctx.cities[c.to];if(!from||!to) break;
    move(from,c.take,1,`contract:${c.id}:delivery`);move(to,c.give,1,`contract:${c.id}:delivery`);
    c.escrow={};release(ctx,c);c.status='delivered';
    for(const seat of [c.from,c.to]) ctx.diplomacy.reputation[seat]=(ctx.diplomacy.reputation[seat]??0)+1;
    receipt(ctx,c,'delivered','ownership swapped exactly once; pact continues to deadline');
   }break;
   case 'delivered': case 'rejected': case 'expired': case 'breached': break;
   default: { const exhaustive:never=c.status; return exhaustive; }
  }
 }
}
export function hasPact(state:DiplomacyState,pair:Pair):boolean {
 return state.enabled && state.contracts.some(c=>(c.status==='accepted'||c.status==='delivered')&&c.createdAt<=pair.now&&c.pactUntil>pair.now&&[c.from,c.to].includes(pair.from)&&[c.from,c.to].includes(pair.to)&&pair.from!==pair.to);
}
export function recordAvoidedRaid(ctx:ContractContext,from:string,to:string):boolean {
 const c=ctx.diplomacy.contracts.find(v=>hasPact({...ctx.diplomacy,contracts:[v]},{from,to,now:ctx.now}));
 if(!c)return false;
 if(!ctx.diplomacy.receipts.some(r=>r.at===ctx.now&&r.id===c.id&&r.actor===from&&r.event==='avoided-raid')) ctx.diplomacy.receipts.push({at:ctx.now,id:c.id,actor:from,other:to,event:'avoided-raid',reason:'planned attack withheld under paid pact',amount:emptyStocks()});
 return true;
}
export function breachContract(ctx:ContractContext,id:string,actor:string):ContractResult {
 const c=ctx.diplomacy.contracts.find(v=>v.id===id);
 if(!c||(c.status!=='accepted'&&c.status!=='delivered')||!hasPact({...ctx.diplomacy,contracts:[c]},{from:c.from,to:c.to,now:ctx.now})||![c.from,c.to].includes(actor)) return {ok:false,reason:'no-active-pact'};
 const other=actor===c.from?c.to:c.from, offender=ctx.cities[actor],victim=ctx.cities[other];
 if(!offender||!victim)return {ok:false,reason:'missing-city'};
 const bond=c.bonds[actor]??0;c.bonds[actor]=0;
 const penalty=Math.min(2,offender.stocks.coin);book(offender,{resource:'coin',amount:-penalty,reason:`contract:${id}:breach`});book(victim,{resource:'coin',amount:bond+penalty,reason:`contract:${id}:compensation`});
 release(ctx,c);c.status='breached';ctx.diplomacy.reputation[actor]=(ctx.diplomacy.reputation[actor]??0)-4;
 receipt(ctx,c,'breached',`${actor} forfeited bond ${bond}, paid ${penalty}, reputation -4`);return {ok:true,contract:c};
}
export function ownedEscrow(state:DiplomacyState,seat:string):Stocks {
 const result=emptyStocks();for(const c of state.contracts){for(const r of RESOURCES)result[r]+=c.escrow[seat]?.[r]??0;result.coin+=c.bonds[seat]??0;}return result;
}
export function diplomacyCapacity(city:City):number { return 1+Math.min(3,Math.floor(city.services.influence/20)); }
export function autoOffer(ctx:ContractContext,from:string,to:string):ContractResult {
 const a=ctx.cities[from],b=ctx.cities[to];if(!a||!b)return {ok:false,reason:'missing-city'};
 let best:OfferTerms|null=null,bestScore=0;
 for(const giveResource of RESOURCES)for(const takeResource of RESOURCES){
  if(giveResource===takeResource)continue;
  const count=Math.min(20,Math.floor(a.stocks[giveResource]*0.15));if(count<2)continue;
  for(const ratio of [0.5,1,2]){
   const amount=Math.min(Math.floor(b.stocks[takeResource]*0.15),Math.floor(count*ratio));if(amount<1||count+amount>40+Math.floor((a.services.transport+b.services.transport)/5))continue;
   const give=emptyStocks(),take=emptyStocks();give[giveResource]=count;take[takeResource]=amount;
   const terms:OfferTerms={id:`${ctx.now}:${from}:${to}`,from,to,give,take,offerUntil:ctx.now+1,deliverAt:ctx.now+2,pactUntil:ctx.now+6};
   const ua=utility(a,b,terms,ctx.diplomacy.reputation[to]??0),ub=utility(b,a,{...terms,give:take,take:give},ctx.diplomacy.reputation[from]??0);
   const score=Math.min(ua.total-1,ub.total);
   if(score>bestScore&&affordable(a,give,1+transport(a))&&affordable(b,take,transport(b))){best=terms;bestScore=score;}
  }
 }
 return best?proposeContract(ctx,best):{ok:false,reason:'no-mutually-useful-trade'};
}
