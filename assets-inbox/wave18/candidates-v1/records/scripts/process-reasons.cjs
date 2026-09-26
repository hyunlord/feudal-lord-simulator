const fs=require('node:fs');
const path=require('node:path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const base=path.resolve(__dirname,'..');
(async()=>{
const rows=JSON.parse(fs.readFileSync(path.join(base,'records/metadata-reasons.json'),'utf8'));
const composite=[];
for(let i=0;i<rows.length;i++){
 const row=rows[i]; const src=path.join(base,row.generationRecords.at(-1).rawFile); const {data,info}=await sharp(src).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let x0=info.width,y0=info.height,x1=0,y1=0,transparent=0;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++){let a=data[(y*info.width+x)*4+3];if(a===0)transparent++;if(a>8){x0=Math.min(x0,x);y0=Math.min(y0,y);x1=Math.max(x1,x);y1=Math.max(y1,y);}}
 if(transparent===0)throw Error(row.id+' has no transparent background');
 const tile=await sharp(src).extract({left:x0,top:y0,width:x1-x0+1,height:y1-y0+1}).resize(80,80,{fit:'inside'}).png().toBuffer(); const m=await sharp(tile).metadata();
 await sharp({create:{width:96,height:96,channels:4,background:'#00000000'}}).composite([{input:tile,left:Math.floor((96-m.width)/2),top:Math.floor((96-m.height)/2)}]).png().toFile(path.join(base,row.file));
 row.qa={...row.qa,sourceWidth:info.width,sourceHeight:info.height,sourceTransparentPixels:transparent,alphaBounds:[x0,y0,x1,y1],alphaPreserved:true,visualReview:row.qa?.visualReview??'pending'};
 for(let j=0;j<4;j++){const size=[24,32,48,96][j];composite.push({input:await sharp(path.join(base,row.file)).resize(size,size).png().toBuffer(),left:24+j*128+Math.floor((96-size)/2),top:16+i*110+Math.floor((96-size)/2)});}
}
await sharp({create:{width:560,height:900,channels:4,background:'#e7d6b1'}}).composite(composite).png().toFile(path.join(base,'records/reasons-24-32-48-96.png'));
fs.writeFileSync(path.join(base,'records/metadata-reasons.json'),JSON.stringify(rows,null,2)+'\n');
console.log(rows.map(x=>({id:x.id,qa:x.qa})));
})().catch(e=>{console.error(e);process.exit(1)});
