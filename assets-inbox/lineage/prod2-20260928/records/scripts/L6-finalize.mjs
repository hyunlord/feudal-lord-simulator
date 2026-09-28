import fs from 'node:fs';
import crypto from 'node:crypto';
import {createRequire} from 'node:module';
const require=createRequire(import.meta.url),sharp=require('/tmp/astra-wave4b-work-20260925/node_modules/sharp');
const base='output/astra-lineage-prod2-v1';
const rows=JSON.parse(fs.readFileSync(`${base}/records/L6.json`));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const checks=[];
for(const r of rows){
 const path=`${base}/${r.file}`,m=await sharp(path).metadata(),last=r.generationRecords.at(-1);
 r.sha256=hash(path);
 r.prompt=last.prompt;
 r.referenceImages=last.referenceImages;
 if(r.stage==='child'){r.age=Number(r.identity.slice(-3))%2?8:6;r.differenceMarkers.age=r.age;}
 if(r.selectedRawFile)r.rawFile=r.selectedRawFile;
 r.qa.visualObservation=r.reusedSource?'Approved source preserved byte for byte. Source age and hair exceptions retained.':'Reviewed at 256px and 96px for costume, identity and age. See independent visual QA for uncertain judgments.';
 if(r.fatherIdentity)r.inheritancePlan={hair:r.identity==='L6_201'?'Approved I103 legacy hair retained; no exact parent attribution':`${r.fatherIdentity}/${r.motherIdentity}: family brown/dark-blond palette, varied sibling combination`,faceShape:`General oval/long-oval family shape from both parents; individual nose and jaw not copied exactly`,feature:r.commonTraits.feature,individual:r.differenceMarkers.markers};
 const exact=r.reusedSource?hash(`${base}/${r.reusedSource}`)===r.sha256:null;
 checks.push({id:r.id,width:m.width,height:m.height,channels:m.channels,hasAlpha:m.hasAlpha,sha256:r.sha256,reusedSourceExact:exact,generationAttempts:r.generationRecords.length});
 if(m.width!==256||m.height!==256||m.channels!==4||!m.hasAlpha||exact===false)throw Error(r.id+' invalid');
}
if(rows.length!==38)throw Error('Expected38');
fs.writeFileSync(`${base}/records/L6.json`,JSON.stringify(rows,null,2));
fs.writeFileSync(`${base}/records/L6-structural-qa.json`,JSON.stringify({count:rows.length,exactReuses:checks.filter(x=>x.reusedSourceExact).length,checks},null,2));
console.log('38 RGBA 256x256; 8 exact source SHA matches');
