import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { appendFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readDataset } from '../league/analysis-files.js';
test('compiled training CLI data verifies then SHA tampering is rejected',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'mobile-analysis-test-'));
 try{
  execFileSync(process.execPath,[fileURLToPath(new URL('../league/run.js',import.meta.url)),'--kind','smoke','--out',directory]);
  let rows=0;const result=await readDataset({input:directory,kind:'smoke',partial:false},()=>{rows++;});
  assert.equal(result.complete,true);assert.equal(result.count,1);assert.equal(rows,1);
  const batch=result.batches[0];assert.ok(batch);await appendFile(join(directory,batch.file),'tampered');
  await assert.rejects(readDataset({input:directory,kind:'smoke',partial:false},()=>{}),/SHA256 mismatch/);
 }finally{await rm(directory,{recursive:true,force:true});}
});
