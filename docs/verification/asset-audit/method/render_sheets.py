"""ASSET-1 B: eight contact sheets at game zoom 1.0 display size, with per-file brightness/saturation z-scores."""
import csv, json, os, re, math, collections, statistics
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from tsjson import ts_consts
from scales import display, front_cell, footprint_pivot, icon_cells
from groups import group_of
W = '../a1trunk'
OUT = 'out/sheets'; os.makedirs(OUT, exist_ok=True)
items = json.load(open('items.json'))
M = {m['path']: m for m in json.load(open('metrics.json'))}
FONT = '/System/Library/Fonts/AppleSDGothicNeo.ttc'
f11 = ImageFont.truetype(FONT, 11); f13 = ImageFont.truetype(FONT, 13); f18 = ImageFont.truetype(FONT, 18); f24 = ImageFont.truetype(FONT, 24)
BG = (143, 143, 138); INK = (20, 20, 20); RED = (220, 30, 30); DIAMOND = (250, 240, 170)
SHEETS = {
    'C1': ('1_buildings', '① 건물 — 주택 L0~L4·변형·시설·Wave 12·Wave 3·Wave 20·공사 단계·집 오버레이 (발판 마름모 함께)'),
    'C2': ('2_walkers_animals_carts', '② 워커(정면 SE 셀, 걸음 0) + 동물·수레·무리'),
    'C3': ('3_props_piles_loads_signs', '③ 소품·더미·적재물·기표·손에 든 물건'),
    'C4': ('4_strips_surfaces', '④ 띠·면·자연 — 도로·물가·성벽·이랑·숲 가장자리·나무·계절 지면'),
    'C5': ('5_effects', '⑤ 효과·연기·불'),
    'C6': ('6_ui_icons_24px', '⑥ UI 아이콘 24 px (셀 단위) + UI 조각(틀·질감·문장, 고정 높이 축소)'),
    'C7': ('7_portraits_96px', '⑦ 초상 96 px'),
    'C8': ('8_illustrations', '⑧ 삽화 썸네일 (폭 240 px)'),
}
WAVE_TAG = lambda w: {'장부 밖': '장부밖'}.get(w, w.replace('wave', 'W').replace('portrait-pool', '초상풀').replace('walker-pilot2', 'WP2').replace('people-pilot1', 'PP1').replace('derived-templates', '파생틀').replace('ui-p0', 'UI-P0').replace('wave4-pilot', 'W4P'))

def luma_sat(stats): return stats.get('bright'), stats.get('sat')

def zscores(cat_items):
    """z-scores inside each sub-group (masks are listed but left out of the statistics)."""
    out = {}
    for g in sorted({i['group'] for i in cat_items}):
        its = [i for i in cat_items if i['group'] == g]
        for i in its:
            m = M.get(i['path'], {})
            i['bright'] = m.get('bright'); i['sat'] = m.get('sat'); i['dominant'] = m.get('dominant')
            i['zb'] = i['zs'] = 0; i['outlier'] = False
        pop = [i for i in its if i['bright'] is not None and not i.get('nostats')]
        if len(pop) < 3: out[g] = None; continue
        mb, sb = statistics.mean(i['bright'] for i in pop), statistics.pstdev(i['bright'] for i in pop) or 1
        ms, ss = statistics.mean(i['sat'] for i in pop), statistics.pstdev(i['sat'] for i in pop) or 1
        for i in pop:
            i['zb'] = (i['bright'] - mb) / sb; i['zs'] = (i['sat'] - ms) / ss
            i['outlier'] = abs(i['zb']) > 2 or abs(i['zs']) > 2
        out[g] = (mb, sb, ms, ss, len(pop))
    return out

def short(p, n=24):
    b = os.path.splitext(os.path.basename(p))[0]
    return b if len(b) <= n else b[:n - 1] + '…'

def label_lines(it):
    tag = WAVE_TAG(it['wave'])
    st = {'설치': '', '미설치': ' 미설치', '빌드 파생(설치)': ' 빌드'}.get(it['state'], '')
    if it.get('ledger') == 'candidate': st += ' cand'
    z = []
    if abs(it.get('zb', 0)) > 2: z.append('B%+.1f' % it['zb'])
    if abs(it.get('zs', 0)) > 2: z.append('S%+.1f' % it['zs'])
    l2 = f"{tag}{st}" + (f" ×{it['display_scale']:.2f}" if it.get('display_scale') else '')
    l3 = f"B{it['bright']:.0f} S{it['sat']:.2f}" + ((' ' + ' '.join(z)) if z else '') if it.get('bright') is not None else ''
    return [short(it['path']), l2, l3]

