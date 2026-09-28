const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base=path.resolve(__dirname,'..');
const read=p=>JSON.parse(fs.readFileSync(path.join(base,p),'utf8'));
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
function resolve(p){for(const q of [path.resolve(base,p),path.resolve(p)])if(fs.existsSync(q))return q;throw Error('Missing '+p);}
const map={L6_101:'I101',L6_102:'I102',L6_201:'I103',L7_101:'I107',L7_102:'I108'};
(async()=>{
 for(const source of read('records/approved-original-hashes.json'))if(sha(source.file)!==source.sha256)throw Error('Approved original changed '+source.file);
 const entries=['L6','L7','L8'].flatMap(f=>{const rows=read(`records/${f}.json`);if(rows.length!==38)throw Error(`${f}: ${rows.length}/38`);return rows;});
 if(new Set(entries.map(r=>r.id)).size!==114)throw Error('Duplicate IDs');
 const actual=['L6','L7','L8'].flatMap(f=>fs.readdirSync(path.join(base,'assets',f)).filter(n=>n.endsWith('.png')));if(actual.length!==114)throw Error('Unexpected PNG count');
 const parentChecks=[],ageExceptions=[],reuseChecks=[],rows=[];
 for(const e of entries){
  const p=resolve(e.file),m=await sharp(p).metadata();if(m.width!==256||m.height!==256)throw Error('Size '+e.id);
  e.file=path.relative(base,p);e.sha256=sha(p);
  const reused=!!e.reusedSource;
  if(!reused&&m.channels!==4)throw Error('RGBA '+e.id);
  const markers=e.differenceMarkers?.markers??(e.differenceMarkers?.description?e.differenceMarkers.description.split(',').map(s=>s.trim()).filter(Boolean):e.differenceMarkers);
  if(!markers||Object.keys(markers).length<3)throw Error('Difference markers '+e.id);
  const common=e.commonTraits??e.commonTraits3;if(!common||Object.keys(common).length!==3)throw Error('Common traits '+e.id);
  if(e.stage==='baby'&&(e.age<0||e.age>2))throw Error('Infant age '+e.id);
  if(e.stage==='child'&&(e.age<6||e.age>9))throw Error('Child age '+e.id);
  if(e.stage==='mature'){const y=entries.find(x=>x.identity===e.identity&&x.stage==='young');if(!y)throw Error('Missing young '+e.id);if(e.age-y.age!==20){if(!(reused&&map[e.identity]&&e.age-y.age===21))throw Error('Age gap '+e.id);ageExceptions.push({id:e.id,young:y.age,mature:e.age,reason:'Approved pool3 source preserved unchanged'});}}
  if(reused){const source=resolve(`references/${map[e.identity]}_${e.stage}.png`);if(sha(source)!==e.sha256)throw Error('Reuse changed '+e.id);reuseChecks.push({id:e.id,source:path.relative(base,source),sha256:e.sha256});}
  if(!reused&&!e.generationRecords?.length)throw Error('No record '+e.id);
  for(const g of e.generationRecords){
   if(!g.prompt)throw Error('No prompt '+e.id);
   const refs=g.referenceImages??[];const resolved=refs.map(resolve);
   const recorded=g.referenceSHA256??g.referenceHashes??{};
   const referenceHashes=Array.isArray(recorded)?recorded.map(r=>[r.file,r.sha256]):Object.entries(recorded);
   for(const [reference,expected] of referenceHashes)if(sha(resolve(reference))!==expected)throw Error('Generation reference changed '+e.id+' '+reference);
   g.verifiedReferenceSHA256=Object.fromEntries(resolved.map((p,i)=>[refs[i],sha(p)]));
   if(!reused){if(!g.rawFile)throw Error('No raw '+e.id);g.rawFile=resolve(g.rawFile);g.rawSHA256=sha(g.rawFile);
    for(const parent of [e.fatherIdentity,e.motherIdentity].filter(Boolean)){const alias=map[parent];if(!resolved.some(p=>path.basename(p).includes(parent+'_')||(alias&&path.basename(p).includes(alias+'_'))))throw Error('Parent input missing '+e.id+' '+parent);parentChecks.push({id:e.id,parent,actualInput:true});}
   }
  }
  rows.push({asset_id:e.id,status:'candidate',file:e.file,identity:e.identity,lineage:e.lineage,generation:e.generation,father:e.fatherIdentity??'',mother:e.motherIdentity??'',stage:e.stage,age:e.age,sex:e.sex,marital_status:e.maritalStatus,clothing:e.clothing,common_traits:JSON.stringify(common),difference_markers:JSON.stringify(e.inheritance?{markers,inheritance:e.inheritance}:markers),reused_source:JSON.stringify(e.reusedSource??null),generation_records:JSON.stringify(e.generationRecords),processing:JSON.stringify(e.processing??null),qa:JSON.stringify(e.qa),sha256:e.sha256});
 }
 if(reuseChecks.length!==14)throw Error('Expected14 reused');
 fs.writeFileSync(path.join(base,'records/assets.json'),JSON.stringify(entries,null,2));
 fs.writeFileSync(path.join(base,'records/asset-rows.json'),JSON.stringify(rows,null,2));
 fs.writeFileSync(path.join(base,'records/technical-qa.json'),JSON.stringify({status:'PASS',assets:114,newGenerated:100,reused:14,identities:36,dimensions:'256x256',approvedOriginalsUnchanged:216,reuseChecks,parentChecks,ageExceptions,limitations:'Metadata and hashes do not prove visual age, class, kinship or identity.'},null,2));
 const identities=entries.filter(e=>e.stage==='young');
 const traits=['# 혈통 본 제작 2차 형질표','','가족 공통은 머리색·얼굴형·특징 하나만 지정한다. 코·턱을 부모에게서 정밀 복제하지 않는다. 표식은 제작 계약이며 실제 시각 판정은 검수표를 따른다.','','| 인물 | 부모 | 청년/장년 나이 | 머리·얼굴 공통 | 개인 차이 표식 | 복식 |','|---|---|---|---|---|---|',...identities.map(e=>{const m=entries.find(x=>x.identity===e.identity&&x.stage==='mature');return `| ${e.identity} | ${[e.fatherIdentity,e.motherIdentity].filter(Boolean).join(' + ')||'창시자/외부 배우자'} | ${e.age}/${m?.age??'미제작'} | ${JSON.stringify(e.commonTraits??e.commonTraits3)} | ${JSON.stringify(e.differenceMarkers)} | ${e.clothing} |`;})];
 fs.writeFileSync(path.join(base,'TRAITS.md'),traits.join('\n')+'\n');
 fs.writeFileSync(path.join(base,'IMAGE_LINKS.md'),'# 개별 초상\n\n'+entries.map(e=>`- [${e.id}](${e.file})`).join('\n')+'\n');
 console.log('PASS114:14 exact reuse,100 new,36identities,parent inputs,age contracts');
})().catch(e=>{console.error(e);process.exitCode=1;});
