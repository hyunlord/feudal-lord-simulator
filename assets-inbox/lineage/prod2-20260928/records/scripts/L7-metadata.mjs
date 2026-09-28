import fs from 'node:fs';
import crypto from 'node:crypto';
const root='/Users/rexxa/github/feudal-lord-simulator/output/astra-lineage-prod2-v1';
const defs=JSON.parse(fs.readFileSync(root+'/records/L7-definitions.json'));
const jobs=JSON.parse(fs.readFileSync(root+'/records/L7-jobs.json'));
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const out=[];
for(const [n,source,sex] of [['101','I107','male'],['102','I108','female']]) for(const [stage,age] of [['young',24],['mature',45],['old',70]]) {
 const id=`L7_${n}_${stage}`, file=`assets/L7/${id}.png`, ref=`references/${source}_${stage}.png`;
 if(hash(root+'/'+file)!==hash(root+'/'+ref)) throw Error('Founder changed '+id);
 out.push({id,file,identity:`L7_${n}`,lineage:'L7',generation:1,stage,age,sex,maritalStatus:'married',clothing:'Approved pool3 gentry fine wool, plain fox/squirrel fur; no ermine',fatherIdentity:null,motherIdentity:null,commonTraits:{hair:'chestnut brown',faceShape:'oval',brow:'softly arched brows'},differenceMarkers:{source},generationRecords:[],referenceImages:[ref],reusedSource:ref,sourceSHA256:hash(root+'/'+ref),qa:'Exact byte reuse of approved founder; legacy24/45/70 ages preserved, +21 exception documented.'});
}
for(const d of defs){
 const stages=d.external?['young','mature']:d.n.startsWith('3')?['baby','child','young']:['baby','child','young','mature'];
 for(const stage of stages){
  const id=`L7_${d.n}_${stage}`, attempts=jobs.filter(j=>j.id===id||j.id.startsWith(id+'-'));
  const selected=attempts.at(-1); if(!selected) throw Error('Missing '+id);
  const age=stage==='young'?d.age:stage==='mature'?d.age+20:stage==='baby'?1:['202','204','304'].includes(d.n)?6:d.n==='302'?7:8;
  out.push({id,file:`assets/L7/${id}.png`,identity:`L7_${d.n}`,lineage:'L7',generation:d.n.startsWith('3')?3:2,stage,age,sex:d.sex,maritalStatus:['baby','child'].includes(stage)?'unmarried':stage==='mature'?'married':d.marital,clothing:stage==='baby'?'Linen bonnet and swaddle; muted fine wool wrap, plain fur trim':d.clothes,fatherIdentity:d.external?null:`L7_${d.father||'101'}`,motherIdentity:d.external?null:`L7_${d.mother||'102'}`,commonTraits:{hair:d.external?'external ancestry': 'chestnut to dark auburn/dark blond',faceShape:'oval overall with independent nose/chin',brow:'softly arched eyebrows'},differenceMarkers:{description:d.markers,age:d.age},prompt:selected.prompt,referenceImages:selected.refs,generationRecords:attempts.map(j=>({prompt:j.prompt,rawFile:j.rawFile,referenceImages:j.refs,referenceSHA256:j.referenceSHA256,tool:'image_gen.imagegen',model:null,seed:null,processing:'Resize full square to256 using sharp, ensureAlpha RGBA; no face compositing'})),rawFile:selected.rawFile,qa:'Individually reviewed at256; batch96 review pending',reusedSource:null});
 }
}
if(out.length!==38) throw Error('Wrong count '+out.length);
const sources=JSON.parse(fs.readFileSync(root+'/records/pool3-source-rows.json'));
for(const r of out){
 r.qa='PASS: individual256 review plus independent prod2_ageqa256/96 review; corrected children8 and mature5 accepted.';
 if(r.generation!==1) continue;
 const s=sources.find(x=>x.id===r.reusedSource.replace('references/','').replace('.png',''));
 r.differenceMarkers={hair:s.hair_color,faceFeatures:s.features,build:s.body,headwear:s.headwear_type,age:r.age};
 r.clothing=s.clothing;
 r.commonTraits={hair:s.hair_color,faceShape:s.features.split(';')[0],familyCue:'softly arched eyebrows in descendant family specification'};
 r.sourceMetadata=s;
}
fs.writeFileSync(root+'/records/L7.json',JSON.stringify(out,null,2));
console.log('L7 records',out.length);
