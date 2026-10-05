from pathlib import Path
import json,hashlib,shutil
root=Path('/Users/rexxa/fls-astra-renderB');out=Path(__file__).resolve().parent;e=root/'.omo/evidence';draft=root/'.omo/drafts';core=Path('/Users/rexxa/fls-astra-renderB-region-core/output/art-architecture/region-core-v1/captures');before=Path('/Users/rexxa/fls-astra-renderB-region-before/output/art-architecture/region-before-v1');sha=lambda f:hashlib.file_digest(f.open('rb'),'sha256').hexdigest();load=lambda f:json.loads(f.read_text());a=load(core/'captures.json');b=load(before/'captures.json');old={v['name']:v for v in b['views']};assert len(a['views'])==18 and a['pass'] and not a['errors'];assert a['commit']=='442b71822c189a245877cc1da1af86831e19448a'
refs={}
def ref(f):return {'path':str(f),'sha256':sha(f),'bytes':f.stat().st_size}
for name in ['region-core-runtime-prep-full-freeze.json','region-before-prep-full-freeze.json','region-core-prep-source-freeze.json','region-core-prep-focused-verified.log','region-core-prep-type-final.log','region-core-prep-lint-final.log','region-core-prep-catalog.log']:refs[name]=ref(e/name)
(out/'external-evidence.json').write_text(json.dumps(refs,indent=2)+'\n')
for source,name in [(e/'region-core-runtime-prep-run.json','actual-run-original.json'),(e/'region-core-runtime-prep-pre-guard.json','remote-pre-guard.json'),(e/'region-core-runtime-prep-post-guard.json','remote-post-guard.json'),(e/'region-core-parent-check.json','parent-check.json'),(e/'region-core-candidate-commit.json','candidate-commit.json'),(e/'region-core-prep.json','static-checks-original.json'),(draft/'region-core-runtime-native-review.md','independent-native-review.md'),(draft/'region-core-runtime-native-review.json','independent-native-review.json'),(draft/'region-core-code-review.md','independent-code-review.md'),(draft/'region-before-native-review.md','baseline-native-review.md')]:shutil.copyfile(source,out/name)
rows=[]
for v in a['views']:
 w=old[v['name']];assert v['identity']==w['identity'] and v['rgbaSHA']==w['rgbaSHA']==v['repeatRgbaSHA'] and v['repeat']['pass'];rows.append({'name':v['name'],'identity':v['identity'],'fullIdentityEqual':True,'rgbaSHA256':v['rgbaSHA'],'baselineRgbaEqual':True,'repeat':v['repeat'],'errors':v['errors'],'repeatErrors':v['repeatErrors'],'beforePNG':ref(before/(v['name']+'.png')),'corePNG':ref(core/(v['name']+'.png')),'coreRepeatPNG':ref(core/'repeat'/(v['name']+'.png')),'expectedDecoded':[x for x in v['decoded'] if x['url'] in v['identity']['expectedRequests']],'expectedPainted':[x for x in v['identity']['expectedRequests'] if x in v['draws']]})
(out/'runtime-identity-index.json').write_text(json.dumps({'scope':'Actual isolated committed core442b18 vs detached fd68 baseline18; not future/main publication','beforeCaptures':ref(before/'captures.json'),'coreCaptures':ref(core/'captures.json'),'views':rows},indent=2)+'\n')
logical=[];(out/'images').mkdir(exist_ok=True)
for season,zoom,role in [('spring','z1','representative'),('spring','z06','representative'),('summer','z1','official4'),('summer','z06','official4'),('winter','z1','official4'),('winter','z06','official4')]:
 name=f'region4-chalk_downs-{season}-{zoom}';record={'view':name,'role':role}
 if name not in old or not (core/(name+'.jpg')).exists():record.update(status='PENDING_REFERENCE2',before=None,after=None,assemblyRequirement='Use actual separate before/core reference2 receipts and original browser JPEG/PNG hashes; verify full identity/RGBA/A-A before filling this slot. Never synthesize zoom or relabel another capture.')
 else:
  bf=before/(name+'.jpg');af=core/(name+'.jpg');same=bf.read_bytes()==af.read_bytes();bn='images/'+name+'-before.jpg';an=bn if same else 'images/'+name+'-core.jpg';shutil.copyfile(bf,out/bn)
  if not same:shutil.copyfile(af,out/an)
  record.update(status='ACTUAL_CORE18_PARITY',before={'stored':bn,'raw':ref(bf),'head':b['commit']},after={'stored':an,'raw':ref(af),'head':a['commit']},physicalSharing=same,sharingReason='Exact original JPEG byte equality verified' if same else 'Distinct actual JPEG originals retained',reencoded=False)
 logical.append(record)
(out/'presentation-index.json').write_text(json.dumps({'slots':logical,'completePairs':4,'pendingPairs':2,'official4Complete':False,'nativeReviewSource':'independent-native-review.md'},indent=2)+'\n')
