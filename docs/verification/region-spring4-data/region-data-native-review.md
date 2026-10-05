# REGION DATA20 독립 native·수치 검토

**PASS — bd84351a의 제한된 DATA20 범위.** AFTER 원본 PNG20장과 positive 봄 BEFORE 원본8장을 각각 view_image로 개별 열람했다. contact sheet로 대체하지 않았다. 수치 PASS만으로 시각 판정을 내리지 않았으며, 실제 열람에서 이 변경을 차단할 새 경계·반복무늬·명암 결함은 발견하지 않았다.

## 실제 시각 관찰

| 장면 | zoom1 / .6의 BEFORE→AFTER 관찰 | 판정 |
|---|---|---|
| chalk_downs 봄2 | 올리브빛 잔디가 더 선명한 초록과 거친 잎결로 변한다. 강 굴곡·갈색 heath island·바위·마을 외곽에서 기존 영역을 유지한다. .6에서도 새 빈 chunk/직선 이음선은 보이지 않는다. | PASS |
| coastal_port 봄2 | 균일한 회녹색이 작은 밝고 어두운 얼룩을 가진 초록으로 바뀐다. 해안의 좁은 가장자리 strip, 하구와 바다, 녹색 meadow 구분이 유지된다. 바다로 새 질감이 넘치지 않는다. | PASS |
| fen_drainage 봄2 | 습지 부분이 더 어두운 올리브색이 되어 grass/pond와의 대비가 커진다. 물·풀 경계와 기존 곡선 영역이 유지된다. .6에서 강한 반복 사각형이나 비어 있는 틈은 발견하지 않았다. | PASS |
| forest_edge 봄2 | 숲 바닥이 약간 따뜻한 황갈색으로 바뀌며 변화가 다른3종보다 작다. 마을 중앙 road와 grass, 숲 및 바위 접합이 읽히고 새 layer 덮임/끊김은 없다. | PASS |
| summer/winter8, open_field 봄2, chalk summer/winter .6 reference2 | 총12장 개별 열람. 기존 비·웅덩이·흰 겨울 입자·grass grid·지역 가장자리를 유지한다. 새 봄 질감이 나타나는 결함은 보이지 않는다. | unchanged PASS |

기존의 날카로운 지역 윤곽, 일부 물/grass grid, 겨울의 강한 grain과 밝은 대비는 여전히 보인다. 이번 DATA에서 새로 생긴 실패로 분류하지 않는다. 미세 반복 질감은 보이지만 이 정지 화면들에서 차단할 정도의 새 hard tile seam은 관찰하지 못했다. 모든 움직임·줌 중 shimmer가 없다는 뜻은 아니다. 도로/건물 접합은 forest 장면과 .6 마을이 주요 관측 근거이며 모든 footprint/활동 상태를 포괄하지 않는다.

## 독립 수치 검산

Pillow+NumPy로 AFTER20/REPEAT20/BASELINE20의 원본60PNG를 직접 decode했다. 전체 RGBA hash와 capture metadata를 교차 확인하여 A/A20 정확 동일, errors0, physical identity20 일치를 확인했다. positive8은 신규 URL request/decode/paint lineage 및 실제 pixel 변화가 모두 있고, negative12는 expectedRequests까지 포함한 full identity와 RGBA 정확 동일 및 첫-open new4 paint 부재가 성립한다.

| positive | 변경 pixel 수 |
|---|---:|
| region4-chalk_downs-spring-z1 | 677171 |
| region4-chalk_downs-spring-z06 | 481939 |
| region4-coastal_port-spring-z1 | 389109 |
| region4-coastal_port-spring-z06 | 204026 |
| region4-fen_drainage-spring-z1 | 386547 |
| region4-fen_drainage-spring-z06 | 202308 |
| region4-forest_edge-spring-z1 | 303443 |
| region4-forest_edge-spring-z06 | 144683 |

20개 baseline PNG SHA도 manifest와 일치한다. catalog provenance의 canonical source4와 public runtime4를 직접 SHA 재계산하여4/4 바이트 동일을 확인했다. PNG 경로·각 SHA·개별 열람 여부·행별 수치는 JSON에 기록했다. paint lineage와 전체 canvas 변화는 source별 최종 visible pixel의 인과분리 증명이 아니며, 위 native 관찰은 실제 화면의 제한된 변화 확인이다.

## actual source/export 영수증

actual remote pre/post guard 모두 `bd84351abb1e36d6b03f7fa03d4ec4f9484ed23d`, trackedClean=true, input27053/export27054, fullInputMap SHA `b0054c259f40f4801f97293d5b8717f6704ec434ebc8b185f3ea0805390dc8a7`로 일치한다. 최종 freeze coverage/hash는 직전 wrapper 독립 검토에서 전수 확인했다. 이번에는 실제 반환된 pre/post 영수증을 확인했으며 원격 명령을 새로 실행하지 않았다.

외부 node_modules 전체는 동일하지 않다. pre5488→post5503으로15개 생성: `.vite/deps/`13개와 `.cache/keyart-derivatives/`2개. 두 전체 hash map을 직접 비교하여 기존5488 변경0/삭제0을 확인했다. 이 생성 cache 추가와 tracked/input27053 불변을 구분하며 external 전체 바이트 동일이라고 주장하지 않는다. 정확 추가 경로는 JSON에 있다.

## 한계와 완료 범위

repeat source 배열이 저장되지 않아 repeat new4 absence는 미관측이다. 이번20뷰에는 autumn/DPR2가 없고 임의 seed/camera, 동적 panning/zoom, 향후 HEAD 및 본선 이관을 승인하지 않는다. 부모의 별도 native 검토와 publication 단계는 별도 책임이다. reviewer는 제품·원본 이미지·장부·Git·DGX를 변경하지 않고 지정 MD/JSON만 작성했다.
