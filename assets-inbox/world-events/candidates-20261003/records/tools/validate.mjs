import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
import {execFileSync} from 'node:child_process';
const require=createRequire(import.meta.url),sharp=require('/opt/homebrew/lib/node_modules/openclaw/node_modules/sharp');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const manifest=JSON.parse(await fs.readFile(path.join(root,'assets/manifest.json'),'utf8'));
const rows=JSON.parse(await fs.readFile(path.join(root,'proofs/placements.json'),'utf8'));
const errors=[];let alphas=0;
for(const a of manifest.assets){const file=path.join(root,a.file),bytes=await fs.readFile(file);const hash=crypto.createHash('sha256').update(bytes).digest('hex');if(hash!==a.sha256)errors.push('hash '+a.file);const m=await sharp(bytes).metadata();if(m.width!==a.width||m.height!==a.height)errors.push('size '+a.file);if(a.newArt){const data=await sharp(bytes).ensureAlpha().raw().toBuffer();let zero=0;for(let i=3;i<data.length;i+=4)if(data[i]===0)zero++;if(zero)alphas++;else errors.push('opaque-new '+a.file);}}
for(const a of rows){for(const kind of ['before','after']){const m=await sharp(path.join(root,a[kind])).metadata();if(m.width!==1600||m.height!==1000)errors.push('proofsize '+a[kind]);}const before=await fs.readFile(path.join(root,a.before)),after=await fs.readFile(path.join(root,a.after));if(before.equals(after))errors.push('no-change '+a.id);for(const x of a.overlays)if(x.left<0||x.top<0||x.left+x.width>1600||x.top+x.height>1000)errors.push('out-of-view '+a.id);}
let listener='';try{listener=execFileSync('lsof',['-nP','-iTCP:4480','-sTCP:LISTEN'],{encoding:'utf8'});}catch{}if(listener.trim())errors.push('port4480-still-listening');
const repo='/Users/rexxa/fls-astra-worldevents';const status=execFileSync('git',['status','--short'],{cwd:repo,encoding:'utf8'});if(status.trim())errors.push('repo-dirty '+status);const head=execFileSync('git',['rev-parse','HEAD'],{cwd:repo,encoding:'utf8'}).trim();
const report={checkedAt:new Date().toISOString(),candidate:true,events:new Set(rows.map(r=>r.event)).size,proofPairs:rows.length,proofDimensions:[1600,1000],assets:manifest.assets.length,newPng:manifest.assets.filter(a=>a.newArt).length,reusedPng:manifest.assets.filter(a=>!a.newArt).length,newWithActualTransparentPixels:alphas,allAssetHashesMatched:!errors.some(e=>e.startsWith('hash')),serverPort4480Closed:!listener.trim(),repoHead:head,repoStatus:status||'clean',engineInstalled:false,errors};await fs.writeFile(path.join(root,'provenance/DELIVERY_QA.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(errors.length)process.exitCode=1;
