const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base=path.resolve(__dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
function portable(input){
 const absolute=path.isAbsolute(input)?input:path.resolve(base,input);
 if(!fs.existsSync(absolute))throw Error('Missing provenance '+input);
 if(absolute.startsWith(base+path.sep))return path.relative(base,absolute);
 const bytes=fs.readFileSync(absolute),dest='references/'+hash(bytes).slice(0,12)+'-'+path.basename(absolute);
 fs.copyFileSync(absolute,path.join(base,dest));return dest;
}
(async()=>{
 const entries=[];
 for(const [lane,count]of [['L3',38],['L4',38],['L5',38],['common-baby',14],['common-children',26],['pilot2-baby',6]]){
  const a=JSON.parse(fs.readFileSync(base+'/records/'+lane+'.json'));
  if(a.length!==count)throw Error(lane+' count '+a.length+' expected '+count);
  entries.push(...a);
 }
 if(new Set(entries.map(r=>r.id)).size!==160)throw Error('Duplicate IDs');
 if(walk(base+'/assets').filter(f=>f.endsWith('.png')).length!==160)throw Error('Unexpected asset count');
 const parentChecks=[],maritalChecks=[],rows=[];
 for(const entry of entries){
  entry.commonTraits=entry.commonTraits??entry.commonTraits3;
  entry.file=portable(entry.file);
  const bytes=fs.readFileSync(base+'/'+entry.file),m=await sharp(bytes).metadata();
  if(m.width!==256||m.height!==256)throw Error('Size '+entry.id);
  if(!entry.generationRecords?.length)throw Error('No provenance '+entry.id);
  if(Object.keys(entry.differenceMarkers||{}).length<3)throw Error('Markers '+entry.id);
  if(entry.lineage!=='common'&&!/_(205|206)$/.test(entry.identity)&&Object.keys(entry.commonTraits||{}).length!==3)throw Error('Family traits '+entry.id);
  if(!entry.maritalStatus)throw Error('Marital status '+entry.id);
  if(entry.stage==='baby'&&(entry.age<0||entry.age>2))throw Error('Baby age '+entry.id);
  if(entry.stage==='toddler'&&(entry.age<3||entry.age>5))throw Error('Toddler age '+entry.id);
  if(entry.stage==='child'&&(entry.age<6||entry.age>9))throw Error('Child age '+entry.id);
  if(entry.stage==='mature'){
   const young=entries.find(r=>r.identity===entry.identity&&r.stage==='young');
   if(!young||entry.age-young.age!==20||entry.age<40||entry.age>50)throw Error('20-year progression '+entry.id);
  }
  for(const generation of entry.generationRecords){
   if(!generation.prompt)throw Error('Missing prompt '+entry.id);
   generation.rawFile=portable(generation.rawFile);
   const raw=await sharp(base+'/'+generation.rawFile).metadata();
   generation.sourceDimensions={width:raw.width,height:raw.height};
   const refs=generation.referenceImages||[];
   if(entry.file.startsWith('assets/pilot2-baby/')&&!refs.some(ref=>path.basename(ref)===entry.identity+'_child.png'))throw Error('Pilot2 child input missing '+entry.id);
   const sha={};
   generation.originalReferenceImages=[...refs];
   generation.referenceImages=refs.map(ref=>{
    const relative=portable(generation.preservedReferenceImages?.[ref]??ref),digest=hash(fs.readFileSync(base+'/'+relative));
    if((generation.referenceSHA256?.[ref]??generation.referenceHashes?.[ref]??generation.referenceSha256?.[ref]??generation.referenceImageSHA256?.[ref])&&(generation.referenceSHA256?.[ref]??generation.referenceHashes?.[ref]??generation.referenceSha256?.[ref]??generation.referenceImageSHA256?.[ref])!==digest)throw Error('Reference bytes changed '+entry.id+' '+ref);
    sha[relative]=digest;return relative;
   });
   generation.packagedReferenceSHA256=sha;
   for(const parent of [entry.fatherIdentity,entry.motherIdentity].filter(Boolean)){
    const found=generation.referenceImages.some(ref=>path.basename(ref).includes(parent+'_'));
    if(!found)throw Error('Parent missing '+entry.id+' '+parent);
    parentChecks.push({asset:entry.id,parent,actualInput:true});
   }
  }
  if(entry.fatherIdentity&&!entries.some(r=>r.identity===entry.fatherIdentity))throw Error('Unknown father');
  if(entry.motherIdentity&&!entries.some(r=>r.identity===entry.motherIdentity))throw Error('Unknown mother');
  maritalChecks.push({asset:entry.id,sex:entry.sex,stage:entry.stage,status:entry.maritalStatus,clothing:entry.clothing});
  if(entry.reusedSource?.file){const source=path.resolve(entry.reusedSource.file);if(hash(fs.readFileSync(source))!==entry.reusedSource.sha256||hash(bytes)!==entry.reusedSource.sha256)throw Error('Reuse mismatch '+entry.id);}
  entry.sha256=hash(bytes);
  rows.push({asset_id:entry.id,status:'candidate',file:entry.file,identity:entry.identity,lineage:entry.lineage,generation:entry.generation??'',father:entry.fatherIdentity??'',mother:entry.motherIdentity??'',stage:entry.stage,age:entry.age,sex:entry.sex,marital_status:entry.maritalStatus,clothing:entry.clothing,common_traits:JSON.stringify(entry.commonTraits),difference_markers:JSON.stringify(entry.differenceMarkers),reused_source:JSON.stringify(entry.reusedSource??entry.reuse??null),generation_records:JSON.stringify(entry.generationRecords),processing:JSON.stringify(entry.processing),qa:JSON.stringify(entry.qa),sha256:entry.sha256});
 }
 const common=entries.filter(r=>r.lineage==='common');
 for(const [stage,count]of [['baby',14],['toddler',12],['child',14]]){
  const group=common.filter(r=>r.stage===stage);
  if(group.length!==count||group.filter(r=>r.sex==='male').length!==count/2||group.filter(r=>r.sex==='female').length!==count/2)throw Error('Common stage/sex balance '+stage);
 }
 for(const prior of JSON.parse(fs.readFileSync(base+'/records/approved-original-hashes.json'))){
  if(hash(fs.readFileSync(prior.file))!==prior.sha256)throw Error('Approved original modified '+prior.file);
 }
 for(const prior of JSON.parse(fs.readFileSync(base+'/records/reference-original-hashes.json'))){
  if(hash(fs.readFileSync(base+'/'+prior.file))!==prior.sha256)throw Error('Attachment modified '+prior.file);
 }
 fs.writeFileSync(base+'/records/assets.json',JSON.stringify(entries,null,2));
 fs.writeFileSync(base+'/records/asset-rows.json',JSON.stringify(rows,null,2));
 fs.writeFileSync(base+'/records/technical-qa.json',JSON.stringify({status:'PASS',count:160,identities:new Set(entries.map(r=>r.identity)).size,dimensions:'256x256',parentChecks,maritalChecks,commonSexBalance:'7/7 babies,6/6 toddlers,7/7 children',adultAgeGap:20,approvedOriginalsUnchanged:104,visualLimitations:'Metadata checks do not prove perceived age, covering, likeness, or distinct identity'},null,2));
 fs.writeFileSync(base+'/IMAGE_LINKS.md','# 개별 초상\n\n'+entries.map(r=>`- [${r.id}](${path.join(base,r.file)})`).join('\n')+'\n');
 console.log('PASS160: sizes, age contracts, parent inputs, marital records, original preservation');
})().catch(e=>{console.error(e);process.exitCode=1;});
