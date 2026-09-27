const fs=require('fs'),path=require('path'),crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const p=path.resolve(__dirname,'..');
const expected={weather:14,'life-ground':8,'life-birds':4,'life-props':8,'person-state':24,'royal-pad':24};
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const checkPath=f=>{if(!f||path.isAbsolute(f)||!fs.existsSync(p+'/'+f))throw Error('missing/nonportable path '+f);};
(async()=>{
 const assets=[],rows=[],checks=[];
 for(const [lane,count]of Object.entries(expected)){
  const f=p+'/records/metadata-'+lane+'.json';
  const rs=JSON.parse(fs.readFileSync(f));if(rs.length!==count)throw Error(lane+' count '+rs.length);
  for(const a of rs){
   checkPath(a.file);const bytes=fs.readFileSync(p+'/'+a.file),m=await sharp(bytes).metadata();
   if(m.width!==a.width||m.height!==a.height||!m.hasAlpha)throw Error('size/alpha '+a.id);
   const stats=await sharp(bytes).stats();const alpha=stats.channels[3];
   if(!alpha||alpha.max===0)throw Error('empty '+a.id);
   if(!a.generationRecords?.length)throw Error('generation record '+a.id);
   for(const g of a.generationRecords){checkPath(g.rawFile);if(!g.prompt)throw Error('prompt '+a.id);for(const ref of g.referenceImages||[])checkPath(ref);const r=await sharp(p+'/'+g.rawFile).metadata();g.sourceImageDimensions={width:r.width,height:r.height};}
   if(lane==='weather'&&!(a.opacityMax>0&&a.opacityMax<=1))throw Error('weather opacity '+a.id);
   const row={asset_id:a.id,status:'candidate',file:a.file,width:a.width,height:a.height,family:lane,description:a.description||'',role:a.role||'',blend_mode:a.blendMode||'source-over',opacity_max:a.opacityMax??1,frame_layout:JSON.stringify(a.frameLayout??null),pivot:JSON.stringify(a.pivot??null),display_scale:JSON.stringify(a.displayScale??null),generation_records:JSON.stringify(a.generationRecords),processing:JSON.stringify(a.processing??null),qa:JSON.stringify(a.qa??null),sha256:hash(bytes)};
   rows.push(row);assets.push(a);checks.push({id:a.id,width:m.width,height:m.height,alphaMin:alpha.min,alphaMax:alpha.max,sha256:row.sha256});
  }
 }
 if(rows.length!==82||new Set(rows.map(a=>a.asset_id)).size!==82||new Set(rows.map(a=>a.file)).size!==82)throw Error('unique count');
 const actual=walk(p+'/assets').map(f=>path.relative(p,f)).sort(),wanted=rows.map(a=>a.file).sort();
 if(JSON.stringify(actual)!==JSON.stringify(wanted))throw Error('assets include missing/extra files');
 fs.writeFileSync(p+'/records/asset-rows.json',JSON.stringify(rows,null,2));
 fs.writeFileSync(p+'/records/asset-manifest.json',JSON.stringify(assets,null,2));
 fs.writeFileSync(p+'/records/technical-qa.json',JSON.stringify({status:'PASS',assetCount:82,laneCounts:expected,checks},null,2));
 console.log('PASS82 PNG dimensions/alpha/provenance/unique IDs');
})();
