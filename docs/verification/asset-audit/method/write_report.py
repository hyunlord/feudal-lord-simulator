"""docs/verification/asset-audit/REPORT.md (ASSET-1)."""
import csv, json, os, collections, subprocess
W = '../a1trunk'
D = json.load(open('reconcile.json')); rows = D['rows']
H = {r['path']: r for r in json.load(open('hashes.json'))['files']}
DR = json.load(open('defect_rows.json')); FX = json.load(open('fix_rows.json'))
SR = json.load(open('sheet_rows.json')); SC = json.load(open('spec_checked.json'))
ST = json.load(open('scale_table.json')) if os.path.exists('scale_table.json') else []
NI = json.load(open('not_installed.json'))
L = list(csv.DictReader(open(W + '/assets-inbox/INBOX_LEDGER.csv', encoding='utf-8')))
HEAD = subprocess.run(['git', '-C', W, 'rev-parse', '--short=7', 'HEAD'], capture_output=True, text=True).stdout.strip()
pub = [r for r in rows if r['surface'] == 'public/assets']; der = [r for r in rows if r['surface'] != 'public/assets']
cnt = lambda rs, k: sum(1 for r in rs if r['class'] == k)
def rel(p): return p.replace('public/assets/', '').replace('assets-inbox/', 'inbox:')
def tbl(head, body):
    out = ['| ' + ' | '.join(head) + ' |', '|' + '---|' * len(head)]
    out += ['| ' + ' | '.join(str(c).replace('|', '\\|') for c in r) + ' |' for r in body]
    return '\n'.join(out)
md = []
A = md.append
A('# ASSET-1 에셋 전수 점검 — runtime 대조·중복·규격·일관성 시트')
A('')
A(f'작성 2026-09-27 · 기준 본선 `codex/phase15-organic-ground` {HEAD} · 작업 지시서 `CLAUDE_CODE_WORK_ORDER_ASSET1_full-audit.md` · **수정은 하지 않았다**(목록만, 사용자 판정 후 ASSET-2).')
A('')
A('산출물: 이 문서(A·C 표), [`sheets/`](sheets/) 8장(B), [`runtime_reconcile.csv`](runtime_reconcile.csv)(runtime 전 파일 분류), '
  '[`confirmed_not_installed.csv`](confirmed_not_installed.csv), [`defects.csv`](defects.csv), [`sheet_stats.csv`](sheet_stats.csv), [`fix_candidates.csv`](fix_candidates.csv), 방법 스크립트 [`method/`](method/).')
open('report_head.md', 'w').write('\n'.join(md))
print('ok')

# ---------------------------------------------------------------- summary
n_pub = len(pub); n_png = sum(1 for r in pub if r['path'].endswith('.png'))
n_cand_der = cnt(der, 'candidate — 판정 전 파일이 runtime에 있음')
older = [r for r in pub if r['class'].startswith('confirmed 옛 버전')]
none_both = [r for r in pub if r['class'] == '장부 밖 — 설치 대장에도 없음']
prov_only = [r for r in pub if r['class'] == '장부 밖 — 설치 대장에만 있음(수제·초기)']
cabx = [r for r in pub if r.get('caBX')]
unref = [r for r in pub if r.get('code_ref') == 'none']
halo = [d for d in DR if d['type'].startswith('헤일로')]
specks = [d for d in DR if d['type'] == '반투명 잔여 점']
outl = [r for r in SR if r['outlier']]
A('')
A('## 요약')
A('')
A(f'- **A. runtime 대조** — `public/assets` {n_pub}개 파일(PNG {n_png}, JSON 5, `.gitkeep` 1)과 빌드 때 `assets-inbox`에서 만드는 웹 파생 {len(der)}개를 모두 분류했다(**미분류 0**). '
  f'superseded·rejected·retired 바이트는 runtime에 **0개**다. 대신 ① 판정 전(candidate)인 **초상 풀 2차 92장**이 CHRON-1 설치로 빌드 파생 {n_cand_der}개(256·96 px)로 게임에 들어가 있고, '
  f'② 새 확정본(-v 번호가 큼)이 있는데 옛 버전이 코드에 등록된 파일이 **{len(older)}개**(도로 2·성벽 면 5), '
  f'③ INBOX 장부·설치 대장 어디에도 없고 코드도 읽지 않는 파일이 **{len(none_both)}개**(예약 목책 5·빵 바구니 1·옛 UI 질감 4)다. '
  f'장부 밖이지만 설치 대장에 기록된 초기 에셋(Codex·ComfyUI·phase16 합성)이 {len(prov_only)}개다.')
A(f'- **중복** — 같은 픽셀이 runtime에 두 이름으로 있는 경우 0. 같은 이름·다른 내용은 runtime 안 4쌍(Wave 11 석조·목조 공사 킷의 `stage_*_medium-v1.png`), runtime↔inbox 82건(대부분 다른 배치의 같은 이름 후보).')
A(f'- **manifest** — 게임이 읽는 생성 manifest(`src/**/*.generated.ts`·`*Manifest*.ts`)가 가리키는데 파일이 없는 것 **0**. manifest 어디에도 없는 runtime PNG 19개(코드가 경로를 조립하는 자원 아이콘 8 포함).')
A(f'- **C2PA caBX** — runtime에 남은 것 {len(cabx)}개(모두 위 ③의 예약 파일). **코드 미참조** runtime 파일 {len(unref)}개(③과 같은 10개).')
A(f'- **B. 일관성 시트** — 8장, 그림 {len(SR)}장(runtime + 확정·미설치 inbox, 같은 픽셀은 한 번). 묶음 안 z-score ±2 밖 **{len(outl)}장**을 빨간 테두리로 표시.')
A(f'- **C. 기계 결함** — 규격(캔버스·피벗·알파 바운딩) 검사 {SC.get("manifest size",0)+SC.get("records size",0)}건 중 불일치 0(피벗이 그림 위 3 px 밖 1건, 낮음). 헤일로 기준에 걸린 것 {len(halo)}개(성벽 면 v2 — 눈으로 보면 빛 받은 윗면), 대신 눈 확인에서 말뚝 면 v2의 색 띠 1건. '
  f'빈 파일 0. 반투명 잔여 점 {len(specks)}개(최대 알파 1~6, 눈에 거의 안 보임). 설치 대장 행 없음 10(③과 같음). DPR·크기 파생 누락 0.')
