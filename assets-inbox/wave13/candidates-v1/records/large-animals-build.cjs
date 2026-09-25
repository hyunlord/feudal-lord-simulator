const fs=require('fs'),path=require('path');const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve('output/astra-wave13-candidates-v1');
const specs={ox:[96,74],horse_draught:[96,80],horse_riding:[96,80],cow_single:[80,64]};
async function main(){const id=process.argv[2], [w,h]=specs[id], raw=path.join(root,'raw/large-animals'); const m=await sharp(`${raw}/${id}-base.png`).metadata();let out=[];
for(let d=0;d<4;d++){const cw=Math.floor(m.width/2),ch=Math.floor(m.height/2),reg={left:(d%2)*cw,top:Math.floor(d/2)*ch,width:cw,height:ch};if(id.startsWith('horse_')&&d===1)reg.height=410;if(id.startsWith('horse_')&&d===3){reg.top=380;reg.height=m.height-380;}let {data,info}=await sharp(`${raw}/${id}-base.png`).extract(reg).ensureAlpha().raw().toBuffer({resolveWithObject:true});
for(let i=0;i<data.length;i+=4){if(data[i]>150&&data[i+1]<50&&data[i+2]<50){data[i+3]=0;}if(data[i+3]<12)data[i+3]=0;}
if(id.startsWith('horse_')&&d===1){for(let y=380;y<info.height;y++)for(let x=0;x<289;x++)data[(y*info.width+x)*4+3]=0;}if(id.startsWith('horse_')&&d===3){for(let y=0;y<30;y++)for(let x=289;x<info.width;x++)data[(y*info.width+x)*4+3]=0;}let x0=info.width,y0=info.height,x1=0,y1=0;for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*cw+x)*4+3]>20){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
const box={left:x0,top:y0,width:x1-x0+1,height:y1-y0+1},scale=Math.min((w-10)/box.width,(h-10)/box.height);const nw=Math.round(box.width*scale),nh=Math.round(box.height*scale),left=Math.round((w-nw)/2),top=h-4-nh;
const buf=await sharp(data,{raw:info}).extract(box).resize(nw,nh).png().toBuffer();const cell=await sharp({create:{width:w,height:h,channels:4,background:'#00000000'}}).composite([{input:buf,left,top}]).png().toBuffer();await fs.promises.writeFile(`${raw}/${id}-${d}-base-cell.png`,cell);out.push({direction:['ne','se','sw','nw'][d],reg,box,scale,nw,nh,left,top});}
fs.writeFileSync(`${root}/records/large-animals-${id}-registration.json`,JSON.stringify(out,null,2));}
main();
