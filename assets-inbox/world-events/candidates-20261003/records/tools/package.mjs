import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('/opt/homebrew/lib/node_modules/openclaw/node_modules/sharp');
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),stage='/tmp/astra-world-events-stage-20261003';
await fs.mkdir(stage,{recursive:true});
for(const p of ['README.md','EVENTS_IN_WORLD.md','REVIEW.md','BLIND.md','assets','provenance','tools'])await fs.cp(path.join(root,p),path.join(stage,p),{recursive:true});
await fs.mkdir(path.join(stage,'proofs'),{recursive:true});
for(const e of await fs.readdir(path.join(root,'proofs'),{withFileTypes:true}))if(e.name!=='blind')await fs.cp(path.join(root,'proofs',e.name),path.join(stage,'proofs',e.name),{recursive:true});
await fs.mkdir(path.join(stage,'references'),{recursive:true});
for(const n of await fs.readdir(path.join(root,'references')))if(n.startsWith('flood-layer-')||n==='EXISTING-WORLD-ART.jpg'||(n.startsWith('church-')&&n.endsWith('-hud.jpg')))await fs.copyFile(path.join(root,'references',n),path.join(stage,'references',n));
async function files(dir){let a=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())a.push(...await files(p));else a.push(p);}return a;}
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const known=new Map();for(const p of await files(stage))if(/\.(jpg|png)$/.test(p))known.set(hash(await fs.readFile(p)),p);
const mapping=[];
for(const letter of ['A','B','C','D']){
 const local=path.join(root,'proofs/blind',letter),dest=path.join(stage,'proofs/blind',letter);await fs.mkdir(dest,{recursive:true});
 const trials=JSON.parse(await fs.readFile(path.join(local,'TRIALS.json'),'utf8'));
 await fs.copyFile(path.join(local,'RESULTS.json'),path.join(dest,'RESULTS.json'));
 await fs.copyFile(path.join(local,'TRIALS.json'),path.join(stage,'provenance',`blind-original-trials-${letter}.json`));
 for(const t of trials)for(const kind of ['scene','detail']){const b=await fs.readFile(path.join(local,t[kind]));const sha=hash(b);let p=known.get(sha);const deduplicated=Boolean(p);if(!p){p=path.join(dest,t[kind]);await fs.writeFile(p,b);known.set(sha,p);}mapping.push({id:t.id,kind,originalAnonymousFile:t[kind],archiveFile:path.relative(stage,p),sha256:sha,deduplicated});t[kind]=path.relative(dest,p);}
 await fs.writeFile(path.join(dest,'TRIALS.json'),JSON.stringify(trials,null,2));
}
await fs.copyFile(path.join(root,'proofs/blind/SCORES.json'),path.join(stage,'proofs/blind/SCORES.json'));
await fs.writeFile(path.join(stage,'proofs/blind/ARCHIVE_MAP.json'),JSON.stringify({note:'After unblinding only: identical copies point to canonical evidence; original anonymous manifests retained in provenance. SHA proves exact viewed image.',images:mapping},null,2));
await fs.copyFile(path.join(stage,'proofs/blind/ARCHIVE_MAP.json'),path.join(root,'proofs/blind/ARCHIVE_MAP.json'));
// Compact explanatory montage/HUD copies only; scored scenes, native crops and all assets remain byte-identical.
for(const p of await files(stage))if(/\.jpg$/.test(p)&&/qa-review-|contact|alpha|QA-first-pass|hud/.test(path.basename(p))){const b=await sharp(await fs.readFile(p)).jpeg({quality:65}).toBuffer();await fs.writeFile(p,b);}
const all=(await files(stage)).filter(p=>path.basename(p)!=='SHA256SUMS').sort();const sums=[];let bytes=0;for(const p of all){const b=await fs.readFile(p);bytes+=b.length;sums.push(hash(b)+'  '+path.relative(stage,p));}
await fs.writeFile(path.join(stage,'SHA256SUMS'),sums.join('\n')+'\n');await fs.copyFile(path.join(stage,'SHA256SUMS'),path.join(root,'SHA256SUMS'));
console.log(JSON.stringify({stage,files:all.length+1,uncompressedBytes:bytes,blindImages:mapping.length,deduplicatedBlind:mapping.filter(x=>x.deduplicated).length}));
