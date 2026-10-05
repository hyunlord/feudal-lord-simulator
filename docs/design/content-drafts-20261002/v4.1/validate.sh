#!/bin/sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
python3 - <<'PY'
import json,hashlib,pathlib,collections
import jsonschema
root=pathlib.Path('.')
checks=0
def check(condition,label):
 global checks
 assert condition,label
 checks+=1
for stem in ('events-v4.1','registry-v4.1'):
 schema=json.loads((root/(stem+'.schema.json')).read_text())
 jsonschema.Draft202012Validator.check_schema(schema)
 jsonschema.Draft202012Validator(schema).validate(json.loads((root/(stem+'.json')).read_text()))
 check(True,stem+' schema')
es=json.loads((root/'events-v4.1.json').read_text())
rs=json.loads((root/'registry-v4.1.json').read_text())['entries']
expected={'ck_evt_011'}|{f'ck_evt_{n:03}' for n in range(201,216)}
check({e['id'] for e in es}==expected,'exact delta IDs')
check(len(es)==len({e['id'] for e in es})==16,'unique16')
check({r['id'] for r in rs}==expected,'matching registry')
check(collections.Counter(e['category'] for e in es if e['number']>200)=={'도시':6,'자연':4,'세력':5},'category counts')
sources={s['id'] for s in json.loads((root/'contracts/sources.json').read_text())['sources']}
for e,r in zip(es,rs):
 check(e['id']==r['id'],'order')
 check(e['number']==int(e['id'].split('_')[-1]),'number/id')
 check(e['period']=='–'.join(map(str,e['years'])),'period/years')
 check(e['years']==[r['calendar']['yearMinInclusive'],r['calendar']['yearMaxInclusive']],'calendar')
 check({c['id'] for c in e['choices']}=={c['id'] for c in r['choices']},'choice IDs')
 check(not r['unsupportedFilters'],'supported filters')
 check(r['minimumEnabledConsequentialChoices']==2,'minimum2')
 check(bool(e['illustration']) and e['title'] not in ['T1','N1','F1'],'finished prose')
 if e['number']>200:
  check(set(e['history']['sourceIds'])<=sources,'source catalog')
  check(e['newEffectLinks']==[],'no R5 sneaked in')
  for path in r['recurrence']['contextFields']:
   check(path.startswith('bound.') and path.split('.')[1] in r['bindings'],'bound context exists')
  for c in e['choices']:
   check(bool(c['tradeoff']) and bool(c['costAxes']),'cost exists')
for key,name in [('events','events-v4.1.json'),('registry','registry-v4.1.json')]:
 check(hashlib.sha256((root/name).read_bytes()).hexdigest()==json.loads((root/'proofs/FINAL_SUMMARY.json').read_text())['inputSHA256'][key],'actual runtime evidence input '+key)
summary=json.loads((root/'proofs/FINAL_SUMMARY.json').read_text())
for key in ['commandFailures','recurrenceFailures','windowFails','newBoundaryFailures']:
 check(summary[key]==[],'runtime failures '+key)
print(json.dumps({'schemas':2,'structural_assertions':checks,'result':'PASS'},ensure_ascii=False))
if (root/'SHA256SUMS').exists():
 count=0
 for row in (root/'SHA256SUMS').read_text().splitlines():
  sha,path=row.split('  ',1)
  assert hashlib.sha256((root/path).read_bytes()).hexdigest()==sha,path
  count+=1
 print(json.dumps({'sha256_files':count,'result':'PASS'}))
PY
