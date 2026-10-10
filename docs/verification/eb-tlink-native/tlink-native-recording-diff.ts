import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join} from 'node:path';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {canonicalTlinkRuleState,TLINK_PARITY_EXCLUSIONS} from '../../scripts/engineBTlinkParity';

const revisions={baseline:'64a16b5a6c1d91024415039db89bb88412528e15',changed:'9ad9253468592e7cba144946081d2fbced36adca'};
const projectorSha='88077edd542e891869d20a63746ce45e575cb80d174047e43e82e18aa982ba45';
const lockSha='26dc99ffc28b42fb06be47ac220f206a101d8cd2217b2391a20cb8006cc18697';
const sha=(v:string|Uint8Array)=>createHash('sha256').update(v).digest('hex');
const [input,output,...extra]=process.argv.slice(2);
assert.ok(input&&output&&!extra.length,'usage: node --import tsx .omo/evidence/tlink-native-recording-diff.ts INPUT_DIR NEW_OUTPUT.json');
assert.ok(!existsSync(output),'Output must be new');
const root=resolve(input),inputs:Record<string,string>={};
function read(path:string){const bytes=readFileSync(join(root,path));inputs[path]=sha(bytes);return bytes;}
const provenanceText=read('provenance.txt').toString();
const provenance:Record<string,string>={};
for(const line of provenanceText.trim().split('\n')){const i=line.indexOf('=');assert.ok(i>0);const key=line.slice(0,i);assert.ok(!(key in provenance));provenance[key]=line.slice(i+1);}
assert.equal(provenance.baseline,revisions.baseline);assert.equal(provenance.changed,revisions.changed);
assert.equal(provenance.lockSha256,lockSha);assert.equal(provenance.node,'v24.21.0');assert.equal(provenance.platform,'Linux aarch64');
assert.match(provenance.nodeSha256,/^[a-f0-9]{64}$/);assert.ok(provenance.nodePath.startsWith('/'));
assert.equal(provenance.scope,'24lots max500000ticks seeds1,2,3 not-standard-guardrail');
assert.deepEqual(TLINK_PARITY_EXCLUSIONS,['history','trace.decisions','trace.answers']);
assert.equal(sha(readFileSync(new URL('../../scripts/engineBTlinkParity.ts',import.meta.url))),projectorSha);
const producerPins:Record<string,string>={};
for(const side of ['baseline','changed'] as const){
 const revision=revisions[side];
 const tree=execFileSync('git',['ls-tree','-r',revision,'src','scripts','package.json','package-lock.json']);
 assert.deepEqual(read(`${side}/source-tree.txt`),tree,`${side} source-tree mismatch`);
 assert.equal(sha(execFileSync('git',['show',`${revision}:package-lock.json`])),lockSha);
 producerPins[side]=sha(execFileSync('git',['show',`${revision}:scripts/efficientGrowthRun.ts`]));
}
assert.equal(sha(execFileSync('git',['show',`${revisions.changed}:scripts/engineBTlinkParity.ts`])),projectorSha);
const comparison=JSON.parse(read('comparison.json').toString());
assert.equal(comparison.scope,'24lots max500000ticks seeds1,2,3');assert.equal(comparison.standardGuardrail,false);
assert.deepEqual(comparison.rows.map((r:{seed:number})=>r.seed),[1,2,3]);
const aggregate=read('aggregate-exit-code').toString().trim();assert.ok(aggregate==='0'||aggregate==='1');
type Difference={readonly path:string;readonly kind:'value'|'missing_baseline'|'missing_changed'|'type';readonly recording:boolean};
function differences(a:unknown,b:unknown,path='',parts:readonly string[]=[]):Difference[]{
 if(Object.is(a,b))return [];
 const recording=parts[0]==='history'||(parts[0]==='trace'&&(parts[1]==='decisions'||parts[1]==='answers'));
 const row=(kind:Difference['kind']):Difference[]=>[{path:path||'/',kind,recording}];
 if(a===null||b===null||typeof a!=='object'||typeof b!=='object')return row(typeof a===typeof b?'value':'type');
 if(Array.isArray(a)!==Array.isArray(b))return row('type');
 const left=Object.fromEntries(Object.entries(a)),right=Object.fromEntries(Object.entries(b));
 const result:Difference[]=[];
 for(const key of [...new Set([...Object.keys(left),...Object.keys(right)])].sort()){
  const child=`${path}/${key.replace(/~/g,'~0').replace(/\//g,'~1')}`,childParts=[...parts,key];
  if(!(key in left)||!(key in right)){
   result.push({path:child,kind:key in left?'missing_changed':'missing_baseline',recording:childParts[0]==='history'||(childParts[0]==='trace'&&['decisions','answers'].includes(childParts[1]))});
  }else result.push(...differences(left[key],right[key],child,childParts));
 }
 return result;
}
const rows=[];
for(const seed of [1,2,3]){
 const load=(side:'baseline'|'changed')=>{
  const prefix=`${side}/seed-${seed}`;
  const bytes=read(`${prefix}/final-state.json`),state=JSON.parse(bytes.toString()),summary=JSON.parse(read(`${prefix}/summary.json`).toString());
  const exitText=read(`${prefix}.exit-code`).toString().trim();assert.equal(exitText,'0');
  assert.equal(sha(bytes),summary.finalStateSha256);assert.equal(state.seed,seed);assert.equal(summary.seed,seed);
  assert.ok(Number.isSafeInteger(state.tick)&&state.tick>0&&state.tick<=500000);assert.equal(summary.final.tick,state.tick);
  assert.equal(summary.targetLots,24);assert.equal(summary.maxTicks,500000);assert.equal(summary.simulationPassed,true);
  const reported=comparison.rows.find((r:{seed:number})=>r.seed===seed).sides[side];
  assert.deepEqual(reported,{exitCode:0,tick:state.tick,sha256:sha(bytes),reportedSha256:sha(bytes),stopReason:summary.stopReason,simulationPassed:true});
  return {state,rawSha256:sha(bytes),projected:canonicalTlinkRuleState(state),tick:state.tick};
 };
 const baseline=load('baseline'),changed=load('changed');
 const rawFinalStateEqual=baseline.rawSha256===changed.rawSha256;
 assert.equal(comparison.rows.find((r:{seed:number})=>r.seed===seed).rawFinalStateEqual,rawFinalStateEqual);
 const changedPaths=differences(baseline.state,changed.state),outside=changedPaths.filter(p=>!p.recording);
 rows.push({seed,baselineTick:baseline.tick,changedTick:changed.tick,rawFinalStateEqual,
  baselineRawSha256:baseline.rawSha256,changedRawSha256:changed.rawSha256,
  baselineRuleSha256:sha(baseline.projected),changedRuleSha256:sha(changed.projected),
  nonRecordingEqual:baseline.projected===changed.projected,recordingChangedPathCount:changedPaths.length-outside.length,
  nonRecordingChangedPathCount:outside.length,changedPaths});
}
const rawAllEqual=rows.every(r=>r.rawFinalStateEqual);
assert.equal(comparison.rawFinalStateAllEqual,rawAllEqual);assert.equal(comparison.failed,!rawAllEqual);assert.equal(aggregate,rawAllEqual?'0':'1');
const nonRecordingAllEqual=rows.every(r=>r.nonRecordingEqual&&r.nonRecordingChangedPathCount===0&&r.baselineTick===r.changedTick);
writeFileSync(output,JSON.stringify({schemaVersion:1,status:nonRecordingAllEqual?'final_nonrecording_equal':'nonrecording_difference',
 rawFinalStateAllEqual:rawAllEqual,nativeAggregateExitCode:Number(aggregate),nonRecordingAllEqual,
 revisions,provenance,producerPins,projectorSha256:projectorSha,scriptSha256:sha(readFileSync(new URL(import.meta.url))),inputs,
 exclusions:TLINK_PARITY_EXCLUSIONS,rows,limits:[
 'Final-state comparison only: no trajectory, every-tick, or command-stream parity asserted.',
 'Raw native comparison and its exit code remain unchanged; this is a separate recording-excluded diagnostic.',
 'Only history, trace.decisions and trace.answers excluded; trace.acts, memory IDs, ledger refs and unknown fields remain.',
 'JSON paths identify changed values or whole missing subtrees; missing subtree descendants are not counted individually.',
 'Runtime binary SHA is a recorded producer assertion; the archived executable is not independently available here.',
 '24 lots / max500000 ticks is not the standard guardrail or the 125-year answer-outcome gate.'
 ]},null,2)+'\n',{flag:'wx'});
if(!nonRecordingAllEqual)process.exitCode=1;
