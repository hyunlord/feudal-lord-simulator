"""Semi-transparent pixels deep inside the picture (alpha 16..239, >=4 px from any clear pixel)."""
import json, os
from multiprocessing import Pool
import numpy as np
from PIL import Image
from scipy import ndimage
W = '../a1trunk'
def one(rel):
    A = np.asarray(Image.open(os.path.join(W, rel)).convert('RGBA'))[..., 3]
    if (A == 255).all(): return rel, 0, None
    clear = A < 8
    if not clear.any(): d = np.full(A.shape, 99.0)
    else: d = ndimage.distance_transform_edt(~clear)
    m = (A >= 16) & (A <= 239) & (d >= 4)
    n = int(m.sum())
    if n == 0: return rel, 0, None
    ys, xs = np.nonzero(m)
    return rel, n, [int(xs.min()), int(ys.min()), int(xs.max()) + 1, int(ys.max()) + 1]
if __name__ == '__main__':
    paths = json.load(open('metric_paths.json'))
    with Pool(8) as p: res = p.map(one, paths, chunksize=8)
    json.dump({r[0]: {'inner_semi': r[1], 'box': r[2]} for r in res}, open('innersemi.json', 'w'))
