import sharp from '/tmp/astra-wave39-work-20260930/node_modules/sharp/dist/index.mjs';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
const root=new URL('../',import.meta.url).pathname;
const records=JSON.parse(await fs.readFile(root+'records/ford-generations.json','utf8'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const transforms={};const metrics=[];const rendered={};
await fs.mkdir(root+'assets/ford',{recursive:true});await fs.mkdir(root+'raw',{recursive:true});await fs.mkdir(root+'proofs',{recursive:true});
function quant(a,q){return a.sort((a,b)=>a-b)[Math.floor((a.length-1)*q)];}
for(const rec of records){
 const raw=await fs.readFile(rec.generated); await fs.copyFile(rec.generated,root+'raw/'+rec.id+'.png');
 rec.inputSha256=sha(await fs.readFile(rec.input));rec.rawSha256=sha(raw);rec.rawPath='raw/'+rec.id+'.png';
 const {data,info}=await sharp(raw).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const sign=rec.direction==='ne'?-1:1;
 if(rec.id.includes('summer')){
  const us=[],vs=[],wu=[];for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){
   const i=(y*info.width+x)*4;if(data[i+3]<128)continue;
   const u=(x+sign*2*y)/2,v=(x-sign*2*y)/2;us.push(u);vs.push(v);
   if(data[i+2]>data[i]+3&&data[i+1]>data[i]+2)wu.push(u);
  }
  transforms[rec.direction]={uMin:quant(us,.005),uMax:quant(us,.995),vMin:quant(vs,.005),vMax:quant(vs,.995),waterMin:quant(wu,.03),waterMax:quant(wu,.97),sourceSize:[info.width,info.height]};
 }
 const t=transforms[rec.direction],out=Buffer.alloc(512*256*4);let waterPixels=0;
 function sourceU(u){if(u< -32)return t.waterMin+(u+32)*(t.waterMin-t.uMin)/32;if(u>32)return t.waterMax+(u-32)*(t.uMax-t.waterMax)/32;return t.waterMin+(u+32)*(t.waterMax-t.waterMin)/64;}
 for(let y=0;y<256;y++)for(let x=0;x<512;x++){
  const u=((x-256)+sign*2*(y-128))/2,v=((x-256)-sign*2*(y-128))/2;
  const su=sourceU(u),sv=(t.vMin+t.vMax)/2+v*(t.vMax-t.vMin)/64;
  const sx=su+sv,sy=sign*(su-sv)/2,ix=Math.floor(sx),iy=Math.floor(sy);
  if(ix<0||iy<0||ix+1>=info.width||iy+1>=info.height)continue;
  const dx=sx-ix,dy=sy-iy,oi=(y*512+x)*4;let alpha=0;const rgb=[0,0,0];
  for(const [ox,oy,w] of [[0,0,(1-dx)*(1-dy)],[1,0,dx*(1-dy)],[0,1,(1-dx)*dy],[1,1,dx*dy]]){
   const i=((iy+oy)*info.width+ix+ox)*4,a=data[i+3]/255;alpha+=a*w;for(let c=0;c<3;c++)rgb[c]+=data[i+c]*a*w;
  }
  if(alpha<.004)continue;for(let c=0;c<3;c++)out[oi+c]=Math.round(rgb[c]/alpha);out[oi+3]=Math.round(alpha*255);
  if(out[oi+2]>out[oi]+3&&out[oi+1]>out[oi]+2&&Math.abs(u)<34){out[oi+3]=Math.round(out[oi+3]*.58);waterPixels++;}
 }
 const path='assets/ford/'+rec.id+'.png';await sharp(out,{raw:{width:512,height:256,channels:4}}).png({compressionLevel:9}).toFile(root+path);
 let x0=512,y0=256,x1=0,y1=0,partial=0,edge=0;for(let y=0;y<256;y++)for(let x=0;x<512;x++){const a=out[(y*512+x)*4+3];if(a){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);if(a<255)partial++;if(x===0||x===511||y===0||y===255)edge++;}}
 const joins=rec.direction==='ne'?[[224,144],[288,112]]:[[224,112],[288,144]];
 metrics.push({id:rec.id,path,width:512,height:256,channels:4,pivot:[256,128],tile:[128,64],waterSpanTiles:1,travelLaneTiles:1,waterJoins:joins,alphaBounds:[x0,y0,x1+1,y1+1],edgePixels:edge,partialAlphaPixels:partial,waterPixels,sha256:sha(await fs.readFile(root+path)),transform:t,seasonGeometry:'Same directional source transform for summer and winter; model detail changes possible.'});rendered[rec.id]=out;
}
const geometry=[];for(const dir of ['ne','nw']){const a=rendered[`ford_w1_${dir}_summer-v1`],b=rendered[`ford_w1_${dir}_winter-v1`];let intersection=0,union=0;for(let i=3;i<a.length;i+=4){if(a[i]>20||b[i]>20)union++;if(a[i]>20&&b[i]>20)intersection++;}geometry.push({direction:dir,alphaSilhouetteIoU:intersection/union});}
await fs.writeFile(root+'records/ford-generations.json',JSON.stringify(records,null,2)+'\n');await fs.writeFile(root+'records/ford-metrics.json',JSON.stringify({assets:metrics,geometry},null,2)+'\n');
const comps=[];for(let n=0;n<records.length;n++){const rec=records[n],row=n%2,col=Math.floor(n/2);comps.push({input:root+'assets/ford/'+rec.id+'.png',left:col*512,top:row*280+24});}
await sharp({create:{width:1024,height:560,channels:3,background:'#665f4e'}}).composite(comps).jpeg({quality:90}).toFile(root+'proofs/ford-seasons.jpg');
const compare=[];for(let n=0;n<2;n++){const dir=['ne','nw'][n];compare.push({input:root+'assets/ford/'+`ford_w1_${dir}_summer-v1.png`,left:0,top:n*256});compare.push({input:records[n].input,left:512,top:n*256});}
await sharp({create:{width:1024,height:512,channels:3,background:'#dfdbc7'}}).composite(compare).jpeg({quality:90}).toFile(root+'proofs/ford-w1-w2.jpg');
console.log(JSON.stringify({metrics,geometry},null,2));
for(const rec of records){rec.tool='image_gen.imagegen';rec.model=null;rec.seed=null;rec.postprocess='Fresh generated w1 art, not w2 compression. Premultiplied bilinear isometric-axis normalization using summer geometry for both seasons; water-colour ROI alpha multiplied by 0.58. Sharp PNG compression9. See ford-metrics.json and ford-export.mjs.';}
await fs.writeFile(root+'records/ford-generations.json',JSON.stringify(records,null,2)+'\n');
const small=[];for(let i=0;i<records.length;i++){const im=await sharp(root+'assets/ford/'+records[i].id+'.png').resize(307,154).png().toBuffer();small.push({input:im,left:(i%2)*307,top:Math.floor(i/2)*154});}
await sharp({create:{width:614,height:308,channels:3,background:'#b6bd9f'}}).composite(small).jpeg({quality:90}).toFile(root+'proofs/ford-scale06.jpg');
