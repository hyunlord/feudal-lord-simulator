# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow", "numpy"]
# ///
# Run: python3 records/tools/verify_delivery.py
"""Verify frozen images, registration metadata, seasonal alpha and city edit scope."""
from pathlib import Path
import hashlib
import json
import csv
from typing import Final
from PIL import Image, ImageChops, ImageFilter
import numpy as np
ROOT: Final=Path(__file__).resolve().parents[2]
BASE: Final=Path('/tmp/astra-landmark-growth-20261003-work')
old=json.loads((ROOT/'records/baseline-hashes.json').read_text())
changed=[]
for rel,sha in old.items():
    p=ROOT/rel
    with Image.open(p) as im:
        assert im.size==(2048,2048) and im.mode=='RGBA',rel
        alpha=np.asarray(im.getchannel('A'))
        assert alpha.max()>128 and alpha.min()==0,rel
        assert not any(np.any(side>32) for side in (alpha[0],alpha[-1],alpha[:,0],alpha[:,-1])),rel
    if hashlib.sha256(p.read_bytes()).hexdigest()!=sha:changed.append(rel)
expected={f'assets/{f}_s{s:02d}_{season}.png' for f in ('bridge','guildhall') for s in (1,2,3) for season in ('summer','winter')}
assert set(changed)==expected
assert len(list((ROOT/'assets').glob('*.png')))==44
backgrounds={season:(ROOT/'references'/f'city-background-{season}.png').read_bytes()==(BASE/'references'/f'city-background-{season}.png').read_bytes() for season in ('summer','winter')}
assert all(backgrounds.values())
scenes=[]
for year,stage in ((1300,1),(1380,2),(1450,3)):
    for season in ('summer','winter'):
        mask=Image.new('L',(1280,800))
        for root in (ROOT,BASE):
            for family,pos in (('bridge',(818,-84)),('guildhall',(133,266))):
                with Image.open(root/'assets'/f'{family}_s{stage:02d}_{season}.png') as im:
                    alpha=im.resize((512,512),Image.Resampling.LANCZOS).getchannel('A')
                layer=Image.new('L',(1280,800));layer.paste(alpha,pos);mask=ImageChops.lighter(mask,layer)
        mask=mask.point(lambda v:255 if v>0 else 0).filter(ImageFilter.MaxFilter(9))
        for zoom in (1.0,.6):
            name=f'city-{year}-{season}-zoom-{zoom:.1f}.png'
            with Image.open(ROOT/'proofs'/name) as im:new=np.asarray(im.convert('RGB'))
            with Image.open(BASE/'proofs'/name) as im:prior=np.asarray(im.convert('RGB'))
            zone=mask
            if zoom<1:
                zone=Image.new('L',(1280,800));zone.paste(mask.resize((768,480),Image.Resampling.LANCZOS),(256,160));zone=zone.filter(ImageFilter.MaxFilter(7))
            delta=np.any(new!=prior,axis=2)
            outside=int(np.logical_and(delta,np.asarray(zone)==0).sum())
            assert outside==0,(name,outside)
            scenes.append({'file':name,'changed_pixels':int(delta.sum()),'outside_target_regions':outside})
report={'passed':True,'png_count':44,'changed_png_count':len(changed),'unchanged_png_count':44-len(changed),'changed_files':changed,'backgrounds_byte_identical':backgrounds,'city_scope':scenes,'runtime_verified':False}
(ROOT/'records/DELIVERY_QA.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps({k:v for k,v in report.items() if k not in ('city_scope','changed_files')},indent=2))
