import sharp from '/Users/rexxa/.npm/_npx/8b377f6eec906bc4/node_modules/sharp/lib/index.js';
import fs from 'node:fs/promises';import path from 'node:path';import crypto from 'node:crypto';
const W='/tmp/astra-wave17-work-20260926',D=W+'/delivery';
async function files(dir){let out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);out.push(...e.isDirectory()?await files(p):[p]);}return out;}
const hash=p=>fs.readFile(p).then(b=>crypto.createHash('sha256').update(b).digest('hex'));
const csv=(rows,cols)=>'\ufeff'+cols.join(',')+'\n'+rows.map(r=>cols.map(c=>'"'+String(r[c]??'').replaceAll('"','""')+'"').join(',')).join('\n')+'\n';
await fs.mkdir(D+'/records/generation',{recursive:true});await fs.mkdir(D+'/reference/templates',{recursive:true});
for(const n of ['P1','P4','P5'])await fs.copyFile(W+'/workerrefs/'+n+'.png',D+'/reference/templates/'+n+'.png');
const world=JSON.parse(await fs.readFile(W+'/world-registered.json'));
let records=[];for(const f of await files(W+'/records'))if(f.endsWith('.json')&&!f.includes('supplemental')){try{let r=JSON.parse(await fs.readFile(f));records.push({r,file:f});if(path.dirname(f)===W+'/records')await fs.copyFile(f,D+'/records/generation/'+path.basename(f));}catch{}}
await fs.writeFile(D+'/records/world-registration.json',JSON.stringify(world,null,2));
const convoy=JSON.parse(await fs.readFile(D+'/records/convoy/assembly.json'));
let rows=[],cellPivots=[];
for(const file of(await files(D+'/assets')).filter(f=>f.endsWith('.png')).sort()){
const rel=path.relative(D,file),base=path.basename(file,'.png'),meta=await sharp(file).metadata(),raw=await sharp(file).ensureAlpha().raw().toBuffer();
let rec=records.find(x=>x.r.final_path===file||x.r.id===base||x.r.id===base.replace(/-v1$/,'')||x.r.id?.endsWith('/'+base))?.r;
if(rel.includes('/illustration/'))rec=records.find(x=>x.r.final_path===file)?.r;
const wr=world.find(r=>r.file===rel);if(wr)rec=wr;
let provenance='builtin imagegen with project references',prompt=rec?.prompt??'',refs=rec?.references??rec?.refs??(rec?.ref?[rec.ref]:rec?.reference?[rec.reference]:[]),source=rec?.generated_source??rec?.source??'',cellw=meta.width,cellh=meta.height,cols=1,frames=1,dirs='',pivotx='',pivoty='',footx=wr?.foot?.[0]??'',footy=wr?.foot?.[1]??'',scale=1;
if(rel.includes('/wk/')||base.includes('refugee_')){cellw=74;cellh=74;cols=4;frames=2;dirs='NE|SE|SW|NW';}
if(rel.includes('/animal_walk/')){cellw=96;cellh=74;cols=4;frames=2;dirs='NE|SE|SW|NW';}
if(rel.includes('/cart/')||rel.includes('/herd/')){cellw=128;cellh=96;cols=4;frames=2;dirs='NE|SE|SW|NW';}
if(base==='raid_smoke_column_sheet-v1'){cellw=128;cellh=192;cols=4;frames=4;pivotx=64;pivoty=186;dirs='static';}
if(base.startsWith('held_')){dirs=base.match(/_(ne|se|sw|nw)-v1$/)[1].toUpperCase();scale=/longbow|bill/.test(base)?2:1;}
if(wr&&!base.includes('smoke')){pivotx=Math.round(cellw/2);pivoty=base.startsWith('beacon')?151:meta.height-1;}if(base==='raid_burning_quay-v1'){pivotx=68;pivoty=119;footx=2;footy=2;}
const cp=convoy.copies.find(r=>r.file===rel);if(cp){provenance='byte-reused project candidate';source=cp.source;refs=[cp.source];prompt='No generation: byte-for-byte reuse; see records/convoy/assembly.json';}
if(base==='wool_sack_convoy-v1'){const p=JSON.parse(await fs.readFile(D+'/records/convoy/prompts.json'));prompt=JSON.stringify(p);refs=[D+'/assets/cart/ox_cart_body-v1.png'];source=D+'/records/convoy/cargo-ai-source.png';}
if(base==='refugee_bundle_sheet-v1'){provenance='reuse of Wave9 generated backpack; original crop and attachment coordinates';prompt=JSON.stringify(rec??{});}
if(rec?.revisions)prompt+='\nRevision history: '+JSON.stringify(rec.revisions);let nonzero=0,opaque=0;for(let i=3;i<raw.length;i+=4){if(raw[i]>0)nonzero++;if(raw[i]===255)opaque++;}
if(cols===4&&frames===2){for(let f=0;f<2;f++)for(let c=0;c<4;c++){let maxY=-1,xs=[];for(let y=0;y<cellh;y++)for(let x=0;x<cellw;x++)if(raw[((f*cellh+y)*meta.width+c*cellw+x)*4+3]>20)maxY=Math.max(maxY,y);for(let y=Math.max(0,maxY-2);y<=maxY;y++)for(let x=0;x<cellw;x++)if(raw[((f*cellh+y)*meta.width+c*cellw+x)*4+3]>20)xs.push(x);cellPivots.push({asset:rel,direction:['NE','SE','SW','NW'][c],frame:f,alpha_ground_x:xs.length?Number((xs.reduce((a,b)=>a+b)/xs.length).toFixed(2)):'',alpha_ground_y:maxY,note:rel.includes('/wk/')?'Reference measurement only; preserve sheet registration, not an instruction to recenter.':'Geometry measurement, not animal/cart joint anchor; use convoy assembly metadata.'});}}
let sourceHash='';try{sourceHash=await hash(source);}catch{}
const history=rel.includes('illustration')?'1318–1347 fictional southern-English market town; French coastal raids1338–40; historical notes supplied.':/archer|bill/.test(base)?'Longbow/simple bill/quilted aketon per commission, no full plate or firearms.':/royal|wool/.test(base)?'1337–39 visual convention; red/gold three-lion signal, no later quartering.':'Restrained fourteenth-century visual; no gore; see HISTORICAL_NOTES.md.';
rows.push({asset_id:rel.replace('assets/','').replace('.png',''),file:rel,status:'candidate',width:meta.width,height:meta.height,cell_width:cellw,cell_height:cellh,columns:cols,frames,directions:dirs,pivot_x:pivotx,pivot_y:pivoty,pivot_basis:cols===4&&frames===2?'per-frame metadata; inherit registration':'new candidate ground anchor; overlay inherits target origin',footprint_tiles_x:footx,footprint_tiles_y:footy,prop_world_scale:scale,game_zoom_1_source_scale:0.5,game_zoom_06_source_scale:0.3,alpha_nonzero_pixels:nonzero,alpha_opaque_pixels:opaque,provenance,reference_files:refs.join('|'),generated_source:source,source_sha256:sourceHash,sha256:await hash(file),full_prompt:prompt,processing:rec?.processing??rec?.postprocess??rec?.registration??'',history_notes:history});
}
await fs.writeFile(D+'/assets.csv',csv(rows,Object.keys(rows[0])));await fs.writeFile(D+'/frame_pivots.csv',csv(cellPivots,Object.keys(cellPivots[0])));await fs.writeFile(W+'/catalog.json',JSON.stringify(rows,null,2));
const sourceRefs=new Set(rows.flatMap(r=>r.reference_files.split('|')).filter(Boolean));let refrows=[];for(const f of sourceRefs){try{refrows.push({source:f,sha256:await hash(f)});}catch{refrows.push({source:f,sha256:'see generation record or relative source'});}}await fs.writeFile(D+'/reference_hashes.csv',csv(refrows,['source','sha256']));
console.log(JSON.stringify({assets:rows.length,workers:rows.filter(x=>x.file.includes('/wk/')).length,illustrations:rows.filter(x=>x.file.includes('/illustration/')).length,source_records:records.length}));