open('report_a.md', 'w').write('\n'.join(md))

# ---------------------------------------------------------------- A
A('')
A('## A. runtime 대조')
A('')
A('**방법.** `git ls-files public/assets` 전 파일과 빌드 파생(`scripts/keyartDerivatives.ts`의 `WEB_ART_DERIVATIVES`: Wave 8 키아트·Wave 16/17 삽화·초상 풀)을 대상으로 했다. '
  '파일 SHA-256, caBX 청크를 뺀 SHA, 디코딩한 RGBA 픽셀 해시를 `assets-inbox` ' + f'{len(L):,}' + '장과 맞춰 보고, 맞지 않으면 설치 대장(`docs/provenance/assets.csv`)의 `sourcePath`(inbox 경로 또는 `docs/asset-evidence` 원본 → 다시 해시 대조)로 연결했다. '
  '연결된 INBOX 장부 행이 여럿이면 confirmed > candidate > superseded > retired > rejected 순으로 대표 상태를 정했다. '
  '"옛 버전"은 같은 파일 이름 줄기(`-vN` 앞)에 번호가 더 큰 confirmed 행이 장부에 있는 경우다.')
A('')
A('### A1. 분류 (미분류 0)')
A('')
order = ['confirmed 최신본', 'confirmed 옛 버전 — 새 확정본(-v 번호 큼)이 장부에 있음', 'superseded — 옛 버전이 runtime에 남음', 'rejected — 반려본이 runtime에 있음',
         'retired — 퇴역본이 runtime에 있음', 'rework_pending — 재작업 대기 파일이 runtime에 있음', 'candidate — 판정 전 파일이 runtime에 있음',
         '장부 밖 — 설치 대장에만 있음(수제·초기)', '장부 밖 — 설치 대장에도 없음', '메타데이터(json·gitkeep)']
body = [[k, cnt(pub, k), cnt(der, k)] for k in order]
body.append(['**합계**', f'**{len(pub)}**', f'**{len(der)}**'])
A(tbl(['분류', '`public/assets` 파일', '빌드 파생(URL)'], body))
A('')
A(f'- 분류되지 않은 파일: `public/assets` {sum(1 for r in pub if r["class"] not in order)}, 빌드 파생 {sum(1 for r in der if r["class"] not in order)}.')
A('- `confirmed인데 미설치(예정)` — 장부 쪽 목록이라 위 표(파일 기준)와 따로 셌다: 확정 그림(확인·기록 그림 제외) **%d장**이 runtime 어느 파일과도 연결되지 않는다 → [`confirmed_not_installed.csv`](confirmed_not_installed.csv).' % len(NI))
wv = collections.Counter(f.split('/')[0] for f in NI)
A('')
A(tbl(['Wave', '미설치 확정 그림'], [[k, v] for k, v in sorted(wv.items(), key=lambda kv: -kv[1])]))
A('')
A('**판정 전 파일이 게임에 있음 (candidate).** 초상 풀 2차 `portrait-pool/pool2-20260926` 92장(I069~I100)은 INBOX 장부 `candidate`인데 CHRON-1이 설치해(`installed_by=CHRON-1`, 설치 대장 notes에도 "candidate — 판정 전"으로 적힘) '
  '빌드 파생 184개(`assets/portraits/256/*.jpg`, `assets/portraits/96/*.jpg`)로 연대기·인물 카드에 나온다.')
A('')
A('**옛 버전이 코드에 등록됨 (7).** 새 버전과 함께 매니페스트에 올라 있다(둘 다 `path (code)`).')
A('')
A(tbl(['runtime 파일', '연결된 장부 행', '새 확정본', '참조'], [[f"`{rel(r['path'])}`", r['ledger_files'].split('; ')[0], r.get('note', '').replace('newer confirmed: ', ''), r.get('code_ref_files', '')] for r in older]))
A('')
A('**장부·설치 대장 어디에도 없음 (10)** — 모두 게임 코드가 읽지 않는다.')
A('')
def tref(p):
    import subprocess
    stem = os.path.splitext(os.path.basename(p))[0]
    t = subprocess.run(['grep', '-rl', stem, W + '/tests', W + '/scripts'], capture_output=True, text=True).stdout.split()
    return ', '.join(sorted({os.path.relpath(x, W) for x in t}))[:160] or '없음'
