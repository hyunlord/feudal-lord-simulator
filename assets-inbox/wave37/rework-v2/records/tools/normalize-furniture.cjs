const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
(async()=>{
const records=JSON.parse(fs.readFileSync(path.join(root,'records/furniture-input.json'),'utf8'));
for (const r of records){
 r.raw_path=`raw/${r.id}.png`;r.output_path=`assets/${r.id}.png`;
 fs.copyFileSync(r.generated_path,path.join(root,r.raw_path));
 if(r.prior_generation)fs.copyFileSync(r.prior_generation.source,path.join(root,r.prior_generation.raw_path));
 const raw=await sharp(path.join(root,r.raw_path)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h,channels:c}=raw.info;
 let l=w,t=h,rr=-1,b=-1;
 for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(raw.data[(y*w+x)*c+3]>0){l=Math.min(l,x);t=Math.min(t,y);rr=Math.max(rr,x);b=Math.max(b,y);}
 const crop={left:l,top:t,width:rr-l+1,height:b-t+1};
 const scale=Math.min((r.width-8)/crop.width,(r.height-8)/crop.height);
 const rw=Math.round(crop.width*scale),rh=Math.round(crop.height*scale),left=Math.floor((r.width-rw)/2),top=r.height-4-rh;
 const sprite=await sharp(path.join(root,r.raw_path)).extract(crop).resize(rw,rh,{fit:'fill',kernel:'lanczos3'}).png().toBuffer();
 await sharp({create:{width:r.width,height:r.height,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:sprite,left,top}]).png().toFile(path.join(root,r.output_path));
 await sharp(path.join(root,r.output_path)).resize(r.width*6,r.height*6,{kernel:'nearest'}).png().toFile(path.join(root,`proofs/${r.id}-6x.png`));
 r.source_dimensions={width:w,height:h};r.transform={crop,scale,resized_width:rw,resized_height:rh,paste_left:left,paste_top:top,canvas_margin_px:4,flip:false,alpha_preserved:true};
 r.raw_sha256=sha(path.join(root,r.raw_path));r.output_sha256=sha(path.join(root,r.output_path));r.model=null;r.seed=null;r.generation_tool='builtin image_gen';r.status='candidate';
 r.foot_method='Visual reading of foremost physical wooden support ground contact on final native and 6x nearest-neighbor inspection; not image midpoint';r.foot_uncertainty_px=2;
}
fs.writeFileSync(path.join(root,'records/furniture.json'),JSON.stringify(records,null,2)+'\n');
console.log(records.map(r=>({id:r.id,source:r.source_dimensions,transform:r.transform})));
})();
