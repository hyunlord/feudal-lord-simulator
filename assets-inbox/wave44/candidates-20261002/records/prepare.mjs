import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';
const root=path.resolve(import.meta.dirname,'..');
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
const original=JSON.parse(await fs.readFile(root+'/records/generations-v1.json','utf8'));
const revisions=JSON.parse(await fs.readFile(root+'/records/revisions.json','utf8'));
const all=[...original.map(r=>({...r,version:1})),...revisions];
const mapping=new Map();
for(const r of all){
 const name=r.id+'-v'+r.version+'.png';
 await fs.copyFile(r.path,root+'/originals/'+name);
 const data=await fs.readFile(r.path),meta=await sharp(data).metadata();
 r.original_local='originals/'+name;r.source_sha256=hash(data);r.source_resolution=[meta.width,meta.height];
 r.generator='built-in image_gen';r.generation_date='2026-10-02';r.model=null;r.seed=null;
 r.historical_profile='S_England_1300_1450_v1';r.art_bible_version='ART_BIBLE_v2';
 mapping.set(r.path,r.original_local);
}
for(const r of all)r.reference_local=r.refs.map((p,i)=>mapping.get(p)??'reference/wave40_'+(i+1)+'.jpg');
await fs.writeFile(root+'/records/generations.json',JSON.stringify(all,null,2));
const rows=[];
for(const r of original){
 const selected=all.filter(a=>a.id===r.id).at(-1);
 const dest='assets/'+r.id+'.jpg';
 await sharp(root+'/'+selected.original_local).resize(960,540,{fit:'fill',kernel:'lanczos3'}).toColourspace('srgb').jpeg({quality:86,chromaSubsampling:'4:4:4',mozjpeg:true}).toFile(root+'/'+dest);
 const data=await fs.readFile(root+'/'+dest),m=await sharp(data).metadata();
 if(m.width!==960||m.height!==540||m.format!=='jpeg')throw Error(dest);
 rows.push({asset_id:r.id,title:r.title,file:dest,status:'candidate',accepted:null,width:m.width,height:m.height,bytes:data.length,sha256:hash(data),selected_version:selected.version,source:selected.original_local,prompt_exact:selected.prompt,reference_images:selected.reference_local.join(';'),crop_or_edit:'Single resize to 960x540; JPEG q86 4:4:4; no crop; see revision records',runtime_installed:false});
}
await fs.writeFile(root+'/records/manifest.json',JSON.stringify(rows,null,2));
const keys=Object.keys(rows[0]),quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
await fs.writeFile(root+'/assets.csv','\ufeff'+[keys.map(quote).join(','),...rows.map(r=>keys.map(k=>quote(r[k])).join(','))].join('\n')+'\n');
const cells=[];
for(let i=0;i<rows.length;i++){
 const left=(i%3)*340+10,top=Math.floor(i/3)*208+10;
 cells.push({input:await sharp(root+'/'+rows[i].file).resize(320,180).toBuffer(),left,top});
 const svg='<svg width="320" height="20"><text x="0" y="15" font-size="13" fill="#eee">'+rows[i].asset_id+'</text></svg>';
 cells.push({input:Buffer.from(svg),left,top:top+181});
}
await sharp({create:{width:1020,height:1040,channels:3,background:'#25211b'}}).composite(cells).jpeg({quality:87}).toFile(root+'/proofs/contact-sheet-320.jpg');
await fs.writeFile(root+'/records/metrics.json',JSON.stringify({count:rows.length,unique_hashes:new Set(rows.map(r=>r.sha256)).size,dimensions:'960x540',format:'JPEG',total_asset_bytes:rows.reduce((s,r)=>s+r.bytes,0),source_count:all.length,resize:'One resize from selected source, no crop; source ratio differs <0.1% from 16:9'},null,2));
console.log(JSON.stringify(rows.map(r=>({id:r.asset_id,bytes:r.bytes,version:r.selected_version}))));
