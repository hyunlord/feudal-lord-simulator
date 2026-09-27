const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'..');
const expected=JSON.parse(fs.readFileSync(root+'/records/expected-assets.json'));
const rows=JSON.parse(fs.readFileSync(root+'/records/asset-rows.json'));
const csvCheck=JSON.parse(fs.readFileSync(root+'/records/csv-validation.json'));
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const checks=[];const check=(name,pass)=>{checks.push({name,pass});if(!pass)throw Error(name);};
check('58 unique expected IDs',expected.length===58&&new Set(expected.map(a=>a.id)).size===58);
check('58 CSV rows',rows.length===58&&csvCheck.dataRows===58&&csvCheck.allCellsRoundtrip===true);
for(const r of rows){check(r.asset_id+' asset hash',sha(fs.readFileSync(root+'/'+r.file))===r.sha256);const records=JSON.parse(r.generation_records);check(r.asset_id+' prompt provenance',records.length>0&&records.every(g=>typeof g.prompt==='string'&&g.prompt.length>100));for(const g of records){const raw=g.rawFile||g.raw_file;check(r.asset_id+' packaged raw',!!raw&&!path.isAbsolute(raw)&&fs.existsSync(root+'/'+raw));for(const ref of g.referenceImages||[]){check(r.asset_id+' packaged reference',!path.isAbsolute(ref)&&fs.existsSync(root+'/'+ref));}}}
for(const f of ['01-chapter3.png','02-chapter4.png','03-chapter5.png'])check('proof '+f,fs.existsSync(root+'/proofs/'+f));
check('exactly 3 final proofs',fs.readdirSync(root+'/proofs').filter(f=>f.endsWith('.png')).length===3);
const all=[];function walk(dir){for(const e of fs.readdirSync(dir,{withFileTypes:true})){const f=path.join(dir,e.name);if(e.isDirectory())walk(f);else all.push(f);}}walk(root+'/assets');check('exactly 58 final assets',all.filter(f=>f.endsWith('.png')).length===58);
fs.writeFileSync(root+'/records/package-verification.json',JSON.stringify({status:'PASS',assertions:checks.length,checks},null,2));console.log('PASS',checks.length,'assertions');
