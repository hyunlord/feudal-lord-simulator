import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const out=path.resolve(process.argv[2]??'/tmp/astra-portrait-pool2-work/deliverable');
const reportFile=process.argv[3];
const assert=(ok,message)=>{if(!ok)throw new Error(message);};
const hash=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const readJSON=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const walk=dir=>fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);
function parseCSV(text){
 const rows=[];let row=[],value='',quoted=false;
 text=text.replace(/^\uFEFF/,'');
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(ch==='"'){if(quoted&&text[i+1]==='"'){value+='"';i++;}else quoted=!quoted;}
  else if(ch===','&&!quoted){row.push(value);value='';}
  else if((ch==='\n'||ch==='\r')&&!quoted){if(ch==='\r'&&text[i+1]==='\n')i++;row.push(value);rows.push(row);row=[];value='';}
  else value+=ch;
 }
 assert(!quoted,'Unclosed CSV quote');
 if(row.length||value){row.push(value);rows.push(row);}
 const header=rows.shift();assert(header&&new Set(header).size===header.length,'Missing or duplicate CSV columns');
 return rows.map((r,i)=>{assert(r.length===header.length,`CSV width mismatch row ${i+2}`);return Object.fromEntries(header.map((k,j)=>[k,r[j]]));});
}
const rows=parseCSV(fs.readFileSync(path.join(out,'portraits.csv'),'utf8'));
assert(rows.length===92,'CSV must have 92 data rows');
assert(new Set(rows.map(r=>r.id)).size===92,'Duplicate CSV IDs');
const roster=readJSON(path.join(out,'roster.json'));
assert(roster.identities.length===32,'32 identities required');
const expected=roster.identities.flatMap(p=>p.stages.map(s=>`${p.identity_id}_${s.stage}`)).sort();
assert(JSON.stringify(expected)===JSON.stringify(rows.map(r=>r.id).sort()),'CSV/roster stage mismatch');
assert(roster.identities.every((p,i)=>p.identity_id===`I${String(i+69).padStart(3,'0')}`),'Identity range/order must be I069..I100');
const portraitFiles=fs.readdirSync(path.join(out,'portraits')).filter(f=>f.endsWith('.png')).sort();
assert(portraitFiles.length===92,'92 portrait PNG required');
for(const row of rows){
 for(const field of ['identity_id','stage','role','prop','prop_group','prompt','sha256','source_file','source_sha256'])assert(row[field]?.trim(),`Missing ${field}: ${row.id}`);
 assert(['none','book_scroll','other'].includes(row.prop_group),`Unknown prop_group: ${row.id}`);
 const image=path.join(out,row.file),bytes=fs.readFileSync(image);
 assert(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),`Not PNG: ${row.id}`);
 assert(bytes.readUInt32BE(16)===256&&bytes.readUInt32BE(20)===256,`Not 256 square: ${row.id}`);
 assert(hash(image)===row.sha256,`PNG hash mismatch: ${row.id}`);
 assert(hash(path.join(out,row.source_file))===row.source_sha256,`Source hash mismatch: ${row.id}`);
 const record=readJSON(path.join(out,'provenance/generation-records',row.id+'.json'));
 assert(record.prompt===row.prompt,`Prompt roundtrip mismatch: ${row.id}`);
 assert(record.packaged_source===row.source_file,`Record source mismatch: ${row.id}`);
 assert(record.packaged_references.join('; ')===row.reference_files,`Reference list roundtrip mismatch: ${row.id}`);
 for(const reference of record.packaged_references)assert(fs.existsSync(path.join(out,reference)),`Missing packaged reference: ${row.id}`);
}
const groups=list=>Object.fromEntries(['none','book_scroll','other'].map(group=>[group,list.filter(r=>r.prop_group===group).length]));
const countStages=groups(rows),countIdentities=groups(rows.filter(r=>r.stage==='young'));
const props=readJSON(path.join(out,'prop-distribution.json'));
assert(JSON.stringify(props.stages.counts)===JSON.stringify(countStages),'Stage prop distribution mismatch');
assert(JSON.stringify(props.identities.counts)===JSON.stringify(countIdentities),'Identity prop distribution mismatch');
assert(countStages.book_scroll/92<=0.25&&countIdentities.book_scroll/32<=0.25,'Book/scroll share exceeds 25%');
const scenesDir=path.join(out,'provenance/proof-scenes');
const sceneFiles=fs.readdirSync(scenesDir).filter(f=>f.endsWith('.json'));
assert(sceneFiles.length===4,'Four scenes required');
assert(fs.readdirSync(path.join(out,'checks')).filter(f=>f.endsWith('.png')).length===4,'Four proof PNG required');
const sceneEvidence=[];
for(const file of sceneFiles){
 const scene=readJSON(path.join(scenesDir,file));
 for(const [i,image] of scene.images.entries()){
  assert(image.x>=0&&image.y>=0&&image.width>0&&image.height>0&&image.x+image.width<=scene.width&&image.y+image.height<=scene.height,`Out-of-bounds image ${file}:${i}`);
  assert(fs.existsSync(path.resolve(scenesDir,image.file)),`Missing scene image ${file}:${i}`);
 }
 for(const [i,text] of scene.texts.entries())assert(text.x>=0&&text.y>=0&&text.x<scene.width&&text.y+(text.size??18)<=scene.height,`Out-of-bounds text origin/height ${file}:${i}`);
 if(file.startsWith('01-')){
  const lastImageBottom=Math.max(...scene.images.map(i=>i.y+i.height));
  const table=scene.texts.find(t=>t.text.startsWith('소지품 분포'));
  assert(table&&table.y>=lastImageBottom+40,'Prop table overlaps portrait rows');
 }
 sceneEvidence.push({file,width:scene.width,height:scene.height,images:scene.images.length,text_entries:scene.texts.length,bounds:'PASS'});
}
const inventory=readJSON(path.join(out,'inventory.json'));
for(const item of inventory){const file=path.join(out,item.file);assert(fs.statSync(file).size===item.bytes,`Inventory size mismatch: ${item.file}`);assert(hash(file)===item.sha256,`Inventory hash mismatch: ${item.file}`);}
const manifest=fs.readFileSync(path.join(out,'SHA256SUMS'),'utf8').trim().split('\n').map(line=>{const m=/^([a-f0-9]{64})  (.+)$/.exec(line);assert(m,'Malformed SHA256SUMS line');return {sha256:m[1],file:m[2]};});
assert(new Set(manifest.map(x=>x.file)).size===manifest.length,'Duplicate manifest paths');
for(const item of manifest)assert(hash(path.join(out,item.file))===item.sha256,`Manifest hash mismatch: ${item.file}`);
const actual=walk(out).map(f=>path.relative(out,f)).filter(f=>f!=='SHA256SUMS').sort();
assert(JSON.stringify(actual)===JSON.stringify(manifest.map(x=>x.file).sort()),'Manifest missing or extra files');
const report={status:'PASS',scope:'Independent structure, CSV roundtrip, prop counts, scene bounds, PNG headers, packaged references, and all SHA256 hashes. No visual classification claim.',portraits:92,csv_rows:92,identities:32,proofs:4,manifest_entries:manifest.length,props:{identities:countIdentities,stages:countStages},scenes:sceneEvidence};
if(reportFile)fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report));
