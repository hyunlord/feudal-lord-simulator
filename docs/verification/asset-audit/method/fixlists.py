"""D: fix candidate lists (no fixes applied): delete from runtime / replace / Astra rework."""
import csv, json, collections
D = json.load(open('reconcile.json')); rows = D['rows']
DR = json.load(open('defect_rows.json'))
SR = json.load(open('sheet_rows.json'))
out = []
by = {r['path']: r for r in rows}
for r in rows:
    if r['surface'] != 'public/assets' or not r['path'].endswith('.png'): continue
    if r.get('code_ref') == 'none' and '설치 대장에도 없음' in r['class']:
        out.append(('runtime에서 지울 것', r['path'], f"장부·설치 대장 모두 없음, 게임 코드 미참조{', caBX 남음' if r.get('caBX') else ''}"))
    elif r.get('code_ref') == 'none':
        out.append(('runtime에서 지울 것', r['path'], '게임 코드 미참조 (테스트·생성 스크립트만 언급)'))
for r in rows:
    if r['class'].startswith('confirmed 옛 버전'):
        out.append(('교체할 것', r['path'], f"옛 버전이 코드에 등록됨 → {r.get('note','').replace('newer confirmed: ','새 확정본 ')}"))
    if r['class'].startswith('candidate'):
        pass
cand = [r for r in rows if r['class'].startswith('candidate')]
if cand:
    out.append(('교체할 것(판정 필요)', f"초상 풀 2차 92장 → 빌드 파생 {len(cand)}개 (assets/portraits/256·96/I069~I100)", 'INBOX 장부 candidate(판정 전)인데 CHRON-1이 설치 — confirmed 판정 또는 pool1로 대체'))
for d in DR:
    if d['type'].startswith('헤일로'):
        out.append(('Astra 재작업 후보(낮음)', d['path'], f"헤일로 기준 초과: {d['detail']} — 눈으로는 빛 받은 윗면, 재작업이 필요 없을 수 있음"))
    if d['type'] == '반투명 잔여 점' and not d['path'].startswith('public/assets/buildings/historical-palisade-reserved') and 'runtime-reserved' not in d['path']:
        out.append(('Astra 재작업 후보(낮음)', d['path'], f"반투명 잔여 점: {d['detail']}"))
import re
NOTE = [(r'snow|frost|winter', '겨울 흰색·무채색(의도일 수 있음)'), (r'stone|rawstone|lime|market_cross', '돌·석회(무채색, 의도일 수 있음)'),
        (r'smoke', '연기(어두움, 의도)'), (r'fire|burning', '불·밤 장면(의도일 수 있음)'), (r'monk|nun', '검은 수도복(의도)'),
        (r'fleece|yarn|wool', '양모(흰색, 의도일 수 있음)'), (r'pt_pilot|/P\d\d', '파일럿 초상 — 풀보다 밝고 채도 낮음'), (r'vignette', '어두운 가장자리 효과(의도)')]
def why(p):
    for rx, t in NOTE:
        if re.search(rx, p): return t
    return ''
for r in SR:
    if not r.get('outlier'): continue
    z = f"B {r['brightness']:.0f} (z {r['z_brightness']:+.1f}), S {r['saturation']:.2f} (z {r['z_saturation']:+.1f})"
    kind = 'Astra 재작업 후보(통계 이탈, 사람 판정)' if r['ledger'] in ('confirmed', 'candidate') else '교체 검토(장부 밖, 통계 이탈)'
    out.append((kind, r['path'], f"{r['sheet']} · {r['group']}: {z}" + (f" — {why(r['path'])}" if why(r['path']) else '')))
out.append(('Astra 재작업 후보', 'public/assets/wall/palisade_face_a-v2.png', '눈 확인: 왼쪽 끝 말뚝 3개 끝에 보라·파랑·빨강 띠(x 0–40, y 0–12) — 같은 픽셀 inbox wave4d/wall/palisade_face_a-v2.png'))
json.dump(out, open('fix_rows.json', 'w'), ensure_ascii=False)
with open('out/fix_candidates.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f); w.writerow(['list', 'path', 'reason'])
    for x in out: w.writerow(x)
print(collections.Counter(x[0] for x in out))