def diamond(draw, cx, cy, fw, fh, scale_px=1.0, dashed=False):
    # footprint corners in screen px around the footprint centre (iso 64x32)
    tw, th = 64 * scale_px, 32 * scale_px
    def ts(x, y): return (cx + (x - y) * tw / 2, cy + (x + y) * th / 2)
    pts = [ts(-fw / 2, -fh / 2), ts(fw / 2, -fh / 2), ts(fw / 2, fh / 2), ts(-fw / 2, fh / 2)]
    if dashed:
        for a, b in zip(pts, pts[1:] + pts[:1]):
            n = 8
            for k in range(0, n, 2):
                p = (a[0] + (b[0] - a[0]) * k / n, a[1] + (b[1] - a[1]) * k / n); q = (a[0] + (b[0] - a[0]) * (k + 1) / n, a[1] + (b[1] - a[1]) * (k + 1) / n)
                draw.line([p, q], fill=DIAMOND, width=1)
    else:
        draw.polygon(pts, outline=DIAMOND)

def render_cell(it, cat):
    """Return (tile RGBA image, label lines) for one item."""
    p = os.path.join(W, it['path'])
    im = Image.open(p).convert('RGBA')
    note = ''
    if cat == 'C7':
        view = im.resize((96, 96), Image.LANCZOS) if im.size != (96, 96) else im
        return view, None
    if cat == 'C8':
        w = 240; h = max(1, round(im.height * w / im.width))
        return im.resize((w, h), Image.LANCZOS), None
    if cat == 'C6':
        cells = icon_cells(it, im)
        if cells is not None:
            tiles = [c.resize((24, 24), Image.LANCZOS) for c in cells]
            n = len(tiles); cols = min(n, 8); rows = math.ceil(n / cols)
            view = Image.new('RGBA', (cols * 28, rows * 28), (0, 0, 0, 0))
            for k, t in enumerate(tiles): view.alpha_composite(t, ((k % cols) * 28 + 2, (k // cols) * 28 + 2))
            return view, f'{n}셀'
        hgt = 64; w = max(1, round(im.width * hgt / im.height))
        if w > 256: w = 256; hgt = max(1, round(im.height * w / im.width))
        return im.resize((w, hgt), Image.LANCZOS), '축소'
    fc = front_cell(it, im) if cat == 'C2' else None
    if fc is not None: im = fc
    s, basis = display(it, im, cat)
    w, h = max(1, round(im.width * s)), max(1, round(im.height * s))
    view = im.resize((w, h), Image.LANCZOS)
    it['display_scale'] = s; it['scale_basis'] = basis
    if cat == 'C4' and re.search(r'public/assets/terrain/', it['path']) and (w > 240 or h > 240):
        return view.crop((0, 0, min(w, 240), min(h, 240))), '반복 무늬 240px만'
    return view, None

def pack(cells, max_w, pad=10):
    """Shelf packing with a header line whenever the group changes; cells = (w, h, payload, group)."""
    x = pad; y = pad; row_h = 0; out = []; heads = []; cur = None
    for w, h, pl, g in cells:
        if g != cur:
            if cur is not None: y += row_h + pad; row_h = 0
            x = pad; heads.append((y, g)); y += 26; cur = g
        if x + w + pad > max_w and x > pad:
            x = pad; y += row_h + pad; row_h = 0
        out.append((x, y, pl)); x += w + pad; row_h = max(row_h, h)
    return out, heads, y + row_h + pad

def build(cat):
    key, title = SHEETS[cat]
    its = [i for i in items if i['cat'] == cat]
    for i in its:
        sc = bool(M.get(i['path'], {}).get('single_colour'))
        i['group'] = group_of(i, cat, sc); i['nostats'] = sc
    stats = zscores(its)
    its.sort(key=lambda i: (i['group'], i['wave'], os.path.basename(i['path'])))
    cells = []
    for it in its:
        view, note = render_cell(it, cat)
        lines = label_lines(it)
        if note: lines[1] += ' ' + note
        extra = {}
        fp = footprint_pivot(it) if (cat == 'C1' and it['group'][0] != 4) else None
        lw = max(f11.getlength(t) for t in lines) + 14
        cw = int(max(view.width, lw, 40)) + 8
        top = 0
        if fp:
            # room for the diamond below/around the pivot
            s = it.get('display_scale', 1)
            if fp[0] == 'px':
                _, fw, fh, pvx, pvy, known = fp
                hw = (fw + fh) * 64 / 4; hh = (fw + fh) * 32 / 4
                px_, py_ = pvx * s, pvy * s
            else:
                _, fw, fh, known = fp
                hw = (fw + fh) * 64 / 4; hh = (fw + fh) * 32 / 4
                a = np.asarray(view)[..., 3]; ys, xs = np.nonzero(a >= 128)
                if len(xs): px_, py_ = (xs.min() + xs.max() + 1) / 2, ys.max() + 1 - hh
                else: px_, py_ = view.width / 2, view.height - hh
            left = max(0, hw - px_); right = max(0, px_ + hw - view.width); below = max(0, py_ + hh - view.height); above = max(0, hh - py_)
            cw = int(max(cw, view.width + left + right + 8)); top = int(above)
            extra = {'fp': (fw, fh, px_ + left + 4, py_ + above, known), 'offx': int(left) + 4, 'below': int(below)}
        chh = top + view.height + extra.get('below', 0) + 4 + 13 * 3 + 4
        cells.append((cw, chh, (it, view, lines, extra, top), it['group']))
    max_w = 2400 if cat not in ('C7',) else 2200
    header_h = 118
    place, heads, total_h = pack(cells, max_w)
    sheet = Image.new('RGB', (max_w, total_h + header_h), BG)
    d = ImageDraw.Draw(sheet)
    d.text((12, 8), title, font=f24, fill=INK)
    n_out = sum(1 for i in its if i['outlier'])
    d.text((12, 42), f'{len(its)}장 · z-score(묶음 안에서 계산) ±2 밖 {n_out}장 = 빨간 테두리 · '
                    f'라벨: 파일명 / Wave·상태 / B=알파가중 평균 밝기(0–255) S=평균 채도(0–1) · 색 네모 = 주조색', font=f13, fill=INK)
    d.text((12, 62), 'Wave: W7=wave7 … 장부밖=INBOX 장부에 없는 수제·초기 에셋 · 상태: 표시 없음=public/assets 설치, 빌드=빌드 때 파생, 미설치=확정이지만 게임에 없음, cand=판정 전', font=f13, fill=INK)
    if cat in ('C1', 'C2', 'C3', 'C4', 'C5'):
        d.text((12, 82), '크기 = 게임 줌 1.0 CSS px(설치본은 코드의 그리기 배율, 미설치는 Astra 기록 배율 → 설치된 같은 계열 → Astra 규격 원본×0.5). 라벨의 ×값 = 파일 1 px당 화면 px. 오른쪽 위 마름모 = 타일 1칸 64×32.', font=f13, fill=INK)
        diamond(d, max_w - 60, 30, 1, 1)
        d.text((max_w - 150, 50), '타일 1칸(64×32)', font=f11, fill=INK)
    if cat == 'C1':
        d.text((12, 100), '노란 마름모 = 발판(footprint). 실선 = 코드 규칙(불투명 상자 바닥 = 발판 앞 꼭짓점)·manifest 앵커·Astra 기록 피벗, 점선 = 발판 미상이라 1×1을 그림 바닥에 맞춘 추정. 오버레이 묶음은 마름모 없음', font=f13, fill=INK)
    for hy, g in heads:
        st = stats.get(g)
        txt = f"▶ {g[1]} — {sum(1 for i in its if i['group'] == g)}장" + (f" · 밝기 평균 {st[0]:.0f} (σ {st[1]:.0f}) · 채도 평균 {st[2]:.2f} (σ {st[3]:.2f})" if st else '')
        d.text((12, hy + header_h + 2), txt, font=f18, fill=INK)
    for x, y, (it, view, lines, extra, top) in place:
        y += header_h
        ox = extra.get('offx', 4)
        if 'fp' in extra:
            fw, fh, cx, cy, known = extra['fp']
            diamond(d, x + cx, y + cy, fw, fh, dashed=not known)
        sheet.paste(view.convert('RGB'), (x + ox, y + top), view)
        ly = y + top + view.height + extra.get('below', 0) + 4
        if it.get('dominant'):
            d.rectangle([x + 2, ly + 2, x + 10, ly + 10], fill=it['dominant'], outline=INK)
        for k, t in enumerate(lines):
            d.text((x + 14, ly + 13 * k), t, font=f11, fill=RED if (k == 2 and it['outlier']) else INK)
        if it['outlier']:
            cw = max(view.width + ox, max(f11.getlength(t) for t in lines) + 14) + 4
            d.rectangle([x - 3, y - 3, x + cw, ly + 13 * 3 + 2], outline=RED, width=2)
    path = f'{OUT}/{key}.jpg'
    sheet.save(path, quality=86, optimize=True, progressive=True)
    return its, path, sheet.size

if __name__ == '__main__':
    import sys
    cats = sys.argv[1:] or list(SHEETS)
    allrows = []
    for c in cats:
        its, path, size = build(c)
        print(c, path, size, os.path.getsize(path) // 1024, 'KB', sum(1 for i in its if i['outlier']), 'outliers')
        for i in its:
            allrows.append({'sheet': SHEETS[c][0], 'group': i['group'][1], 'path': i['path'], 'wave': i['wave'], 'state': i['state'], 'ledger': i.get('ledger', ''),
                            'display_scale': round(i.get('display_scale', 0), 4) if i.get('display_scale') else '', 'scale_basis': i.get('scale_basis', ''),
                            'brightness': round(i['bright'], 1) if i.get('bright') is not None else '', 'saturation': round(i['sat'], 3) if i.get('sat') is not None else '',
                            'dominant': i.get('dominant', ''), 'z_brightness': round(i.get('zb', 0), 2), 'z_saturation': round(i.get('zs', 0), 2), 'outlier': 'yes' if i.get('outlier') else ''})
    json.dump(allrows, open('sheet_rows.json', 'w'), ensure_ascii=False)
