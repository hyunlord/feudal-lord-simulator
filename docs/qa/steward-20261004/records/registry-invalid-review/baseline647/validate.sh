#!/bin/sh
set -eu
python3 - "$0" "${1:?current source repository required}" "${2:?R01 canonical baseline directory required}" <<'PY'
import copy,hashlib,json,pathlib,re,sys
import jsonschema
p=pathlib.Path(sys.argv[1]).resolve().parent
repo=pathlib.Path(sys.argv[2]); d=json.loads((p/'variants.ko.json').read_text());basePath=pathlib.Path(sys.argv[3]);base=json.loads((basePath/'variants.ko.json').read_text())
assert hashlib.sha256((basePath/'variants.ko.json').read_bytes()).hexdigest()=='f8eb252fd54b977fc74ae31463906a7bead2bbd041c6433071d316a755a1305b'
assert all(hashlib.sha256((basePath/name).read_bytes()).hexdigest()==value for name,value in json.loads((p/'R01_BASE_MANIFEST.json').read_text()).items())
expected=copy.deepcopy(base)
expected['sourceHead']='5fb1aebfe735592c1424c947e88388d4ffe21742'
for slot in ['amountExact','amountAbsExact','amountSignedExact']: expected['slots'][slot]=d['slots'][slot]
expression=next(line.strip() for line in (repo/'src/content/historyCopy.ko.ts').read_text().splitlines() if line.strip().startswith('"ledger.season":'))
next(t for t in expected['historyTemplates'] if t['template']=='ledger.season')['sourceExpression']=expression
assert expected==d,'change outside five approved data paths'
assert 'moneyWordsFull(' in d['slots']['amountExact'] and 'moneyWordsFull(' in d['slots']['amountAbsExact'] and 'moneyWordsFullDelta(' in d['slots']['amountSignedExact']
for name,expected in json.loads((p/'SOURCE_SNAPSHOT.json').read_text()).items():
 assert hashlib.sha256((repo/name).read_bytes()).hexdigest()==expected,('source drift',name)
jsonschema.Draft202012Validator(json.loads((p/'variants.schema.json').read_text())).validate(d)
hist=d['historyTemplates']; ledger=d['ledgerCategories']; allv=[v for x in hist+ledger for v in x['variants']]
oldv={v['id']:v for x in base['historyTemplates']+base['ledgerCategories'] for v in x['variants']}; newv={v['id']:v for v in allv}
assert len(newv)==len(allv)==427
assert set(oldv)<=set(newv)
changed=[k for k in oldv if oldv[k]!=newv[k]]
assert changed==[],changed
assert newv['person.emptied.brief']['headline']=='가구가 살던 집이 비었다.'
source=(repo/'src/content/historyCopy.ko.ts').read_text()
keys=set(re.findall(r'^  "([a-z_0-9]+\.[a-z_0-9]+)":',source,re.M))
assert keys=={x['template'] for x in hist},(keys-{x['template'] for x in hist},{x['template'] for x in hist}-keys)
s=(repo/'src/ledger/ledger.types.ts').read_text().split('export const LEDGER_CATEGORIES = [',1)[1].split('] as const;',1)[0]
s=re.sub(r'//[^\n]*','',s); cats=set(re.findall(r'"([a-z_]+)"',s))
assert cats=={x['category'] for x in ledger}
for v in allv:
 slots=set(re.findall(r'\{([A-Za-z][A-Za-z0-9]*)\}',v.get('headline',v.get('text',''))))
 assert slots<=set(d['slots']),(v['id'],slots)
 if 'headline' in v: assert slots==set(v['requiredSlots']) and v['retainFactLine']
fixtures=[]
def get(ctx,path):
 for k in path.split('.'):
  if not isinstance(ctx,dict) or k not in ctx:return None
  ctx=ctx[k]
 return ctx
def matches(c,ctx):
 a=get(ctx,c['field']);b=c['value'];op=c['op']
 if a is None:return False
 if op=='eq':return a==b and type(a)==type(b)
 if op=='in':return a in b
 if not isinstance(a,(int,float)) or isinstance(a,bool):return False
 return {'gt':lambda:a>b,'gte':lambda:a>=b,'lt':lambda:a<b,'lte':lambda:a<=b}[op]()
def pick(row,ctx):
 for v in sorted(row['variants'],key=lambda x:(-x.get('priority',0),x['id'])):
  if v.get('disabled') or not all(matches(c,ctx) for c in v.get('when',[])):continue
  valid=True
  for slot in v.get('requiredSlots',[]):
   value=get(ctx,{'eventYear':'date.year','decisionCount':'params.count','termYears':'params.years'}.get(slot,'params.'+slot))
   if type(value)!=int or value<(1 if slot in ['decisionCount','termYears'] else 0):valid=False
  if valid:return v['id']
 return None
