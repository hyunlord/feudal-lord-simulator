const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base = path.resolve(__dirname, '..');
const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const walk = d => fs.readdirSync(d, {withFileTypes:true}).flatMap(e => e.isDirectory() ? walk(path.join(d,e.name)) : [path.join(d,e.name)]);
function portable(input) {
  const absolute = path.isAbsolute(input) ? input : path.resolve(base,input);
  if (!fs.existsSync(absolute)) throw Error('Missing provenance: '+input);
  if (absolute.startsWith(base+path.sep)) return path.relative(base,absolute);
  const bytes = fs.readFileSync(absolute);
  const destination = 'references/'+hash(bytes).slice(0,12)+'-'+path.basename(absolute);
  fs.copyFileSync(absolute,path.join(base,destination));
  return destination;
}
(async()=>{
 const entries = ['gentry','brothers','sisters'].flatMap(lane => {
   const rows = JSON.parse(fs.readFileSync(path.join(base,'records',lane+'.json')));
   if(rows.length!==8) throw Error(lane+' does not contain 8 assets');
   return rows;
 });
 if(new Set(entries.map(r=>r.id)).size!==24) throw Error('Duplicate asset IDs');
 if(walk(base+'/assets').filter(f=>f.endsWith('.png')).length!==24) throw Error('Unexpected asset files');
 for(const pair of [['L1_203','L1_204'],['L2_201','L2_202'],['L2_203','L2_204']]) {
   for(const stage of ['child','young','mature']) {
     const older=entries.find(r=>r.identity===pair[0]&&r.stage===stage);
     const younger=entries.find(r=>r.identity===pair[1]&&r.stage===stage);
     if(!older||!younger||older.age-younger.age!==3) throw Error('Age gap '+pair+' '+stage);
   }
 }
 const rows=[];
 for(const entry of entries) {
   entry.file=portable(entry.file);
   const bytes=fs.readFileSync(path.join(base,entry.file));
   const meta=await sharp(bytes).metadata();
   if(meta.width!==256||meta.height!==256) throw Error('Wrong size '+entry.id);
   if(!entry.generationRecords?.length) throw Error('Missing generation '+entry.id);
   if(Object.keys(entry.commonTraits||{}).length!==3) throw Error('Expected exactly three family traits '+entry.id);
   if(Object.keys(entry.differenceMarkers||{}).length<3) throw Error('Missing distinct markers '+entry.id);
   for(const generation of entry.generationRecords) {
     if(!generation.prompt) throw Error('Missing prompt '+entry.id);
     generation.rawFile=portable(generation.rawFile);
     generation.referenceImages=generation.referenceImages.map(portable);
     for(const parent of [entry.fatherIdentity,entry.motherIdentity]) {
       if(!parent||!generation.referenceImages.some(ref=>path.basename(ref).includes(parent+'_mature'))) throw Error('Missing actual parent reference '+entry.id+' '+parent);
     }
   }
   entry.sha256=hash(bytes);
   rows.push({asset_id:entry.id,status:'candidate',file:entry.file,identity:entry.identity,lineage:entry.lineage,stage:entry.stage,age:entry.age,sex:entry.sex,common_traits:JSON.stringify(entry.commonTraits),difference_markers:JSON.stringify(entry.differenceMarkers),clothing:entry.clothing,parents:JSON.stringify([entry.fatherIdentity,entry.motherIdentity]),generation_records:JSON.stringify(entry.generationRecords),processing:JSON.stringify(entry.processing),qa:JSON.stringify(entry.qa),sha256:entry.sha256});
 }
 for(const prior of JSON.parse(fs.readFileSync(base+'/records/original-hashes.json'))) {
   if(hash(fs.readFileSync(prior.file))!==prior.sha256) throw Error('Original modified '+prior.file);
 }
 fs.writeFileSync(base+'/records/assets.json',JSON.stringify(entries,null,2));
 fs.writeFileSync(base+'/records/asset-rows.json',JSON.stringify(rows,null,2));
 fs.writeFileSync(base+'/records/technical-qa.json',JSON.stringify({status:'PASS',count:24,identities:6,dimensions:'256x256',bothParentInputs:true,originalsUnchanged:true,minimumMarkerCount:3},null,2));
 fs.writeFileSync(base+'/IMAGE_LINKS.md','# 개별 초상\n\n'+entries.map(r=>`- [${r.id}](${path.join(base,r.file)})`).join('\n')+'\n');
 console.log('PASS 24 portraits; parent inputs, markers, sizes, originals verified');
})().catch(e=>{console.error(e);process.exitCode=1;});
