from pathlib import Path
import csv, hashlib, json, zipfile, html
from PIL import Image
root=Path(__file__).resolve().parents[1]
old=root.parent/'astra-wave37-candidates-20260930'
changed={'condition_prosperous_bench','trade_carpenter_a','trade_miller_a','trade_miller_b'}
entries=[]
for name in ['furniture','miller']:
 data=json.loads((root/'records'/f'{name}.json').read_text());entries.extend(data if isinstance(data,list) else data['assets'])
assert {e['id'] for e in entries}==changed
recs={e['id']:e for e in entries}
rows=list(csv.DictReader((old/'assets.csv').open()))
checks=[]
for row in rows:
 id=row['asset_id'];p=root/'assets'/f'{id}.png';im=Image.open(p);assert im.mode=='RGBA'
 assert im.size==Image.open(old/'assets'/p.name).size
 digest=hashlib.sha256(p.read_bytes()).hexdigest();same=digest==hashlib.sha256((old/'assets'/p.name).read_bytes()).hexdigest()
 assert same==(id not in changed)
 if id in changed:
  e=recs[id];row.update(sha256=digest,foot_x=e['foot_x'],foot_y=e['foot_y'],foot_method=e.get('foot_method','visual contact excluding shadow'),foot_uncertainty_px=e.get('foot_uncertainty_px',2),record='records/'+('miller' if id.startswith('trade_miller') else 'furniture')+'.json',postprocess=json.dumps(e.get('postprocess',e.get('transform','see record')),ensure_ascii=False))
 else:row['record']='references/prior-records/'+Path(row['record']).name
 row['revision']='reworked-v2' if id in changed else 'unchanged'
 checks.append({'id':id,'sha256':digest,'same_as_previous':same,'width':im.width,'height':im.height})
for filename,selected in [('assets.csv',rows),('rework.csv',[x for x in rows if x['asset_id'] in changed])]:
 with (root/filename).open('w') as f:
  w=csv.DictWriter(f,fieldnames=list(rows[0]));w.writeheader();w.writerows(selected)
(root/'qa/integrity.json').write_text(json.dumps({'changed':4,'unchanged':28,'checks':checks},indent=2))
links=['proofs/01-confusion-pairs.jpg','blind/recognition.jpg']+['assets/'+e['id']+'.png' for e in entries]
(root/'INDEX.md').write_text('# Wave37 교정 이미지\n\n'+''.join(f'- [{f}]({f})\n' for f in links))
(root/'index.html').write_text('<!doctype html><meta charset="utf-8"><title>Wave37 네 장 교정</title><style>body{background:#e4dcc4;font:16px sans-serif}img{max-width:880px}figure{display:inline-block}</style><h1>Wave37 네 장 교정 · 미설치 후보</h1><a href="REPORT.md">보고서</a><br>'+''.join(f'<figure><a href="{f}"><img src="{f}"><figcaption>{f}</figcaption></a></figure>' for f in links))
with (root/'RAW_INDEX.csv').open('w') as f:
 w=csv.writer(f);w.writerow(['path','bytes','sha256'])
 for p in sorted((root/'raw').rglob('*')):
  if p.is_file():w.writerow([str(p),p.stat().st_size,hashlib.sha256(p.read_bytes()).hexdigest()])
files=sorted(p for p in root.rglob('*') if p.is_file() and 'raw' not in p.relative_to(root).parts and '__pycache__' not in p.parts and p.name!='SHA256SUMS.txt')
(root/'SHA256SUMS.txt').write_text(''.join(hashlib.sha256(p.read_bytes()).hexdigest()+'  '+str(p.relative_to(root))+'\n' for p in files));files.append(root/'SHA256SUMS.txt')
z=Path('/tmp/astra-wave37-rework-v2-lite.zip')
with zipfile.ZipFile(z,'w',zipfile.ZIP_DEFLATED,compresslevel=9) as out:
 for p in files:out.write(p,'astra-wave37-rework-v2/'+str(p.relative_to(root)))
with zipfile.ZipFile(z) as out:assert out.testzip() is None
print(z,z.stat().st_size,hashlib.sha256(z.read_bytes()).hexdigest())
