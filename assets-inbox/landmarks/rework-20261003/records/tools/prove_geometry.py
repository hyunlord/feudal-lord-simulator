# /// script
# requires-python = ">=3.11"
# dependencies = ["Pillow", "numpy"]
# ///
# Run: python3 records/tools/prove_geometry.py
"""Render diagnostic annotations and engine-grid proof plates; never rewrite sprites."""
from pathlib import Path
import json
import math
from dataclasses import dataclass
from typing import Final
from PIL import Image, ImageDraw
import numpy as np

ROOT: Final = Path(__file__).resolve().parents[2]
BASE: Final = Path('/tmp/astra-landmark-growth-20261003-work')
ENDS: Final = {'bridge_s01':((230.5,417),(1028,890)),
 'bridge_s02':((186.5,432.5),(1084,898)), 'bridge_s03':((514.5,472),(1267.5,871.5))}
TARGET: Final = ((576,1440),(960,1632))
@dataclass(frozen=True, slots=True)
class Matrix:
    a: float
    b: float
    c: float
    tx: float
    ty: float
    def point(self, p: tuple[float,float]) -> tuple[float,float]:
        """Map raw top-down source coordinates to registered canvas coordinates."""
        x,y=p
        return self.a*x+self.tx,self.b*x+self.c*y+self.ty

def angle(points: list[tuple[float,float]]) -> float:
    """Return signed screen-space angle of one observed segment."""
    p,q=points
    return math.degrees(math.atan2(q[1]-p[1],q[0]-p[0]))

out=ROOT/'proofs/geometry';out.mkdir(parents=True,exist_ok=True)
rows=json.loads((ROOT/'records/transforms.json').read_text())
results=[]
for row in rows:
    name=row['filename']; prefix=name.rsplit('_',1)[0]
    m=Matrix(*row['matrix'])
    with Image.open(ROOT/'assets'/name) as opened: sprite=opened.convert('RGBA')
    bg=Image.new('RGBA',sprite.size,(92,112,104,255));bg.alpha_composite(sprite)
    draw=ImageDraw.Draw(bg)
    primary=[m.point(tuple(p)) for p in row['primary_segment']]
    held=[m.point(tuple(p)) for p in row['heldout_segment']]
    draw.line(primary,fill=(65,255,110),width=3);draw.line(held,fill=(255,210,30),width=3)
    for x,y in primary+held:draw.ellipse((x-4,y-4,x+4,y+4),fill=(255,255,255))
    end_residual=[]
    if prefix in ENDS:
        observed=[m.point(p) for p in ENDS[prefix]]
        for p,q in zip(observed,TARGET,strict=True):
            end_residual.append(math.dist(p,q)*.25)
            x,y=q;draw.line((x-12,y,x+12,y),fill=(0,220,255),width=2);draw.line((x,y-12,x,y+12),fill=(0,220,255),width=2)
            x,y=p;draw.ellipse((x-5,y-5,x+5,y+5),outline=(255,80,120),width=2)
    alpha=sprite.getchannel('A');box=alpha.point(lambda v:255 if v>=128 else 0).getbbox()
    assert box is not None
    box=(max(0,box[0]-30),max(0,box[1]-30),min(2048,box[2]+30),min(2048,box[3]+30))
    detail=bg.crop(box)
    plate=Image.new('RGB',(max(960,detail.width),detail.height+70),(40,44,40))
    plate.paste(detail.convert('RGB'),(0,70));d=ImageDraw.Draw(plate)
    d.text((15,10),f'{name} | green calibration / yellow held-out | cyan bank target / pink observed end',fill='white')
    d.text((15,30),f'long axis {angle(primary):.6f} deg; held-out {angle(held):.6f} deg; end residual world px {end_residual}',fill='white')
    d.text((15,50),'Manual raw picks: beams +/-3-4 raw px; occluded deck ends +/-10-12 raw px. Not runtime.',fill='white')
    plate.save(out/f'{name[:-4]}-axis.png')
    results.append({'filename':name,'calibrated_angle_deg':angle(primary),
                    'heldout_angle_deg':angle(held),'heldout_error_deg':abs(angle(held)-angle(primary)),
                    'endpoint_observation_residual_world_px':end_residual,
                    'primary_registered':primary,'heldout_registered':held})
    if prefix in ENDS:
        cell=Image.new('RGBA',(400,300),(86,102,79,255));d=ImageDraw.Draw(cell)
        origin=(200,180)
        for tx in range(-9,10):
            for ty in range(-9,10):
                x=origin[0]+(tx-ty)*32;y=origin[1]+(tx+ty)*16
                fill=(86,121,139) if -1<=tx<=1 else (116,131,83)
                d.polygon(((x,y-16),(x+32,y),(x,y+16),(x-32,y)),fill=fill,outline=(91,110,91))
        scaled=sprite.resize((512,512),Image.Resampling.LANCZOS)
        cell.alpha_composite(scaled,(origin[0]-192,origin[1]-384))
        clean=cell.copy()
        d=ImageDraw.Draw(cell)
        for dx,dy in ((-48,-24),(48,24)):
            x=origin[0]+dx;y=origin[1]+dy
            d.line((x-12,y+6,x+12,y-6),fill=(30,255,255),width=1)
            d.ellipse((x-2,y-2,x+2,y+2),outline=(255,60,90))
        board=Image.new('RGB',(1200,630),(40,44,40));bd=ImageDraw.Draw(board)
        bd.text((12,12),name+' | left world 1.0 clean / right exact 3x guide | three water cells, span (96,48)',fill='white')
        board.paste(clean.convert('RGB'),(0,95))
        board.paste(cell.crop((75,45,325,245)).resize((750,600),Image.Resampling.NEAREST).convert('RGB'),(450,30))
        board.save(out/f'{name[:-4]}-river3.png')
(ROOT/'records/geometry-results.json').write_text(json.dumps(results,indent=2)+'\n')
pairs=[]
for prefix in [f'{f}_s{s:02d}' for f in ('bridge','guildhall') for s in (1,2,3)]:
    masks=[]
    for season in ('summer','winter'):
        with Image.open(ROOT/'assets'/f'{prefix}_{season}.png') as im:masks.append(np.asarray(im.getchannel('A'))>=128)
    iou=float(np.logical_and(*masks).sum()/np.logical_or(*masks).sum())
    pairs.append({'id':prefix,'silhouette_iou':iou,'threshold':.95,'passed':iou>=.95})
(ROOT/'records/seasonal-qa.json').write_text(json.dumps(pairs,indent=2)+'\n')
print('12 axis plates, 6 engine-grid river plates; max held-out error',max(r['heldout_error_deg'] for r in results))
print('max observed endpoint residual',max(v for r in results for v in r['endpoint_observation_residual_world_px']))
