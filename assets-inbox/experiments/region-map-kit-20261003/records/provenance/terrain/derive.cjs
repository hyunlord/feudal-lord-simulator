const fs=require('fs');
const crypto=require('crypto');
const sharp=require('/opt/homebrew/lib/node_modules/openclaw/node_modules/sharp');
const root='/Users/rexxa/fls-astra-mapkit-output';
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function conditionAlpha(master,width){
 const {data,info}=await sharp(master).resize({width,kernel:'lanczos3'}).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const radius=width>=480?3:width>=320?2:1;
 const alpha=Buffer.alloc(info.width*info.height);
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
  let minimum=255;
  for(let dy=-radius;dy<=radius;dy++)for(let dx=-radius;dx<=radius;dx++){
   const xx=x+dx,yy=y+dy;
   const a=xx<0||yy<0||xx>=info.width||yy>=info.height?0:data[(yy*info.width+xx)*4+3];
   minimum=Math.min(minimum,a);
  }
  alpha[y*info.width+x]=Math.round(255*Math.pow(minimum/255,1.65));
 }
 const softened=await sharp(alpha,{raw:{width:info.width,height:info.height,channels:1}}).blur(0.6).greyscale().raw().toBuffer();
 for(let p=0;p<alpha.length;p++)data[p*4+3]=Math.min(data[p*4+3],softened[p]);
 return sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).png().toBuffer();
}
(async()=>{
 const promptRecord=JSON.parse(fs.readFileSync(root+'/provenance/terrain/prompts.json'));
 const generations=JSON.parse(fs.readFileSync(root+'/provenance/terrain/generation-records.json'));
 const records=[];const masters=[];const proof=[];
 for(const [i,job] of promptRecord.jobs.entries()){
  const master=root+'/masters/terrain/'+job.id+'.png';const m=await sharp(master).metadata();
  masters.push({...job,...generations.find(x=>x.id===job.id),master,sha256:hash(master),width:m.width,height:m.height,tool:'image_gen__imagegen',transparent_background:true});
  const sizes=i<8?[['S',192],['M',320],['L',480]]:[['L',480]];
  for(const [size,width] of sizes){
   const id=job.id+'_'+size;const path='kit/terrain/'+id+'.png';
   fs.writeFileSync(root+'/'+path,await conditionAlpha(master,width));
   const {data,info}=await sharp(root+'/'+path).ensureAlpha().raw().toBuffer({resolveWithObject:true});
   let transparent=0,soft=0,edgeNonzero=0,alphaMax=0;let left=info.width,top=info.height,right=-1,bottom=-1;
   for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
    const a=data[(y*info.width+x)*4+3];alphaMax=Math.max(alphaMax,a);
    if(a===0)transparent++;else {if(a<255)soft++;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    if((x===0||y===0||x===info.width-1||y===info.height-1)&&a>5)edgeNonzero++;
   }
   records.push({id,path,type:'terrain',masterId:job.id,size,width:info.width,height:info.height,pivotX:0.5,pivotY:0.5,pivotPixelX:info.width/2,pivotPixelY:info.height/2,status:'candidate',sha256:hash(root+'/'+path),masterSha256:hash(master),transparentPixels:transparent,softAlphaPixels:soft,alphaMax,edgePixelsAlphaOver5:edgeNonzero,alphaBounds:{left,top,right,bottom},processing:'alpha-v2: one Lanczos3 downscale; alpha-only minimum erosion radius S1 M2 L3 px; alpha power 1.65 and sigma 0.6 feather bounded by original alpha; RGB unmodified; master untouched',zLayer:20});
  }
  const preview=await conditionAlpha(master,320);
  proof.push({input:preview,left:(i%3)*360+20,top:Math.floor(i/3)*260+10});
 }
 fs.writeFileSync(root+'/provenance/terrain/manifest.json',JSON.stringify({count:records.length,assets:records},null,2)+'\n');
 const columns=['id','path','masterId','size','width','height','pivotX','pivotY','status','sha256','masterSha256','transparentPixels','softAlphaPixels','alphaMax','edgePixelsAlphaOver5','processing'];
 fs.writeFileSync(root+'/provenance/terrain/manifest.csv',columns.join(',')+'\n'+records.map(r=>columns.map(k=>JSON.stringify(r[k])).join(',')).join('\n')+'\n');
 fs.writeFileSync(root+'/provenance/terrain/masters.json',JSON.stringify(masters,null,2)+'\n');
 for(const [name,bg]of [['light','#d4bd7c'],['dark','#222a23']])await sharp({create:{width:1080,height:1040,channels:4,background:bg}}).composite(proof).png().toFile(root+'/provenance/terrain/proof-'+name+'.png');
 console.log(JSON.stringify({count:records.length,masters:masters.length,allHaveAlpha:records.every(x=>x.transparentPixels>0&&x.softAlphaPixels>0),maxNonzeroBorder:Math.max(...records.map(x=>x.edgePixelsAlphaOver5)),dimensions:records.map(x=>[x.id,x.width,x.height])},null,2));
})();
