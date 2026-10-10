import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve,join,basename} from 'node:path';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';

const [input,diffPath,destination,...extra]=process.argv.slice(2);
assert.ok(input&&diffPath&&destination&&!extra.length,'usage: node .omo/evidence/tlink-native-archive-23d.mjs NATIVE_INPUT_DIR DIFF_JSON NEW_ARCHIVE_DIR');
const root=resolve(input),out=resolve(destination);
assert.ok(!existsSync(out),'Archive directory must be new');
assert.equal(out,resolve('docs/verification/eb-tlink-native-23d'),'23d archive must use its separate destination');
const sha=b=>createHash('sha256').update(b).digest('hex');
const diffBytes=readFileSync(diffPath),diff=JSON.parse(diffBytes);
assert.equal(diff.schemaVersion,1);
assert.ok(['final_nonrecording_equal','nonrecording_difference'].includes(diff.status),'Requires completed offline diagnostic, not a provisional claim');
assert.equal(diff.revisions.baseline,'64a16b5a6c1d91024415039db89bb88412528e15');
assert.equal(diff.revisions.changed,'23d12264289538de5f6ef3ef3f36aa9257b10aba');
assert.deepEqual(diff.exclusions,['history','trace.decisions','trace.answers']);
assert.deepEqual(diff.rows.map(r=>r.seed),[1,2,3]);
const diffHelper=readFileSync(new URL('./tlink-native-recording-diff-23d.ts',import.meta.url));
assert.equal(sha(diffHelper),diff.scriptSha256,'Diagnostic helper must match the actual report');
const members=[],rawFinalStates=[];
function add(path,bytes,originalSha256=null){members.push({path,bytes,sha256:sha(bytes),size:bytes.length,...(originalSha256?{originalSha256}:{})});}
function receipt(path){const bytes=readFileSync(join(root,path));assert.equal(sha(bytes),diff.inputs[path],`Changed diagnostic input: ${path}`);add(path,bytes);return bytes;}
const officialDirectory=resolve(root,'..');
const exitBytes=readFileSync(join(officialDirectory,'exit-code'));
const exitText=exitBytes.toString().trim();assert.match(exitText,/^(0|[1-9]\d*)$/);
const officialExitCode=Number(exitText);assert.ok(Number.isSafeInteger(officialExitCode)&&officialExitCode<=255);
assert.equal(officialExitCode,diff.nativeAggregateExitCode,'Official outer exit differs from diagnostic aggregate; no normalization allowed');
const timingBytes=readFileSync(join(officialDirectory,'timing.env'));
const timing={};
for(const line of timingBytes.toString().trim().split('\n')){
 const i=line.indexOf('=');assert.ok(i>0,'Unreadable timing receipt');const key=line.slice(0,i);
 assert.ok(!(key in timing),'Duplicate timing field');timing[key]=line.slice(i+1);
}
assert.match(timing.COMMAND_S??'',/^\d+(?:\.\d+)?$/,'Missing/invalid completed command duration');
const logBytes=readFileSync(join(officialDirectory,'run.log'));assert.ok(logBytes.length>0,'Empty run log');
add('official/exit-code',exitBytes);add('official/timing.env',timingBytes);
add('official/run.log.gz',gzipSync(logBytes,{level:9}),sha(logBytes));
const officialRun={runId:basename(officialDirectory),runIdBasis:'fetched artifact directory name',
 artifactDirectory:officialDirectory,nativeInputDirectory:root,exitCode:officialExitCode,
 commandSeconds:Number(timing.COMMAND_S),timing,runLogRawSha256:sha(logBytes)};
