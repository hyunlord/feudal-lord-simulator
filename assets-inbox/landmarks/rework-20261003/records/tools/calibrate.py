# /// script
# requires-python = ">=3.11"
# dependencies = []
# ///
# Run: python3 records/tools/calibrate.py
"""Compute whole-sprite registration matrices from manually observed baselines."""
from pathlib import Path
import json
from typing import Final

ROOT: Final = Path(__file__).resolve().parents[2]
# id, primary slope endpoints, anchor, horizontal scale, vertical scale, held-out segment.
SPECS: Final = (
 ('bridge_s01', ((342,380),(1047,787)), (629.25,653.5),384/797.5,384/797.5,((209,455),(914,862))),
 ('bridge_s02', ((286,384),(1085,790)), (635.25,665.25),384/897.5,384/897.5,((159,457),(960,863))),
 ('bridge_s03', ((600,443),(1265,774)), (891,671.75),384/753,.60,((484,513),(1122,831))),
 ('guildhall_s01', ((583,896),(786,815)), (885,810),.50,.50,((996,739),(1308,613))),
 ('guildhall_s02', ((482,877),(1127,590)), (745,1004),.60,.60,((732,638),(849,586))),
 ('guildhall_s03', ((399,777),(980,498)), (669,821),.60,.60,((782,602),(971,511))),
)
rows=[]
for name, primary, anchor, a, c, heldout in SPECS:
    p,q=primary
    slope=(q[1]-p[1])/(q[0]-p[0])
    target=.5 if name.startswith('bridge') else -.5
    b=a*target-c*slope
    tx=768-a*anchor[0]
    ty=1536-b*anchor[0]-c*anchor[1]
    for season in ('summer','winter'):
        rows.append({'filename':f'{name}_{season}.png','matrix':[a,b,c,tx,ty],
                     'raw_anchor':anchor,'primary_segment':primary,'heldout_segment':heldout,
                     'target_slope':target,'season_geometry':'same source pixel coordinates; verified separately'})
(ROOT/'records/transforms.json').write_text(json.dumps(rows,indent=2)+'\n')
print(f'{len(rows)} registration matrices')
