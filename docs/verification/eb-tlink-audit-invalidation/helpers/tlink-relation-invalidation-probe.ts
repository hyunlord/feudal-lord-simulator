import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {LORD_SLICE_SCENARIO_ID} from '../../src/content/lordSliceConfig';
import {newGameState} from '../../src/state/newGame';
import {gameReducer} from '../../src/state/gameStore';
import {advanceTick} from '../../src/engine/tick';
import {lordBotCommands} from '../../src/engine/lordBot';
import {createTlinkParityObserver} from '../../scripts/engineBTlinkParity';
import {refuseHeavyOnMac} from '../../scripts/remote/localGuard.mjs';
import type {GameState} from '../../src/engine/engine.types';
const revision='9ad9253468592e7cba144946081d2fbced36adca';
const target={seed:3,id:'h-002840',tick:62011,estate:'estate-neighbour-3',limit:63000};
const selectionReason='Earliest interior pending-to-invalidated candidate without an actual state-changing command before first season: nine audit-4 punish attempts all stateChanged=false. Earlier candidates h-003681, h-002251 and h-002465 have actual oversight/audit-mode changes. The runtime cause remains unknown.';
const sha=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const [data,output,...extra]=process.argv.slice(2);
assert.ok(data&&output&&!extra.length,'usage: tsx .omo/evidence/tlink-relation-invalidation-probe.ts DATA_DIR NEW_OUTPUT.json');
refuseHeavyOnMac('Bounded frozen-source invalidation probe',{remote:'Use official run.sh --heavy --experiment'});
assert.equal(process.platform,'linux');assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),revision);
const status=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
assert.ok(status===''||status==='?? .omo/evidence/tlink-relation-invalidation-probe.ts','Only this hash-pinned runtime probe may be untracked');assert.ok(!existsSync(output));
const directory=resolve(data),contextPath=join(directory,'seed-3/original-contexts.json.gz'),parityPath=join(directory,'seed-3/collect-parity.json');
const contextBytes=readFileSync(contextPath),parityBytes=readFileSync(parityPath);
// Pins are the original completed collection bytes, not a reconstructed command list.
assert.equal(sha(contextBytes),'fe1aa6447a56a8e75c68b51f26c01ef134ba2e7d601baea77ab4070f7a610ab1');assert.equal(sha(parityBytes),'4cf1d7e52dcb00a2f839f49d1645f7da6be2988e33a5bd46356137c322ffd5e3');
const contexts=JSON.parse(gunzipSync(contextBytes).toString()) as {ordinal:number;tick:number;command:Parameters<typeof gameReducer>[1];history?:{id:string}|null}[];
const expected=JSON.parse(parityBytes.toString());
const preflightBytes=readFileSync(join(directory,'seed-3/preflight.json'));
assert.equal(sha(preflightBytes),'73b945af393119d7985a7bd1da1222d1294cf784b493e40b3cd39a859c05dcdf');
const preflight=JSON.parse(preflightBytes.toString());assert.equal(preflight.sourceRevision,revision);
for(const pin of preflight.sourceFiles as {path:string;sha256:string}[])assert.equal(sha(readFileSync(pin.path)),pin.sha256,`source drift ${pin.path}`);
for(const [name,pin] of Object.entries(preflight.toolHashes))assert.equal(sha(readFileSync(join('scripts',name))),pin,`tool drift ${name}`);
assert.equal(process.version,preflight.source.node);assert.equal(sha(readFileSync('package-lock.json')),preflight.source.lock);
let state=newGameState({scenarioId:LORD_SLICE_SCENARIO_ID,seed:target.seed});assert.ok(state&&state.tick===0);
const parity=createTlinkParityObserver({seasonLength:1000});let ordinal=0;const stream=createHash('sha256');
parity.observe(state,{phase:'initial',commandOrdinal:ordinal});
const evidence=(s:GameState)=>s.trace?.answers?.find(a=>a.id===target.id)?.estateRelationEvidence;
const snapshot=(s:GameState)=>({tick:s.tick,proof:evidence(s),oversight:s.stewardship?.oversight.find(o=>o.estateId===target.estate),
 stewards:s.stewardship?.stewards.filter(x=>x.estateId===target.estate),summaries:s.stewardship?.summaries.filter(x=>x.estateId===target.estate)});
let transition:unknown=null,answered:unknown=null;
function inspect(before:GameState,after:GameState,phase:string,command:unknown){
 if(!answered&&evidence(after)){assert.equal(after.tick,target.tick);answered=snapshot(after);}
 const old=evidence(before),current=evidence(after);
 if(old?.some((row,i)=>row.status==='pending'&&current?.[i]?.status==='invalidated')){
  const known=new Set(before.history?.records.map(r=>r.id));transition={phase,ordinal,command,before:snapshot(before),after:snapshot(after),
   stewardshipSame:before.stewardship===after.stewardship,
   oversightSame:before.stewardship?.oversight.find(o=>o.estateId===target.estate)===after.stewardship?.oversight.find(o=>o.estateId===target.estate),
   freshSummaries:after.stewardship?.summaries.filter(x=>!before.stewardship?.summaries.includes(x)),
   freshHistory:after.history?.records.filter(r=>!known.has(r.id))};
 }
}
const started=Date.now();
try{
 outer:while(state.tick<target.limit){
  assert.ok(Date.now()-started<20*60*1000,'20-minute wall limit');
  for(const {command} of lordBotCommands(state)){
   const expectedCommand=contexts[ordinal];assert.ok(expectedCommand);assert.equal(expectedCommand.ordinal,ordinal+1);assert.equal(expectedCommand.tick,state.tick);assert.deepEqual(command,expectedCommand.command);
   const before=state;state=gameReducer(state,command);ordinal++;stream.update(`${JSON.stringify({ordinal,tick:before.tick,command})}\n`);
   parity.observe(state,{phase:'command',commandOrdinal:ordinal});inspect(before,state,'command',command);
   if(expectedCommand.history)assert.ok(state.history?.records.some(r=>r.id===expectedCommand.history?.id),'answer ID drift');
   if(transition)break outer;
  }
  const before=state;state=advanceTick(state);parity.observe(state,{phase:'tick',commandOrdinal:ordinal});inspect(before,state,'tick',null);
  if(transition)break;
 }
 const observed=parity.snapshot();assert.deepEqual(observed.checkpoints,expected.checkpoints.slice(0,observed.checkpoints.length),'original collection sampled prefix mismatch');
 assert.ok(answered,'target answer not reached');assert.ok(transition,'no first invalidation before bound');
 writeFileSync(output,JSON.stringify({status:'bounded_original_replay_first_invalidation_observed',revision,target,selectionReason,tick:state.tick,ordinal,
  sourceFiles:preflight.sourceFiles,toolHashes:preflight.toolHashes,scriptSha256:sha(readFileSync(new URL(import.meta.url))),
  inputs:{contextSha256:sha(contextBytes),paritySha256:sha(parityBytes),preflightSha256:sha(preflightBytes)},
  sampledPrefixCheckpoints:observed.checkpoints.length,commandPrefixSha256:stream.digest('hex'),answered,transition,
  limits:['Only original command prefix through first invalidation. Not full replay or gate.','No state fabrication or extra reducer/tick. No future credit inferred from observation.']},null,2)+'\n',{flag:'wx'});
}catch(error){writeFileSync(output,JSON.stringify({status:'failed_probe_not_evidence',revision,target,selectionReason,tick:state.tick,ordinal,error:String(error),answered,transition},null,2)+'\n',{flag:'wx'});throw error;}
