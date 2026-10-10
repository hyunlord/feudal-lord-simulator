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
const originalRevision='9ad9253468592e7cba144946081d2fbced36adca';
const revision=process.env.EXPECTED_PRODUCT_REVISION;
assert.ok(revision&&/^[0-9a-f]{40}$/.test(revision),'EXPECTED_PRODUCT_REVISION must pin the full new product commit');
assert.notEqual(revision,originalRevision,'The repaired product revision is required');
const target={seed:3,id:'h-002840',tick:62011,estate:'estate-neighbour-3',limit:63000};
const selectionReason='Verify target survives genuine audit at 62320 and contributes on the existing first-next-season record at 63000; original command and canonical-state prefix unchanged.';
const sha=(bytes:string|Uint8Array)=>createHash('sha256').update(bytes).digest('hex');
const [data,output,...extra]=process.argv.slice(2);
assert.ok(data&&output&&!extra.length,'usage: tsx .omo/evidence/tlink-audit-repair-probe.ts DATA_DIR NEW_OUTPUT.json');
refuseHeavyOnMac('Bounded repaired-source audit preservation probe',{remote:'Use official run.sh --heavy --experiment'});
assert.equal(process.platform,'linux');assert.equal(execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),revision);
const status=execFileSync('git',['status','--porcelain'],{encoding:'utf8'}).trim();
assert.ok(status===''||status==='?? .omo/evidence/tlink-audit-repair-probe.ts','Only this hash-pinned runtime probe may be untracked');assert.ok(!existsSync(output));
const directory=resolve(data),contextPath=join(directory,'seed-3/original-contexts.json.gz'),parityPath=join(directory,'seed-3/collect-parity.json');
const contextBytes=readFileSync(contextPath),parityBytes=readFileSync(parityPath);
// Pins are the original completed collection bytes, not a reconstructed command list.
assert.equal(sha(contextBytes),'fe1aa6447a56a8e75c68b51f26c01ef134ba2e7d601baea77ab4070f7a610ab1');assert.equal(sha(parityBytes),'4cf1d7e52dcb00a2f839f49d1645f7da6be2988e33a5bd46356137c322ffd5e3');
const contexts=JSON.parse(gunzipSync(contextBytes).toString()) as {ordinal:number;tick:number;command:Parameters<typeof gameReducer>[1];history?:{id:string}|null}[];
const expected=JSON.parse(parityBytes.toString());
const preflightBytes=readFileSync(join(directory,'seed-3/preflight.json'));
assert.equal(sha(preflightBytes),'73b945af393119d7985a7bd1da1222d1294cf784b493e40b3cd39a859c05dcdf');
const preflight=JSON.parse(preflightBytes.toString());assert.equal(preflight.sourceRevision,originalRevision);
const allowedChange='src/engine/decisionTraceEstateRelations.ts';
const originalSource=preflight.sourceFiles as {path:string;sha256:string}[];
const sourcePaths=execFileSync('git',['ls-files','src'],{encoding:'utf8'}).trim().split('\n').sort();
assert.deepEqual(sourcePaths,originalSource.map(pin=>pin.path).sort(),'Source file set changed');
const currentSourceFiles=sourcePaths.map(path=>({path,sha256:sha(readFileSync(path))}));
for(const pin of originalSource){
 const current=currentSourceFiles.find(row=>row.path===pin.path)!;
 assert.equal(current.sha256,sha(execFileSync('git',['show',`${revision}:${pin.path}`])),`dirty source ${pin.path}`);
 if(pin.path!==allowedChange)assert.equal(current.sha256,pin.sha256,`unauthorized source drift ${pin.path}`);
}
assert.notEqual(currentSourceFiles.find(row=>row.path===allowedChange)?.sha256,originalSource.find(row=>row.path===allowedChange)?.sha256);
const sourceTreeSha256=sha(JSON.stringify(currentSourceFiles));
const gitTree=execFileSync('git',['rev-parse',`${revision}^{tree}`],{encoding:'utf8'}).trim();
for(const [name,pin] of Object.entries(preflight.toolHashes))assert.equal(sha(readFileSync(join('scripts',name))),pin,`tool drift ${name}`);
assert.equal(process.version,preflight.source.node);assert.equal(sha(readFileSync('package-lock.json')),preflight.source.lock);
let state=newGameState({scenarioId:LORD_SLICE_SCENARIO_ID,seed:target.seed});assert.ok(state&&state.tick===0);
const parity=createTlinkParityObserver({seasonLength:1000});let ordinal=0;const stream=createHash('sha256');
parity.observe(state,{phase:'initial',commandOrdinal:ordinal});
const evidence=(s:GameState)=>s.trace?.answers?.find(a=>a.id===target.id)?.estateRelationEvidence;
const snapshot=(s:GameState)=>({tick:s.tick,proof:evidence(s),oversight:s.stewardship?.oversight.find(o=>o.estateId===target.estate),
 stewards:s.stewardship?.stewards.filter(x=>x.estateId===target.estate),summaries:s.stewardship?.summaries.filter(x=>x.estateId===target.estate)});
