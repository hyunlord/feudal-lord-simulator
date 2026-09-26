import fs from 'node:fs/promises';
import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';
const W='/tmp/astra-wave17-work-20260926';
const paths=(await fs.readdir(W+'/records')).filter(x=>x.startsWith('prop-')&&x.endsWith('.json')).sort();
const comps=[], rows=[]; let labels='';
for(let n=0;n<paths.length;n++){
const r=JSON.parse(await fs.readFile(W+'/records/'+paths[n],'utf8'));
const {data,info}=await sharp(r.generated_source).ensureAlpha().raw().toBuffer({resolveWithObject:true});let l=info.width,t=info.height,rr=-1,b=-1;
for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){let i=(y*info.width+x)*4;if(data[i+3]<32)data[i+3]=0;if(data[i+3]>60){l=Math.min(l,x);rr=Math.max(rr,x);t=Math.min(t,y);b=Math.max(b,y);}}
let crop={left:l,top:t,width:rr-l+1,height:b-t+1};let raw=await sharp(data,{raw:{width:info.width,height:info.height,channels:4}}).extract(crop).resize(r.id.includes('ledger')?16:r.id.includes('torch')?14:28,r.id.includes('ledger')?18:r.id.includes('torch')?26:30,{fit:'inside'}).png().toBuffer();let mi=await sharp(raw).metadata();let left=Math.floor((32-mi.width)/2),top=Math.floor((32-mi.height)/2);await fs.mkdir(W+'/delivery/assets/prop',{recursive:true});await sharp({create:{width:32,height:32,channels:4,background:'#00000000'}}).composite([{input:raw,left,top}]).png().toFile(r.final_path);
let final=await sharp(r.final_path).raw().toBuffer();for(let i=3;i<final.length;i+=4)final[i]=Math.round(255*Math.pow(final[i]/255,0.65));await sharp(final,{raw:{width:32,height:32,channels:4}}).png().toFile(r.final_path);let gy=16,gx=16;if(!r.id.includes('ledger')){let best=-1;for(let x=3;x<29;x++){let score=0;for(let y=15;y<=17;y++){let i=(y*32+x)*4;score+=final[i+3];}if(score>best){best=score;gx=x;}}}
Object.assign(r,{source_crop:crop,final_placement:[left,top,mi.width,mi.height],grip_anchor:[gx,gy],processing:'Alpha trim, aspect-preserving Lanczos downsample, centered 32x32 transparent canvas; coverage compensation alpha exponent 0.65 at small size; no procedural artwork or mirrored direction copies.'});await fs.writeFile(W+'/records/'+paths[n],JSON.stringify(r,null,2));rows.push([r.id,r.id.split('_').at(-1).split('-')[0],32,32,gx,gy,'candidate local grip; attach to matching template hand',r.final_path.split('/delivery/')[1]].join(','));
const x=n%4*180,y=Math.floor(n/4)*170;comps.push({input:await sharp(r.final_path).resize(128,128,{kernel:'nearest'}).png().toBuffer(),left:x+26,top:y+10});labels+=`<text x="${x+5}" y="${y+157}" font-size="11" fill="#222">${r.id}</text>`;
}
await fs.writeFile(W+'/delivery/prop_anchors.csv','asset_id,direction,canvas_width,canvas_height,grip_x,grip_y,anchor_basis,file\n'+rows.join('\n')+'\n');
let h=Math.ceil(paths.length/4)*170;comps.push({input:Buffer.from(`<svg width="720" height="${h}" xmlns="http://www.w3.org/2000/svg">${labels}</svg>`),left:0,top:0});await sharp({create:{width:720,height:h,channels:4,background:'#aab09e'}}).composite(comps).png().toFile(W+'/props-contact.png');console.log(paths.length);
