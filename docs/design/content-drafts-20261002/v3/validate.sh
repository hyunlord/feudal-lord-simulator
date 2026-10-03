#!/bin/sh
set -eu
cd "$(dirname "$0")"
python3 - <<'PY'
import copy, json, pathlib, hashlib
from jsonschema import Draft202012Validator
p=pathlib.Path('.')
s=json.loads((p/'events-v3.schema.json').read_text());e=json.loads((p/'events-v3.json').read_text())
Draft202012Validator.check_schema(s);v=Draft202012Validator(s);v.validate(e)
expected=[2,4,8,15,19,25,28,30,31,35,37,42,46,49,59]
assert [a['number'] for a in e]==expected
assert [a['id'] for a in e]==[f'ck_evt_{n:03}' for n in expected]
assert len({a['title'] for a in e})==15
assert next(a for a in e if a['number']==31)['title']=='청지기를 갈아야 할 때'
assert next(a for a in e if a['number']==59)['title']=='직접 감독을 내려놓을 때'
assert all(len({c['id'] for c in a['choices']})==len(a['choices']) for a in e)
for a in e:
 if a['number'] in [2,37]: assert len(a['choices'])==2
for mutation in ['missing_title','wrong_condition_type','unknown_key']:
 bad=copy.deepcopy(e)
 if mutation=='missing_title':del bad[0]['title']
 elif mutation=='wrong_condition_type':bad[0]['conditions']['state']=1
 else:bad[0]['inventedField']=True
 assert list(v.iter_errors(bad)),mutation
if (p/'SHA256SUMS').exists():
 for line in (p/'SHA256SUMS').read_text().splitlines():
  expected_hash,name=line.split('  ',1)
  assert hashlib.sha256((p/name).read_bytes()).hexdigest()==expected_hash,name
print('PASS: schema, 15 IDs, titles, choice IDs, 3 malformed-input rejections, available SHA256SUMS')
PY
