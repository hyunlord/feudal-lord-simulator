"""ASSET-1 B: the art that goes on the eight sheets (runtime + confirmed inbox art, one entry per distinct picture)."""
import csv, json, os, re, collections
W = '../a1trunk'
H = {r['path']: r for r in json.load(open('hashes.json'))['files']}
D = json.load(open('reconcile.json'))
L = {'assets-inbox/' + r['file']: r for r in csv.DictReader(open(W + '/assets-inbox/INBOX_LEDGER.csv', encoding='utf-8'))}
PROOF = re.compile(r'(^|/)(proofs?|checks?|qa|contact[^/]*|previews?|records?|superseded|pilot)(/|$)|contact|comparison|_proof|preview', re.I)
SKIP_INBOX = re.compile(r'(walker-pilot2/.*/(masters|templates/cells)/|walker-pilot2/.*/templates/P\d(_\w+)?\.png$|_(96|128)\.png$|/original-assets/|asset-trial/)')
SKIP_RT = re.compile(r'(ui-p0/icons/.*-\d+\.png$|ui-p0/cursors/.*-32\.png$|ui-p0/portraits/.*-96\.png$)')

CATS = [
    ('C6', r'advisor_portrait_frame'),
    ('C3', r'market_bread_basket'),
    ('C7', r'(portrait-pool/|/portraits/|advisor_steward_portrait)'),
    ('C8', r'(keyart|loading_13\d\d|wave16/|/illustration/|/illustration$|scenes_(build|events|people)/|chapter\d_)'),
    ('C6', r'(ui-p0/|public/assets/ui/|runtime-icons-v1|wave8/[^/]+/assets/(icons|frames|ornaments|time)/|wave8/(icons|frames|ornaments|time)/|wave12/[^/]+/assets/icons/|wave14/|wave3/[^/]+/assets/icons/|wave19/)'),
    ('C5', r'(/fx/|effect_|smoke|fire_|burst|dust_puff|plus_float|snowfall|falling_leaves|rain_streak)'),
    ('C4', r'(historical-wall|historical-gate|historical-palisade|/wall/|stone_wall)'),
    ('C3', r'(/pile/|/props?/|/loads/|cart_load|/signifier/|/marker/|/site/|visibility-v1/construction|wave6/[^/]+/assets/construction|walker-props|held_|/work/|/yard/|haycock|/pack/|empty_granary|scroll_royal|bier_shroud|leaving_child|refugee_(bundle|child))'),
    ('C2', r'(walkers-v2|runtime-actors-v1|/workers?/|/wk/|/walker/|wave9/candidates-20260925/assets/wk_|/actors/|derived-templates|walker-pilot2/[^/]+/assets/(templates/masters|workers)/|/animal|/herd/|/cart/|/rider/|zones/animals|overlay_cloak|/overlays/)'),
    ('C1', r'(buildings/|phase16-house-condition|/bld/|/active/|wave2/|l1-tile|farmstead|wave20/|/kit_|/construction/|/overlay/|/event/|runtime-construction-v1|/pasture/|/season/roof_snow)'),
    ('C4', r'(boundary/|/fields?/|foliage|/road/|/shore/|terrain|/water/|/module/|water-bridges|phase16-landscape|/orchard/|/season/|/zones/|zones/|/decal/|yards/|/fence/|/garden/|/ground/|/tree/)'),
]
CATS = [(c, re.compile(p)) for c, p in CATS]
def category(p):
    for c, rx in CATS:
        if rx.search(p): return c
    return None

def wave_of_row(r): return r['wave']
items = []; seen_px = set()
rt = [r for r in D['rows'] if r['surface'] == 'public/assets' and r['path'].endswith('.png')]
for r in rt:
    p = r['path']
    if SKIP_RT.search(p): continue
    h = H[p]; seen_px.add(h.get('psha'))
    lf = [x for x in (r.get('ledger_files') or '').split('; ') if x]
    wave = lf[0].split('/')[0] if lf else '장부 밖'
    items.append({'path': p, 'wave': wave, 'state': '설치', 'ledger': r.get('ledger_status') or '장부 밖', 'ledger_file': lf[0] if lf else ''})
    for x in lf: seen_px.add(H.get('assets-inbox/' + x, {}).get('psha'))
deriv_src = {src for _, src, _ in D['deriv']}
for p, row in sorted(L.items()):
    if not p.endswith('.png') or PROOF.search(row['file']) or SKIP_INBOX.search(p): continue
    if row['status'] != 'confirmed' and p not in deriv_src: continue
    h = H.get(p)
    if not h or h.get('psha') in seen_px: continue
    seen_px.add(h.get('psha'))
    items.append({'path': p, 'wave': row['wave'], 'state': '빌드 파생(설치)' if p in deriv_src else '미설치', 'ledger': row['status'], 'ledger_file': row['file']})
for it in items: it['cat'] = category(it['path'])
json.dump(items, open('items.json', 'w'), ensure_ascii=False)
if __name__ == '__main__':
    print(len(items), collections.Counter(it['cat'] for it in items))
    print(collections.Counter((it['cat'], it['state']) for it in items))
    for it in items:
        if it['cat'] is None: print('UNASSIGNED', it['path'])