A(tbl(['runtime 파일', 'caBX', '크기', '테스트·스크립트 언급'], [[f"`{rel(r['path'])}`", r.get('caBX') or 0, f"{r.get('width')}×{r.get('height')}", tref(r['path'])] for r in none_both]))
A('')
fam = collections.Counter('/'.join(r['path'].split('/')[2:-1]) for r in prov_only)
A('**장부 밖, 설치 대장에만 있음 (%d)** — Astra 이전에 Codex image_gen·ComfyUI·phase16 합성으로 만든 초기 에셋. 설치 대장에 행과 원본(`docs/asset-evidence`)이 있다.' % len(prov_only))
A('')
A(tbl(['폴더', '파일'], [[f'`{k}`', v] for k, v in sorted(fam.items())]))
open('report_a.md', 'w').write('\n'.join(md))

# A2
import re as _re
A('')
A('### A2. 중복 — 같은 내용 두 이름 / 같은 이름 다른 내용')
A('')
g = collections.defaultdict(list)
for r in pub:
    if r['path'].endswith('.png'): g[H[r['path']].get('psha')].append(r['path'])
same = [v for v in g.values() if len(v) > 1]
A(f'- **같은 픽셀, runtime 두 이름: {len(same)}건.** 빌드 파생 원본이 두 URL에 쓰인 경우도 없다(초상 256·96 쌍은 의도).')
bn = collections.defaultdict(list)
for r in pub:
    if r['path'].endswith('.png'): bn[os.path.basename(r['path'])].append(r['path'])
rr = [(b, v) for b, v in bn.items() if len(v) > 1 and len({H[x]['sha'] for x in v}) > 1]
A(f'- **같은 이름, runtime 안 다른 내용: {len(rr)}쌍** — ' + ', '.join(f"`{b}` ({' / '.join(rel(x).rsplit('/',1)[0] for x in v)})" for b, v in rr) + '. 폴더가 달라 충돌은 없지만 이름만으로는 구분되지 않는다.')
Ls = {'assets-inbox/' + r['file']: r for r in L}
ib = collections.defaultdict(list)
for r in L: ib[os.path.basename(r['file'])].append(r)
ri = []
for r in pub:
    b = os.path.basename(r['path'])
    if b in ib:
        linked = {x for x in r.get('ledger_files', '').split('; ') if x}
        diff = [x for x in ib[b] if x['file'] not in linked]
        if diff: ri.append((r, diff))
kinds = collections.Counter()
for r, d in ri:
    sts = sorted({x['status'] for x in d})
    kinds[(r['class'].split(' ')[0] if not r['class'].startswith('장부 밖') else '장부 밖', '·'.join(sts))] += 1
A(f'- **같은 이름, runtime↔inbox 다른 내용: {len(ri)}건** — runtime 파일은 확정본과 바이트가 같고, 같은 이름의 다른 배치 파일(후보·옛 판)이 inbox에 따로 있는 경우다. 표는 (runtime 분류, 같은 이름 inbox 행의 상태)별 개수.')
A('')
A(tbl(['runtime 분류', '같은 이름 inbox 행 상태', '건수'], [[k[0], k[1], v] for k, v in sorted(kinds.items(), key=lambda kv: -kv[1])]))
A('')
A('  - 장부 밖 12건은 초기 runtime 파일과 이름이 같은 Astra 후보: `buildings/house_l0.png`·`foliage/tree_oak_large.png`·`terrain/grass.png`(asset-trial 후보), `runtime-actors-v1/actor_*`(wave4e·wave5a 템플릿 후보 9). 이 후보들은 runtime 파일의 원본이 아니다(해시 다름).')
A('  - 전체 목록: `runtime_reconcile.csv`에는 runtime 쪽만 있으므로, 이 82건은 [`same_name_different_content.csv`](same_name_different_content.csv)에 따로 적었다.')
with open('out/same_name_different_content.csv', 'w', newline='', encoding='utf-8') as f:
    w = csv.writer(f); w.writerow(['runtime_path', 'runtime_class', 'runtime_sha256', 'inbox_file', 'inbox_status', 'inbox_sha256'])
    for r, d in ri:
        for x in d: w.writerow([r['path'], r['class'], r['sha256'], x['file'], x['status'], x['sha256']])
    for b, v in rr:
        for x in v: w.writerow([x, 'runtime↔runtime', H[x]['sha'], '', '', ''])

# A3
A('')
A('### A3. manifest 대조')
A('')
mani = collections.defaultdict(set)
for m, raw, n in D['mani_urls']: mani[n].add(m)
notin = [r for r in pub if r['path'].endswith('.png') and r['path'] not in mani]
A(f'manifest로 본 파일: 게임이 읽는 `src/**/*.generated.ts`·`src/**/*anifest*.ts`와 `public/assets/**/*.json`(이 JSON 5개는 게임 코드가 읽지 않고 생성 스크립트만 읽는다).')
A('')
A(f'- **manifest에 없는데 파일이 있음: {len(notin)}개**')
fam2 = collections.defaultdict(list)
for r in notin: fam2['/'.join(r['path'].split('/')[2:-1])].append(r)
A('')
A(tbl(['폴더', '파일', '코드 참조'], [[f'`{k}`', len(v), ', '.join(sorted({x.get("code_ref") for x in v}))] for k, v in sorted(fam2.items())]))
A('')
A('  - `runtime-icons-v1` 8개는 `src/ui/ResourceArtwork.tsx`가 `assets/runtime-icons-v1/${kind}.png`로 경로를 조립해 읽는다(manifest 없음, 참조 있음). `ui/seal_slot.png`는 코드가 직접 읽는다. 나머지 10개는 A1의 "어디에도 없음"과 같다.')
H2 = {r['path'] for r in json.load(open('hashes.json'))['files']}
deriv_urls = {u for u, _, _ in D['deriv']}
miss = collections.defaultdict(set)
for m, raw, n in D['mani_urls']:
    if n not in H2 and n not in deriv_urls: miss[m].add(n)
