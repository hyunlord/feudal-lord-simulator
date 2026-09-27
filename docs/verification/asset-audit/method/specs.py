"""ASSET-1 C: manifest / records spec vs actual canvas and alpha bounds; derivative and DPR copies; naming."""
import csv, glob, json, os, re, collections
import numpy as np
from PIL import Image
from tsjson import ts_consts
W = '../a1trunk'
H = {r['path']: r for r in json.load(open('hashes.json'))['files']}
ROWS = []  # (type, severity, path, detail, source)
CHECKED = collections.Counter()
def add(t, sev, path, detail, src): ROWS.append({'type': t, 'severity': sev, 'path': path, 'detail': detail, 'declared_in': src})

_bb = {}
def bbox(path, frame=None, thr=128):
    key = (path, frame, thr)
    if key in _bb: return _bb[key]
    a = np.asarray(Image.open(os.path.join(W, path)).convert('RGBA'))[..., 3]
    if frame: a = a[frame[1]:frame[1] + frame[3], frame[0]:frame[0] + frame[2]]
    nz = np.argwhere(a >= thr)
    r = None if not len(nz) else (int(nz[:, 1].min()), int(nz[:, 0].min()), int(nz[:, 1].max()) + 1, int(nz[:, 0].max()) + 1)
    _bb[key] = r; return r

def norm(u):
    if u.startswith('assets-inbox/') or u.startswith('public/'): return u
    if u.lstrip('/').startswith('assets/'): return 'public/' + u.lstrip('/')
    return None

DER = {('public/' + d['url']): d for d in ts_consts(W + '/src/render/runtimeAssetDerivatives.generated.ts')['runtimeAssetDerivatives']}
# derivative table vs actual
for p, d in DER.items():
    h = H.get(p)
    if not h: add('파생 대장: 파일 없음', 'high', p, 'runtimeAssetDerivatives lists it', 'src/render/runtimeAssetDerivatives.generated.ts'); continue
    if (h.get('w'), h.get('h')) != (d['width'], d['height']):
        add('파생 대장: 크기 불일치', 'high', p, f"declared {d['width']}x{d['height']}, actual {h.get('w')}x{h.get('h')}", 'src/render/runtimeAssetDerivatives.generated.ts')
    if h['sha'] != d['sha256']:
        add('파생 대장: SHA 불일치', 'high', p, f"declared {d['sha256'][:12]}, actual {h['sha'][:12]}", 'src/render/runtimeAssetDerivatives.generated.ts')