def check(row,ctx,expected,label):
 got=pick(row,ctx);assert got==expected,(label,got,expected)
 fixtures.append({'case':label,'input':ctx,'row':row.get('template',row.get('category')),'expected':expected,'actual':got})
by={r['template']:r for r in hist}
for r in hist:check(r,{},r['template']+'.brief','missing_context')
for r in hist:
 for v in r['variants']:
  if not v['when']:continue
  ctx={}
  for c in v['when']:
   a,b=c['field'].split('.');val=c['value'];op=c['op']
   if op=='in':val=val[0]
   if op=='gt':val+=1
   if op=='lt':val-=1
   ctx.setdefault(a,{})[b]=val
  for slot in v['requiredSlots']:
   a,b={'eventYear':'date.year','decisionCount':'params.count','termYears':'params.years'}.get(slot,'params.'+slot).split('.')
   ctx.setdefault(a,{}).setdefault(b,20)
  check(r,ctx,v['id'],'condition_witness')
for r in ledger:
 for account,amount,suffix in [('cash',25,'cash_in'),('cash',-25,'cash_out'),('cash',0,'other'),('restricted',25,'other'),('arrears',25,'other'),('in_kind',-25,'in_kind')]:
  expected=r['category']+'.'+suffix
  if r['category']=='instalment' and account=='arrears':expected='instalment.arrears_added'
  if newv[expected].get('disabled'):expected=None
  check(r,{'entry':{'account':account,'amount':amount}},expected,account+'_'+str(amount))
check(next(r for r in ledger if r['category']=='instalment'),{'entry':{'account':'arrears','amount':-25}},'instalment.arrears_reduced','negative_arrears_not_cash')
for template,params in [('decision.bundle',{'decisionKind':'registry'}),('decision.bundle',{'decisionKind':'registry','count':0}),('registry.term_began',{'kind':'installments'}),('registry.term_began',{'kind':'installments','years':0}),('registry.term_began',{'kind':'remission','what':'other','years':3}),('manor.petition_precedent',{'kind':'boundary','granted':1})]:
 check(by[template],{'params':params},template+'.brief','new_missing_or_wrong_context')
for template in ['registry.term_began','registry.term_ended']:
 assert all('amount' not in slot for v in by[template]['variants'] for slot in v['requiredSlots'])
assert 'paid' not in newv['registry.term_ended.installments']['headline']
sha=lambda f:hashlib.sha256(f.read_bytes()).hexdigest()
report={'status':'static_pass','sourceHead':d['sourceHead'],'candidateSha256':sha(p/'variants.ko.json'),'baseCandidateSha256':sha(basePath/'variants.ko.json'),'historyKinds':len(d['historyKinds']),'templates':len(hist),'historyVariants':sum(len(r['variants']) for r in hist),'conditionalHistoryVariants':sum(bool(v['when']) for r in hist for v in r['variants']),'ledgerCategories':len(ledger),'ledgerVariants':sum(len(r['variants']) for r in ledger),'uniqueIds':len(allv),'preservedOriginalIds':len(oldv),'changedOriginalIds':changed,'newIds':len(set(newv)-set(oldv)),'schema':'passed Draft202012Validator','sourceKeyCoverage':'exact','fixtureTotal':len(fixtures),'fixtureSelected':sum(f['actual'] is not None for f in fixtures),'fixtureBlocked':sum(f['actual'] is None for f in fixtures),'fixtureScope':'synthetic pure-data condition selection; no money, name, quantity parser or engine API execution','engineExecution':False,'render':False,'saveRestore':False,'canonicalPromoted':False,'independentReview':'pending'}
assert fixtures==json.loads((basePath/'SELECTION_FIXTURES.json').read_text()),'existing 524 selector fixtures changed'
report['approvedDataPathsOnly']=True
report['existingFixturesExactlyPreserved']=True
if (p/'MONEY_ADAPTER_VALIDATION.json').exists():
 money=json.loads((p/'MONEY_ADAPTER_VALIDATION.json').read_text())
 assert money['candidateSha256']==sha(p/'variants.ko.json')
 report['separateMoneyAdapterEvidence']={'file':'MONEY_ADAPTER_VALIDATION.json','status':money['status'],'uniqueMoneyVariantIds':money['uniqueMoneyVariantIds'],'cashVariantIds':money['cashVariantIds'],'renderedRows':money['renderedRows'],'engineExecuted':False,'browserExecuted':False}
(p/'SELECTION_FIXTURES.json').write_text(json.dumps(fixtures,ensure_ascii=False,indent=2)+'\n');(p/'VALIDATION.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n');print(json.dumps(report,ensure_ascii=False,indent=2))
PY
