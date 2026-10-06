import {readFile,readdir,writeFile} from 'node:fs/promises';
import {gunzipSync} from 'node:zlib';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const directory='records/league-run',evidence=[];
for(const index of [0,5940,11879]){
 const files=(await readdir(directory)).filter(f=>f.startsWith('duel-')&&f.endsWith('.meta.json'));
 let found=null;
 for(const name of files){const meta=JSON.parse(await readFile(`${directory}/${name}`,'utf8'));if(meta.start<=index&&index<meta.end){found=meta;break;}}
 assert.ok(found);
 const original=JSON.parse(gunzipSync(await readFile(`${directory}/${found.file}`)).toString().trim().split('\n')[index-found.start]);
 const replay=spawnSync(process.execPath,['prototype/dist/league/run.js','--kind','duel','--replay-index',String(index)],{encoding:'utf8',maxBuffer:8*1024*1024});
 assert.equal(replay.status,0,replay.stderr);const result=JSON.parse(replay.stdout);assert.deepEqual(result.game,original);assert.equal(result.sourceHash,found.sourceHash);
 evidence.push({index,id:original.id,sourceHash:result.sourceHash,exactCompactStateEqual:true});
}
await writeFile('records/R04_REPLAY_AUDIT.json',JSON.stringify({scope:'Three preselected already-evaluated matches; not all-match replay',evidence},null,2)+'\n');console.log(JSON.stringify(evidence));