def check_entry(src, key, e, path):
    h = H.get(path)
    if not h or 'w' not in h: return
    dw, dh = e.get('width'), e.get('height')
    if not isinstance(dw, (int, float)) or not isinstance(dh, (int, float)): return
    CHECKED['manifest size'] += 1
    exp = (dw, dh); why = ''
    if path in DER:
        d = DER[path]
        if (dw, dh) == (d['originalWidth'], d['originalHeight']): exp = (d['width'], d['height']); why = ' (declared = original, runtime is the scripted downscale)'
    # sourceScale (UI frames): declared size is the file's own pixel size; the frame is drawn at 1/sourceScale
    if (h['w'], h['h']) != tuple(int(round(x)) for x in exp):
        add('규격: 캔버스 크기 불일치', 'high', path, f"{key}: declared {dw}x{dh}{why}, actual {h['w']}x{h['h']}", src)
        return
    s = h['w'] / dw  # declared -> actual pixels
    frame = None; fr = e.get('frames')
    if isinstance(fr, dict) and fr.get('width'):
        frame = (0, 0, int(fr['width'] * s), int(fr['height'] * s))
    piv = e.get('pivot') or e.get('anchor')
    if isinstance(piv, dict) and 'x' in piv and not piv.get('overlay'):
        px, py = piv['x'], piv['y']
        CHECKED['manifest pivot'] += 1
        W_, H_ = (fr['width'], fr['height']) if frame else (dw, dh)
        if not (0 <= px <= W_ and 0 <= py <= H_):
            add('규격: 피벗이 캔버스 밖', 'high', path, f'{key}: pivot ({px},{py}) canvas {W_}x{H_}', src); return
        b = bbox(path, frame)
        if b is None: return
        x0, y0, x1, y1 = [v / s for v in b]
        if px < x0 - 2 or px > x1 + 2:
            add('규격: 피벗이 그림 좌우 밖', 'medium', path, f'{key}: pivot x {px} vs alpha(>=128) x {x0:.0f}–{x1:.0f}', src)
        if py > y1 + 0.25 * H_:
            add('규격: 피벗이 그림 바닥보다 한참 아래', 'medium', path, f'{key}: pivot y {py} vs alpha bottom {y1:.0f} (canvas h {H_})', src)
        elif py < y0 - 2:
            add('규격: 피벗이 그림 위쪽 밖', 'low', path, f'{key}: pivot y {py} vs alpha top {y0:.0f}', src)
    gb = e.get('groundAnchor')
    if isinstance(gb, dict) and 'x' in gb:
        b = bbox(path)
        if b is not None:
            px, py = gb['x'] * h['w'], gb['y'] * h['h']
            if not (b[0] - 2 <= px <= b[2] + 2 and b[1] - 2 <= py <= b[3] + 2):
                add('규격: 지면 기준점이 그림 밖', 'medium', path, f'{key}: groundAnchor ({gb["x"]},{gb["y"]}) vs alpha bbox {b}', src)
    ab = e.get('alphaBounds') or (e.get('alpha') if isinstance(e.get('alpha'), dict) else None)
    if isinstance(ab, dict) and 'width' in ab:
        thr = 8 if 'alphaBounds' in e else 128
        CHECKED['manifest alpha bounds'] += 1
        b = bbox(path, None, thr)
        if b is not None:
            ax0, ay0, ax1, ay1 = [v / s for v in b]
            tol = max(2.0, 1.5 / s)
            dx = max(abs(ax0 - ab['x']), abs(ay0 - ab['y']), abs(ax1 - (ab['x'] + ab['width'])), abs(ay1 - (ab['y'] + ab['height'])))
            if dx > tol:
                add('규격: 알파 바운딩 표기 불일치', 'medium', path, f"{key}: declared {ab['x']},{ab['y']},{ab['width']}x{ab['height']} vs actual(alpha>={thr}) {ax0:.0f},{ay0:.0f},{ax1-ax0:.0f}x{ay1-ay0:.0f} (max diff {dx:.1f} declared px)", src)

def walk(src, v, key=''):
    if isinstance(v, dict):
        u = v.get('url') or v.get('path')
        if isinstance(u, str) and re.search(r'\.(png|jpe?g)$', u):
            p = norm(u)
            if p: check_entry(src, key, v, p)
        for k, x in v.items(): walk(src, x, k if not isinstance(x, (dict, list)) or key == '' else f'{key}.{k}')
    elif isinstance(v, list):
        for x in v: walk(src, x, key)

for gp in sorted(glob.glob(W + '/src/**/*.generated.ts', recursive=True)):
    rel = os.path.relpath(gp, W)
    if rel.endswith('runtimeAssetDerivatives.generated.ts'): continue
    for name, val in ts_consts(gp).items():
        if isinstance(val, tuple): continue
        if name == 'BUILDING_SPRITE_ALPHA':
            for k, e in val.items():
                m = re.search(r'BUILDING_SPRITE_ALPHA[\s\S]*?\b' + k + r':[^\n]*//\s*(\S+)', open(gp).read())
                if m: check_entry(rel, k, e, norm(m.group(1)))
            continue
        walk(rel, val)
for jp in sorted(glob.glob(W + '/public/assets/**/*.json', recursive=True)):
    rel = os.path.relpath(jp, W); d = os.path.dirname(rel)
    data = json.load(open(jp))
    items = data if isinstance(data, list) else data.get('assets', [])
    for e in items:
        if not isinstance(e, dict): continue
        u = e.get('url') or e.get('path') or e.get('file') or e.get('filename')
        if not isinstance(u, str): continue
        p = norm(u) or (d + '/' + u)
        if 'originalCanvas' in e: continue  # registration coordinates are in the original canvas
        check_entry(rel, e.get('key') or e.get('assetId') or os.path.basename(u), e, p)

