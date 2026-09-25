const fs=require('fs'),path=require('path'),sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..'),defs=require('./frames-definitions.json'),generation=require('./frames-generation.json');
async function main(){
 const recs=[],native={};
 for(const [id,w,h,desc,ref,cap] of defs){
  const raw=path.join(root,'sources/frames',id+'-raw.png');
  let pipeline=sharp(raw);if(id==='banner_unlock')pipeline=pipeline.extract({left:0,top:0,width:1983,height:330});if(id==='toast_small')pipeline=pipeline.extract({left:0,top:0,width:2043,height:343});
  const dark=id.includes('dark')||id.startsWith('frame_hud')||id==='tab_build_base',bg=dark?[81,67,52]:[225,209,174];
  let {data,info}=await pipeline.resize(w,h,{fit:'fill'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
  native[id]={data:Buffer.from(data),info};
  if(cap){
   for(let y=0;y<h;y++)for(let x=0;x<w;x++){
    const i=(y*w+x)*4,a=data[i+3]/255,corner=(x<12||x>=w-12)&&(y<12||y>=h-12),edge=x<4||x>=w-4||y<4||y>=h-4;
    let keep=edge||corner;
    if(id==='frame_objective_complete')keep=keep||(x>=w-32&&y>=h-32);
    if(id==='frame_objective_warn'||id==='frame_advisor_warn')keep=keep||(x>=w-cap&&y<cap);
    if(id==='banner_unlock')keep=edge||corner;
    for(let k=0;k<3;k++)data[i+k]=keep?Math.round(data[i+k]*a+bg[k]*(1-a)):bg[k];
    data[i+3]=255;
   }
  }else if(id.includes('texture')){
   for(let i=0;i<data.length;i+=4){const tone=Math.max(-3,Math.min(3,Math.round((data[i]+data[i+1]+data[i+2])/3-202)*.2));for(let k=0;k<3;k++)data[i+k]=bg[k]+tone;data[i+3]=255;}
  }
  if(id.includes('texture')||id.includes('divider')){
   for(let y=0;y<h;y++)for(let k=0;k<4;k++)data[(y*w+w-1)*4+k]=data[y*w*4+k];
   if(id.includes('texture'))for(let x=0;x<w;x++)for(let k=0;k<4;k++)data[((h-1)*w+x)*4+k]=data[x*4+k];
  }
  if(id==='banner_unlock'){
   const seal=await sharp(native[id].data,{raw:info}).extract({left:10,top:40,width:46,height:46}).resize(32,32).raw().toBuffer();
   for(let yy=0;yy<32;yy++)for(let xx=0;xx<32;xx++){const si=(yy*32+xx)*4,di=((yy+8)*w+xx+8)*4;if(seal[si]>seal[si+1]*1.25)for(let k=0;k<3;k++)data[di+k]=seal[si+k];}
  }
  await sharp(data,{raw:info}).png().toFile(path.join(root,'assets/ui',id+'.png'));
  const g=generation.find(r=>r.id===id);
  recs.push({id:'ui/'+id,file:'assets/ui/'+id+'.png',width:w,height:h,role:desc,status:'candidate',generationRecords:{tool:'image_gen.imagegen',prompt:g.prompt,references:['references/astra-ui-p0-reference-files/pilot_assets/'+ref+'.png'],raw:'sources/frames/'+id+'-raw.png',rawOriginalPath:g.rawPath,modelVersion:null,seed:null},processing:'Generated original preserved. Exact canvas registration and downsample. Opaque flat reading fields normalized to pilot palette; generated edge and corner ink retained. Texture contrast compressed and opposing terminal pixels matched; dark texture palette corrected. Toast source cropped to actual bordered rectangle. Objective variants share registered geometry.',nineSlice:cap?{left:cap,top:cap,right:cap,bottom:cap,sourceScale:2,renderCapScale:.5}:null,qa:{text:'none',numbers:'none',barInterior:'none',center:cap?'flat opaque':'not applicable',limitations:id==='advisor_portrait_frame'?'Fixed circle overlay; do not nine-slice.':id.includes('texture')?'Terminal pixel equality tested; runtime tiling not tested.':''}});
 }
 // Match objective geometry by using the normal registered body and transplanting only generated state marks.
 const normal=await sharp(path.join(root,'assets/ui/frame_objective_normal.png')).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 for(const id of ['frame_objective_complete','frame_objective_warn']){
  const d=Buffer.from(normal.data),src=native[id].data,w=256;
  for(let y=0;y<256;y++)for(let x=0;x<256;x++){
   const i=(y*w+x)*4,seal=id.endsWith('complete')&&x>=224&&y>=224&&src[i]>src[i+1]*1.25,stain=id.endsWith('warn')&&x>=224&&x<250&&y>=5&&y<32&&src[i+1]<160;
   if(seal||stain)for(let k=0;k<3;k++)d[i+k]=src[i+k];
  }
  await sharp(d,{raw:normal.info}).png().toFile(path.join(root,'assets/ui',id+'.png'));
 }
 fs.writeFileSync(path.join(root,'records/frames.json'),JSON.stringify(recs,null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