gen_miss = sum(len(v) for m, v in miss.items() if not m.startswith('public/'))
A(f'- **manifest에 있는데 파일이 없음: 게임이 읽는 manifest 기준 {gen_miss}개.** 공개 JSON에는 파일 없는 경로 {sum(len(v) for m, v in miss.items() if m.startswith("public/"))}개가 있으나 모두 기록용이다:')
for m, v in sorted(miss.items()):
    note = {'public/assets/world_asset_manifest.json': '`foliageSelections[].candidates[].path`(나무 후보 선별 기록 64)·`acceptedReferences[].path`(참조 3) — 선별 이력',
            'public/assets/buildings/historical-wall/manifest.json': '`not_installed` 목록의 석벽 모서리·T자·끝(설치하지 않았다고 적힌 것)'}.get(m, '')
    A(f'  - `{m}` {len(v)}개 — {note}')

# A4
A('')
A('### A4. runtime 파일의 C2PA caBX 청크')
A('')
A(f'runtime PNG {n_png}개 중 caBX가 남은 파일 **{len(cabx)}개** — 모두 A1 "어디에도 없음"의 예약 파일이다. 나머지 {n_png - len(cabx)}개는 caBX가 없다(설치 때 떼었거나 원래 없음). 빌드 파생(JPEG·반 크기 PNG)은 스크립트가 새로 인코딩하므로 청크를 옮기지 않는다(`scripts/keyartDerivatives.ts`).')
A('')
A(tbl(['파일', 'caBX 청크', '바이트'], [[f"`{rel(r['path'])}`", r['caBX'], r['bytes']] for r in cabx]))

# A5
A('')
A('### A5. 코드가 참조하지 않는 runtime 파일')
A('')
refc = collections.Counter(r.get('code_ref') for r in pub if r['path'].endswith('.png'))
A('`src/**`(ts·tsx·css·json)·`index.html`·`vite.config.ts`에서 ① `assets/…` 경로 문자열, ② 파일 이름, ③ 템플릿 경로(`${…}`)의 변수 값이 따옴표 문자열로 있는지 찾았다.')
A('')
A(tbl(['참조 방식', 'PNG'], [[k, v] for k, v in sorted(refc.items(), key=lambda kv: -kv[1])]))
A('')
A(f'미참조 {len(unref)}개는 A1 "어디에도 없음" 10개와 같다. 이 중 `ui/` 4개(`illumination_corner`·`parchment_texture`·`scroll_frame`·`wood_console`)는 Phase 13 UI 생성 스크립트(`scripts/generateUiAssets.py`·`scripts/uiAssetManifest.ts`)와 그 테스트만 언급한다. 예약 6개는 어디서도 언급되지 않는다.')
open('report_a.md', 'w').write('\n'.join(md))

# ---------------------------------------------------------------- C
A('')
A('## C. 기계 결함 표')
A('')
A(f'대상: runtime PNG {n_png} + 확정(또는 설치된) inbox 그림, 같은 픽셀은 한 번만 셌다(runtime 경로 우선, 같은 픽셀 사본은 `defects.csv`의 `same_pixels`). 전체 목록 [`defects.csv`](defects.csv).')
A('')
tcount = collections.Counter((d['type'], d['severity']) for d in DR)
checks = [
    ('규격: 캔버스 크기 불일치', f"게임 manifest {SC.get('manifest size',0)}건(파생 대장 `runtimeAssetDerivatives`의 원본→축소 관계, UI 틀의 `sourceScale` 반영) + Astra 기록 `records/*.csv` {SC.get('records size',0)}건"),
    ('규격: 피벗·지면 기준점 vs 알파 바운딩', f"manifest 피벗 {SC.get('manifest pivot',0)}건 + Astra 기록 피벗 {SC.get('records pivot',0)}건: 캔버스 밖, 알파(≥128) 좌우 밖, 바닥보다 캔버스 높이 25 % 넘게 아래, 위쪽 밖. 오버레이·UI 틀(좌상단 0,0 등록)은 제외"),
    ('규격: 알파 바운딩 표기 불일치', f"`alphaBounds`(알파≥8)·`BUILDING_SPRITE_ALPHA`(≥128) {SC.get('manifest alpha bounds',0)}건, 허용 ±2 px(선언 좌표)"),
    ('헤일로(가장자리 밝음)', '가장자리(투명 픽셀에서 2 px 안, 알파≥32) 평균 밝기 > 내부(알파 255, 4 px 이상 안쪽) + 40'),
    ('반투명 잔여 점', '몸통(알파≥128)에서 2 px 넘게 떨어진, 6 px 이하·알파<128 외딴 점이 30개 이상. 효과·지면·초상·삽화 제외'),
    ('빈 파일', '0바이트, 완전 투명, 보이는 픽셀 16개 미만'),
    ('C2PA caBX 청크 잔존', 'runtime PNG의 caBX 청크(A4와 같음)'),
    ('설치 대장: 행 없음', 'runtime PNG인데 `docs/provenance/assets.csv`에 행이 없음'),
    ('파생 대장: 크기·SHA 불일치', '`runtimeAssetDerivatives.generated.ts`의 width·height·sha256 vs 실제 파일(65건)'),
    ('DPR·크기 파생 누락', 'UI 아이콘 시트의 24·32·48·64·96 크기 세트, 커서·초상 1x/2x(2x가 1x의 두 배), UI 틀 `sourceScale` 표기'),
    ('이름 규칙', '문서화된 규칙이 없어 저장소 관례 `[a-z0-9_]+(-vN|-크기)?.png` 기준'),
    ('단색 그림(참고)', '보이는 픽셀이 모두 한 색 — 코드에서 색칠하는 마스크로 보이며 결함으로 세지 않음'),
]
body = []
for name, how in checks:
    if name.startswith('규격: 피벗'):
        n = sum(v for (t, s), v in tcount.items() if '피벗' in t or '기준점' in t)
    elif name.startswith('파생 대장'):
        n = sum(v for (t, s), v in tcount.items() if t.startswith('파생 대장'))
    elif name.startswith('DPR'):
        n = sum(v for (t, s), v in tcount.items() if t.startswith('DPR'))
    elif name.startswith('규격: 캔버스'):
        n = sum(v for (t, s), v in tcount.items() if '캔버스 크기' in t)
    else:
        n = sum(v for (t, s), v in tcount.items() if t == name)
    body.append([name, how, n])
