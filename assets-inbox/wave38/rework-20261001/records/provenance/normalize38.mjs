import fs from 'node:fs/promises';
import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';
import crypto from 'node:crypto';
const W='/tmp/astra-wave40-work', D=W+'/delivery/wave38-rework';
const records=JSON.parse(await fs.readFile(W+'/records/wave38-generations.json','utf8'));
const colors=[[85,55,32],[104,71,44],[54,36,25],[99,89,76],[188,163,116]];
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
await fs.mkdir(D+'/provenance',{recursive:true});await fs.mkdir(D+'/reference',{recursive:true});
for(let n=0;n<records.length;n++){
 const r=records[n],original=await sharp(r.refs[0]).ensureAlpha().raw().toBuffer({resolveWithObject:true});
 const {width:w,height:h}=original.info;
 const trimmed=await sharp(r.source).trim({threshold:20}).resize(w,h,{fit:'fill'}).ensureAlpha().raw().toBuffer();
 // Exact original canvas/alpha contract; preserve original perimeter to avoid state silhouette drift.
 const out=Buffer.from(original.data); const color=colors[n];
 for(let y=4;y<h-4;y++)for(let x=5;x<w-5;x++){
  const i=(y*w+x)*4;
  if(original.data[i+3]>0){for(let c=0;c<3;c++)out[i+c]=trimmed[i+c];}
 }
 for(let y=9;y<h-9;y++)for(let x=12;x<w-12;x++){
  const i=(y*w+x)*4;for(let c=0;c<3;c++)out[i+c]=color[c];
 }
 await sharp(out,{raw:{width:w,height:h,channels:4}}).png().toFile(D+'/assets/'+r.id+'.png');
 const output=await fs.readFile(D+'/assets/'+r.id+'.png');
 r.processing={width:w,height:h,original_perimeter_preserved:true,original_alpha_preserved:true,generated_surface_inset:[5,4,w-10,h-8],flat_text_surface:[12,9,w-24,h-18],flat_rgb:color};
 r.source_sha256=sha(await fs.readFile(r.source));r.original_sha256=sha(await fs.readFile(r.refs[0]));r.output_sha256=sha(output);
 r.status='candidate';r.tool='built-in image_gen';
 for(const ref of r.refs)await fs.copyFile(ref,D+'/reference/'+ref.split('/').pop());
}
for(const id of ['button_secondary_normal','button_secondary_hover','button_secondary_pressed','button_secondary_disabled','tab_unselected'])await fs.copyFile('/tmp/astra-wave38-work/delivery/assets/'+id+'.png',D+'/reference/'+id+'.png');
await fs.writeFile(D+'/provenance/generations.json',JSON.stringify(records,null,2));
const items=[];let labels='';const text=(x,y,t)=>`<text x="${x}" y="${y}" font-size="15" fill="#30271c" font-family="Arial">${t}</text>`;
labels+=text(20,25,'Wave38 / original → dark-oak rework → secondary (unchanged)');
for(let i=0;i<4;i++){
 const id=records[i].id,y=55+i*85;labels+=text(20,y+14,id.replace('button_primary_',''));
 for(const [j,path] of [records[i].refs[0],D+'/assets/'+id+'.png',D+'/reference/'+id.replace('primary','secondary')+'.png'].entries())items.push({input:await sharp(path).resize(256,80,{kernel:'nearest'}).toBuffer(),left:120+j*280,top:y});
}
labels+=text(20,435,'hover before / hover rework / selected unchanged');
for(const [j,path] of [records[4].refs[0],D+'/assets/tab_hover.png',D+'/reference/tab_selected.png'].entries())items.push({input:await sharp(path).resize(256,80,{kernel:'nearest'}).toBuffer(),left:120+j*280,top:450});
items.push({input:Buffer.from(`<svg width="1000" height="550">${labels}</svg>`),left:0,top:0});
await sharp({create:{width:1000,height:550,channels:3,background:'#e8dcc4'}}).composite(items).jpeg({quality:90}).toFile(D+'/comparison.jpg');
console.log(records.map(r=>({id:r.id,size:[r.processing.width,r.processing.height],center:r.processing.flat_rgb})));
