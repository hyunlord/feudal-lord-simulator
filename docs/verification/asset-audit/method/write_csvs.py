"""Write runtime_reconcile.csv, confirmed_not_installed.csv, defects.csv (ASSET-1 A and C)."""
import csv, json, os, re, collections
from items import category
W = '../a1trunk'; OUT = 'out'; os.makedirs(OUT, exist_ok=True)
D = json.load(open('reconcile.json')); rows = D['rows']
H = {r['path']: r for r in json.load(open('hashes.json'))['files']}
L = list(csv.DictReader(open(W + '/assets-inbox/INBOX_LEDGER.csv', encoding='utf-8')))
M = {m['path']: m for m in json.load(open('metrics.json'))}
S = json.load(open('specks.json'))
SPEC = json.load(open('spec_rows.json'))

# ---- runtime_reconcile.csv ----
cols = ['surface', 'path', 'class', 'ledger_status', 'ledger_files', 'match', 'install_ledger', 'manifests', 'code_ref', 'code_ref_files',
        'same_content_runtime', 'caBX', 'width', 'height', 'bytes', 'sha256', 'source', 'note']
with open(f'{OUT}/runtime_reconcile.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore'); w.writeheader()
    for r in rows: w.writerow({k: r.get(k, '') for k in cols})

# ---- confirmed_not_installed.csv ----
PROOF = re.compile(r'(^|/)(proofs?|checks?|qa|contact[^/]*|previews?|records?)(/|$)|contact|comparison|_proof|preview', re.I)
LL = D['linked_ledger']
ni = [r for r in L if r['status'] == 'confirmed' and r['file'].lower().endswith('.png') and not PROOF.search(r['file']) and r['file'] not in LL]
with open(f'{OUT}/confirmed_not_installed.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f); w.writerow(['wave', 'file', 'sha256', 'installed_by', 'verdict_note'])
    for r in sorted(ni, key=lambda r: r['file']): w.writerow([r['wave'], r['file'], r['sha256'], r['installed_by'], r['verdict_note']])
json.dump([r['file'] for r in ni], open('not_installed.json', 'w'))

# ---- defects.csv ----
SURF = re.compile(r'(terrain|/shore/|/water/|/road/|/fields?/|/zones/|zones/|/decal/|/season/|/ground/|/garden/|phase16-landscape|_fill|vignette|texture|parchment|/boundary/|boundary/)')
Ls = {'assets-inbox/' + r['file']: r for r in L}
def scope(p):
    if p.startswith('public/'): return 'runtime'
    r = Ls.get(p); return f"inbox {r['status']}" if r else 'inbox'
def copies(p):
    h = H.get(p, {}); ps = h.get('psha')
    return [q for q, x in H.items() if q != p and x.get('psha') == ps and (q.startswith('public/') or q.startswith('assets-inbox/'))]
drows = []
for r in SPEC:
    drows.append({'type': r['type'], 'severity': r['severity'], 'scope': scope(r['path']), 'path': r['path'], 'detail': r['detail'], 'declared_in': r['declared_in']})
seen_px = set()
for p, m in sorted(M.items(), key=lambda kv: (not kv[0].startswith('public/'), kv[0])):
    ps = H.get(p, {}).get('psha')
    dup = ps in seen_px; seen_px.add(ps)
    if dup: continue  # report each picture once (runtime copy first)
    cp = '; '.join(copies(p))[:300]
    if m.get('empty'):
        drows.append({'type': '빈 파일', 'severity': 'high', 'scope': scope(p), 'path': p, 'detail': m['empty'], 'declared_in': '', 'same_pixels': cp})
    if m.get('halo'):
        drows.append({'type': '헤일로(가장자리 밝음)', 'severity': 'medium', 'scope': scope(p), 'path': p,
                      'detail': f"edge luma {m['edge_luma']:.0f} vs inner {m['inner_luma']:.0f} (+{m['edge_luma']-m['inner_luma']:.0f} > 40)", 'declared_in': '', 'same_pixels': cp})
    c = category(p)
    s = S.get(p, {})
    if c not in ('C5', 'C7', 'C8', None) and not SURF.search(p) and s.get('specks', 0) >= 30:
        drows.append({'type': '반투명 잔여 점', 'severity': 'low', 'scope': scope(p), 'path': p,
                      'detail': f"{s['specks']} isolated specks ({s['speck_px']} px, max alpha {s['speck_max_alpha']}) >2 px from the body", 'declared_in': '', 'same_pixels': cp})
    if m.get('single_colour'):
        drows.append({'type': '단색 그림(참고)', 'severity': 'info', 'scope': scope(p), 'path': p, 'detail': 'every visible pixel has one RGB (mask-style art, tinted in code?)', 'declared_in': '', 'same_pixels': cp})
# caBX in runtime (A4, repeated here for the defect view)
for p, h in H.items():
    if p.startswith('public/') and h.get('cabx'):
        drows.append({'type': 'C2PA caBX 청크 잔존', 'severity': 'low', 'scope': 'runtime', 'path': p, 'detail': f"{h['cabx']} caBX chunk(s), {h['bytes']} bytes", 'declared_in': ''})
SEV = {'high': 0, 'medium': 1, 'low': 2, 'info': 3}
drows.sort(key=lambda r: (SEV[r['severity']], r['type'], r['path']))
with open(f'{OUT}/defects.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['type', 'severity', 'scope', 'path', 'detail', 'declared_in', 'same_pixels'], extrasaction='ignore'); w.writeheader()
    for r in drows: w.writerow(r)
json.dump(drows, open('defect_rows.json', 'w'), ensure_ascii=False)
print(collections.Counter((r['type'], r['scope'].split(' ')[0]) for r in drows))
