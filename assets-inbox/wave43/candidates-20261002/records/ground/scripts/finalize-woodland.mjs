import fs from 'node:fs/promises';import crypto from 'node:crypto';
import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';
const rows=JSON.parse(await fs.readFile('manifest.json'));
for(const r of rows){
 if(r.id!=="woodland_floor_spring_a")continue;
 const m=await sharp(r.raw_copy).metadata();let pipeline=sharp(r.raw_copy),crop=null;
 if(r.repeat==='X'){const a=await sharp(r.raw_copy).ensureAlpha().raw().toBuffer();let minY=m.height,maxY=-1;for(let y=0;y<m.height;y++)for(let x=0;x<m.width;x++)if(a[(y*m.width+x)*4+3]>127){minY=Math.min(minY,y);maxY=Math.max(maxY,y);}crop={left:0,top:minY,width:m.width,height:maxY-minY+1};pipeline=pipeline.extract(crop);}
 const w=r.width,h=r.height,data=await pipeline.resize(w,h,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 if(r.repeat==='X'){const orig=await sharp(r.summer_reference).ensureAlpha().raw().toBuffer();for(let i=3;i<data.length;i+=4)data[i]=orig[i];}
 const blend=(horizontal)=>{const length=horizontal?w:h,other=horizontal?h:w,band=horizontal?16:10;for(let k=0;k<other;k++)for(let d=0;d<band;d++){const i=(horizontal?k*w+d:d*w+k)*4,j=(horizontal?k*w+length-1-d:(length-1-d)*w+k)*4,t=d/(band-1),weight=(1-t)*(1-t);for(let c=0;c<4;c++){const avg=(data[i+c]+data[j+c])/2;data[i+c]=Math.round(data[i+c]*(1-weight)+avg*weight);data[j+c]=Math.round(data[j+c]*(1-weight)+avg*weight);}}};
 blend(true);if(r.repeat==='XY')blend(false);
 let transparentRGB=0;for(let i=0;i<data.length;i+=4)if(data[i+3]===0){data[i]=data[i+1]=data[i+2]=0;}
 const edge=(horizontal)=>{let sum=0,count=0;for(let k=0;k<(horizontal?h:w);k++)for(let c=0;c<4;c++){const i=(horizontal?k*w:k)*4+c,j=(horizontal?k*w+w-1:(h-1)*w+k)*4+c;sum+=Math.abs(data[i]-data[j]);count++;}return sum/count;};
 await sharp(data,{raw:{width:w,height:h,channels:4}}).png().toFile(r.file);
 r.final_sha256=crypto.createHash('sha256').update(await fs.readFile(r.file)).digest('hex');r.postprocess={raw_crop:crop,resize:'one resize to target',alpha:r.repeat==='X'?'original strip alpha restored before repeat-edge blend; zero-alpha RGB zeroed':'fully opaque',repeat:'symmetric opposite-edge blend16px X,10px Y for fills; preserves interior',edge_rgba_mae_x:edge(true),edge_rgba_mae_y:edge(false),zero_alpha_rgb_nonzero:transparentRGB};
 const panels=[];for(const [label,file]of [['winter',r.winter_reference],['spring',r.file],['summer',r.summer_reference]]){const tile=await sharp(file).resize(w,h,{fit:'fill'}).png().toBuffer();const grid=await sharp({create:{width:w*2,height:h*2,channels:4,background:'#676b52'}}).composite(Array.from({length:4},(_,i)=>({input:tile,left:(i%2)*w,top:Math.floor(i/2)*h}))).png().toBuffer();panels.push(grid);}
 for(const scale of [1,.6]){const pw=Math.round(w*2*scale),ph=Math.round(h*2*scale),bufs=await Promise.all(panels.map(p=>sharp(p).resize(pw,ph).png().toBuffer()));await sharp({create:{width:pw*3,height:ph,channels:3,background:'#676b52'}}).composite(bufs.map((input,i)=>({input,left:i*pw,top:0}))).jpeg({quality:93}).toFile(`proofs/${r.id}-winter-spring-summer-${scale}.jpg`);}
 await fs.writeFile(`records/${r.id}.json`,JSON.stringify(r,null,2)+'\n');console.log(r.id,r.postprocess);
}
await fs.writeFile('manifest.json',JSON.stringify(rows,null,2)+'\n');
