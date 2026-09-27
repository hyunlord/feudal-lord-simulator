"""Sub-groups inside each sheet: layout sections and the population each z-score is computed in."""
import re
def group_of(it, cat, single_colour=False):
    p = it['path']
    if cat == 'C1':
        if re.search(r'(/overlay/|/event/|/active/|roof_snow|condition_decals|phase16-house-condition)', p): return (4, '집·시설 오버레이(판자·방치·화재 흔적·역병·지붕 눈·가동 소품·상태 레이어)')
        if re.search(r'(kit_|stage_|roof_frame|construction_|raising_frame|centering)', p): return (3, '공사 단계(기초·골조·지붕틀·비계)')
        if re.search(r'(/house_l\d|/house_pair|historical-houses/|/houses/|l1-tile|variants-wave2/house_|wave2/house_)', p): return (1, '주택(L0~L4·변형·Wave 2 변형·Wave 20 시대별)')
        return (2, '시설·공공 건물')
    if cat == 'C2':
        if re.search(r'(animal|/herd/|/cart/|/rider/|/pack/|zones/animals|cart_hand|cart_ox)', p): return (2, '동물·수레·무리')
        return (1, '워커(정면 SE 셀)')
    if cat == 'C4':
        if re.search(r'(/wall/|historical-wall|historical-gate|historical-palisade|stone_wall|/fence/|hurdle|water-bridges|/module/)', p): return (3, '성벽·울타리·다리·교대')
        if re.search(r'(foliage|/tree/|/orchard/|forest_fringe|shrub|tree_|phase16-landscape/orchard)', p): return (2, '나무·수풀·숲 가장자리')
        return (1, '지면·띠(도로·물가·물·이랑·목초지·계절 지면·데칼)')
    if cat == 'C6':
        if single_colour: return (3, '단색 마스크(문장·상인 표식·인장 — 코드에서 색칠, 통계 제외)')
        from scales import ICONISH
        if ICONISH.search(p): return (1, '아이콘(셀마다 24 px)')
        return (2, 'UI 조각(틀·버튼·질감·장식 — 높이 64 px로 축소)')
    if cat == 'C8':
        if 'scenes_' in p: return (2, 'Wave 19 장면 그림(투명 배경 소품형)')
        return (1, '회화 삽화(키아트·로딩·이벤트·연대기·결정·장)')
    return (1, {'C3': '소품·더미·적재물·기표·손에 든 물건·작업 도구', 'C5': '효과·연기·불', 'C7': '초상'}.get(cat, ''))
