import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';

test('Given canonical79 and catalog A/B/C When generating twice Then only48 legacy keys remain and owned bytes/ledgers survive', () => {
  const result = spawnSync('python3', ['-c', String.raw`
import importlib.util, pathlib, tempfile, shutil, json, csv, hashlib, re
root=pathlib.Path.cwd()
spec=importlib.util.spec_from_file_location('installer', root/'scripts/installWave22.py'); m=importlib.util.module_from_spec(spec); spec.loader.exec_module(m)
with tempfile.TemporaryDirectory(prefix='heath-generator-') as directory:
 t=pathlib.Path(directory); (t/'assets-inbox').mkdir(); (t/'assets-inbox/wave22').symlink_to(root/'assets-inbox/wave22',target_is_directory=True)
 (t/'docs/provenance/prompts').mkdir(parents=True); (t/'src/render/art').mkdir(parents=True); (t/'public/assets/wave22/decals').mkdir(parents=True)
 for p in ['docs/provenance/assets.csv','assets-inbox/INBOX_LEDGER.csv']: shutil.copyfile(root/p,t/p)
 catalog=json.loads((root/'src/render/art/catalog.json').read_text()); b=next(x for x in catalog if x['bundleId']=='wave22-land-decals'); a=next(x for x in b['entries'] if x['id']=='wave22-heath-patch-a')
 base_rule=next(x for x in b['rules'] if x['slot']=='land-decal-base');b['entries']=[a];b['rules']=[base_rule]
 for name,w,h in [('b',96,64),('c',128,96)]:
  e=json.loads(json.dumps(a));e['id']='fixture-'+name;e['image'].update(url='assets/wave22/decals/heath_patch_'+name+'.png',width=w,height=h);e['geometry']['pivot']={'x':w//2,'y':h-8};b['entries'].append(e)
  shutil.copyfile(root/('assets-inbox/wave22/rework-20260927/assets/decals/heath_patch_'+name+'-v1.png'),t/('public/assets/wave22/decals/heath_patch_'+name+'.png'))
 rule=json.loads(json.dumps(b['rules'][0]));rule.update(id='fixture-variant',slot='land-decal-variant',variants=[{'assetId':e['id'],'weight':1} for e in b['entries']]);b['rules'].append(rule)
 (t/'src/render/art/catalog.json').write_text(json.dumps(catalog));shutil.copyfile(root/'public/assets/wave22/decals/heath_patch_a.png',t/'public/assets/wave22/decals/heath_patch_a.png')
 m.ROOT=t;m.WAVE=t/'assets-inbox/wave22';m.BATCHES=[m.WAVE/'rework-20260927',m.WAVE/'candidates-20260927'];m.RECORDS=m.WAVE/'rework-20260927/records/assets.csv';m.ARCHETYPES=root/'src/content/scenario/archetypes.ts';m.RUNTIME=t/'public/assets/wave22';m.LEDGER=t/'docs/provenance/assets.csv';m.INBOX_LEDGER=t/'assets-inbox/INBOX_LEDGER.csv';m.MANIFEST=t/'src/render/wave22GroundManifest.generated.ts'
 def rows(p): return list(csv.DictReader(p.open()))
 arow=next(x for x in rows(m.LEDGER) if x['runtimePath']=='public/assets/wave22/decals/heath_patch_a.png');ibefore=rows(m.INBOX_LEDGER)
 hashfile=lambda p:hashlib.sha256(p.read_bytes()).hexdigest()
 for source in (root/'public/assets/wave22/terrain').glob('*.png'):
  (m.RUNTIME/'terrain').mkdir(exist_ok=True);shutil.copyfile(source,m.RUNTIME/'terrain'/source.name)
 owned={str(p.relative_to(m.RUNTIME)):hashfile(p) for p in m.RUNTIME.rglob('*.png')}
 region_rows=[x for x in rows(m.LEDGER) if x['runtimePath'].startswith('public/assets/wave22/terrain/')]

 expected={k:json.loads(v) for k,v in re.findall(r'^  "([^"]+)": (.+),$',(root/'src/render/wave22GroundManifest.generated.ts').read_text(),re.M)}
 assert len(expected)==48
 for iteration in range(2):
  m.main();actual={k:json.loads(v) for k,v in re.findall(r'^  "([^"]+)": (.+),$',m.MANIFEST.read_text(),re.M)};assert actual==expected
  assert len(actual)==48 and 'decals/heath_patch_a' not in actual
  assert next(x for x in rows(m.LEDGER) if x['runtimePath']==arow['runtimePath'])==arow
  assert all(hashfile(m.RUNTIME/key)==value for key,value in owned.items())
  assert [x for x in rows(m.LEDGER) if x['runtimePath'].startswith('public/assets/wave22/terrain/')]==region_rows
  for key,meta in actual.items(): assert hashfile(t/'public'/meta['url'])==hashfile(root/'public'/meta['url'])
  assert next(x for x in rows(m.INBOX_LEDGER) if 'heath_patch_a-v1' in x['file'])==next(x for x in ibefore if 'heath_patch_a-v1' in x['file'])
 before_bytes={p:p.read_bytes() for p in [m.LEDGER,m.INBOX_LEDGER,m.MANIFEST]}
 b['rules'][0]['conditions'].append({'field':'season','op':'eq','value':'spring'});(t/'src/render/art/catalog.json').write_text(json.dumps(catalog))
 import subprocess
 try: m.main()
 except subprocess.CalledProcessError: pass
 else: raise AssertionError('Partial-season fallback was accepted')
 assert all(p.read_bytes()==raw for p,raw in before_bytes.items())
 b['rules'][0]['conditions'].pop();region=next(x for x in catalog if x['bundleId']=='wave22-region-textures');region['rules'].pop();(t/'src/render/art/catalog.json').write_text(json.dumps(catalog))
 try: m.main()
 except subprocess.CalledProcessError: pass
 else: raise AssertionError('Partial region ownership was accepted')
 assert all(p.read_bytes()==raw for p,raw in before_bytes.items())
 print('PASS: canonical79 -> legacy48 twice; A/B/C bytes, A provenance/installation unchanged')
`], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stdout + result.stderr);
  assert.match(result.stdout, /legacy48 twice/);
});
