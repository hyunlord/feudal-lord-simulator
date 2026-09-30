const fs=require('fs');
const path=require('path');
const sharp=require('/Users/rexxa/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/sharp');
const root=path.resolve(__dirname,'..');
(async()=>{
const rows=JSON.parse(fs.readFileSync(path.join(root,'records/trades-a-input.json')));
for(const r of rows){
 const source=r.tool_metadata.output_hint.match(/ as (.+?\.png) by default/s)[1];
 const raw=path.join(root,'raw',r.id+'.png');fs.copyFileSync(source,raw);
 const {data,info}=await sharp(raw).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 let minx=info.width,miny=info.height,maxx=-1,maxy=-1;
 for(let y=0;y<info.height;y++)for(let x=0;x<info.width;x++)if(data[(y*info.width+x)*4+3]>8){minx=Math.min(minx,x);miny=Math.min(miny,y);maxx=Math.max(maxx,x);maxy=Math.max(maxy,y);}
 const crop={left:minx,top:miny,width:maxx-minx+1,height:maxy-miny+1};
 const width=r.id.includes('dyer')||r.id.includes('smith')?96:128;
 const scale=Math.min((width-8)/crop.width,87/crop.height);
 const w=Math.floor(crop.width*scale),h=Math.floor(crop.height*scale),left=Math.round((width-w)/2),top=91-h;
 const buf=await sharp(raw).extract(crop).resize(w,h,{fit:'fill'}).toBuffer();
 await sharp({create:{width,height:96,channels:4,background:{r:0,g:0,b:0,alpha:0}}}).composite([{input:buf,left,top}]).png().toFile(path.join(root,'assets',r.id+'.png'));
 Object.assign(r,{raw_path:raw,asset_path:path.join(root,'assets',r.id+'.png'),source_path:source,source_dimensions:{width:info.width,height:info.height},canvas:{width,height:96},transform:{alpha_threshold:8,crop,scale,resized:{width:w,height:h},placement:{left,top},baseline_target_y:90,mirror:false,aspect_ratio_preserved:true},status:'candidate',anchor:{x:Math.round(width/2),y:90,method:'pending visual annotation'},limitations:[]});
}
fs.writeFileSync(path.join(root,'records/trades-a.json'),JSON.stringify(rows,null,2));
const blocks=[];for(let i=0;i<rows.length;i++){let asset=await sharp(rows[i].asset_path).resize(256,192,{fit:'contain',kernel:'nearest',background:{r:0,g:0,b:0,alpha:0}}).png().toBuffer();blocks.push({input:asset,left:(i%4)*280+12,top:Math.floor(i/4)*220+10});const label=Buffer.from(`<svg width="280" height="24"><text x="8" y="18" fill="#222" font-size="16">${rows[i].id}</text></svg>`);blocks.push({input:label,left:(i%4)*280,top:Math.floor(i/4)*220+196});}
await sharp({create:{width:1120,height:440,channels:4,background:'#c9c1a5'}}).composite(blocks).png().toFile(path.join(root,'proofs/trades-a-contact.png'));
console.log(rows.map(r=>({id:r.id,source:r.source_dimensions,canvas:r.canvas,crop:r.transform.crop})));
})();
