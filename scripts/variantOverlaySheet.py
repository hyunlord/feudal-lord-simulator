#!/usr/bin/env python3
"""Check sheet for scripts/registerVariantOverlays.py: per house variant, the base with its vacant layer, the variant with the
unregistered layer, and the variant with the registered layer. Usage: python3 scripts/variantOverlaySheet.py <out.jpg>"""
import json, sys
from pathlib import Path
from PIL import Image, ImageDraw
ROOT=Path('.')
text=Path('src/render/buildingVariantOverlay.generated.ts').read_text()
rows=json.JSONDecoder().raw_decode(text[text.index('= [')+2:])[0]
def man(p):
    t=Path(p).read_text(); return json.JSONDecoder().raw_decode(t[t.index('= [')+2:])[0]
singles=man('src/render/historicalHouseAssetManifest.generated.ts'); pairs=man('src/render/houseCompoundAssetManifest.generated.ts')
metas={m['url']:m for m in singles+pairs}
cell=260; out=Image.new('RGBA',(cell*3, cell*len(rows)),(170,170,170,255))
for i,r in enumerate(rows):
    meta=metas[r['baseUrl']]; v=Image.open('public/'+r['url']).convert('RGBA'); W,H=v.size; k=W/meta['width']
    stem=Path(meta['url']).stem.rsplit('-v',1)[0]
    cond=Image.open(f'public/assets/phase16-house-condition/{stem}-vacant-v1.png').convert('RGBA').resize((W,H))
    base=Image.open('public/'+meta['url']).convert('RGBA').resize((W,H))
    b1=base.copy(); b1.alpha_composite(cond)
    # transformed layer: variant = s*base + d (derivative px: d*k)
    s=r['scale']; layer=cond.resize((round(W*s),round(H*s)))
    v2=v.copy()
    canvas=Image.new('RGBA',(W*3,H*3)); canvas.alpha_composite(layer,(W+round(r['dx']*k),H+round(r['dy']*k))); tmp=canvas.crop((W,H,2*W,2*H))
    v2.alpha_composite(tmp)
    raw=v.copy(); raw.alpha_composite(cond)
    for j,im in enumerate([b1, raw, v2]):
        sc=cell/max(W,H); out.alpha_composite(im.resize((int(W*sc),int(H*sc))),(j*cell,i*cell))
    ImageDraw.Draw(out).text((4,i*cell+4), f"{Path(r['url']).stem} s={s} iou={r['roofIou']}", fill=(0,0,0,255))
out.convert('RGB').save(sys.argv[1], quality=72)
