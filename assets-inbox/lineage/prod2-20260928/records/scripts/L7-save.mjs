import fs from 'node:fs';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
const sharp=createRequire(import.meta.url)('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root='/Users/rexxa/github/feudal-lord-simulator/output/astra-lineage-prod2-v1';
const jobs=JSON.parse(fs.readFileSync(root+'/records/L7-jobs.json','utf8'));
for(const j of jobs){
 const raw='/Users/rexxa/feudal-lord-analysis/astra-raw/lineage-prod2-20260928/L7/'+j.id+'.png';
 if(!fs.existsSync(raw)) fs.copyFileSync(j.src,raw);
 const out=root+(j.id.includes('-v')?'/records/':'/assets/L7/')+j.id+'.png';
 if(!fs.existsSync(out)) await sharp(raw).resize(256,256,{fit:'fill'}).ensureAlpha().png().toFile(out);
 j.rawFile=raw; j.referenceSHA256 ??= j.refs.map(p=>({file:p,sha256:crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex')}));
}
fs.writeFileSync(root+'/records/L7-jobs.json',JSON.stringify(jobs,null,2));
