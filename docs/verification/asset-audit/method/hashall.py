"""Hash every runtime file (public/assets) and every inbox PNG: file sha, caBX-stripped sha, pixel sha, chunks, size."""
import hashlib, json, os, struct, subprocess, sys, zlib
from multiprocessing import Pool
from PIL import Image
import numpy as np

W = sys.argv[1]
OUT = sys.argv[2]

def chunks(b):
    if b[:8] != b'\x89PNG\r\n\x1a\n':
        return None
    out = []; i = 8
    while i + 8 <= len(b):
        n = struct.unpack('>I', b[i:i+4])[0]; t = b[i+4:i+8].decode('latin1')
        out.append((t, i, n)); i += 12 + n
        if t == 'IEND': break
    return out

def strip_cabx(b, ch):
    parts = [b[:8]]
    for t, i, n in ch:
        if t != 'caBX':
            parts.append(b[i:i+12+n])
    return b''.join(parts)

def one(rel):
    p = os.path.join(W, rel)
    b = open(p, 'rb').read()
    r = {'path': rel, 'bytes': len(b), 'sha': hashlib.sha256(b).hexdigest()}
    if not rel.lower().endswith('.png'):
        return r
    ch = chunks(b)
    if ch is None:
        r['notpng'] = True
        r['head'] = b[:40].decode('latin1', 'replace')
        return r
    names = [t for t, _, _ in ch]
    r['chunks'] = sorted(set(names))
    r['cabx'] = names.count('caBX')
    r['sha_nocabx'] = hashlib.sha256(strip_cabx(b, ch)).hexdigest() if r['cabx'] else r['sha']
    try:
        im = Image.open(p); im.load()
        r['w'], r['h'], r['mode'] = im.width, im.height, im.mode
        a = np.asarray(im.convert('RGBA'))
        r['psha'] = hashlib.sha256(a.tobytes() + struct.pack('>II', im.width, im.height)).hexdigest()
        al = a[:, :, 3]
        r['alpha_min'] = int(al.min()); r['alpha_max'] = int(al.max())
        nz = np.argwhere(al > 0)
        if len(nz):
            y0, x0 = nz.min(0); y1, x1 = nz.max(0)
            r['bbox0'] = [int(x0), int(y0), int(x1 - x0 + 1), int(y1 - y0 + 1)]
        nz = np.argwhere(al >= 128)
        if len(nz):
            y0, x0 = nz.min(0); y1, x1 = nz.max(0)
            r['bbox128'] = [int(x0), int(y0), int(x1 - x0 + 1), int(y1 - y0 + 1)]
        r['opaque_px'] = int((al == 255).sum()); r['semi_px'] = int(((al > 0) & (al < 255)).sum()); r['clear_px'] = int((al == 0).sum())
    except Exception as e:
        r['decode_error'] = str(e)
    return r

if __name__ == '__main__':
    files = subprocess.run(['git', '-C', W, 'ls-files', 'public/assets', 'assets-inbox', 'docs/asset-evidence'], capture_output=True, text=True).stdout.split('\n')
    files = [f for f in files if f and (f.startswith('public/assets') or f.lower().endswith('.png'))]
    # also untracked files under public/assets (should be none)
    untracked = subprocess.run(['git', '-C', W, 'ls-files', '--others', '--exclude-standard', 'public/assets'], capture_output=True, text=True).stdout.split()
    files += untracked
    with Pool(8) as pool:
        res = pool.map(one, files, chunksize=16)
    json.dump({'files': res, 'untracked': untracked}, open(OUT, 'w'))
    print(len(res), 'hashed;', len(untracked), 'untracked in public/assets')
