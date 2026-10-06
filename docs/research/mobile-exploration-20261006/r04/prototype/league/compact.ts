import { AXES, population } from '../model/index.js';
import type { GameResult, Snapshot } from './game.js';
import type { ScheduledGame } from './schedule.js';
export function compactSnapshot(snapshot:Snapshot){
 const city=snapshot.city;
 const facilities=city.facilities.map(f=>({...f}));
 const facilityCounts=Object.fromEntries(AXES.map(axis=>[axis,facilities.filter(f=>f.axis===axis&&f.hp>0).length]));
 return {seat:snapshot.seat,strategy:snapshot.strategy,tick:city.tick,population:population(city),
  stocks:city.stocks,externalMarket:city.externalMarket,ownedEscrow:snapshot.ownedEscrow,value:snapshot.value,
  policy:city.policy,facilityCounts,facilities,services:city.services,mobilized:city.mobilized,
  migrantsRemaining:city.migrantsRemaining,starvation:city.starvation,
  roads:city.tiles.filter(t=>t.road).map(t=>({x:t.x,y:t.y})),
  households:city.households.map(h=>({id:h.id,people:h.people,x:h.x,y:h.y,facilityId:h.facilityId})),
  flows:snapshot.flows};
}
export function compactGame(result:GameResult,schedule:ScheduledGame){
 return {id:schedule.id,block:schedule.block,rotation:schedule.rotation,spec:result.spec,
  growth:result.growth.map(compactSnapshot),foreign:result.foreign.map(compactSnapshot),recovery:result.recovery.map(compactSnapshot),
  wars:result.wars,decisions:result.decisions,order:result.order,diplomacy:result.diplomacy};
}
export type CompactGame=ReturnType<typeof compactGame>;
