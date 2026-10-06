import { createWriteStream } from 'node:fs';
import { once } from 'node:events';
import { rename } from 'node:fs/promises';
import { pipeline } from 'node:stream/promises';
import { createGzip } from 'node:zlib';
import type { Game, Observation } from './analysis-input.js';
function city(observation:Observation){return {seat:observation.seat,strategy:observation.strategy,population:observation.population,stocks:observation.stocks,ownedEscrow:observation.escrow,value:observation.recordedValue,policy:observation.policy,facilityCounts:observation.facilities};}
/** Lightweight per-game audit trail, not a replacement for full local inputs. */
export function outcome(game:Game){
 const decisions:Record<string,Record<string,number>>={};for(const row of game.decisions){const counts=decisions[row.seat]??{};counts[row.action]=(counts[row.action]??0)+1;decisions[row.seat]=counts;}
 const receipts:Record<string,number>={};for(const event of game.receipts)receipts[event]=(receipts[event]??0)+1;
 return {id:game.id,block:game.block,rotation:game.rotation,seed:game.seed,terrain:game.terrain,growthSteps:game.age,strategies:game.recovery.map(c=>c.strategy),growth:game.growth.map(city),foreign:game.foreign.map(city),recovery:game.recovery.map(city),wars:game.wars,decisionCounts:decisions,diplomacyReceiptCounts:receipts};
}
export function outcomeWriter(destination:string){
 const temporary=`${destination}.${process.pid}.tmp`,gzip=createGzip({level:9}),completion=pipeline(gzip,createWriteStream(temporary,{flags:'wx'}));
 return {async add(game:Game):Promise<void>{if(!gzip.write(JSON.stringify(outcome(game))+'\n'))await once(gzip,'drain');},async finish():Promise<void>{gzip.end();await completion;await rename(temporary,destination);},async abort():Promise<void>{gzip.destroy();try{await completion;}catch(error){if(!(error instanceof Error)||!('code'in error)||error.code!=='ERR_STREAM_PREMATURE_CLOSE')throw error;}}};
}
