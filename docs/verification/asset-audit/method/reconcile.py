"""ASSET-1 A: classify every runtime file against INBOX_LEDGER.csv and docs/provenance/assets.csv (read-only)."""
import csv, glob, json, os, re, collections
from tsjson import ts_consts
W = '../a1trunk'
H = json.load(open('hashes.json'))['files']
BY = {r['path']: r for r in H}
RT = sorted([r for r in H if r['path'].startswith('public/assets')], key=lambda r: r['path'])
INB = {r['path']: r for r in H if r['path'].startswith('assets-inbox')}
EV = {r['path']: r for r in H if r['path'].startswith('docs/asset-evidence')}
L = list(csv.DictReader(open(W + '/assets-inbox/INBOX_LEDGER.csv', encoding='utf-8')))
LBY = {'assets-inbox/' + r['file']: r for r in L}
P = list(csv.DictReader(open(W + '/docs/provenance/assets.csv', encoding='utf-8')))
PBY = {p['runtimePath']: p for p in P}

ish, inc, ipx = collections.defaultdict(list), collections.defaultdict(list), collections.defaultdict(list)
for p, r in INB.items():
    ish[r['sha']].append(p)
    inc[r.get('sha_nocabx', r['sha'])].append(p)
    if r.get('psha'): ipx[r['psha']].append(p)

def content_links(rec):
    out = []; seen = set()
    def add(p, k):
        if p not in seen: seen.add(p); out.append((p, k))
    for p in ish.get(rec['sha'], []): add(p, 'bytes')
    for p in inc.get(rec.get('sha_nocabx') or rec['sha'], []) + inc.get(rec['sha'], []): add(p, 'bytes minus caBX')
    for p in ipx.get(rec.get('psha'), []): add(p, 'pixels')
    return out

def prov_links(path):
    p = PBY.get(path)
    if not p: return []
    src = p['sourcePath']; out = []
    if src.startswith('assets-inbox/') and src in INB:
        out.append((src, 'install-ledger source (derived)'))
    elif src.startswith('docs/asset-evidence') and src in EV:
        out += [(q, 'install-ledger source = evidence copy, ' + k) for q, k in content_links(EV[src])]
    if not out and p['sourceSha256']:
        out += [(q, 'install-ledger sourceSha256') for q in ish.get(p['sourceSha256'], [])]
    return out

PRI = {'confirmed': 0, 'candidate': 1, 'rework_pending': 2, 'superseded': 3, 'retired': 4, 'rejected': 5}
VER = re.compile(r'^(.*?)[-_]v(\d+)$')
def stem_ver(path):
    b = os.path.splitext(os.path.basename(path))[0]
    m = VER.match(b)
    return (m.group(1), int(m.group(2))) if m else (b, 0)

# newer confirmed version lookup: same file stem, higher -vN, confirmed, in any wave (e.g. wave4-pilot v1 -> wave4d v2)
by_stem = collections.defaultdict(list)
for r in L:
    s, v = stem_ver(r['file']); by_stem[s].append((v, r))

def newer_confirmed(row):
    s, v = stem_ver(row['file'])
    return [r for vv, r in by_stem[s] if vv > v and r['status'] == 'confirmed']

# ---- code corpus -------------------------------------------------------------
SRC = {}
for p in glob.glob(W + '/src/**/*', recursive=True):
    if os.path.isfile(p) and p.endswith(('.ts', '.tsx', '.css', '.json')):
        SRC[os.path.relpath(p, W)] = open(p, encoding='utf-8', errors='replace').read()
for f in ('index.html', 'vite.config.ts'):
    SRC[f] = open(W + '/' + f, encoding='utf-8').read()
GEN = {k for k in SRC if k.endswith('.generated.ts')}
QUOTED = set(re.findall(r'["\']([A-Za-z0-9_.\-]+)["\']', '\n'.join(SRC.values())))

def code_ref(path):
    rel = path[len('public/'):]  # assets/...
    hits = [k for k, t in SRC.items() if rel in t]
    if hits:
        kind = 'path (generated manifest)' if all(h in GEN for h in hits) else 'path (code)'
        return kind, hits
    base = os.path.basename(path)
    hits = [k for k, t in SRC.items() if base in t]
    if hits: return 'file name (dynamic path)', hits
    stem = os.path.splitext(base)[0]
    if stem in QUOTED: return 'stem in a quoted string (template path)', []
    m = re.match(r'gate_part_(\w+?)_(nw_se|ne_sw)-v1\.png$', base)
    if m and m.group(1) in QUOTED and 'gate_part_${part}' in SRC.get('src/render/gateArtAssets.ts', ''):
        return 'template path (gateArtAssets.ts)', ['src/render/gateArtAssets.ts']
    return 'none', []