A(tbl(['결함', '검사 방법', '건수'], body))
A('')
def dl(t, pred=None, limit=40):
    rs = [d for d in DR if (pred(d) if pred else d['type'] == t)]
    return [[f"`{rel(d['path'])}`", d['scope'], d['detail'], rel(d.get('same_pixels', '') or '')[:120]] for d in rs[:limit]]
A('**규격** — 불일치 0. 낮음 1건:')
A('')
A(tbl(['파일', '범위', '내용', '같은 픽셀'], dl('', lambda d: d['type'].startswith('규격'))))
A('')
A('**헤일로 3건 — 눈으로 보면 흰 테두리가 아니라 빛 받은 윗면(말뚝 끝·돌 윗면)이 밝은 것이다.** 기준(가장자리 > 내부 + 40)에는 걸리므로 표에 두되, 다른 결함을 함께 적는다:')
A('')
A(tbl(['파일', '범위', '내용', '같은 픽셀'], dl('헤일로(가장자리 밝음)')))
A('')
A('- 눈 확인에서 따로 찾은 것(기계 표 밖): `wall/palisade_face_a-v2.png` 왼쪽 끝 말뚝 3개 끝에 **보라·파랑·빨강 띠**(x 0–40, y 0–12, 채도 높은 픽셀 640개). `wall/stone_face_b-v1.png`·`stone_face_a/c-v1` 윗줄 20 px에 **반투명 띠**(알파 16–239 픽셀 1,054개, 첫 성가퀴가 비침) — v1은 A1의 옛 버전이다.')
A('')
A('**반투명 잔여 점 %d건** — 모두 최대 알파 1~6(게임에서 거의 안 보임): 예약 파일 6, 나무 다리·돌 강둑 2, 석벽 기둥 1, 겨울 사과나무 1, 전령 워커 1.' % len(specks))
A('')
A(tbl(['파일', '범위', '내용', '같은 픽셀'], dl('반투명 잔여 점')))
A('')
A('**설치 대장 행 없음 10** — A1 "어디에도 없음"과 같은 파일. **파생 대장·DPR 파생** — 불일치·누락 0(아이콘 시트 11종 모두 24/32/48/64/96, 커서 6·초상 4의 1x/2x 모두 있고 2x = 1x의 두 배, UI-P0 틀 18개·Wave 8 틀 6개 모두 `sourceScale: 2`).')
A('')
nm = collections.Counter()
for d in DR:
    if d['type'] == '이름 규칙':
        p = d['path']; fam = '/'.join(p.split('/')[1:3]) if p.startswith('assets-inbox') else '/'.join(p.split('/')[2:3])
        nm[(fam, d['detail'], d['scope'].split(' ')[0])] += 1
A('**이름 규칙 %d건** — 방향 접미 대문자(`_NE`·`_SW` — Wave 7·13·17은 소문자 `_ne`), 초상 ID 대문자(`P01`·`I037`), `-v1_96` 같은 접미 순서. 게임 동작과 무관한 표기 차이다.' % sum(nm.values()))
A('')
A(tbl(['묶음', '사유', '범위', '건수'], [[f'`{k[0]}`', k[1], k[2], v] for k, v in sorted(nm.items(), key=lambda kv: -kv[1])]))
A('')
sc_ = [d for d in DR if d['type'] == '단색 그림(참고)']
A(f'**단색 그림(참고) {len(sc_)}건**(runtime {sum(1 for d in sc_ if d["scope"] == "runtime")}) — Wave 14 문장(charges·ordinaries·partitions)·상인 표식·도시 인장이 흰색 또는 검은색 한 색이다. UI-5가 `public/assets/wave14/`에 설치했고 `src/ui/heraldry/EmblemImage.tsx`가 색을 입히는 마스크라 결함으로 세지 않았다.')
open('report_a.md', 'w').write('\n'.join(md))

