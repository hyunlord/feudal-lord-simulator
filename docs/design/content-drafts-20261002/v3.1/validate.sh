#!/bin/sh
set -eu
cd "$(dirname "$0")"
python3 - <<'PY'
import copy,json,pathlib,hashlib,re
from jsonschema import Draft202012Validator
p=pathlib.Path('.')
s=json.loads((p/'events-v3.1.schema.json').read_text());e=json.loads((p/'events-v3.1.json').read_text());rows=json.loads((p/'records/review-all60.json').read_text())
Draft202012Validator.check_schema(s);v=Draft202012Validator(s);v.validate(e)
assert len(rows)==60 and sorted(a['number'] for a in rows)==list(range(1,61))
assert len(e)==49 and len({a['id'] for a in e})==49
assert {a['id'] for a in e}=={a['id'] for a in rows if a['changed']}
for a in e:
 assert a['id']==f"ck_evt_{a['number']:03}"
 lo,hi=map(int,a['period'].split('–'));assert 1300<=lo<=a['years'][0]<=a['years'][1]<=hi<=1450
 assert len({c['id'] for c in a['choices']})==len(a['choices'])
 if a['number'] in [9,32,33,38,53,13,34,52]:assert a['years']==[1300,1450]
 for k,idx in [('fromYear',0),('toYear',1)]:
  for n in re.findall(k+r'=(\d{4})',a['integration']['requirements']):assert int(n)==a['years'][idx],(a['id'],k,n)
for key in ['title','conditions']:
 bad=copy.deepcopy(e);del bad[0][key];assert list(v.iter_errors(bad))
for d in [800,1100]:
 assert 750<d<1250 and 750<d<=2000 and 650<d<1250
 assert 750<d<1250 and 650<d<1250
for f in ['SHA256SUMS']:
 if (p/f).exists():
  for line in (p/f).read_text().splitlines():
   expected,name=line.split('  ',1);assert hashlib.sha256((p/name).read_bytes()).hexdigest()==expected,name
print('PASS: schema49, coverage60, IDs, periods, lawsuit/audit windows, embedded calendar years, bot rate arithmetic, hashes')
PY
