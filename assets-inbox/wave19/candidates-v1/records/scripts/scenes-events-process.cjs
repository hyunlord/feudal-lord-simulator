const fs=require('fs'); const path=require('path'); const crypto=require('crypto');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
(async()=>{
const rows=JSON.parse(fs.readFileSync(path.join(root,'records/metadata-scenes-events.json')));
const comps=[];
for(let i=0;i<rows.length;i++){
 const r=rows[i];const source=path.join(root,r.generationRecords.at(-1).rawFile);
 const {data,info}=await sharp(source).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let minx=info.width,miny=info.height,maxx=-1,maxy=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){minx=Math.min(minx,x);miny=Math.min(miny,y);maxx=Math.max(maxx,x);maxy=Math.max(maxy,y);}
 if(maxx<0)throw Error('empty '+r.id);
 const crop={left:minx,top:miny,width:maxx-minx+1,height:maxy-miny+1};
 const buf=await sharp(source).extract(crop).resize(84,84,{fit:'contain',background:'#00000000'}).png().toBuffer();
 const out=path.join(root,r.file);await sharp(buf).extend({top:6,bottom:6,left:6,right:6,background:'#00000000'}).png().toFile(out);
 const m=await sharp(out).metadata();if(m.width!==96||m.height!==96||m.channels!==4)throw Error('bad dimensions');
 r.width=96;r.height=96;r.sha256=crypto.createHash('sha256').update(fs.readFileSync(out)).digest('hex');r.processing={method:'Generated alpha preserved; alpha > 8 bounding-box crop; Lanczos3 contain 84x84; transparent 6px padding; no painted replacement',crop,rawWidth:info.width,rawHeight:info.height};
 let x=16;for(const size of [24,32,48,96]){comps.push({input:await sharp(out).resize(size,size).png().toBuffer(),left:x,top:i*116+10});x+=size+22;}
}
await sharp({create:{width:400,height:rows.length*116,channels:4,background:'#dfd1b5'}}).composite(comps).png().toFile(path.join(root,'raw/scenes_events/contact-24-32-48-96.png'));
fs.writeFileSync(path.join(root,'records/metadata-scenes-events.json'),JSON.stringify(rows,null,2)+'\n');console.log(rows.map(r=>r.id+': '+r.width+'x'+r.height).join('\n'));
})();
