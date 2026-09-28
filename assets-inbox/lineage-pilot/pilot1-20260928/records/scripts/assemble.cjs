const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const p=path.resolve(__dirname,'..'),hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const exists=f=>{if(!f||path.isAbsolute(f)||!fs.existsSync(p+'/'+f))throw Error('missing/nonportable '+f);};
(async()=>{
 const a=[];for(const [lane,count]of [['lineage1',34],['lineage2',34],['common',12]]){let r=JSON.parse(fs.readFileSync(p+'/records/metadata-'+lane+'.json'));if(r.length!==count)throw Error(lane+' count '+r.length);a.push(...r);}
 if(new Set(a.map(x=>x.file)).size!==80||new Set(a.map(x=>x.id)).size!==80)throw Error('duplicates');
 const rows=[],parentChecks=[];const independent=JSON.parse(fs.readFileSync(p+'/records/independent-trait-review.json'));
 for(const r of a){exists(r.file);let b=fs.readFileSync(p+'/'+r.file),m=await sharp(b).metadata();if(m.width!==256||m.height!==256)throw Error('size '+r.id);if(!r.generationRecords?.length)throw Error('provenance '+r.id);
 for(const g of r.generationRecords){exists(g.rawFile);if(!g.prompt)throw Error('prompt '+r.id);for(const ref of g.referenceImages||[])exists(ref);const rm=await sharp(p+'/'+g.rawFile).metadata();g.sourceImageDimensions={width:rm.width,height:rm.height};}
 for(const side of ['fatherIdentity','motherIdentity'])if(r[side]){const parent=a.filter(x=>x.identity===r[side]);if(!parent.length)throw Error('parent identity '+r.id+' '+r[side]);for(const g of r.generationRecords){const ok=parent.some(x=>(g.referenceImages||[]).includes(x.file));if(!ok)throw Error('actual parent ref absent '+r.id+' '+side);parentChecks.push({asset:r.id,parent:r[side],side,actualReference:true});}}
 if(r.fatherIdentity&&r.motherIdentity){if(!r.inheritance||Object.keys(r.inheritance).length<5)throw Error('inheritance '+r.id);for(const [trait,v]of Object.entries(r.inheritance)){if(![r.fatherIdentity,r.motherIdentity].includes(v.from))throw Error('traitparent '+r.id+' '+trait);const parent=a.find(x=>x.identity===v.from);if(parent?.traits?.[trait]!==v.value)throw Error('traitvalue '+r.id+' '+trait);}}
 rows.push({asset_id:r.id,status:'candidate',file:r.file,identity:r.identity,lineage:r.lineage,generation:r.generation,father_identity:r.fatherIdentity||'',mother_identity:r.motherIdentity||'',stage:r.stage,sex:r.sex,age:r.age,clothing:r.clothing,traits:JSON.stringify(r.traits??null),inheritance:JSON.stringify(r.inheritance??null),generation_records:JSON.stringify(r.generationRecords),processing:JSON.stringify(r.processing??null),qa:JSON.stringify({artist:r.qa??null,independentFindings:independent.findings.filter(f=>f.ids?.includes(r.id)),distinctPersonPairs:independent.distinctPersonCriterion.pairs.filter(f=>f.ids.includes(r.id))}),sha256:hash(b)});
 }
 const actual=walk(p+'/assets').map(f=>path.relative(p,f)).sort(),wanted=a.map(r=>r.file).sort();if(JSON.stringify(actual)!==JSON.stringify(wanted))throw Error('extra/missing asset');
 const originals=JSON.parse(fs.readFileSync(p+'/records/original-reference-hashes.json'));for(const r of originals)if(hash(fs.readFileSync(p+'/'+r.file))!==r.sha256)throw Error('original changed '+r.file);
 fs.writeFileSync(p+'/records/asset-rows.json',JSON.stringify(rows,null,2));fs.writeFileSync(p+'/records/asset-manifest.json',JSON.stringify(a,null,2));fs.writeFileSync(p+'/records/technical-qa.json',JSON.stringify({status:'PASS',pngCount:80,distinctIdentities:new Set(a.map(x=>x.identity)).size,dimensions:'256x256',parentChecks,originalsPreserved:originals.length},null,2));console.log('PASS80PNG actualparentrefs and originalpreservation');
})();