# A5 addendum: registered but never drawn (code trace)
NEVER = [
    ('buildings/historical-palisade-reserved/*, runtime-reserved-v1/*', '어디서도 참조 안 함 (A1 ③)'),
    ('buildings/stone_wall_segment.png', 'manifest에만 있음'),
    ('buildings/historical-gate/gate_part_doors_closed_*', '읽지만 그리지 않음'),
    ('runtime-construction-v1/construction_wall-v2·construction_salvage-v3·effect_smoke-v1', '코드에 "reserved"로 적힘'),
    ('complete-art-v1/water-bridges 돌다리·여울·강둑·water_shallow', '`bridgeWaterKit`만 부르는데 그 함수를 부르는 곳이 없음'),
    ('module/ferry_landing-v1', '등록만'),
    ('shore/shoreline_a~f-v1, shallow_a~c-v1', '등록만(로드 안 함)'),
    ('wall/*_face_*-v1 (v2가 그려짐)', '등록만 — A1 옛 버전 7개와 겹침'),
    ('runtime-actors-v1 civilian_man·civilian_woman·merchant·cleric·cart_ox', '`active:false`'),
    ('wave9 event_abandoned·event_plague_shut·fresh_graves·weeds_overgrown·funeral_bearers·royal_messenger·bier_shroud·scroll_royal·empty_granary_floor·hungry_queue', '그리는 코드 없음(키가 생성 manifest에만 있음, 표본 grep 확인)'),
    ('wave7 plus_float, wave11 ramp_plank·kit_defense/*_gate', '그리는 코드 없음'),
    ('visibility-v1 roof_frame_thatch·fire_large·fire_small·work_carry_beam·work_pose_overlay_m', '`visibilityArtManifest.ts`에 등록만'),
    ('wave8 loading_1337·loading_1348 키아트, minimap·objective·legend 틀, overlay 아이콘 일부, wave19 틀 일부', 'UI에서 쓰는 곳을 찾지 못함'),
    ('runtime-icons-v1 (stone_raw 제외 7)', '`ResourceArtwork`가 P0 시트로 대신 그려 보이지 않음(stone_raw만 보조 줄 16 px)'),
]
A('')
A('**그리는 코드가 없는 등록 파일(코드 추적, grep 밖).** 위 grep에서는 "참조 있음"이지만 실제로 그려지는 경로를 찾지 못한 파일이다. 보조 에이전트가 그리기 코드를 따라가 찾았고, wave9·visibility 몇 개는 grep으로 표본 확인했다. 지울지는 예약 여부를 보고 판단해야 한다.')
A('')
A(tbl(['파일', '근거'], [[f'`{a}`', b] for a, b in NEVER]))

# ---------------------------------------------------------------- B
A('')
A('## B. 일관성 시트 (8장)')
A('')
A('각 시트는 **게임 줌 1.0의 CSS px 크기**로 그렸다. 설치된 파일은 그리기 코드의 배율, 미설치 확정본은 ① Astra 기록의 배율(`game_zoom_1_source_scale`·`native_to_world_scale`) → ② 설치된 같은 계열의 코드 배율 → ③ Astra 파이프라인 규격 "원본×0.5 = 줌 1.0"(Wave 12·13 README) 순서로 정했다. 워커 합성기를 거치는 워커 시트·손 소품은 기록값보다 합성기 규칙을 먼저 썼다. '
  '라벨 둘째 줄의 `×값`이 파일 1 px당 화면 px이고, 계열별 근거는 [`display_scale_by_family.csv`](display_scale_by_family.csv)와 [`sheet_stats.csv`](sheet_stats.csv)의 `scale_basis`에 있다. 줌 1.0에서 DPR은 선명도만 바꾸고 크기는 바꾸지 않는다(`src/render/canvasRuntime.ts:57-71`, `src/render/worldSprite.ts:248-257`).')
A('')
A('**밝기·채도·주조색.** 파일마다 보이는 픽셀(알파 가중)의 평균 밝기(Rec.709, 0–255)·평균 채도(HSV S)·주조색(알파≥128 픽셀을 8단계로 묶은 최빈 색)을 계산하고, **시트 안 묶음마다** z-score를 냈다(마스크처럼 한 색인 그림은 통계에서 뺐다). ±2 밖은 빨간 테두리와 빨간 숫자로 표시했다. 통계 이탈은 결함이 아니라 "사람이 볼 곳"이다(눈·서리·돌·연기는 의도로 튀는 경우가 많다).')
A('')
SS = collections.defaultdict(list)
for r in SR: SS[r['sheet']].append(r)
names = {'1_buildings': '① 건물(발판 마름모)', '2_walkers_animals_carts': '② 워커(정면 SE 셀)·동물·수레', '3_props_piles_loads_signs': '③ 소품·더미·적재물·기표', '4_strips_surfaces': '④ 띠·면·자연',
         '5_effects': '⑤ 효과·연기·불', '6_ui_icons_24px': '⑥ UI 아이콘 24 px + UI 조각', '7_portraits_96px': '⑦ 초상 96 px', '8_illustrations': '⑧ 삽화 썸네일'}
body = []
for k in sorted(SS):
    rs = SS[k]
    st = collections.Counter(r['state'] for r in rs)
    body.append([f'[{names[k]}](sheets/{k}.jpg)', len(rs), st.get('설치', 0), st.get('빌드 파생(설치)', 0), st.get('미설치', 0), sum(1 for r in rs if r['outlier'])])
