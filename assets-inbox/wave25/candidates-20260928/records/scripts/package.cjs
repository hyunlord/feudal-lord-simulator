const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');const root=path.resolve(__dirname,'..'),raw='/Users/rexxa/feudal-lord-analysis/astra-raw/wave25-20260928',stage='/tmp/astra-wave25-package-stage',zip='/tmp/astra-wave25-candidates-20260928-lite.zip';
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');fs.mkdirSync(raw,{recursive:true});let originals=[];for(const folder of['records','native']){let base=root+'/'+folder;if(!fs.existsSync(base))continue;for(const f of fs.readdirSync(base)){let p=base+'/'+f;if(!f.endsWith('.png'))continue;let b=fs.readFileSync(p),out=raw+'/'+folder+'/'+f;fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,b);originals.push({source:folder+'/'+f,preserved:out,bytes:b.length,sha256:sha(b)})}}fs.writeFileSync(root+'/records/raw-inventory.json',JSON.stringify(originals,null,2));
const assets=JSON.parse(fs.readFileSync(root+'/records/asset-manifest.json')).assets;fs.writeFileSync(root+'/index.html','<!doctype html><meta charset="utf-8"><title>Wave25 candidates</title><style>body{background:#e5d7b6;color:#493a2b;font:16px sans-serif}li{margin:14px}img{vertical-align:middle;margin-right:20px}</style><h1>Wave25 후보16종</h1><p><a href="proofs/01-lineage-1280x800.png">확인 그림1280×800</a></p><ul>'+assets.map(a=>'<li><a href="'+a.file+'"><img src="'+a.file+'">'+a.id+'</a> '+a.width+'×'+a.height+'</li>').join('')+'</ul>');
fs.mkdirSync(stage,{recursive:true});const dest=stage+'/astra-wave25-candidates';fs.mkdirSync(dest,{recursive:true});for(const folder of['assets','proofs','records','references','scripts']){fs.mkdirSync(dest+'/'+folder,{recursive:true});for(const f of fs.readdirSync(root+'/'+folder)){if(folder==='records'&&(f.endsWith('.png')||f==='package-result.json'))continue;let p=root+'/'+folder+'/'+f;if(fs.statSync(p).isFile())fs.copyFileSync(p,dest+'/'+folder+'/'+f)}}for(const f of['README.md','QA.md','PLAN.md','index.html','generation-records.csv'])fs.copyFileSync(root+'/'+f,dest+'/'+f);
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name])}let files=walk(dest).filter(p=>!p.endsWith('/SHA256SUMS'));fs.writeFileSync(dest+'/SHA256SUMS',files.sort().map(p=>sha(fs.readFileSync(p))+'  '+path.relative(dest,p)).join('\n')+'\n');
execFileSync('python3',['-c',`import zipfile,pathlib,csv,io,hashlib,json
root=pathlib.Path(${JSON.stringify(dest)})
with zipfile.ZipFile(${JSON.stringify(zip)},'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(root.rglob('*')):
  if p.is_file(): z.write(p,str(p.relative_to(root.parent)))
with zipfile.ZipFile(${JSON.stringify(zip)}) as z:
 assert z.testzip() is None
 prefix='astra-wave25-candidates/'
 for line in z.read(prefix+'SHA256SUMS').decode().splitlines():
  digest,name=line.split('  ',1)
  assert hashlib.sha256(z.read(prefix+name)).hexdigest()==digest,name
 rows=list(csv.DictReader(io.StringIO(z.read(prefix+'generation-records.csv').decode('utf-8-sig'))))
 assert len(rows)==16
 assert len([n for n in z.namelist() if '/assets/' in n and n.endswith('.png')])==16
 assert len([n for n in z.namelist() if '/proofs/' in n and n.endswith('.png')])==1
 print('CRC, hashes, CSV16, assets16, proof1 passed')`],{stdio:'inherit'});let b=fs.readFileSync(zip);let result={zip,bytes:b.length,MiB:b.length/1024/1024,sha256:sha(b),assets:16,proofs:1,csv_rows:16,crc:'pass',manifest_hashes:files.length,raw_originals:originals.length};fs.writeFileSync(root+'/records/package-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
