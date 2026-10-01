import fs from 'node:fs/promises';
import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';
import crypto from 'node:crypto';
const W='/tmp/astra-wave40-work',D=W+'/delivery/wave40';const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
await fs.mkdir(D+'/provenance',{recursive:true});await fs.mkdir(D+'/reference',{recursive:true});
const prompts=JSON.parse(await fs.readFile(W+'/records/wave40-prompts.json'));const rows=[];
for(const p of prompts){let r;try{r=JSON.parse(await fs.readFile(W+'/records/'+p.id+'.json'));}catch{continue;}
const meta=await sharp(r.source).metadata();const target=D+'/assets/'+r.id+'.jpg';
await sharp(r.source).resize(960,540,{fit:'cover',position:'centre'}).removeAlpha().jpeg({quality:88,mozjpeg:true,chromaSubsampling:'4:4:4'}).toFile(target);
r.source_sha256=sha(await fs.readFile(r.source));r.file='assets/'+r.id+'.jpg';r.sha256=sha(await fs.readFile(target));r.status='candidate';r.tool='built-in image_gen';r.processing={source_dimensions:[meta.width,meta.height],resize:'960x540 cover-centre Lanczos3',encoding:'JPEG quality88 mozjpeg 4:4:4'};
r.reference_records=[];
for(const [i,ref]of r.refs.entries()){let file='reference/'+(i===0?'Wave33_style.jpg':'Wave21_lord_warning.png');await fs.copyFile(ref,D+'/'+file);r.reference_records.push({file,original_path:ref,sha256:sha(await fs.readFile(ref))});}
rows.push(r);
}
await fs.writeFile(D+'/provenance/generations.json',JSON.stringify(rows,null,2));
const cols=4,tw=384,th=216,gap=12,label=30,width=cols*(tw+gap)+gap,height=4*(th+label+gap)+gap;
const layers=[];let labels='';for(let i=0;i<rows.length;i++){const x=gap+(i%cols)*(tw+gap),y=gap+Math.floor(i/cols)*(th+label+gap);layers.push({input:await sharp(D+'/'+rows[i].file).resize(tw,th).toBuffer(),left:x,top:y});labels+=`<text x="${x+6}" y="${y+th+21}" fill="#ede4d2" font-family="Apple SD Gothic Neo,Arial" font-size="17">${rows[i].title} · ${rows[i].id.slice(0,2)}</text>`;}
layers.push({input:Buffer.from(`<svg width="${width}" height="${height}">${labels}</svg>`),left:0,top:0});
await sharp({create:{width,height,channels:3,background:'#30291f'}}).composite(layers).jpeg({quality:88,mozjpeg:true}).toFile(D+'/contact-sheet.jpg');
const keys=['id','title','file','width','height','status','distinction','sha256','prompt','references','source_sha256'];const q=v=>'"'+String(v??'').replaceAll('"','""')+'"';
const csv=[keys,...rows.map(r=>[r.id,r.title,r.file,960,540,r.status,r.distinction,r.sha256,r.prompt,r.reference_records.map(x=>x.file).join(';'),r.source_sha256])].map(row=>row.map(q).join(',')).join('\r\n');await fs.writeFile(D+'/assets.csv','\ufeff'+csv+'\r\n');
console.log({completed:rows.length,expected:14,ids:rows.map(r=>r.id)});
