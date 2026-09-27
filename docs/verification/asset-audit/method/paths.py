"""Pictures to measure: every runtime PNG + confirmed or installed inbox art (proofs and records left out)."""
import csv, json, re
D = json.load(open('reconcile.json'))
L = list(csv.DictReader(open('../a1trunk/assets-inbox/INBOX_LEDGER.csv', encoding='utf-8')))
PROOF = re.compile(r'(^|/)(proofs?|checks?|qa|contact[^/]*|previews?|records?)(/|$)|contact|comparison|_proof|preview', re.I)
paths = [r['path'] for r in D['rows'] if r['surface'] == 'public/assets' and r['path'].endswith('.png')]
art = ['assets-inbox/' + r['file'] for r in L if r['file'].lower().endswith('.png') and not PROOF.search(r['file']) and (r['status'] == 'confirmed' or r['installed_by'].strip())]
json.dump(sorted(set(paths + art)), open('metric_paths.json', 'w'))
print(len(set(paths + art)))
