import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from '/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp/dist/index.mjs';
const b='/Users/rexxa/github/feudal-lord-simulator/output/astra-lineage-prod2-v1';
const m=JSON.parse(process.argv[2]);
const raw='/Users/rexxa/feudal-lord-analysis/astra-raw/lineage-prod2-20260928/L8/'+m.id+'.png';
fs.copyFileSync(m.generated,raw);await sharp(raw).resize(256,256,{fit:'contain'}).ensureAlpha().png().toFile(b+'/assets/L8/'+m.id+'.png');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const rec={...m,file:'assets/L8/'+m.id+'.png',rawFile:raw,selectedRawFile:raw,status:'candidate',sha256:hash(b+'/assets/L8/'+m.id+'.png'),generationRecords:[{prompt:m.prompt,referenceImages:m.referenceImages,referenceHashes:Object.fromEntries(m.referenceImages.map(p=>[p,hash(p)])),rawFile:raw,tool:'image_gen.imagegen',model:null,seed:null,sourceDimensions:await sharp(raw).metadata()}],processing:'Sharp resize256 ensureAlpha only; no face composite',qa:{status:'candidate',visualObservation:'Pending full 256px and96px visual review',runtime:'not installed'}};delete rec.generated;const p=b+'/records/L8.json';const a=fs.existsSync(p)?JSON.parse(fs.readFileSync(p)):[];a.push(rec);fs.writeFileSync(p,JSON.stringify(a,null,2));console.log(m.id);