# ---- manifests -----------------------------------------------------------------
IMG = re.compile(r'\.(png|jpe?g|webp)$', re.I)
def walk_strings(v, keypath=''):
    if isinstance(v, dict):
        for k, x in v.items(): yield from walk_strings(x, k)
    elif isinstance(v, list):
        for x in v: yield from walk_strings(x, keypath)
    elif isinstance(v, str):
        yield keypath, v

MANI = collections.defaultdict(set)  # normalized path -> manifests
MANI_URLS = []  # (manifest, raw, normalized)
for jp in sorted(glob.glob(W + '/public/assets/**/*.json', recursive=True)):
    rel = os.path.relpath(jp, W); d = os.path.dirname(rel)
    for k, s in walk_strings(json.load(open(jp))):
        if not IMG.search(s): continue
        if s.startswith(('/Users/', '/tmp/', 'docs/', 'output/')) or k in ('source', 'source_directory', 'bodySource', 'sourcePath'):
            continue
        if s.startswith('public/'): n = s
        elif s.lstrip('/').startswith('assets/'): n = 'public/' + s.lstrip('/')
        else: n = d + '/' + s
        MANI[n].add(rel); MANI_URLS.append((rel, s, n))
MANIFEST_TS = sorted(set(glob.glob(W + '/src/**/*.generated.ts', recursive=True)) | {p for p in glob.glob(W + '/src/**/*anifest*.ts', recursive=True) if not p.endswith('.test.ts')})
for gp in MANIFEST_TS:
    rel = os.path.relpath(gp, W)
    for name, val in ts_consts(gp).items():
        if isinstance(val, tuple): continue
        for k, s in walk_strings(val):
            if not IMG.search(s): continue
            if s.startswith('assets-inbox/'): n = s
            elif s.startswith('public/'): n = s
            elif s.lstrip('/').startswith('assets/'): n = 'public/' + s.lstrip('/')
            else: continue
            MANI[n].add(rel); MANI_URLS.append((rel, s, n))

# build-time derivatives (served by the Vite plugin in scripts/keyartDerivatives.ts)
kd = open(W + '/scripts/keyartDerivatives.ts', encoding='utf-8').read()
DERIV = []  # (url, source, family)
CAND = re.search(r'const CANDIDATES = "([^"]+)"', kd).group(1); PLAGUE = re.search(r'const PLAGUE = "([^"]+)"', kd).group(1)
for m in re.finditer(r'source: `\$\{(CANDIDATES|PLAGUE)\}/([^`]+)`, url: "([^"]+)"', kd):
    DERIV.append(('public/' + m.group(3), (CAND if m.group(1) == 'CANDIDATES' else PLAGUE) + '/' + m.group(2), 'wave8 keyart'))
for gp, const, fam in (('src/ui/wave16ArtManifest.generated.ts', 'WAVE16_IMAGES', 'wave16 illustration'),
                       ('src/ui/wave17ArtManifest.generated.ts', 'WAVE17_IMAGES', 'wave17 illustration'),
                       ('src/ui/portraitArtManifest.generated.ts', 'PORTRAIT_IMAGES', 'portrait pool')):
    for k, v in ts_consts(W + '/' + gp)[const].items():
        DERIV.append(('public/' + v['url'], v['source'], fam))
        if 'url96' in v: DERIV.append(('public/' + v['url96'], v['source'], fam + ' 96'))
DERIV_URLS = {u for u, _, _ in DERIV}

# ---- classify runtime files -----------------------------------------------------------
CLASS = {
    'latest': 'confirmed 최신본',
    'older': 'confirmed 옛 버전 — 새 확정본(-v 번호 큼)이 장부에 있음',
    'superseded': 'superseded — 옛 버전이 runtime에 남음',
    'rejected': 'rejected — 반려본이 runtime에 있음',
    'retired': 'retired — 퇴역본이 runtime에 있음',
    'candidate': 'candidate — 판정 전 파일이 runtime에 있음',
    'rework_pending': 'rework_pending — 재작업 대기 파일이 runtime에 있음',
    'prov_only': '장부 밖 — 설치 대장에만 있음(수제·초기)',
    'none': '장부 밖 — 설치 대장에도 없음',
    'meta': '메타데이터(json·gitkeep)',
}
rows = []; linked_ledger = collections.defaultdict(list)
sha_groups = collections.defaultdict(list); px_groups = collections.defaultdict(list)
for r in RT:
    if r['path'].endswith('.png'):
        sha_groups[r['sha']].append(r['path'])
        if r.get('psha'): px_groups[r['psha']].append(r['path'])

