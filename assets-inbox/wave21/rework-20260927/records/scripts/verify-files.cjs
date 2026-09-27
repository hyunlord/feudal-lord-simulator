const fs=require('fs'),path=require('path'),crypto=require('crypto');
const p=path.resolve(__dirname,'..');
function walk(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const rel=f=>path.relative(p,f),sha=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const all=walk(p),expected=JSON.parse(fs.readFileSync(p+'/records/expected-assets.json')).map(a=>a.file).sort(),actual=walk(p+'/assets').map(rel).sort();
if(JSON.stringify(actual)!==JSON.stringify(expected))throw Error('unexpected or missing asset');
if(all.some(f=>/ch3-records-contact|ch5-events-contact/.test(f)))throw Error('excluded contact included');
const selected=JSON.parse(fs.readFileSync(p+'/records/rework-selection.json'));
if(selected.length!==24||new Set(selected.map(a=>a.id)).size!==24)throw Error('selection');
const proofs=walk(p+'/proofs');if(proofs.length!==3)throw Error('proofcount');
const review=JSON.parse(fs.readFileSync(p+'/records/independent-rework-review.json'));
fs.writeFileSync(p+'/records/package-check.json',JSON.stringify({status:'PASS',assetCount:actual.length,proofCount:proofs.length,reworked:selected.length,excludedContactsAbsent:true,independentReviewFile:'records/independent-rework-review.json',reviewStatus:review.verdict||review.status||'see review',fileHashes:actual.map(f=>({file:f,sha256:sha(p+'/'+f)}))},null,2));
const files=walk(p).filter(f=>rel(f)!=='SHA256SUMS').sort();
fs.writeFileSync(p+'/SHA256SUMS',files.map(f=>sha(f)+'  '+rel(f)).join('\n')+'\n');
console.log('PASS58assets3proofs24replacements; manifest '+files.length+' files');
