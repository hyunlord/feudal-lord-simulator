# 물건 초기 enhanced 매칭 육안 재검토

검토 대상은 `enhanced-findings-initial.json`과 `score-enhanced-initial/MATCHES.json`이다. 최종 source mapping 재실행 이전의 초기 결과이며 최종 점수로 제시하면 안 된다. 동결 GT는 수정하지 않았다. 주석 contact는 초록=고정 정답, 빨강=초기 검출이다.

## scale_ratio: 초기 3TP / 2FN

| 후보 / 정답 | 공간 판정 | 원본 의미 대조 |
|---|---|---|
| exp-prenat1-city:scale_ratio:0 / seed2 rain barrel | TP | 빗물통을 실제로 둘러싼다. 일부 좌측 여백 포함하지만 사람보다 큰 일반 통이라는 의미가 일치한다. |
| exp-prenat1-city:scale_ratio:1 / seed2 upright barrel | TP | brewery의 가운데 세로 보관통이다. 왼쪽 교반용 mash tub와 혼동하지 않았다. |
| exp-prenat1-city:scale_ratio:2 / seed2 grain sack | TP | 세로통 오른쪽 곡물 자루다. 위치·종류가 일치한다. |
| scale-seed4-rain-barrel | FN | 화면 좌하(546,570,25,31)의 빗물통이 실제로 남아 있으나 scale 후보가 없다. |
| scale-seed4-cottage-door | FN | (578,568,12,16)의 초가 출입문 개구부가 성인보다 작다. 후보가 없다. |

**seed4의 공통 상류 누락:** 원본 capture 첫 프레임에는 `/assets/walkers-v2/wk_servant_m_01-v1.png` 두 draw와 `/assets/walkers-v2/wk_labor_f_04-v1.png` 한 draw가 있다. 검토 시 `scale.py:detect_scale`의 사람 분류는 person:, /villagers/, /people/, /walker/wk_, /workers/wk_로 한정하며 `/walkers-v2/`가 없다. 따라서 visible human reference 최소3개에 도달하지 못하고 전체 scale 함수가 조기 반환하는 것이 직접 확인되는 누락 경로다. 문 컴포넌트 추출 자체도 별도로 필요한 조건이라 사람 분류만 고치면 문까지 회수된다고 단정하지 않는다. 일반 문 개구부 원본 계측은 기존 바이블1.15–1.40H 대조로 유지한다.

## repeat_density: 초기 2TP / 3FN

두 seed2 후보는 실제 흰 실타래를 둘러싸며 에일통 재고를 잘못 매칭한 것이 아니다.

| 후보 | 초기 상자 | 육안 판정 |
|---|---|---|
| exp-prenat1-city:repeat_density:0 |1199,142,287,233|북쪽 별개 주택열의 과도한 흰 고리 반복과 일치|
| exp-prenat1-city:repeat_density:1 |783,392,412,191|남서 주택열의 흰 고리 반복과 일치|
| exp-seed1-ch5-detail:repeat_density:0 |658,454,412,296|12개 흰 고리를 한 큰 사각형으로 병합. 문제의 존재는 읽지만 별개 세 주택열을 국소화하지 못함|
| exp-seed1-ch5-detail:repeat_density:1 |680,232,447,360|제재소 반복 후보. 실타래 정답으로 대체 매칭하면 의미 오류|

seed1은 **감지 자체가 전혀 없는 3FN이 아니다.** 큰 yarn 후보가 세 군집의 일부를 걸치며 정상 길/건물/빈 영역까지 포함한다. 고정된 IoU·예측영역50% 포함·중심 포함 기준을 만족하는 단일 정답이 없어 회수0이다. 초기 점수표에서 큰 후보 중심이 부분검토 ROI 밖이면 excluded가 되므로 이 FN만 보고 정밀도100%를 일반 장면 정밀도라고 읽으면 안 된다. 큰 영역 후보의 구획 실패를 해결해야 하며 GT를 넓혀 성공시키면 안 된다.

source mapping 선행확인: `/public/assets/wave3/pile/yarn_skeins_1.png`는 wt-current와 wt-prenat1에서 SHA256 `ab4d4af4481222bcce03ecc20174ad3acd9057243d35103846c06daba231268b`로 동일하다. 따라서 이번 yarn 병합 상자 문제를 이 PNG의 버전 차이만으로 설명할 수 없다. 다른 집/마스크 소스는 mapping 재실행 후 별도 확인할 부분이다.

## 정상 재고 오탐 대조

초기 결과에서 exp-current-city의 repeat_density 후보는 **0개**다. 고정 정상 ROI5(북·남 에일재고, 작업장 장작/물품, 창고 상자, 시장 물품)를 원본에서 보았으며 실제 정상 재고라는 판정을 유지한다. exp-prenat1-city도 yarn 두 후보 외 반복 후보가 없으므로 옛 회차의 에일통 군집을 TP로 잘못 재활용하지 않았다. 다만 이것은 지정 ROI에서의 정상 대조 결과이고 모든 에일통/장작/상자 표현에 대한 오탐 제로 증명은 아니다.

## 증거

- OBJECT_MATCH_exp-prenat1-city.jpg: 통·자루·실타래의 실제 표적과 초기 상자 대조
- OBJECT_MATCH_exp-seed1-ch5-detail.jpg: 세 정답 군집과 과대한 하나의 yarn 후보
- OBJECT_MATCH_exp-seed4-middle.jpg: 두 scale 미검출 물건
- OBJECT_TRUTH_normal_stocks.jpg: 정상 재고5구역(이전 직접 육안 확인 원본에서 파생)

검출기 코드·게임 src·동결 정답 파일은 변경하지 않았다.

입력 `enhanced-findings-initial.json` SHA256 `52ee5eebd04cff31456f4a9c2c8ef299258ef436f5f8a98a45b8d5d09985e288`.

입력 `score-enhanced-initial/MATCHES.json` SHA256 `ed7b17699579ba037817c2081811925214b360a66655128bdd566b438e37471c`.

## 원본 draw 독립 재계수 — 중앙 군집 note 정정

동결 `yarn-seed1-middle` note의 “five”는 육안 계수 오기다. 원본과 draw를 대조하면 실제 해당 ROI의 실타래는 **4개**다: draw787 `(575,558,38,25)`, draw798 `(450,579,38,25)`, draw812 `(492,600,38,25)`, draw816 `(658,600,38,25)`. 앞의 세 개 중 일부는 앞집·난간에 가려져 있으나 흰 고리 형태가 화면에 남아 있고 816은 뚜렷하다. `(625,595)` 근처 흰 부분은 yarn draw가 아니라 연기/집/우물 겹침이라 추가 실타래로 세지 않는다. `OBJECT_MATCH_seed1_middle_copies.jpg`에 원본 draw 위치와 order를 표시했다. 군집의 과다반복 판정은 네 별개 문앞 물건으로 유지하지만, 정답의 잘못된 설명을 숨기지 않는다. 동결 파일과 SHA는 변경하지 않았다.
