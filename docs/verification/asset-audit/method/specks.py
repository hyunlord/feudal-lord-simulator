"""Semi-transparent residue: tiny isolated specks (<=6 px, no pixel >=128, more than 2 px from the body)."""
import json, os, sys
from multiprocessing import Pool
import numpy as np
from PIL import Image
from scipy import ndimage
W = '../a1trunk'
def one(rel):
    A = np.asarray(Image.open(os.path.join(W, rel)).convert('RGBA'))[..., 3]
    body = A >= 128
    if not body.any() or (A == 255).all(): return {'path': rel, 'specks': 0, 'speck_px': 0}
    lab, n = ndimage.label(A > 0, structure=np.ones((3, 3)))
    if n == 0: return {'path': rel, 'specks': 0, 'speck_px': 0}
    idx = np.arange(1, n + 1)
    size = ndimage.sum(np.ones_like(A, dtype=np.int32), lab, idx)
    amax = ndimage.maximum(A, lab, idx)
    far = ndimage.distance_transform_edt(~body) > 2
    farmin = ndimage.minimum(far.astype(np.int8), lab, idx)  # 1 if every pixel of the island is far from the body
    sel = (size <= 6) & (amax < 128) & (farmin == 1)
    return {'path': rel, 'specks': int(sel.sum()), 'speck_px': int(size[sel].sum()), 'speck_max_alpha': int(amax[sel].max()) if sel.any() else 0}
if __name__ == '__main__':
    paths = json.load(open('metric_paths.json'))
    with Pool(8) as p: res = p.map(one, paths, chunksize=8)
    json.dump({r['path']: r for r in res}, open('specks.json', 'w')); print(len(res))
