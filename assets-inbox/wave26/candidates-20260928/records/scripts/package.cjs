const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');const R=path.resolve(__dirname,'..'),raw='/Users/rexxa/feudal-lord-analysis/astra-raw/wave26-20260928',stage='/tmp/astra-wave26-package-stage',zip='/tmp/astra-wave26-candidates-20260928-lite.zip',dest=stage+'/astra-wave26-candidates';const hash=b=>crypto.createHash('sha256').update(b).digest('hex');function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name])}
let qa=JSON.parse(fs.readFileSync(R+'/records/technical-qa.json'));if(qa.assets!==100||qa.missing.length||qa.failures.length)throw Error('technicalQAfailed');const assets=JSON.parse(fs.readFileSync(R+'/records/manifest.json')).assets;fs.mkdirSync(raw,{recursive:true});let raws=[];for(const p of walk(R+'/native')){let rel=path.relative(R,p),out=raw+'/'+rel,b=fs.readFileSync(p);fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,b);raws.push({source:rel,preserved:out,bytes:b.length,sha256:hash(b)})}fs.writeFileSync(R+'/records/raw-inventory.json',JSON.stringify(raws,null,2));
fs.writeFileSync(R+'/index.html','<!doctype html><meta charset="utf-8"><title>Wave26 후보</title><style>body{font:16px sans-serif;background:#6f7866;color:#fff8e7;margin:24px}a{color:#fff8e7}li{display:inline-block;width:205px;vertical-align:top;margin:12px}img{display:block;min-height:161px;object-fit:contain;object-position:bottom left;max-width:180px}</style><h1>Wave26 후보100종</h1><p>게임 미설치 · '+['01-level-variants','02-city-repetition','03-state-overlays'].map((x,i)=>'<a href="proofs/'+x+'.png">확인'+(i+1)+'</a>').join(' · ')+'</p>'+[0,1,2,3,4].map(n=>'<h2>L'+n+'</h2><ul>'+assets.filter(a=>a.level===n).map(a=>'<li><a href="'+a.file+'"><img src="'+a.file+'">'+a.id+'</a></li>').join('')+'</ul>').join(''));
fs.mkdirSync(dest,{recursive:true});for(const dir of['assets','proofs','references','records','scripts'])for(const p of walk(R+'/'+dir)){let rel=path.relative(R,p);if(dir==='records'&&(p.endsWith('.png')||p.endsWith('package-result.json')))continue;let out=dest+'/'+rel;fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(p,out)}for(const f of['README.md','QA.md','PLAN.md','index.html','generation-records.csv'])fs.copyFileSync(R+'/'+f,dest+'/'+f);let files=walk(dest).filter(p=>!p.endsWith('SHA256SUMS')).sort();fs.writeFileSync(dest+'/SHA256SUMS',files.map(p=>hash(fs.readFileSync(p))+'  '+path.relative(dest,p)).join('\n')+'\n');
execFileSync('python3',['-c',`import pathlib,zipfile,hashlib,csv,io
r=pathlib.Path(${JSON.stringify(dest)})
with zipfile.ZipFile(${JSON.stringify(zip)},'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(r.rglob('*')):
  if p.is_file():z.write(p,str(p.relative_to(r.parent)))
with zipfile.ZipFile(${JSON.stringify(zip)}) as z:
 assert z.testzip() is None
 pre='astra-wave26-candidates/'
 for line in z.read(pre+'SHA256SUMS').decode().splitlines():
  h,n=line.split('  ',1);assert hashlib.sha256(z.read(pre+n)).hexdigest()==h,n
 rows=list(csv.DictReader(io.StringIO(z.read(pre+'generation-records.csv').decode('utf-8-sig'))))
 assert len(rows)==100 and len({x['id'] for x in rows})==100
 for row in rows:assert hashlib.sha256(z.read(pre+row['file'])).hexdigest()==row['sha256']
 assert len([n for n in z.namelist() if '/assets/' in n and n.endswith('.png')])==100
 assert len([n for n in z.namelist() if '/proofs/' in n and n.endswith('.png')])==3
 print('CRC + all manifest hashes +100 CSV records +100assets +3proofs PASS')`],{stdio:'inherit'});let b=fs.readFileSync(zip),result={zip,bytes:b.length,MiB:b.length/1048576,sha256:hash(b),assets:100,proofs:3,csv_rows:100,raw_files:raws.length,manifest_hashes:files.length,crc:'pass'};fs.writeFileSync(R+'/records/package-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