for(const path of ['comparison.json','provenance.txt','aggregate-exit-code'])receipt(path);
for(const side of ['baseline','changed']){
 receipt(`${side}/source-tree.txt`);
 for(const seed of [1,2,3]){
  const prefix=`${side}/seed-${seed}`;
  receipt(`${prefix}.exit-code`);
  const summary=JSON.parse(receipt(`${prefix}/summary.json`));
  const path=`${prefix}/final-state.json`,bytes=readFileSync(join(root,path)),hash=sha(bytes);
  assert.equal(hash,diff.inputs[path]);assert.equal(hash,summary.finalStateSha256);
  const row=diff.rows.find(r=>r.seed===seed);assert.equal(hash,row[`${side}RawSha256`]);
  rawFinalStates.push({side,seed,path,bytes:bytes.length,sha256:hash,tick:summary.final.tick,retainedInCompactArchive:false});
 }
}
add('recording-diff.json.gz',gzipSync(diffBytes,{level:9}),sha(diffBytes));
add('tlink-native-recording-diff-23d.ts',diffHelper);
add('tlink-native-archive-23d.mjs',readFileSync(new URL(import.meta.url)));
const manifest={schemaVersion:1,scope:'24 lots; max 500000 ticks; seeds 1,2,3; legitimate early stop; NOT standard guardrail',
 officialRun,revisions:diff.revisions,rawFinalStateAllEqual:diff.rawFinalStateAllEqual,nativeAggregateExitCode:diff.nativeAggregateExitCode,
 nonRecordingAllEqual:diff.nonRecordingAllEqual,diagnosticStatus:diff.status,
 rawFinalStates,members:members.map(({bytes,...metadata})=>metadata),
 limits:['Flags copied from hash-bound completed diagnostic; archive packaging is not an independent simulation or parity adjudication.',
 'Raw final-state files are omitted for size; fetch all six original files to reproduce the diagnostic.',
 'Final-state projection comparison does not prove trajectory parity, standard guardrail acceptance, or 125-year outcome coverage.']};
add('manifest.json',Buffer.from(JSON.stringify(manifest,null,2)+'\n'));
add('README.md',Buffer.from(`# Native paired diagnostic receipts\n\nScope: 24 lots, max 500000 ticks, seeds 1–3. Target-scale-stable early termination is retained as measured. This is not the standard guardrail. Read comparison.json and recording-diff.json.gz separately; recording exclusions never overwrite the raw result or native exit code.\n\n## Fetch and reproduce\n\nFetch the existing completed handle with \`bash scripts/remote/run.sh --fetch engineB-tlink-native-latest-23d1226\` (confirm the exact handle against the original run receipt). Do not start another run. Locate eb-tlink-native-paired in the fetched artifact directory. Require provenance.txt, comparison.json, aggregate-exit-code, both source-tree.txt files, all six summary.json/final-state.json files and six seed exit codes. Verify every raw final-state byte count and SHA256 against manifest.json. A fetch reporting missing exit-code is incomplete, not terminal evidence.\n\nFrom the original repository containing both pinned commits and the unchanged projector, place the retained diagnostic helper under .omo/evidence/ and run:\n\n\`\`\`sh\nnode --import tsx .omo/evidence/tlink-native-recording-diff-23d.ts NATIVE_INPUT_DIR NEW_DIFF.json\n\`\`\`\n\nThe helper writes a new result only; non-recording differences exit 1 while preserving the report. Packaging does not remedy failed simulations or unavailable files. Raw files remain external; their exact relative paths, sizes and hashes are in manifest.json. The compressed report's original JSON SHA is recorded in the member list.\n`));
const checksums=members.map(m=>`${m.sha256}  ${m.path}`).join('\n')+'\n';add('SHA256SUMS',Buffer.from(checksums));
const totalBytes=members.reduce((n,m)=>n+m.size,0);
assert.ok(totalBytes<3_000_000,`Compact archive reaches/exceeds 3,000,000 bytes: ${totalBytes}; do not silently omit receipts`);
mkdirSync(out);
for(const member of members){const path=join(out,member.path);mkdirSync(resolve(path,'..'),{recursive:true});writeFileSync(path,member.bytes,{flag:'wx'});}
console.log(JSON.stringify({output:out,files:members.length,totalBytes,rawFinalStatesRetained:false,diagnosticStatus:diff.status}));