A(tbl(['시트', '그림', 'public 설치', '빌드 파생', '미설치 확정', 'z ±2 밖'], body))
A('')
A('포함 기준: runtime PNG 전부 + INBOX 장부 `confirmed`(확인·기록 그림 제외) + 빌드 파생 원본(판정 전 초상 풀 2차 포함). 같은 픽셀은 한 번(runtime 쪽). 아이콘 크기 사본(`-24`~`-64`)·커서 `-32`·초상 `-96`·`people-pilot1`의 `_96`/`_128`·walker-pilot2의 셀 조각·wave7 `original-assets`는 원본과 겹쳐 뺐다.')
A('')
A('### 주요 배율 (줌 1.0, 파일 1 px당 화면 px)')
A('')
KEYS = [
    ('주택 L0~L4·쌍집(`historical-houses`)·Wave 2 변형', '0.497–0.500', '불투명 상자 폭 = 0.88 × 64 × (w+h)/2, 바닥 = 발판 앞 꼭짓점', '`src/render/historicalHouseAssets.ts:73-89`, `houseCompoundAssets.ts:55-62`'),
    ('시설(`historical-facilities-v1`)', '0.498–0.533', 'manifest `displayWidth` ÷ 원본 상자 폭', '`src/render/historicalFacilityAssets.ts:100-125`'),
    ('초기 평면 건물 well·logging_camp·storehouse·barn', '0.708 / 0.640 / 0.801 / 0.970', '발판 맞춤(fill × (w+h) × 32 ÷ 불투명 폭)', '`src/render/buildingSpriteFit.ts:18-55`'),
    ('집 상태 레이어(`phase16-house-condition`)', '0.336–0.450', '집 사각형에 맞춰 잘라 그림', '`src/render/houseConditionOverlay.ts:44-139`'),
    ('Wave 11 공사 킷', '0.2(방어) · 0.498–0.801', '해당 건물 사각형 / 탑 고정 0.2', '`src/render/constructionKits.ts:29-122`'),
    ('워커(`walkers-v2`·옛 actor·Wave 11 일꾼)', '0.26–0.43(셀 px)', '그림 높이를 17.6 px(0.55 × 32)로 맞춤', '`src/render/walkerComposer.ts:27-30,183-188`'),
    ('**Wave 9 이야기 워커**(장례·떠나는 가족·청원자·전령)', '**0.5(셀 px)**', '`storyWorldProps` WALKER_SCALE — 일반 워커의 약 1.8배 크기', '`src/render/storyWorldProps.ts:20-31`'),
    ('손 소품(`walker-props-v1`·work 도구)', '0.17–0.28', '0.65 × 운반자 배율', '`src/render/walkerComposer.ts:30,93-97`'),
    ('더미(Wave 7 `pile`)', '0.3', 'PILE_SCALE', '`src/render/stockPiles.ts:16`'),
    ('수레 짐(Wave 7 `cart_load`)', '0.269', '17.6 × 0.55 ÷ 36', '`src/render/drawWalkers.ts:115-124`'),
    ('기표(Wave 7 `signifier`)', '0.4–0.5', '고정', '`src/render/worldSigns.ts:127-169`'),
    ('목초지 동물(`zones/animals`)', '0.234–0.240', '`displayWidth` 30·46', '`src/render/zoneAssetManifest.ts:66-80`'),
    ('도로 띠(`earth_strip`-v3)', '약 0.363(타일 축 방향)', '5.2타일에 512 px, 폭 0.65타일', '`src/render/drawRoadRibbons.ts:376-582`'),
    ('이랑(`ridge_*`)·물가 띠', '약 0.28(타일 축 방향)', '타일당 128 px', '`src/render/drawArableFields.ts:31-208`'),
    ('성벽 면 띠(512×128)', '약 0.17(벽 방향) · 0.156(세로)', '타일당 205 px, 128행 → 20 px', '`src/render/drawWallFaces.ts:45-169`'),
    ('숲 가장자리·계절 데칼', '0.5', 'DECAL_SCALE', '`src/render/seasonalDecals.ts:22-23`'),
    ('과수(`zones/orchard_*`·Wave 15 과수)', '0.155–0.180', '43 × prop scale', '`src/render/zoneLayer.ts:206`'),
    ('연기(Wave 7)·완공 효과', '0.3 · 0.55–1.1', 'SMOKE_SCALE · (w+h) × 27 × 1.3', '`src/render/roofSmoke.ts:66`, `constructionCompletionEffects.ts:167-172`'),
    ('미설치 Astra(Wave 12·13·17·20 등)', '0.5', 'Astra 기록 `game_zoom_1_source_scale`·`native_to_world_scale`(Wave 20 0.498–0.500) 또는 규격 기본', 'Wave 12·13 README, Wave 17·20 `records/assets.csv`'),
]
A(tbl(['계열', '배율', '계산', '근거'], [list(k) for k in KEYS]))
A('')
A('### 시트에서 보이는 것 (배율·밝기)')
A('')
A('- **Wave 9 이야기 워커가 일반 워커보다 약 1.8배 크다.** 셀 × 0.5(그림 높이 약 32 px)로 그려지고, 일반 워커는 17.6 px다(② 시트 둘째 묶음 옆, `wk_funeral_bearers`·`wk_leaving_family`·`wk_petitioner_*`·`wk_royal_messenger`).')
A('- **Wave 13 동물·수레를 규격(원본×0.5)대로 넣으면 지금 동물보다 두 배 넘게 크다.** 원본 1 px당 0.5 대 목초지 동물 0.234–0.240, 손수레는 폭 17.6 px(0.25)다(② 동물 묶음: W4c·W4e 대 W13). 설치(MOVE-2) 때 배율을 정해야 한다.')
A('- **Wave 17 손 소품은 기록 배율이 0.5인데, 설치된 손 소품은 0.65 × 운반자(약 0.18)로 그려진다.** 기록대로 넣으면 지금 손 소품의 약 2.8배다. 시트는 합성기 규칙(0.18)으로 그렸다.')
A('- **Wave 12 건물·Wave 20 집·Wave 3 건물(×0.5)은 설치된 집·시설(0.497–0.533)과 같은 배율이다.** 발판 마름모 대비 크기도 비슷하다(① 시트).')
A('- **초상:** 파일럿 초상(`people-pilot1` P2·P5·P6, `pivot-pilot` P04·P09·P11·P18·P31·P33·P35)이 풀 1·2차(밝기 약 60–100)보다 밝고(밝기 118–140) 채도가 낮다. 풀 안에서는 빨간 옷의 I038·I084·I097이 채도 +2 이상.')
A(f'- **UI:** 옛 자원 아이콘 `stone`·`stone_raw`(장부 밖)가 P0 아이콘보다 채도가 낮다. 문장·인장 마스크 {sum(1 for d in DR if d["type"] == "단색 그림(참고)")}장은 한 색이라 통계에서 뺐다.')
A('- 나머지 이탈 대부분은 의도로 보인다: 지붕 눈·서리·눈 더미(밝기 +2~+4), 돌 수레 짐·석회 더미(채도 −3), 검은 연기, 불 난 밤 장면(`event_fire`).')
A('')
A('전체 이탈 목록은 D의 "Astra 재작업 후보(통계 이탈)"와 [`sheet_stats.csv`](sheet_stats.csv)(`outlier=yes`).')
open('report_a.md', 'w').write('\n'.join(md))