let answered:unknown=null,auditWitness:unknown=null,seasonWitness:unknown=null;
function inspect(before:GameState,after:GameState,phase:string,command:unknown){
 const current=evidence(after);
 if(!answered&&current){assert.equal(after.tick,target.tick);assert.ok(current.every(row=>row.status==='pending'));answered=snapshot(after);}
 if(answered)assert.ok(!current?.some(row=>row.status==='invalidated'),'target proof invalidated');
 if(phase==='tick'&&after.tick===62320){
  const audits=after.stewardship?.audits.filter(row=>row.estateId===target.estate&&!before.stewardship?.audits.some(old=>old.id===row.id));
  assert.equal(audits?.length,1,'genuine target-estate audit not observed');
  assert.ok(current?.length&&current.every(row=>row.status==='pending'),'proof did not survive audit');
  auditWitness={phase,ordinal,command,before:snapshot(before),after:snapshot(after),freshAudits:audits};
 }
 if(phase==='tick'&&after.tick===target.limit){
  assert.ok(current?.length&&current.every(row=>row.status==='consumed'),'proof was not consumed at first next season');
  const summaries=after.stewardship?.summaries.filter(row=>row.estateId===target.estate&&row.tick===target.limit&&!before.stewardship?.summaries.includes(row));
  assert.equal(summaries?.length,1);
  const records=after.history?.records.filter(row=>row.template==='stewardship.season'&&row.tick===target.limit
   &&row.params?.traceEstate===target.estate&&row.because?.some(cause=>cause.decisionId===target.id&&cause.key==='estate_mood'));
  assert.equal(records?.length,1,'existing stewardship.season own-answer link absent or ambiguous');
  assert.ok(!before.history?.records.some(row=>row.id===records?.[0]?.id));
  assert.equal(records?.[0]?.params?.reported,summaries?.[0]?.reported);
  assert.equal(records?.[0]?.params?.mode,summaries?.[0]?.mode);
  seasonWitness={phase,ordinal,before:snapshot(before),after:snapshot(after),freshSummaries:summaries,existingSeasonRecord:records?.[0]};
 }
}
const started=Date.now();
try{
 while(state.tick<target.limit){
  assert.ok(Date.now()-started<20*60*1000,'20-minute wall limit');
  for(const {command} of lordBotCommands(state)){
   const expectedCommand=contexts[ordinal];assert.ok(expectedCommand);assert.equal(expectedCommand.ordinal,ordinal+1);assert.equal(expectedCommand.tick,state.tick);assert.deepEqual(command,expectedCommand.command);
   const before=state;state=gameReducer(state,command);ordinal++;stream.update(`${JSON.stringify({ordinal,tick:before.tick,command})}\n`);
   parity.observe(state,{phase:'command',commandOrdinal:ordinal});inspect(before,state,'command',command);
   if(expectedCommand.history)assert.ok(state.history?.records.some(r=>r.id===expectedCommand.history?.id),'answer ID drift');
  }
  const before=state;state=advanceTick(state);parity.observe(state,{phase:'tick',commandOrdinal:ordinal});inspect(before,state,'tick',null);
 }
 const observed=parity.snapshot();assert.deepEqual(observed.checkpoints,expected.checkpoints.slice(0,observed.checkpoints.length),'original collection sampled prefix mismatch');
 assert.ok(answered&&auditWitness&&seasonWitness,'required actual witnesses missing');assert.equal(state.tick,target.limit);
 const expectedPrefix=contexts.filter(row=>row.tick<target.limit);
 assert.equal(ordinal,expectedPrefix.length,'original command prefix was incomplete');
 const expectedCommandPrefixSha256=sha(expectedPrefix.map(row=>JSON.stringify({ordinal:row.ordinal,tick:row.tick,command:row.command})+'\n').join(''));
 const commandPrefixSha256=stream.digest('hex');assert.equal(commandPrefixSha256,expectedCommandPrefixSha256);
 writeFileSync(output,JSON.stringify({status:'bounded_repaired_audit_survival_and_existing_season_link_verified',revision,originalRevision,target,selectionReason,tick:state.tick,ordinal,
  sourceFiles:currentSourceFiles,originalSourceFiles:originalSource,sourceTreeSha256,gitTree,node:process.version,dependencyLockSha256:preflight.source.lock,toolHashes:preflight.toolHashes,scriptSha256:sha(readFileSync(new URL(import.meta.url))),
  inputs:{contextSha256:sha(contextBytes),paritySha256:sha(parityBytes),preflightSha256:sha(preflightBytes)},
  sampledPrefixCheckpoints:observed.checkpoints.length,commandPrefixSha256,expectedCommandPrefixSha256,answered,auditWitness,seasonWitness,
  limits:['Only original command prefix through tick63000. Not full replay, 125-year result, or gate.','No state fabrication, additional commands, or duplicate transition calls. Actual existing season receipt only; no whole-run metric extrapolation.']},null,2)+'\n',{flag:'wx'});
}catch(error){writeFileSync(output,JSON.stringify({status:'failed_probe_not_evidence',revision,target,selectionReason,tick:state.tick,ordinal,error:String(error),answered,auditWitness,seasonWitness},null,2)+'\n',{flag:'wx'});throw error;}