def classify(path, rec, links, surface):
    row = {'surface': surface, 'path': path, 'bytes': rec.get('bytes', ''), 'sha256': rec.get('sha', ''),
           'width': rec.get('w', ''), 'height': rec.get('h', ''), 'caBX': rec.get('cabx', 0) if rec else ''}
    prov = PBY.get(path) or PBY.get(rec.get('_prov_key', ''))
    row['install_ledger'] = f"{prov['assetId']}@{prov['version']} ({prov['status']})" if prov else '없음'
    lrows = [(LBY[p], k) for p, k in links if p in LBY]
    for lr, k in lrows: linked_ledger[lr['file']].append((path, k))
    if lrows:
        best = min(lrows, key=lambda x: PRI.get(x[0]['status'], 9))
        st = best[0]['status']
        row['ledger_status'] = st
        row['ledger_files'] = '; '.join(sorted({x[0]['file'] for x in lrows}))[:600]
        row['ledger_statuses'] = '; '.join(sorted({x[0]['status'] for x in lrows}))
        row['match'] = '; '.join(sorted({x[1] for x in lrows}))
        if st == 'confirmed':
            newer = [n for x in lrows if x[0]['status'] == 'confirmed' for n in newer_confirmed(x[0])]
            if newer:
                row['class'] = CLASS['older']; row['note'] = 'newer confirmed: ' + '; '.join(sorted({n['file'] for n in newer}))[:300]
            else:
                row['class'] = CLASS['latest']
        else:
            row['class'] = CLASS.get(st, st)
            if st == 'superseded': row['note'] = 'replaced_by: ' + best[0]['replaced_by']
    else:
        row['ledger_status'] = ''; row['ledger_files'] = ''; row['ledger_statuses'] = ''; row['match'] = ''
        row['class'] = CLASS['prov_only'] if prov else CLASS['none']
    return row

for r in RT:
    p = r['path']
    if not p.endswith('.png'):
        row = {'surface': 'public/assets', 'path': p, 'bytes': r['bytes'], 'sha256': r['sha'], 'class': CLASS['meta'],
               'install_ledger': '', 'ledger_status': '', 'ledger_files': '', 'match': ''}
    else:
        links = content_links(r)
        if not links: links = prov_links(p)
        row = classify(p, r, links, 'public/assets')
        row['manifests'] = '; '.join(sorted(MANI.get(p, [])))
        kind, hits = code_ref(p)
        row['code_ref'] = kind; row['code_ref_files'] = '; '.join(hits[:3])
        others = [q for q in sha_groups[r['sha']] if q != p] + [q for q in px_groups.get(r.get('psha'), []) if q != p and q not in sha_groups[r['sha']]]
        row['same_content_runtime'] = '; '.join(others)
    rows.append(row)

for url, src, fam in DERIV:
    rec = dict(INB.get(src, {})); rec['_prov_key'] = src
    links = [(src, 'build-time derivative source')] if src in LBY else []
    row = classify(url, rec, links, 'build derivative (' + fam + ')')
    row['bytes'] = ''; row['sha256'] = ''; row['width'] = ''; row['height'] = ''; row['caBX'] = ''
    row['source'] = src
    row['manifests'] = '; '.join(sorted(MANI.get(src, [])))
    row['code_ref'] = 'build-time derivative (scripts/keyartDerivatives.ts)'
    rows.append(row)

json.dump({'rows': rows, 'linked_ledger': linked_ledger, 'mani_urls': MANI_URLS, 'deriv': DERIV}, open('reconcile.json', 'w'), ensure_ascii=False)
c = collections.Counter((row['surface'].split(' (')[0], row['class']) for row in rows)
for k, v in sorted(c.items()): print(v, *k)
print('code_ref:', collections.Counter(row.get('code_ref') for row in rows if row['surface'] == 'public/assets'))