# UI manifest DPR / size copies
ui = ts_consts(W + '/src/ui/uiArtManifest.generated.ts')['UI_ART_MANIFEST']
sizesets = collections.Counter(tuple(sorted(v['sizes'])) for v in ui['iconSheets'].values())
common = sizesets.most_common(1)[0][0]
for k, v in ui['iconSheets'].items():
    if tuple(sorted(v['sizes'])) != common:
        add('DPR·크기 파생: 아이콘 크기 세트 누락', 'medium', 'public/' + v['sizes'][max(v['sizes'], key=int)]['url'], f'{k}: sizes {sorted(v["sizes"], key=int)} vs usual {list(common)}', 'src/ui/uiArtManifest.generated.ts')
    n = len(v['cells'])
    for sz, s in v['sizes'].items():
        p = 'public/' + s['url']; h = H.get(p)
        if not h: add('DPR·크기 파생: 파일 없음', 'high', p, f'{k} size {sz}', 'src/ui/uiArtManifest.generated.ts'); continue
        if h['h'] != int(sz) or h['w'] not in (int(sz) * n,):
            add('DPR·크기 파생: 크기 불일치', 'medium', p, f'{k} size {sz}: expected {int(sz)*n}x{sz} ({n} cells), actual {h["w"]}x{h["h"]}', 'src/ui/uiArtManifest.generated.ts')
for grp in ('cursors', 'portraits'):
    for k, v in ui[grp].items():
        x1, x2 = v.get('x1'), v.get('x2')
        if not x1 or not x2:
            add('DPR·크기 파생: 1x/2x 한쪽 없음', 'high', k, f'{grp}.{k}: x1={bool(x1)} x2={bool(x2)}', 'src/ui/uiArtManifest.generated.ts'); continue
        h1, h2 = H.get('public/' + x1['url']), H.get('public/' + x2['url'])
        if not h1 or not h2:
            add('DPR·크기 파생: 파일 없음', 'high', x1['url'] if not h1 else x2['url'], f'{grp}.{k}', 'src/ui/uiArtManifest.generated.ts'); continue
        if (h2['w'], h2['h']) != (2 * h1['w'], 2 * h1['h']):
            add('DPR·크기 파생: 2x가 1x의 두 배가 아님', 'medium', 'public/' + x1['url'], f'{grp}.{k}: x1 {h1["w"]}x{h1["h"]}, x2 {h2["w"]}x{h2["h"]}', 'src/ui/uiArtManifest.generated.ts')
for k, v in ui['frames'].items():
    if not v.get('sourceScale'):
        add('DPR·크기 파생: 2배 원본 표기 없음', 'low', 'public/' + v['url'], f'frames.{k}: no sourceScale', 'src/ui/uiArtManifest.generated.ts')

# build-time derivative sources: declared size vs source
for gp, const in (('src/ui/portraitArtManifest.generated.ts', 'PORTRAIT_IMAGES'), ('src/ui/wave16ArtManifest.generated.ts', 'WAVE16_IMAGES'), ('src/ui/wave17ArtManifest.generated.ts', 'WAVE17_IMAGES')):
    for k, v in ts_consts(W + '/' + gp)[const].items():
        h = H.get(v['source'])
        if not h: add('빌드 파생: 원본 없음', 'high', v['source'], k, gp); continue
        if 'width' in v and (h['w'], h['h']) != (v['width'], v['height']):
            add('빌드 파생: 표기 크기 ≠ 원본 크기', 'low', v['source'], f"{k}: declared {v['width']}x{v['height']}, source {h['w']}x{h['h']} (derivative is resized at build)", gp)

# install ledger coverage
P = {p['runtimePath']: p for p in csv.DictReader(open(W + '/docs/provenance/assets.csv', encoding='utf-8'))}
for p, h in H.items():
    if p.startswith('public/assets') and p.endswith('.png') and p not in P:
        add('설치 대장: 행 없음', 'medium', p, 'no row in docs/provenance/assets.csv', 'docs/provenance/assets.csv')

