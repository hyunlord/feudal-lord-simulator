const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const sharp = require('/tmp/astra-wave39-work-20260930/node_modules/sharp');
const root = path.dirname(__dirname);
const rows = JSON.parse(fs.readFileSync(path.join(__dirname, 'abandoned-generations.json')));
const sha = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function bounds(p) {
 const {data,info}=await sharp(p).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let l=info.width,t=info.height,r=-1,b=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x);b=Math.max(b,y);}
 return {left:l,top:t,width:r-l+1,height:b-t+1,sourceWidth:info.width,sourceHeight:info.height};
}
(async()=>{
 const metrics=[];
 for(const group of [...new Set(rows.map(r=>r.group))]){
  const pair=rows.filter(r=>r.group===group&&!r.status); const boxes=await Promise.all(pair.map(r=>bounds(r.generated_path)));
  const l=Math.min(...boxes.map(b=>b.left)),t=Math.min(...boxes.map(b=>b.top));
  const r=Math.max(...boxes.map(b=>b.left+b.width)),b=Math.max(...boxes.map(b=>b.top+b.height));
  const crop={left:l,top:t,width:r-l,height:b-t}; const width=120,height=Math.round(crop.height*width/crop.width);
  for(const row of pair){
   const raw=path.join(root,'raw',row.id+'.png');fs.copyFileSync(row.generated_path,raw);
   const dest=path.join(root,'assets/abandoned',row.id+'.png');
   const sprite=await sharp(raw).extract(crop).resize(width,height,{kernel:'lanczos3'}).png().toBuffer();
   await sharp({create:{width:128,height:160,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:sprite,left:4,top:152-height}]).png({compressionLevel:9}).toFile(dest);
   const {data,info}=await sharp(dest).raw().toBuffer({resolveWithObject:true});let min=255,max=0,edges=0;
   for(let y=0;y<160;y++)for(let x=0;x<128;x++){const a=data[(y*128+x)*4+3];min=Math.min(min,a);max=Math.max(max,a);if(x===0||y===0||x===127||y===159)edges=Math.max(edges,a);}
   row.raw_sha256=sha(raw);row.raw_path=path.relative(root,raw);row.reference_sha256=row.references.map(p=>({path:p,sha256:sha(p)}));
   metrics.push({id:row.id,file:path.relative(root,dest),width:128,height:160,channels:info.channels,pivot:[64,120],groundFootprint:[128,64],alphaBounds:await bounds(dest),alphaMin:min,alphaMax:max,edgeAlphaMax:edges,sha256:sha(dest),transform:{crop,resize:[width,height],placement:[4,152-height],flipX:false,flipY:false},status:'candidate'});
  }
 }
 for(const row of rows.filter(r=>r.status)){const raw=path.join(root,'raw',row.id+'.png');fs.copyFileSync(row.generated_path,raw);row.raw_sha256=sha(raw);row.raw_path=path.relative(root,raw);row.reference_sha256=row.references.map(p=>({path:p,sha256:sha(p)}));} fs.writeFileSync(path.join(__dirname,'abandoned-generations.json'),JSON.stringify(rows,null,2));fs.writeFileSync(path.join(__dirname,'abandoned-metrics.json'),JSON.stringify(metrics,null,2));
 for(const theme of ['light','dark']){
 const layers=[];
 for(let i=0;i<metrics.length;i++)layers.push({input:path.join(root,metrics[i].file),left:12+(i%5)*152,top:28+Math.floor(i/5)*192});
 await sharp({create:{width:784,height:420,channels:3,background:theme==='light'?'#e6ddc9':'#252b28'}}).composite(layers).png().toFile(path.join(root,'proofs','abandoned-'+theme+'-actual.png'));
 }
 console.log(JSON.stringify(metrics.map(m=>({id:m.id,alpha:[m.alphaMin,m.alphaMax],edge:m.edgeAlphaMax,bounds:m.alphaBounds})),null,2));
})();
