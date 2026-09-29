const fs=require('fs'),path=require('path'),crypto=require('crypto'),{execFileSync}=require('child_process');
const R=path.resolve(__dirname,'..'),raw='/Users/rexxa/feudal-lord-analysis/astra-raw/wave32-20260929',stage=fs.mkdtempSync('/tmp/astra-wave32-package-'),dest=stage+'/astra-wave32-candidates',zip='/tmp/astra-wave32-candidates-20260929-lite.zip';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function walk(p){return fs.readdirSync(p,{withFileTypes:true}).flatMap(d=>d.isDirectory()?walk(p+'/'+d.name):[p+'/'+d.name])}
const manifest=JSON.parse(fs.readFileSync(R+'/records/manifest.json'));if(manifest.status!=='PASS'||manifest.assets.length!==26)throw Error('26 verified assets required');
fs.mkdirSync(raw,{recursive:true});let raws=[];for(const p of walk(R+'/native')){const rel=path.relative(R,p),out=raw+'/'+rel,b=fs.readFileSync(p);fs.mkdirSync(path.dirname(out),{recursive:true});if(fs.existsSync(out)&&hash(fs.readFileSync(out))!==hash(b))throw Error('Raw overwrite forbidden '+out);if(!fs.existsSync(out))fs.writeFileSync(out,b);raws.push({source:rel,preserved:out,bytes:b.length,sha256:hash(b)});if(/\.(json|txt)$/.test(p)){const textOut=R+'/records/native-text/'+path.relative(R+'/native',p);fs.mkdirSync(path.dirname(textOut),{recursive:true});fs.copyFileSync(p,textOut);}}
fs.writeFileSync(R+'/records/raw-inventory.json',JSON.stringify(raws,null,2));
const assets=manifest.assets,esc=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
let html='<!doctype html><html lang="ko"><meta charset="utf-8"><title>Wave32 곡창 후보</title><style>body{font:16px sans-serif;background:#697261;color:#fff5df;margin:24px}a{color:#fff5df}ul{display:flex;flex-wrap:wrap;gap:18px;padding:0}li{display:block;width:210px;overflow-wrap:anywhere}.state{position:relative;display:block;width:160px;height:144px}.state img{position:absolute;left:0;top:0}.proof{width:min(100%,1100px)}</style><h1>Wave32 곡창 후보 26장</h1><p>게임 미설치 · 기본형3 + 상태18 + 소품5</p><p><a href="generation-records.csv">CSV26행</a> · <a href="QA.md">검수표</a></p>';
for(const p of ['01-city-repetition','02-variants-states'])html+='<p><a href="proofs/'+p+'.jpg"><img class="proof" src="proofs/'+p+'.jpg"></a></p>';
for(const family of ['a','b','c','shared']){html+='<h2>'+family+'</h2><ul>';for(const a of assets.filter(a=>a.variant===family)){const base='assets/granary_'+family+'-v1.png';html+='<li><a href="'+a.file+'"><span class="state">'+(family==='shared'?'':'<img src="'+base+'">')+((a.state==='base')?'':'<img src="'+a.file+'">')+'</span>'+esc(a.id)+'</a>'+(a.coverage?'<p>눈 '+a.coverage.percent.toFixed(2)+'%</p>':'')+'</li>';}html+='</ul>';}
fs.writeFileSync(R+'/gallery.html',html+'</html>');
fs.mkdirSync(dest,{recursive:true});for(const dir of ['assets','proofs','references','records','scripts'])for(const p of walk(R+'/'+dir)){const rel=path.relative(R,p);if(p.endsWith('package-result.json')||/bases-progress\.png$/.test(p))continue;const out=dest+'/'+rel;fs.mkdirSync(path.dirname(out),{recursive:true});fs.copyFileSync(p,out);}for(const f of ['README.md','QA.md','PLAN.md','gallery.html','generation-records.csv'])fs.copyFileSync(R+'/'+f,dest+'/'+f);
const files=walk(dest).sort();fs.writeFileSync(dest+'/SHA256SUMS',files.map(p=>hash(fs.readFileSync(p))+'  '+path.relative(dest,p)).join('\n')+'\n');
execFileSync('python3',['-c',`import pathlib,zipfile,hashlib,csv,io
r=pathlib.Path(${JSON.stringify(dest)})
with zipfile.ZipFile(${JSON.stringify(zip)},'w',zipfile.ZIP_DEFLATED,compresslevel=9) as z:
 for p in sorted(r.rglob('*')):
  if p.is_file():z.write(p,str(p.relative_to(r.parent)))
with zipfile.ZipFile(${JSON.stringify(zip)}) as z:
 assert z.testzip() is None
 pre='astra-wave32-candidates/'
 for line in z.read(pre+'SHA256SUMS').decode().splitlines():
  h,n=line.split('  ',1);assert hashlib.sha256(z.read(pre+n)).hexdigest()==h,n
 rows=list(csv.DictReader(io.StringIO(z.read(pre+'generation-records.csv').decode('utf-8-sig'))))
 assert len(rows)==26 and len({x['id'] for x in rows})==26
 for row in rows:assert hashlib.sha256(z.read(pre+row['file'])).hexdigest()==row['sha256']
 assert len([n for n in z.namelist() if '/assets/' in n and n.endswith('.png')])==26
 assert len([n for n in z.namelist() if '/proofs/' in n and n.endswith('.jpg')])==2
 assert len([x for x in rows if x['state']=='snow'])==3
 assert all(60<=float(x['snow_coverage_percent'])<=80 for x in rows if x['state']=='snow')
 print('CRC + all SHA256 +26assets +26CSV +2proofs +3snow PASS')`],{stdio:'inherit'});
const b=fs.readFileSync(zip),result={zip,bytes:b.length,MiB:b.length/1048576,sha256:hash(b),assets:26,proofs:2,csv_rows:26,raw_files:raws.length,raw_bytes:raws.reduce((n,r)=>n+r.bytes,0),manifest_hashes:files.length,crc:'pass',stage:dest};fs.writeFileSync(R+'/records/package-result.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result));
