import collections, gzip, hashlib, json, pathlib, subprocess
ROOT=pathlib.Path('.')
REV='23d12264289538de5f6ef3ef3f36aa9257b10aba'
BASE=ROOT/'.remote-runs/engineB-tlink-audit125-23d1226/eb-tlink-audit-final'
OUT=ROOT/'.omo/evidence/tlink-inert-23d-charter.json'
sha=lambda b:hashlib.sha256(b).hexdigest()
inputs=[]
def read(p):
 b=p.read_bytes(); plain=gzip.decompress(b) if p.suffix=='.gz' else b
 inputs.append({'path':str(p),'sha256':sha(b),'decodedSha256':sha(plain)})
 return json.loads(plain)
config=read(ROOT/'.omo/evidence/final-23d-config.json')
sources=[]
for name in ['src/engine/stewardship.ts','src/engine/history.ts','src/engine/decisionTraceEstateRelations.ts','src/content/stewardshipConfig.ts','src/state/gameStore.ts','src/engine/factions.ts','src/engine/decisionTrace.ts','src/engine/decisionTraceAnswerReceipts.ts']:
 b=subprocess.check_output(['git','show',REV+':'+name]);sources.append({'path':name,'revision':REV,'sha256':sha(b),'workingBytesEqual':b==pathlib.Path(name).read_bytes()})
rows=[];counts=[]
for seed in [1,2,3]:
 d=BASE/f'seed-{seed}'; pin=next(p for p in config['replayPins'] if p['seed']==seed)
 m=read(d/'manifest.json');assert inputs[-1]['sha256']==pin['manifestSha256'];assert m['sourceRevision']==REV and m['valid'] and m['replayVerified']
 raw=read(BASE/f'seed-{seed}.json');assert inputs[-1]['sha256']==pin['rawSha256']
 ctx=read(d/'original-contexts.json.gz');assert inputs[-1]['sha256']==m['contextSha256']
 state=read(d/'original-final-state.json.gz');assert inputs[-1]['decodedSha256']==m['finalComparison']['expectedSha256']
 for p in sources: assert next(x['sha256'] for x in m['sourceFiles'] if x['path']==p['path'])==p['sha256']
 answers={a['id']:a for a in state['trace']['answers']}
 classified={a['historyId']:a for a in m['classification']['rows'] if a.get('historyId')}
 for c in ctx:
  before=c.get('context',{}).get('estateBefore');after=c.get('context',{}).get('estateAfter')
  if c['command']['type']!='answer_estate_petition' or not before or before['kind']!='charter_request' or c['command']['grant']:continue
  ident=(c.get('history') or {}).get('id');a=answers.get(ident)
  if not a:continue
  evidence=a.get('estateRelationEvidence',[])
  zero=[e for e in evidence if e['dimension']=='merchants' and e['actual']==0 and e['before']==e['after']==-100 and e['intended']==-8]
  if not zero:continue
  assert len(evidence)==1 and len(zero)==1
  assert c['stateChanged'] and before['estateId']!='estate-home' and before['status']=='open' and after['status']=='refused' and after['decidedBy']=='lord'
  assert {k:v for k,v in after.items() if k not in ['status','decidedBy']}=={k:v for k,v in before.items() if k not in ['status','decidedBy']}
  cl=classified[ident];assert cl['cameHeavyToLord'] is True
  future=[{'id':h['id'],'tick':h['tick'],'template':h['template']} for h in raw['history'] if h['kind']!='decision' and a['tick']<h['tick']<=a['tick']+12000 and any(x['decisionId']==ident for x in h.get('because',[]))]
  same=[{'id':h['id'],'tick':h['tick'],'template':h['template'],'params':h.get('params')} for h in raw['history'] if h['kind']!='decision' and h['tick']==a['tick'] and any(x['decisionId']==ident for x in h.get('because',[]))]
  rows.append({'seed':seed,'historyId':ident,'ordinal':c['ordinal'],'tick':a['tick'],'mature':a['tick']+12000<=raw['endTick'],'source':a['source'],'event':'core:charter_request','choice':'refuse','estateBefore':before,'estateAfter':after,'relationEvidence':zero[0],'futureOwnReceipts':future,'sameTickOwnReceipts':same,'domainEffectDeltas':{'merchants':0,'tenants':0,'cash':0,'neglect':False,'rights':0,'land':0,'people':0,'persistentOrders':0},'deltaProof':'merchants from retained answer-time trace evidence; other effects from exhaustively bounded frozen off-map refusal handler and unchanged petition payload, not full-state snapshots','processingChanges':['petition.status open -> refused','petition.decidedBy absent -> lord'],'processingConsumers':['removed from open petition list','no future open-petition lapse','steward.lordDecided registry counter'],'classification':'inert_domain_effect_with_processing_settlement','classificationBasis':'User explicitly excludes processing-only receipts and identifies saturated charter refusal as inert exemplar; settlement alone does not grant rights or alter standing command.'})
 counts.append({'seed':seed,'mature':sum(r['seed']==seed and r['mature'] for r in rows),'censored':sum(r['seed']==seed and not r['mature'] for r in rows)})
summary={'rows':len(rows),'mature':sum(r['mature'] for r in rows),'censored':sum(not r['mature'] for r in rows),'perSeed':counts,'actualRightMutationExcluded':0,'futureOwnReceipts':sum(bool(r['futureOwnReceipts']) for r in rows),'byEventChoice':dict(collections.Counter(r['event']+':'+r['choice'] for r in rows if r['mature']))}
assert summary['mature']==127
out={'revision':REV,'runId':'engineB-tlink-audit125-23d1226','scope':'offline verified original three-seed 125-year archive, no simulation','summary':summary,'sourcePins':sources,'inputs':inputs,'rows':rows,'limitations':['No full immediate before/after game-state snapshots were retained; only affected scalar trace evidence and petition payload are runtime-measured. Zero of other substantive fields follows exhaustive pinned handler, not absence of records.','Do not call these total GameState no-ops: settlement, history and registry counters change.','Seed17 anecdote is not part of this measured seed1-3 dataset.','No raw rights:true flag is treated as a changed right.','No future direct score modification.']}
OUT.write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n');print(json.dumps(summary,indent=2));print('outputSha256',sha(OUT.read_bytes()))
