"""Scale table for the report: one row per family rule actually used on the sheets."""
import json, collections
SR = json.load(open('sheet_rows.json'))
rows = collections.defaultdict(list)
for r in SR:
    if r['sheet'][0] in '12345' and r['scale_basis']:
        fam = r['path'].replace('public/assets/', '').replace('assets-inbox/', 'inbox:').rsplit('/', 1)[0]
        rows[(r['scale_basis'], fam)].append(r['display_scale'])
out = []
for (basis, fam), v in sorted(rows.items(), key=lambda kv: kv[0][1]):
    lo, hi = min(v), max(v)
    out.append({'family': fam, 'n': len(v), 'scale': f'{lo:.3f}' if abs(hi - lo) < 0.0005 else f'{lo:.3f}–{hi:.3f}', 'basis': basis})
json.dump(out, open('scale_table.json', 'w'), ensure_ascii=False)
print(len(out))

# CSVs for the report folder
import csv
cols = ['sheet', 'group', 'path', 'wave', 'state', 'ledger', 'display_scale', 'scale_basis', 'brightness', 'saturation', 'dominant', 'z_brightness', 'z_saturation', 'outlier']
with open('out/sheet_stats.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=cols, extrasaction='ignore'); w.writeheader()
    for r in SR: w.writerow(r)
with open('out/display_scale_by_family.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.DictWriter(f, fieldnames=['family', 'n', 'scale', 'basis']); w.writeheader()
    for r in out: w.writerow(r)
