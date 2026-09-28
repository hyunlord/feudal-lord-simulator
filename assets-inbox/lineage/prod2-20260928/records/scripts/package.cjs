const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),cp=require('node:child_process');
const base=path.resolve(__dirname,'..');
const stage='/tmp/astra-lineage-prod2-delivery';
const lite='/tmp/astra-lineage-prod2-candidates-20260928-lite.zip';
const raw='/Users/rexxa/feudal-lord-analysis/astra-raw/lineage-prod2-20260928';
const full='/Users/rexxa/feudal-lord-analysis/astra-raw/zips/astra-lineage-prod2-candidates-20260928-full.zip';
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isSymbolicLink()?[]:e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
for(const required of ['REPORT.md','TRAITS.md','assets.csv','records/technical-qa.json','records/blind-results.json','records/age-review.json'])if(!fs.existsSync(path.join(base,required)))throw Error('Not ready: '+required);
if(fs.existsSync(stage))throw Error('Delivery staging already exists; inspect before replacing');
fs.mkdirSync(stage,{recursive:true});
for(const f of walk(base)){
 const rel=path.relative(base,f);
 if(rel.startsWith('records/proof-work/')||rel==='SHA256SUMS')continue;
 const dest=path.join(stage,rel);fs.mkdirSync(path.dirname(dest),{recursive:true});fs.copyFileSync(f,dest);
}
const manifest=walk(stage).sort().map(f=>`${hash(f)}  ${path.relative(stage,f)}`).join('\n')+'\n';
fs.writeFileSync(path.join(stage,'SHA256SUMS'),manifest);
fs.writeFileSync(path.join(base,'SHA256SUMS'),manifest);
cp.execFileSync('/usr/bin/zip',['-q','-9','-r',lite,'.'],{cwd:stage});
cp.execFileSync('/usr/bin/unzip',['-tq',lite]);
fs.mkdirSync(path.dirname(full),{recursive:true});
fs.copyFileSync(lite,full);
cp.execFileSync('/usr/bin/zip',['-q','-9','-r',full,path.basename(raw)],{cwd:path.dirname(raw)});
cp.execFileSync('/usr/bin/unzip',['-tq',full]);
const result={lite:{file:lite,bytes:fs.statSync(lite).size,sha256:hash(lite)},full:{file:full,bytes:fs.statSync(full).size,sha256:hash(full)},manifestFiles:manifest.trim().split('\n').length,crc:'PASS'};
fs.writeFileSync(path.join(base,'records/delivery.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