# Astra records (inbox): canvas and pivot vs actual
PIV = re.compile(r'(?:pivot|foot|ground)[^0-9\-]{0,40}\(?\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)', re.I)
L = {'assets-inbox/' + r['file']: r for r in csv.DictReader(open(W + '/assets-inbox/INBOX_LEDGER.csv', encoding='utf-8'))}
for rc in sorted(glob.glob(W + '/assets-inbox/**/records/*.csv', recursive=True)):
    rel = os.path.relpath(rc, W); base = os.path.dirname(os.path.dirname(rel))
    try: rows = list(csv.DictReader(open(rc, encoding='utf-8-sig')))
    except Exception: continue
    if not rows: continue
    cols = rows[0].keys()
    fcol = next((c for c in ('file', 'runtimePath', 'base_file') if c in cols), None)
    wcol = next((c for c in ('width', 'canvas_width', 'canvas_w') if c in cols), None)
    hcol = next((c for c in ('height', 'canvas_height', 'canvas_h') if c in cols), None)
    if not fcol or not wcol: continue
    for r in rows:
        f = (r.get(fcol) or '').strip()
        if not f.endswith('.png'): continue
        path = f if f.startswith('assets-inbox/') else base + '/' + f
        if path not in H or path not in L or L[path]['status'] not in ('confirmed', 'candidate'): continue
        h = H[path]
        try: dw, dh = int(float(r[wcol])), int(float(r[hcol]))
        except Exception: continue
        CHECKED['records size'] += 1
        if (h['w'], h['h']) != (dw, dh):
            add('규격(Astra 기록): 캔버스 크기 불일치', 'high', path, f'records {dw}x{dh}, actual {h["w"]}x{h["h"]}', rel); continue
        px = py = None
        if 'pivot_x' in cols and r.get('pivot_x', '').strip() not in ('', 'n/a'):
            try: px, py = float(r['pivot_x']), float(r['pivot_y'])
            except Exception: pass
        else:
            for c in ('pivot_or_attachment', 'canvas_pivot', 'pivot_contract'):
                raw = (r.get(c) or '').strip()
                try:
                    j = json.loads(raw)
                except Exception:
                    j = None
                if isinstance(j, dict):
                    g = j.get('suggestedGroundAnchor') or j.get('groundAnchor') or j.get('ground_anchor')
                    pv = j.get('pivot')
                    if isinstance(g, list) and len(g) == 2: px, py = float(g[0]), float(g[1]); break
                    if isinstance(pv, list) and len(pv) == 2 and pv != [0, 0]: px, py = float(pv[0]), float(pv[1]); break
                    if isinstance(pv, dict) and 'x' in pv: px, py = float(pv['x']), float(pv['y']); break
                    continue
                m = PIV.search(raw)
                if m: px, py = float(m.group(1)), float(m.group(2)); break
        if px is None or (px == 0 and py == 0): continue  # (0,0) = top-left registration (UI frames, overlays)
        if re.search(r'/(active|overlay|overlays|event|fx)/', path) or (r.get('kind') or '').strip() == 'active':
            continue  # overlays carry the host's registration, not their own
        if (r.get('pivot_units') or '').strip() not in ('', 'px', 'pixels', 'native_px', 'source_px'):
            continue
        CHECKED['records pivot'] += 1
        if not (0 <= px <= dw and 0 <= py <= dh):
            add('규격(Astra 기록): 피벗이 캔버스 밖', 'medium', path, f'pivot ({px:g},{py:g}) canvas {dw}x{dh}', rel); continue
        b = bbox(path)
        if b is None: continue
        if px < b[0] - 2 or px > b[2] + 2:
            add('규격(Astra 기록): 피벗이 그림 좌우 밖', 'medium', path, f'pivot x {px:g} vs alpha x {b[0]}–{b[2]}', rel)
        if py > b[3] + 0.25 * dh:
            add('규격(Astra 기록): 피벗이 그림 바닥보다 한참 아래', 'medium', path, f'pivot y {py:g} vs alpha bottom {b[3]} (h {dh})', rel)

# naming (repository convention; no written rule): lower-case ascii, [a-z0-9_], optional -v<N>, optional -<px>
NAME_OK = re.compile(r'^[a-z0-9]+(?:_[a-z0-9]+)*(?:-(?:v\d+|\d+|active-v\d+|neglected-v\d+|strained-v\d+|vacant-v\d+))?\.png$')
for p, h in H.items():
    if not p.endswith('.png'): continue
    if not (p.startswith('public/assets') or (p in L and L[p]['status'] == 'confirmed' and '/proofs/' not in p and '/records/' not in p)): continue
    b = os.path.basename(p)
    if NAME_OK.match(b): continue
    why = []
    if re.search(r'[A-Z]', b): why.append('대문자')
    if re.search(r'[^A-Za-z0-9_.\-]', b): why.append('허용 밖 문자')
    if b.count('-') > 1 or re.search(r'-(?!v\d+\.png$|\d+\.png$)', b): why.append("'-'가 버전·크기 접미 밖에 쓰임")
    if not why: why.append('관례 밖 형식')
    add('이름 규칙', 'low', p, ', '.join(why), '저장소 관례')

json.dump(ROWS, open('spec_rows.json', 'w'), ensure_ascii=False)
json.dump(CHECKED, open('spec_checked.json', 'w'))
print(dict(CHECKED))
c = collections.Counter((r['type'], r['path'].startswith('public/')) for r in ROWS)
for k, v in sorted(c.items()): print(v, *k)
