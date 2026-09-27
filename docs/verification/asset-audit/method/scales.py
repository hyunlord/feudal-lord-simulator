"""Display scale at zoom 1.0 per family, walker front cells, icon cells, building footprints/pivots."""
import csv, glob, json, os, re
from PIL import Image
from tsjson import ts_consts
W = '../a1trunk'

# ---- icon sheets -------------------------------------------------------------------------
ICONISH = re.compile(r'((?<!button_)icon|/icons/|/ui-icons/|runtime-icons-v1|warning_map_marker)')
def icon_cells(it, im):
    p = it['path']
    if not ICONISH.search(p): return None
    if im.height == 96 and im.width % 96 == 0:
        return [im.crop((k * 96, 0, (k + 1) * 96, 96)) for k in range(im.width // 96)]
    if im.width == im.height:
        return [im]
    return None

# ---- walker front cell (SE, gait frame 0) ----------------------------------------------------------
ACT = {('public/' + a['url']): a for a in ts_consts(W + '/src/render/runtimeActorManifest.generated.ts')['runtimeActorManifest']}
WALKERISH = re.compile(r'(walkers-v2|/workers?/|/wk/|/walker/|/wk_|derived-templates|templates/masters|/actors/)')
def front_cell(it, im):
    p = it['path']
    if p in ACT:
        a = ACT[p]; s = im.width / a['width']
        fr = next((f for f in a['frames'] if f['direction'] == 'SE' and f['gaitFrame'] == 0), a['frames'][0])
        r = fr['source']
        return im.crop((int(r['x'] * s), int(r['y'] * s), int((r['x'] + r['width']) * s + 1), int((r['y'] + r['height']) * s + 1)))
    if WALKERISH.search(p) and abs(im.width / im.height - 2) < 0.05:
        cw, ch = im.width / 4, im.height / 2
        return im.crop((round(cw), 0, round(2 * cw), round(ch)))
    return None

# ---- records: Astra per-file scale / pivot / footprint -----------------------------------------------------
REC = {}
for rc in glob.glob(W + '/assets-inbox/**/records/*.csv', recursive=True):
    base = os.path.dirname(os.path.dirname(os.path.relpath(rc, W)))
    try: rows = list(csv.DictReader(open(rc, encoding='utf-8-sig')))
    except Exception: continue
    for r in rows:
        f = (r.get('file') or r.get('base') or r.get('base_file') or '').strip()
        if not f.endswith('.png'): continue
        path = f if f.startswith('assets-inbox/') else base + '/' + f
        d = REC.setdefault(path, {})
        for k in ('game_zoom_1_source_scale', 'native_to_world_scale', 'pivot_x', 'pivot_y', 'footprint', 'footprint_tiles_x', 'footprint_tiles_y', 'footprint_x_tiles', 'footprint_y_tiles', 'pivot_units', 'kind'):
            if (r.get(k) or '').strip(): d.setdefault(k, r[k].strip())

# ---- runtime manifests ---------------------------------------------------------------------------------------
WORLD = {a['path']: a for a in ts_consts(W + '/src/render/worldAssetManifest.generated.ts')['runtimeWorldAssetManifest']['assets']}
FAC = {('public/' + a['url']): a for a in ts_consts(W + '/src/render/historicalFacilityManifest.ts')['historicalFacilityManifest']}
DER = {('public/' + d['url']): d for d in ts_consts(W + '/src/render/runtimeAssetDerivatives.generated.ts')['runtimeAssetDerivatives']}
LAND = {('public' + a['url'] if a['url'].startswith('/') else 'public/' + a['url']): a for a in ts_consts(W + '/src/render/townLandscapeManifest.generated.ts')['townLandscapeManifest']}

BASE_FP = {a['key']: (a['footprint']['width'], a['footprint']['height']) for a in WORLD.values() if a.get('footprint')}
def footprint_pivot(it):
    """('px', fw, fh, pivot_x, pivot_y in file px, known) from a manifest or record, or ('front', fw, fh, known):
    the code puts the opaque box's bottom on the footprint's front corner (houses, facilities, variants, farmstead)."""
    p = it['path']; b = os.path.basename(p)
    m = re.search(r'house_pair_l\d_(horizontal|vertical)', b)
    if 'historical-houses/' in p or 'variants-wave2/house_pair' in p:
        if m: return ('front', 2, 1, True) if m.group(1) == 'horizontal' else ('front', 1, 2, True)
        return ('front', 1, 1, True)
    if 'historical-facilities-v1/' in p:
        kind = b.split('-')[0].split('_')[0]
        fw, fh = BASE_FP.get(kind, (1, 1))
        return ('front', fw, fh, kind in BASE_FP)
    if 'variants-wave2/' in p:
        kind = 'mill' if b.startswith('windmill') else b.split('_')[0]
        if b.startswith('house_'): return ('front', 1, 1, True)
        fw, fh = BASE_FP.get(kind, (1, 1))
        return ('front', fw, fh, kind in BASE_FP)
    if 'buildings/farmstead/' in p:
        return ('front', 1, 1, True)
    if p in WORLD and WORLD[p].get('footprint'):
        a = WORLD[p]
        if p.endswith(('/well.png', '/logging_camp.png', '/storehouse.png', '/barn.png')):
            return ('front', a['footprint']['width'], a['footprint']['height'], True)
        return ('px', a['footprint']['width'], a['footprint']['height'], a['anchor']['x'], a['anchor']['y'], True)
    r = REC.get(p) or REC.get('assets-inbox/' + it.get('ledger_file', ''))
    if r and r.get('pivot_x') and ('px' in r.get('pivot_units', 'px') or r.get('pivot_units', '') in ('pixels', '')):
        fw = r.get('footprint_tiles_x') or r.get('footprint_x_tiles'); fh = r.get('footprint_tiles_y') or r.get('footprint_y_tiles')
        if not fw and r.get('footprint') and 'x' in r['footprint']: fw, fh = r['footprint'].split('x')[:2]
        try:
            return ('px', float(fw or 1), float(fh or 1), float(r['pivot_x']), float(r['pivot_y']), bool(fw))
        except ValueError:
            pass
    return ('front', 1, 1, False)

import numpy as _np
HOUSE = {0: 0.4996, 1: 0.4986, 2: 0.4981, 3: 0.4984, 4: 0.4979}
PAIR = {'l2_h': 0.4999, 'l2_v': 0.4973, 'l3_h': 0.4980, 'l3_v': 0.4990, 'l4_h': 0.4998, 'l4_v': 0.4998}
COND = {'house_l0': 0.4294, 'house_l1': 0.3894, 'house_l2': 0.4014, 'house_l3': 0.3705, 'house_l4': 0.4504,
        'pair_l2_horizontal': 0.3823, 'pair_l2_vertical': 0.3358, 'pair_l3_horizontal': 0.3744, 'pair_l3_vertical': 0.3370,
        'pair_l4_horizontal': 0.3922, 'pair_l4_vertical': 0.3537}
def _lvl(p, table=HOUSE, default=0.498):
    m = re.search(r'_l(\d)', os.path.basename(p))
    return table.get(int(m.group(1)), default) if m else default
def _pair(p):
    m = re.search(r'pair_l(\d)_(h|v)', os.path.basename(p))
    return PAIR.get(f'l{m.group(1)}_{m.group(2)}') if m else None
def _cond(p):
    b = os.path.basename(p)
    for k, v in sorted(COND.items(), key=lambda kv: -len(kv[0])):
        if k in b: return v
    return None
def _walker(it, im):
    """17.6 px figure height (VILLAGER_WORLD_SCALE 0.55 x 32) over the figure's alpha height in the front cell."""
    a = _np.asarray(im.convert('RGBA'))[..., 3]
    ys = _np.nonzero((a >= 128).any(1))[0]
    return 17.6 / max(8, (ys.max() - ys.min() + 1)) if len(ys) else None
V2 = {'house_l0': 0.4996, 'house_l1': 0.4986, 'house_l2': 0.4981, 'house_l3': 0.4984, 'house_l4': 0.4979, 'chapel': 0.4981, 'market': 0.4984,
      'windmill': 0.4997, 'well': 0.7081, 'storehouse': 0.8012}
def _variant(it, im):
    b = os.path.basename(it['path'])
    for k, v in V2.items():
        if b.startswith(k): return v
    return 0.4981
FAMILY = [  # (regex on the path, scale per PNG px at zoom 1.0 or a function, basis) — from the draw code
    (r'public/assets/buildings/well\.png$', 0.7081, 'buildingSpriteFit (1×1, fill 0.52)'),
    (r'public/assets/buildings/logging_camp\.png$', 0.6400, 'buildingSpriteFit (1×1, fill 0.87)'),
    (r'public/assets/buildings/storehouse\.png$', 0.8012, 'buildingSpriteFit (2×2, fill 0.87)'),
    (r'public/assets/buildings/barn\.png$', 0.9697, 'buildingSpriteFit (2×2, fill 0.75)'),
    (r'historical-houses/house_pair_', lambda it, im: _pair(it['path']), 'houseCompoundAssets (w+h)×32×0.88'),
    (r'historical-houses/house_l\d', lambda it, im: _lvl(it['path']), 'historicalHouseAssets 0.88×64 opaque width'),
    (r'runtime-mill-v1/mill_body', 0.5, 'animatedMill 68 px'),
    (r'runtime-mill-v1/mill_sails', 0.492, 'animatedMill (skewed, rotated — nominal)'),
    (r'variants-wave2/', _variant, 'buildingVariantAssets: same frame as the base'),
    (r'buildings/farmstead/', 0.4060, 'farmsteadArt 0.85×64 ÷ opaque width'),
    (r'historical-wall/stone_wall_straight', 0.083, 'stoneWallGeometry (only with render-wall-strips=0)'),
    (r'historical-gate/gate_part_stone_arch', 0.1176, 'gateArtRenderer panels — non-uniform, vertical scale'),
    (r'historical-gate/gate_part_timber_frame', 0.147, 'gateArtRenderer panels — non-uniform, vertical scale'),
    (r'historical-gate/gate_part_doors', 0.09, 'gateArtRenderer door leaves — vertical scale'),
    (r'historical-gate/(gate_part_)?palisade', 0.25, 'timberGateRenderer post texture — vertical scale'),
    (r'historical-palisade-reserved/|runtime-reserved-v1/', 0.1, '미사용(그리는 코드 없음) — 0.1로 표시'),
    (r'phase16-house-condition/', lambda it, im: _cond(it['path']), 'houseConditionOverlay: house rectangle'),
    (r'runtime-construction-v1/construction_foundation', 0.1256, 'constructionArtAssets (1×1)'),
    (r'runtime-construction-v1/construction_timber_frame|runtime-construction-v1/construction_frame', 0.1232, 'constructionArtAssets (1×1)'),
    (r'runtime-construction-v1/construction_roof', 0.1192, 'constructionArtAssets (1×1, wave7 truss 없을 때)'),
    (r'runtime-construction-v1/construction_scaffold', 0.0577, 'constructionArtAssets span×0.30 (1×1)'),
    (r'runtime-construction-v1/construction_(wall|salvage)', 0.12, '미사용(reserved) — 형제 배율로 표시'),
    (r'runtime-construction-v1/effect_(dust|smoke)', 0.25, 'constructionCompletionEffects 32×64 per 128×256 frame'),
    (r'runtime-construction-v1/condition_decals', 0.06, 'houseConditionOverlay fallback (0.03–0.09)'),
    (r'wave11/kit_timber/stage_\w+_small', 0.4996, 'constructionKits: L0 house rectangle'),
    (r'wave11/kit_timber/stage_\w+_medium', 0.4981, 'constructionKits: L2 house rectangle'),
    (r'wave11/kit_timber/raising_frame', 0.34, 'constructionKits site prop'),
    (r'wave11/kit_stone/stage_\w+_medium', 0.4984, 'constructionKits: masonry rectangle'),
    (r'wave11/kit_stone/stage_\w+_large', 0.8012, 'constructionKits: storehouse 2×2 fit'),
    (r'wave11/kit_public/stage_\w+_church', 0.4998, 'constructionKits: church rectangle'),
    (r'wave11/kit_public/stage_\w+_keep', 0.5326, 'constructionKits: keep rectangle'),
    (r'wave11/kit_defense/', 0.2, 'constructionKits tower 0.2 (gate 미사용 — 같은 값으로 표시)'),
    (r'wave11/site/(beam|sawpit)', 0.34, 'constructionKits site prop'),
    (r'wave11/site/(mortar|lime|centering|ramp)', 0.4, 'constructionKits site prop (ramp_plank 미사용)'),
    (r'wave11/site/(treadwheel|hoist)', 0.45, 'constructionKits site prop'),
    (r'wave11/work/', 0.178, '0.65 × carrier factor'),
    (r'wave7/construction/roof_frame', 0.5, 'constructionArtAssets TRUSS_SCALE'),
    (r'wave7/(overlay/boarded|season/roof_snow)', lambda it, im: _lvl(it['path']), 'house rectangle (buildingOverlays)'),
    (r'wave9/event/(fire_roof|burnt|abandoned|plague_shut)', lambda it, im: _lvl(it['path']), 'house rectangle (abandoned·plague_shut 미사용)'),
    (r'wave9/event/crowd_manor_gate', 0.55, 'storyWorldProps fixed'),
    (r'wave9/fx/black_smoke', 0.55, 'buildingOverlays fixed'),
    (r'wave9/fx/rain_streak|wave15/fx/snowfall', 1.0, 'screen-space fill, 1 CSS px per PNG px'),
    (r'wave9/(walker|prop/leaving_child)', 0.5, 'storyWorldProps WALKER_SCALE 0.5 per cell px'),
    (r'wave9/decal/soot', 0.7, 'buildingOverlays fixed'),
    (r'wave9/decal/', 0.5, 'seasonalDecals fixed (graves·weeds 미사용)'),
    (r'wave9/field/ridge|/fields/ridge_|wave15/fields/ridge|wave3/.*field/ridge', 0.2795, 'drawArableFields: 128 PNG px per tile (along the axis)'),
    (r'wave9/(pile|prop|signifier)', 0.3, '미사용 — 더미 배율로 표시'),
    (r'(walkers-v2|runtime-actors-v1/actor_|wave11/workers|/workers/|/wk/|/wk_|derived-templates|templates/masters|/actors/)', _walker, 'walkerComposer: figure drawn 17.6 px tall'),
    (r'runtime-actors-v1/cart_', 0.255, 'runtimeActorAssets: cart 17.6 px wide'),
    (r'walker-props-v1/overlay_cloak', 0.275, 'walkerComposer: copied 1:1 into the adult cell'),
    (r'(walker-props-v1/held_|visibility-v1/work/|walker-pilot2/[^/]+/assets/props/)', 0.18, '0.65 × carrier factor (adult ≈0.27)'),
    (r'visibility-v1/construction/well_stages', 0.72, 'constructionPlaque fixed'),
    (r'visibility-v1/(construction|marker)/', 0.5, 'constructionPlaque / worldSigns fixed'),
    (r'visibility-v1/fx/completion_burst', 0.548, 'constructionCompletionEffects (1×1)'),
    (r'visibility-v1/fx/hammer_sparks', 0.44, 'constructionCompletionEffects'),
    (r'visibility-v1/fx/dust_puff', 0.8, 'constructionMoments fallback (1×1)'),
    (r'visibility-v1/fx/smoke_chimney', 0.3, 'roofSmoke fallback'),
    (r'visibility-v1/fx/fire_', 0.5, '미사용 — 0.5로 표시'),
    (r'wave7/pile/|wave3/.*/pile/', 0.3, 'stockPiles PILE_SCALE'),
    (r'wave7/signifier/(tall_grass|footprints)', 0.5, 'worldSigns fixed'),
    (r'wave7/signifier/(bar_latch|bundle_family)', 0.42, 'worldSigns SIGN_PROP_SCALE'),
    (r'wave7/signifier/empty_stall', 0.4, 'worldSigns SIGN_STALL_SCALE'),
    (r'wave7/season/(dry_grass|leaves|frost)|wave15/season/', 0.5, 'seasonalDecals DECAL_SCALE'),
    (r'wave7/fx/(roof_smoke|oven_smoke)', 0.3, 'roofSmoke SMOKE_SCALE'),
    (r'wave7/fx/dust_puff', 0.75, 'constructionMoments (1×1)'),
    (r'wave7/fx/plus_float', 0.5, '미사용 — 0.5로 표시'),
    (r'wave7/cart/cart_load|wave3/.*/loads/cart_load', 0.2689, 'drawWalkers 17.6×0.55÷36'),
    (r'wave7/work/|wave3/.*/props/work_', 0.27, 'walkerComposer: 1.0 in the cell × carrier factor'),
    (r'wave13/.*/work/', 0.178, '설치된 손 소품 계열(0.65 × 운반자 배율) — 추정'),
    (r'boundary/forest_fringe|wave15/boundary/', 0.5, 'drawGroundBoundaries 64×48 × decal scale'),
    (r'boundary/(grass_edge|field_furrow)', 0.5, 'drawGroundBoundaries 64×32'),
    (r'road/stone_strip', 0.485, 'drawRoadRibbons (along a tile axis)'),
    (r'road/earth_strip', 0.363, 'drawRoadRibbons (along a tile axis; v1·v2 URL override only)'),
    (r'fields/furrow_stamp', 0.4, 'drawArableFields 64×length÷1.4 (0.268–0.536)'),
    (r'fields/soil_|zones/(pasture|orchard_floor)|wave15/zones/pasture|wave15/fields/soil', 0.5, 'drawZones floor pattern'),
    (r'wave15/zones/orchard_spring_petals', 0.5, 'seasonalDecals 0.5 × prop scale'),
    (r'zones/orchard_|wave15/orchard/', 0.17, 'zoneLayer 43 × prop scale (0.155–0.180)'),
    (r'zones/haycock_a', 0.234, 'zoneAssetManifest displayWidth 30'),
    (r'zones/haycock_b', 0.203, 'zoneAssetManifest displayWidth 26'),
    (r'zones/haycock_', 0.219, 'zoneAssetManifest displayWidth 28'),
    (r'zones/animals/ox_', 0.240, 'zoneAssetManifest displayWidth 46'),
    (r'zones/animals/', 0.234, 'zoneAssetManifest displayWidth 30'),
    (r'shore/shoreline_deep', 0.2795, 'drawShoreline 128 PNG px per tile'),
    (r'shore/shoreline_', 0.2795, '등록만(로드 안 함) — 같은 계열 배율'),
    (r'shore/(reeds|mudstone)', 0.25, 'drawShoreline fixed width'),
    (r'shore/shallow_|water/', 0.5, 'drawShoreline pattern'),
    (r'public/assets/terrain/', 1.0, 'terrainPatterns 1.0'),
    (r'wave15/terrain/', 0.5, 'seasonGround pattern 0.5'),
    (r'foliage/(shrub|grass_tuft|field_stone)|wave15/foliage/(shrub|grass_tuft|field_stone)', 1.0, 'groundCoverLayout per-instance 0.75–1.25'),
    (r'foliage/stump_fresh', 0.75, 'treeLayout 0.62–0.88'),
    (r'foliage/stump_old', 0.56, 'treeLayout 0.40–0.72'),
    (r'wave15/foliage/tree_oak_large', 0.514, 'same as base tree (renderScale)'),
    (r'wave15/foliage/tree_oak_small', 0.544, 'same as base tree (renderScale)'),
    (r'wave15/foliage/tree_pine_tall', 0.533, 'same as base tree'),
    (r'wave15/foliage/tree_pine_short', 0.524, 'same as base tree'),
    (r'wave15/foliage/tree_birch', 0.533, 'same as base tree'),
    (r'wave15/foliage/tree_dead', 0.520, 'same as base tree'),
    (r'wave15/fx/falling_leaves', 0.75, 'seasonFx LEAF_SCALE'),
    (r'/wall/stone_tower_corner_b', 0.0568, 'drawWallFaces crop 48 px tall'),
    (r'/wall/stone_tower_corner', 0.0737, 'drawWallFaces crop 44 px tall'),
    (r'/wall/stone_pillar', 0.0434, 'drawWallFaces crop 30 px tall'),
    (r'/wall/stone_gate_v3', 0.2510, 'gateArtRenderer 51.2÷204'),
    (r'/wall/(palisade_gate|stone_gate)', 0.147, 'gateArtRenderer panels — vertical scale'),
    (r'/wall/\w*top', 0.156, 'drawWallFaces tops (vertical)'),
    (r'/wall/', 0.17, 'drawWallFaces strip: 205 PNG px per tile along the wall, 128 rows → 20 px (v1 미사용)'),
    (r'module/', 0.25, 'drawShoreline abutment 64 px wide (ferry_landing 등록만)'),
    (r'water-bridges/bridge_wood', 0.63, 'drawBridges affine (deck ≈0.63 along)'),
    (r'water-bridges/water_surface', 0.4225, 'drawWater 742 px crop → 128'),
    (r'water-bridges/', 0.63, '미사용(bridgeWaterKit 호출 없음) — 나무 다리 배율로 표시'),
    (r'yards/croft_bed', 0.2734, 'zoneAssetManifest displayWidth 35'),
    (r'yards/hurdle', 0.5, 'zoneAssetManifest displayWidth = half'),
]
ASTRA_DEFAULT = 0.5  # Astra pipeline spec: game zoom 1.0 = source x 0.5 (wave12 README, wave17 records game_zoom_1_source_scale)

def display(it, im, cat):
    """Scale from the file's pixels to CSS px at zoom 1.0, and where it comes from."""
    p = it['path']
    if p.startswith('public/assets/'):
        for rx, sc, basis in FAMILY:
            if re.search(rx, p):
                v = sc(it, im) if callable(sc) else sc
                if v: return v, basis
    if p in WORLD and WORLD[p].get('renderScale'):
        return WORLD[p]['renderScale'], 'worldAssetManifest renderScale'
    if p in LAND and LAND[p].get('displayWidth'):
        return LAND[p]['displayWidth'] / LAND[p]['width'], 'townLandscapeManifest displayWidth/width'
    if p in FAC and FAC[p].get('displayWidth'):
        a = FAC[p]; k = im.width / a['width']
        return a['displayWidth'] / (a['source']['width'] * k), 'historicalFacilityManifest displayWidth / source rect'
    COMPOSER = r'(/workers/|/wk/|/wk_|derived-templates|templates/masters|/actors/|/props?/held_|/props/work_|walker-pilot2/[^/]+/assets/props/|/work/)'
    if p.startswith('assets-inbox/') and re.search(COMPOSER, p):
        for rx, sc, basis in FAMILY:
            if re.search(rx, p):
                v = sc(it, im) if callable(sc) else sc
                if v: return v, '미설치 — 워커 합성기 규칙(설치된 같은 계열): ' + basis
    r = REC.get(p) or REC.get('assets-inbox/' + it.get('ledger_file', ''))
    if r and r.get('game_zoom_1_source_scale'):
        return float(r['game_zoom_1_source_scale']), 'Astra records game_zoom_1_source_scale'
    if r and r.get('native_to_world_scale'):
        try: return float(r['native_to_world_scale']), 'Astra records native_to_world_scale'
        except ValueError: pass
    if p.startswith('assets-inbox/'):
        for rx, sc, basis in FAMILY:
            if re.search(rx, p):
                v = sc(it, im) if callable(sc) else sc
                if v: return v, '미설치 — 설치된 같은 계열 배율: ' + basis
    if it.get('ledger_file'):
        return ASTRA_DEFAULT, 'Astra 규격 기본(원본×0.5) — 코드 배율 미확인'
    return 1.0, '미확인(파일 1:1)'
