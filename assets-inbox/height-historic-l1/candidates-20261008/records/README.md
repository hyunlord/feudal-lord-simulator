# RB-HEIGHT-HISTORIC-L1 — 후보 7장 인계

**후보 아트만 제작했다. 설치·실제 게임·DGX 검증은 하지 않았다. 엄격한 정적 정합 전체 통과를 주장하지 않는다.**

긴 초가박공, 크림 목골, 앞 열린 창과 문, 오른쪽 닫힌 덧창을 보존했다. 본체 5차를 선택했고 앞선 4차는 문잎 높이/폭 또는 발판 기하 부족으로 보존했다. 총 생성 11회(본체5+상태층6). 모델 이름/seed는 내장 imagegen이 반환하지 않았다. 프롬프트는 prompts/, 원시는 raw/, 원본은 originals/에 있다.

## 설치 담당이 사용할 파일

HANDOFF7/의 아래 7개만 최종 후보다. 모두 139×175 RGBA, pivot=(71.66148325358851,161.92025518341308), world scale=0.4986217267599071, footprint=1×1. 원래 pivot y에 위쪽 공간36을 더했으며 바닥 세계 위치는 유지한다.

|역할|파일|SHA256|
|---|---|---|
|body|HANDOFF7/house_l1-historic-body-v3.png|7742bd9d112750bf034993d221071f901c5a04ec7efe0d6d9286ee638c75c5b8|
|snow|HANDOFF7/house_l1-historic-snow-v3.png|8fe87ced5575f4f00fde9b5764bb4dd0f0699a20c656b8ba0c13d3a1cad56e5c|
|boarded|HANDOFF7/house_l1-historic-boarded-v3.png|5271937497b45492922951b250ba5b47014ba953ed9be88ac2c764e1cfaaec55|
|strained|HANDOFF7/house_l1-historic-strained-v3.png|f7c4026670f40199809f0a4ea4a1a452d9ccc1f2934d7cbc9fb13d8331490310|
|neglected|HANDOFF7/house_l1-historic-neglected-v3.png|cbe030d4f68902c966be991559992fe0b1db80e72dae1183709bcf2bce91683f|
|vacant|HANDOFF7/house_l1-historic-vacant-v3.png|5bbc55b9b47479547e3ad9f9c066681d4a3e1699391dd6de3ac0f951390432d7|
|plague-shut|HANDOFF7/house_l1-historic-plague-shut-v3.png|e4d9d57331f3953a240df271c034a51cb1d1c25f640320242801b6ed58788d5c|

## 치수와 등록

문틀을 제외한 실제 나무 문잎의 양쪽 수직 끝점을 원시에서 판독했다. 왼쪽44.512/오른쪽44.616 native, 투영폭17.160 native. world높이22.195/22.247, 폭8.556이며 어른17.6 대비 높이1.261/1.264, 폭0.486이다. 수동 끝점 오차는±1.2 native를 따로 둔다. 권장43~47×19~20native는 절대 관문이 아니고 바이블 world비율 높이1.15~1.40·폭.45~.65의 중앙값을 충족한다. 문틀을 넣어 높이를 부풀리지 않았다. door-source-grid.png에 원시 측정 격자가 있다.

본체 전체에 동일배율.104, translation(13,12)를 적용했다. 발판3점은 원본+위패딩36 기준 최대 좌표잔차.488native(수동판독오차±1.5 별도). 전체 확대/축소 등록 외 부위조립·워프·마스크절단·도어만후처리는 없다. 등록은 Pillow whole-canvas inverse affine BICUBIC, inverse tuple=(1/s,0,-tx/s,0,1/s,-ty/s), output139×175. 상세 raw SHA/계수는 manifest.json에 있다.

층은 본체 기준 전용 생성이다. 기본 층은 s=139/rawWidth,translation(0,0); strained만 전체(-5,+22), snow만 s=(139/rawWidth)*.92,translation(+2,+1). 눈 최초등록 오른쪽돌출은 보존했고 전체균등재등록으로 줄였다. 부분 마스크로 눈을 자르지 않았다. 모든 최종 파일의 alpha 유효픽셀 offcanvas 소실0; body 원시 바깥테두리에는 낮은alpha 픽셀84개가 남지만 alpha>32/≥128은0이다. 이 수치와 등록 소실은 다른 개념이며 manifest에 분리했다.

## 상태별 기존 기능 유지

- snow: roofSnowAlpha 겨울/봄 해빙용.

- boarded: abandonedTick 일반 폐쇄, 창2곳과 문1곳에 X형 판자.

- strained: 거주중 경미한 유지 부족, 문 오른쪽 매우 작은 훼손. 매우 약하게 보이는 것이 원본 역할과 일치한다.

- neglected: 거주중 더 심한 유지 부족, 지붕 작은 훼손과 문 오른쪽 벽손상.

- vacant: residents<=0인 빈집, 지붕/오른쪽 벽손상과 앞창 한 줄 판자. abandoned와 같은 상태로 합치지 않는다.

- plague-shut: 역병 빈집+abandoned 조건의 창2곳 닫힌 덧창, 일반X판자와 구별. 문전체나 옛본체를 복제하지 않는다.

화재/fire_roof·전소/burnt는 기존 fallback을 유지하며 이 7장 범위가 아니다. consumer조건 및 우선순위는 준비문서/설치담당 소유다.

## 눈 및 합성의 남은 한계

수동 지붕 폴리곤4515px에서 가중덮임65.865%, alpha>32 이진68.704%, alpha≥128 이진66.512%. 마스크는 오직 측정용이고 아트에 적용하지 않았다. 마스크 밖 alpha>32 118px, 가중106.667px, 최대Chebyshev거리4native, 마스크판독오차±2native. **오른쪽 박공 경사 밖으로 세로로 처진 눈 조각이 남는다.** 밝은/어두운 정적합성 모두 공개했다. 설치담당은 실제 줌1.0/.6에서 이 조각이 처마눈으로 붙어 보이는지, 떨어져 떠 보이는지 반드시 확인한다. 따라서 눈까지 엄격한 정적정합 통과라고 표기하지 않는다. 필요하면 내장imagegen 수정이며 부분클립은 금지한다.

proofs/의 밝은/어두운 합성은 등록한 새 본체+각층이다. root도6개밝은합성을 직접 확인하여 판자위치·vacant/plague 구별을 확인했고 위 눈잔차를 지적했다. 새게임 장면은 아니다. body 비교·알파·해시검사는 실제 렌더 소비나 게임월드 투영 검증을 대신하지 않는다.

## 근거/재현

SOURCES.json: 원본경로·치수·SHA. archive1254 본체는 runtime139와 내용/등록이 달라 재료 참고로만 사용했다. manifest.json: 역할별 최종/원시SHA·등록·alpha경계·offcanvas. MEASUREMENTS.json: 문끝점·발판·눈 지붕폴리곤. SHA256SUMS: 자기자신을 제외한 모든 파일. 저장소코드·public·장부·커밋·DGX는 변경하지 않았다.
