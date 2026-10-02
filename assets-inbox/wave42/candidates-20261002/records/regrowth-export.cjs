const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const sharp=require('/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js');
const root=path.resolve(__dirname,'..');
const sha=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
async function bounds(input){const {data,info}=await sharp(input).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,t=info.height,r=-1,b=-1;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){l=Math.min(l,x);r=Math.max(r,x);t=Math.min(t,y);b=Math.max(b,y);}return{left:l,top:t,width:r-l+1,height:b-t+1};}
(async()=>{
 const records=JSON.parse(fs.readFileSync(path.join(__dirname,'regrowth-generations.json')));const metrics=[];
 for(const item of records){
  const log=item.id.startsWith('log_');const height=log?128:192;const pivot=[64,log?108:172];
  const targetHeight=log?42:item.id.includes('1to3')?24:item.id.includes('4to8')?36:item.id.includes('_a_')?110:120;
  const targetWidth=log?88:item.id.includes('sapling')?50:108;
  const raw=path.join(root,'raw','regrowth',item.id+'.png');fs.copyFileSync(item.generated_path,raw);
  item.inputHashes=item.inputs.map(file=>({file,sha256:sha(file)}));item.generatedSha256=sha(raw);
  const input=raw;
  const box=await bounds(raw);
  const ratio=Math.min(targetWidth/box.width,targetHeight/box.height);const w=Math.max(1,Math.round(box.width*ratio)),h=Math.max(1,Math.round(box.height*ratio));
  const sprite=await sharp(input).extract(box).resize(w,h).png().toBuffer();
  const target=path.join(root,'assets','regrowth',item.id+'.png');
  await sharp({create:{width:128,height,channels:4,background:'#00000000'}}).composite([{input:sprite,left:64-Math.floor(w/2),top:pivot[1]-h}]).png({compressionLevel:9}).toFile(target);
  const {data,info}=await sharp(target).raw().toBuffer({resolveWithObject:true});let edgeMax=0,alphaMin=255,alphaMax=0;for(let y=0;y<height;y++)for(let x=0;x<128;x++){const a=data[(y*128+x)*4+3];alphaMin=Math.min(alphaMin,a);alphaMax=Math.max(alphaMax,a);if(x===0||x===127||y===0||y===height-1)edgeMax=Math.max(edgeMax,a);}
  metrics.push({id:item.id,file:path.relative(root,target),width:128,height,pivot,footprint:[128,64],visibleBounds:await bounds(target),alphaMin,alphaMax,edgeMax,sha256:sha(target),rawSha256:sha(raw),transform:{crop:box,resize:[w,h],flipX:false},candidate:true});
 }
 fs.writeFileSync(path.join(__dirname,'regrowth-metrics.json'),JSON.stringify(metrics,null,2));
 fs.writeFileSync(path.join(__dirname,'regrowth-generations.json'),JSON.stringify(records,null,2));
 const layers=[];for(let i=0;i<metrics.length;i++){const m=metrics[i];const row=Math.floor(i/6),col=i%6;const input=await sharp(path.join(root,m.file)).png().toBuffer();layers.push({input,left:col*160+16,top:row*228+20+(192-m.height)});}
 for(const [name,color]of[['light','#dbd5b8'],['dark','#27352d']])await sharp({create:{width:960,height:456,channels:4,background:color}}).composite(layers).png().toFile(path.join(root,'proofs','regrowth-'+name+'.png'));
 console.log(JSON.stringify({count:metrics.length,valid:metrics.every(m=>m.alphaMin===0&&m.alphaMax===255&&m.edgeMax===0),metrics}));
})();
