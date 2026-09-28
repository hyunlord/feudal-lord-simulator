# Wave 24 alpha cleanup (processed-20260928): pixels with alpha < 8 become RGBA (0,0,0,0); every other pixel is
# unchanged. Inputs are Astra's delivered PNGs (sha checked by the caller); output PNGs carry no ancillary chunks.
import hashlib, json, sys
import numpy as np
from PIL import Image
rows = []
for src, dst in zip(sys.argv[1::2], sys.argv[2::2]):
    image = Image.open(src); assert image.mode == 'RGBA', (src, image.mode)
    a = np.array(image); low = a[..., 3] < 8
    changed = int((low & a.any(-1)).sum())
    a[low] = 0
    Image.fromarray(a, 'RGBA').save(dst, optimize=True)
    b = np.array(Image.open(dst)); assert (b[~low] == np.array(image)[~low]).all() and not b[low].any()
    rows.append({'file': dst.split('/')[-1], 'size': list(image.size), 'alpha_below_8': int(low.sum()), 'changed_pixels': changed,
                 'sha256_in': hashlib.sha256(open(src, 'rb').read()).hexdigest(), 'sha256_out': hashlib.sha256(open(dst, 'rb').read()).hexdigest()})
print(json.dumps(rows, indent=1))
