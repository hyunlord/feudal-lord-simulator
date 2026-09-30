const fs=require('fs'),path=require('path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
(async()=>{
const entries=JSON.parse(fs.readFileSync(path.join(root,'records/trades-c-sources.json'))),result=[];
for(const e of entries){
const raw=path.join(root,'raw',e.id+'.png');fs.copyFileSync(e.source,raw);
const {data,info}=await sharp(raw).ensureAlpha().raw().toBuffer({resolveWithObject:true});
let l=info.width,t=info.height,r=0,b=0;
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
const w=e.id.startsWith('trade_inn_')?96:128,h=96,scale=Math.min((w-8)/(r-l+1),86/(b-t+1));
const rw=Math.round((r-l+1)*scale),rh=Math.round((b-t+1)*scale),left=Math.floor((w-rw)/2),top=91-rh;
const buf=await sharp(raw).extract({left:l,top:t,width:r-l+1,height:b-t+1}).resize(rw,rh,{kernel:'lanczos3'}).toBuffer();
const out=path.join(root,'assets',e.id+'.png');
await sharp({create:{width:w,height:h,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:buf,left,top}]).png().toFile(out);
result.push({...e,raw_path:raw,output_path:out,raw_dimensions:[info.width,info.height],crop_alpha_threshold:8,crop_bbox:[l,t,r,b],scale,resized:[rw,rh],paste:[left,top],width:w,height:h,baseline_y:90,status:'candidate',postprocess:'Sharp alpha>8 crop, proportional Lanczos3 resize, transparent canvas; no mirror or rotation',foot_x:Math.round(w/2),foot_y:90,foot_method:'Pending visual actual foot contact review',foot_uncertainty_px:null});
}
fs.writeFileSync(path.join(root,'records/trades-c.json'),JSON.stringify(result,null,2));console.log(result.map(x=>({id:x.id,bbox:x.crop_bbox,canvas:[x.width,x.height]})));
})();
