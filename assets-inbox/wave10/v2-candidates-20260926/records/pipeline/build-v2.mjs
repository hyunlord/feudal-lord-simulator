import fs from 'node:fs';import path from 'node:path';import{execFileSync}from'node:child_process';
const root='/tmp/astra-wave10-v2-work',out=root+'/deliverable',old='/tmp/astra-wave10-work/deliverable';
for(const d of ['layers','masks','provenance/raw','provenance/reused'])fs.mkdirSync(out+'/'+d,{recursive:true});
const run=(...a)=>execFileSync(root+'/raster',a.map(String),{encoding:'utf8',stdio:['pipe','pipe','pipe']}).trim();
const hairFits=JSON.parse(fs.readFileSync(root+'/hair-fit-recommendation.json')).recommendations;
const assets=[],sources=[],sourceIds=new Set();
const adult={crown:[119,40],hairline:[105,70],eye_line_y:112,ear:[150,120],chin:[98,168],shoulder_y:208};
const child={crown:[120,56],hairline:[104,82],eye_line_y:112,ear:[147.36,120],chin:[101.6,160],shoulder_y:208};
const registerSource=(id,file,prompt='')=>{if(!sourceIds.has(id)){const rel='provenance/'+(file.includes('/records/')?'raw':'raw')+'/'+id+path.extname(file);fs.copyFileSync(file,out+'/'+rel);sources.push({id,path:rel,prompt});sourceIds.add(id);}return id;};
const file=(id,role='layer',part='base')=>({path:(role==='layer'?'layers/':'masks/')+id+'.png',role,part});
const entry=(id,kind,size_class,files,source_ids,prompt,processing=[],collar=null)=>assets.push({id,kind,size_class,files,anchors:size_class==='child'?child:adult,collar,source_ids,prompt,processing,status:'candidate'});
const def=(input,output)=>run('defringe',input,output,2);
const rawRecords=fs.readdirSync(root+'/records').filter(x=>x.endsWith('.json')).map(f=>JSON.parse(fs.readFileSync(root+'/records/'+f)));
for(const r of rawRecords){
 const sid=registerSource('generated-'+r.id,r.source,r.prompt),p=out+'/layers/'+r.id+'.png';
 if(r.kind==='face'){
  const normalized=root+'/review/faces-normalized/'+r.id+'.png';if(!fs.existsSync(normalized))continue;
  const lm=root+'/review/'+r.id+'-skin-landmarks.json';fs.writeFileSync(lm,execFileSync(root+'/landmarks-v2',[normalized],{encoding:'utf8'}));run('mask-skin-v2',normalized,out+'/masks/'+r.id+'_skinmask.png',lm);run('recolor-skin',normalized,out+'/masks/'+r.id+'_skinmask.png',p,'#B38360');def(p,p);
  entry(r.id,'face',r.size_class,[file(r.id),file(r.id+'_skinmask','skinmask')],[sid],r.prompt,['landmark crown/eye/chin registration; see face-registration.json','uniform medium skin ramp #B38360 preserving shading','defringe radius2']);
 }else if(r.kind.startsWith('hair')){
  const inf=JSON.parse(run('info',r.source)),mid=Math.floor(inf.width/2);const files=[];
  for(const [part,x,w]of (r.single_front?[['front',0,inf.width],['rear',0,inf.width]]:[['front',0,mid],['rear',mid,inf.width-mid]])){const id=r.id+(part==='rear'?'_rear':'');const tmp=root+'/review/'+id+'-crop.png';run('crop',r.source,tmp,x,0,w,inf.height);run('resize',tmp,out+'/layers/'+id+'.png',256,256);if(r.single_front&&part==='rear'){const empty=root+'/review/empty.json';fs.writeFileSync(empty,JSON.stringify({regions:[]}));run('polygon-mask',out+'/layers/'+id+'.png',empty);}const fit=hairFits.find(f=>f.id===r.id);if(fit&&fit.apply_to.includes(part))run('place',out+'/layers/'+id+'.png',out+'/layers/'+id+'.png',fit.width,fit.height,fit.x,fit.y);if(r.single_front&&part==='front')run('clip-alpha',out+'/layers/'+id+'.png',root+'/tonsure-scalp-limit.png',out+'/layers/'+id+'.png');def(out+'/layers/'+id+'.png',out+'/layers/'+id+'.png');run('mask-hair',out+'/layers/'+id+'.png',out+'/masks/'+id+'_haircolor.png');files.push(file(id,'layer',part),file(id+'_haircolor','haircolor',part));}
  entry(r.id,r.kind,r.size_class,files,[sid],r.prompt,[r.single_front?'single front tonsure ring; rear intentionally transparent':'two square source panels split to front/rear','per-style size/position registration; see hair-fit-recommendation.json','defringe radius2']);
 }else if(r.kind==='age'){
  run('resize',r.source,p,256,256);if(fs.existsSync(root+'/age-registration.json'))run('warp',p,p,root+'/age-registration.json');
  if(fs.existsSync(root+'/age-inset-mask.png')){run('clip-alpha',p,root+'/age-inset-mask.png',root+'/review/'+r.id+'-clip.png');fs.copyFileSync(root+'/review/'+r.id+'-clip.png',p);}
  run('mask-hair',p,out+'/masks/'+r.id+'_skinmask.png');run('recolor-skin',p,out+'/masks/'+r.id+'_skinmask.png',p,'#B38360');def(p,p);
  entry(r.id,'age','adult',[file(r.id),file(r.id+'_skinmask','skinmask')],[sid],r.prompt,['registered skin aging patches','facial-feature and outside-face exclusion mask','defringe radius2']);
 }
}
const oldRecords=JSON.parse(fs.readFileSync('/tmp/astra-wave10-work/processed-records.json'));
for(const r of oldRecords.filter(r=>r.kind==='hair'&&r.id!=='pt_hair_m_06'||r.kind==='beard')){
 const files=[],sids=[];
 for(const part of r.kind==='hair'?['front','rear']:['base']){
  const id=r.id+(part==='rear'?'_rear':'');const src=old+'/layers/'+id+'.png';sids.push(registerSource('reuse-'+id,src,r.prompt));const dest=out+'/layers/'+id+'.png';
  run('warp',src,dest,root+'/adult-registration.json');if(r.id==='pt_beard_04'){const mask=root+'/review/beard04-visible.png';run('polygon-mask',mask,root+'/beard04-visible.json');run('clip-alpha',dest,mask,dest);run('place',dest,dest,256,256,12,10);}def(dest,dest);run('mask-hair',dest,out+'/masks/'+id+'_haircolor.png');files.push(file(id,'layer',part),file(id+'_haircolor','haircolor',part));
 }
 if(r.id==='pt_hair_f_09'){const front=out+'/layers/'+r.id+'.png',rear=out+'/layers/'+r.id+'_rear.png',a=root+'/review/f09-front-permit.png',b=root+'/review/f09-rear-transfer.png',t=root+'/review/f09-transfer.png';run('polygon-mask',a,root+'/f09-front-permit.json');run('polygon-mask',b,root+'/f09-rear-transfer.json');run('clip-alpha',front,b,t);run('composite',rear,rear,t);run('clip-alpha',front,a,front);for(const[id,p]of[[r.id,front],[r.id+'_rear',rear]])run('mask-hair',p,out+'/masks/'+id+'_haircolor.png');}
 entry(r.id,r.kind,'adult',files,sids,r.prompt,['reuse existing artwork','six-anchor v2 piecewise registration','defringe radius2']);
 if(r.kind==='beard'){
  const id=r.id+'_child',dest=out+'/layers/'+id+'.png';run('warp',out+'/layers/'+r.id+'.png',dest,root+'/child-registration.json');def(dest,dest);run('mask-hair',dest,out+'/masks/'+id+'_haircolor.png');
  entry(id,'beard','child',[file(id),file(id+'_haircolor','haircolor')],sids,r.prompt,['88% width + child vertical anchor warp','test-only; excluded from random children','defringe radius2']);
 }
}
entry('pt_beard_09','beard','adult',[],[],'No beard: code-only',[]);
for(const [id,collar]of [['pt_hood','hood'],['pt_hat_brim',null]]){
 const src=old+'/pilot-reuse/'+id+'-v1.png',sid=registerSource('pilot-'+id,src,'User supplied pilot2 reusable headwear');const dest=out+'/layers/'+id+'.png';
 run('warp',src,dest,root+'/headwear-registration.json');if(id==='pt_hood')run('warp',dest,dest,root+'/hood-window-fit.json');def(dest,dest);
 const clip=out+'/masks/'+id+'_hairclip.png';run('polygon-mask',clip,root+'/'+(id==='pt_hood'?'hood':'hat')+'-clip.json');
 entry(id,'headwear','adult',[file(id),file(id+'_hairclip','hairclip')],[sid],'Reused user-supplied pilot2; no new generation',['six-anchor head warp with xFadeY160..208 preserving shoulder width','defringe radius2','white hairclip=allowed hair visibility'],collar);
 const cid=id+'_child';run('warp',dest,out+'/layers/'+cid+'.png',root+'/child-headwear-registration.json');def(out+'/layers/'+cid+'.png',out+'/layers/'+cid+'.png');run('warp',clip,out+'/masks/'+cid+'_hairclip.png',root+'/child-headwear-registration.json');
 if(id==='pt_hood'){for(const p of[out+'/layers/'+cid+'.png',out+'/masks/'+cid+'_hairclip.png']){run('warp',p,p,root+'/child-hood-neck-in.json');run('warp',p,p,root+'/child-hood-neck-restore.json');}}
 entry(cid,'headwear','child',[file(cid),file(cid+'_hairclip','hairclip')],[sid],'Reused user-supplied pilot2 child88% derived',['88% head width, child vertical anchors; shoulder preserved','defringe radius2'],collar);
}
for(const [id,collar]of [['pt_garment_work_tunic','plain'],['pt_garment_merchant_gown','fur']]){
 const src=old+'/pilot-reuse/'+id+'-v1.png',sid=registerSource('pilot-'+id,src,'User supplied pilot2 reusable garment');def(src,out+'/layers/'+id+'.png');entry(id,'garment','adult',[file(id)],[sid],'Reused user supplied pilot2; no new generation',['original shoulder y208 preserved','defringe radius2'],collar);
}
const catalog={title:'ASTRA Wave10 레이어 결합규격v2 후보',created_at:'2026-09-26',assets,sources,proofs:fs.existsSync(root+'/proofs-catalog.json')?JSON.parse(fs.readFileSync(root+'/proofs-catalog.json')):[],qa:{status:'pending'}};
fs.writeFileSync(root+'/catalog.json',JSON.stringify(catalog,null,2));console.log(JSON.stringify({assets:assets.length,faces:assets.filter(x=>x.kind==='face').length,generated:rawRecords.length}));