# ---------------------------------------------------------------- D
A('')
A('## D. 수정 후보 목록 (수정하지 않음 — 사용자 판정 후 ASSET-2)')
A('')
A('전체: [`fix_candidates.csv`](fix_candidates.csv).')
A('')
g = collections.defaultdict(list)
for k, p, why in FX: g[k].append((p, why))
A(f"### 1. runtime에서 지울 것 ({len(g['runtime에서 지울 것'])})")
A('')
A(tbl(['파일', '이유'], [[f'`{rel(p)}`', w] for p, w in g['runtime에서 지울 것']]))
A('')
A('검토: 위 "그리는 코드가 없는 등록 파일"은 예약인지 확인한 뒤 지울지 정한다(이 목록에는 넣지 않았다).')
A('')
rep = g['교체할 것'] + g['교체할 것(판정 필요)']
A(f'### 2. 교체할 것 ({len(rep)})')
A('')
A(tbl(['파일', '이유'], [[f'`{rel(p)}`' if '/' in p and ' ' not in p else p, w] for p, w in rep]))
A('')
ast = g['Astra 재작업 후보'] + g['Astra 재작업 후보(낮음)']
A(f'### 3. Astra 재작업 후보 — 결함 ({len(ast)})')
A('')
A(tbl(['파일', '이유'], [[f'`{rel(p)}`', w] for p, w in ast]))
A('')
st = g['Astra 재작업 후보(통계 이탈, 사람 판정)']; rp = g['교체 검토(장부 밖, 통계 이탈)']
A(f'### 4. 통계 이탈 — 사람 판정 ({len(st)} Astra + {len(rp)} 장부 밖)')
A('')
A('시트에서 빨간 테두리로 표시한 그림이다. 이름으로 의도가 짐작되는 것은 괄호에 적었다(겨울 흰색·돌·연기·불·양모 등). 재작업으로 보낼지는 시트를 보고 정한다.')
A('')
A(tbl(['분류', '파일', '시트·묶음·값'], [['Astra', f'`{rel(p)}`', w] for p, w in st] + [['장부 밖', f'`{rel(p)}`', w] for p, w in rp]))

# ---------------------------------------------------------------- appendix
A('')
A('## 관문')
A('')
A(tbl(['관문', '결과'], [
    ['① runtime 전 파일 분류(미분류 0)', f'`public/assets` {len(pub)}/{len(pub)}, 빌드 파생 {len(der)}/{len(der)} 분류 — [`runtime_reconcile.csv`](runtime_reconcile.csv)'],
    ['② 시트 8종', '[`sheets/`](sheets/) 8장(JPEG, 각 1.5 MB 이하), 통계 [`sheet_stats.csv`](sheet_stats.csv)'],
    ['③ 결함 표', 'C절, [`defects.csv`](defects.csv)'],
    ['④ 문서만 커밋', '`docs/verification/asset-audit/`·`docs/STATUS.md`·`docs/ROADMAP.html`만. `src/`·`public/`·`assets-inbox/` 변경 0'],
]))
A('')
A('## 한계')
A('')
A('- 표시 배율은 그리기 코드를 읽어 정했다(파일·줄 근거는 `display_scale_by_family.csv`). 길·이랑·성벽 면·다리처럼 늘여 그리는 띠는 한 방향의 배율로 대표했다. 나무·덤불·효과처럼 인스턴스마다 달라지는 것은 기준값(중간)을 썼다.')
A('- 미설치 그림의 배율은 규격값이라 설치 때 달라질 수 있다.')
A('- 헤일로 기준(가장자리 > 내부 + 40)은 빛 받은 윗면도 잡는다. 걸린 3장은 눈으로 보면 흰 테두리가 아니다.')
A('- "코드 미참조"는 grep이다. 그리는 경로가 없는 등록 파일은 코드 추적으로 따로 적었고, 모두 확인하지는 않았다(표본 grep).')
A('- 시트 글꼴은 macOS AppleSDGothicNeo. 방법 스크립트는 [`method/`](method/).')
text = '\n'.join(md)
iA, iC, iN, iB, iD = (text.index(k) for k in ('\n## A. ', '\n## C. ', '\n**그리는 코드가 없는 등록 파일', '\n## B. ', '\n## D. '))
text = text[:iA] + text[iA:iC] + text[iN:iB] + text[iB:iD] + text[iC:iN] + text[iD:]
open('REPORT.md', 'w').write(text + '\n')
print('REPORT.md', len(md))
