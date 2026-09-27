"""Per-image pixel metrics: halo, semi-transparent residue, emptiness, brightness/saturation/dominant colour."""
import json, os, sys, csv, re
from multiprocessing import Pool
import numpy as np
from PIL import Image
from scipy import ndimage
W = '../a1trunk'

def luma(rgb):
    return 0.2126 * rgb[..., 0] + 0.7152 * rgb[..., 1] + 0.0722 * rgb[..., 2]

def metrics(rel):
    p = os.path.join(W, rel); out = {'path': rel}
    if os.path.getsize(p) == 0:
        out['empty'] = 'zero bytes'; return out
    im = Image.open(p); im.load()
    a = np.asarray(im.convert('RGBA')).astype(np.float32)
    rgb, A = a[..., :3], a[..., 3]
    h, w = A.shape; out['w'], out['h'] = w, h
    vis = A > 0
    nvis = int(vis.sum()); out['visible_px'] = nvis
    if nvis == 0: out['empty'] = 'fully transparent'; return out
    if nvis < 16: out['empty'] = f'only {nvis} visible px'
    has_alpha = bool((A < 255).any()); out['has_alpha'] = has_alpha
    # colour stats over visible pixels, alpha-weighted
    wgt = A[vis] / 255.0; px = rgb[vis]
    L = luma(px); out['bright'] = float((L * wgt).sum() / wgt.sum())
    mx = px.max(1); mn = px.min(1); sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1), 0)
    out['sat'] = float((sat * wgt).sum() / wgt.sum())
    body = A >= 128
    q = (px[A[vis] >= 128] if body.any() else px).astype(np.int32) // 32
    if len(q):
        key = q[:, 0] * 64 + q[:, 1] * 8 + q[:, 2]
        k = np.bincount(key).argmax(); sel = (px[A[vis] >= 128] if body.any() else px)[key == k]
        m = sel.mean(0).astype(int); out['dominant'] = '#%02x%02x%02x' % tuple(m); out['dominant_share'] = float((key == k).mean())
    single = bool((px.max(0) - px.min(0)).max() < 3); out['single_colour'] = single
    if not has_alpha:
        return out
    clear = A < 8
    if clear.any() and body.any():
        dist_clear = ndimage.distance_transform_edt(~clear)  # distance to nearest clear pixel
        edge = (A >= 32) & (dist_clear <= 2)
        inner = (A == 255) & (dist_clear >= 4)
        out['edge_n'], out['inner_n'] = int(edge.sum()), int(inner.sum())
        if edge.sum() >= 50 and inner.sum() >= 50:
            eL = float(luma(rgb[edge]).mean()); iL = float(luma(rgb[inner]).mean())
            out['edge_luma'], out['inner_luma'] = eL, iL
            out['halo'] = eL - iL > 40
        dist_body = ndimage.distance_transform_edt(~body)
        resid = (A > 0) & (A < 255) & (dist_body > 3)
        out['residue_px'] = int(resid.sum())
        out['faint_px'] = int(((A > 0) & (A < 16)).sum())
        # connected components of any-visible pixels not touching the main body
        lab, n = ndimage.label(A > 0)
        if n > 1:
            sizes = ndimage.sum(np.ones_like(A), lab, index=range(1, n + 1))
            bodylab = set(np.unique(lab[body])) - {0}
            stray = [int(s) for i, s in enumerate(sizes, 1) if i not in bodylab]
            out['stray_islands'] = len(stray); out['stray_px'] = int(sum(stray))
    return out

if __name__ == '__main__':
    paths = json.load(open(sys.argv[1]))
    with Pool(8) as pool:
        res = pool.map(metrics, paths, chunksize=8)
    json.dump(res, open(sys.argv[2], 'w'))
    print(len(res))
