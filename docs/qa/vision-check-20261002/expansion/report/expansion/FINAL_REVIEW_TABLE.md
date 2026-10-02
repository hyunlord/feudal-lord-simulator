# 최종 사람 판정 표

평가범위 안의 모든 후보와 놓침. 전체 미평가 후보는 MATCHES.json에 남긴다.

| 장면 | 검출기 | 판정 | 후보 ID | 정답 ID | 근거 |
|---|---|---|---|---|---|
| exp-main-coast | straight_boundary | TP | a69b24f69e24 | EXP-straight_boundary-coast-south | Spatial one-to-one match |
| exp-main-coast | straight_boundary | TP | 8f74e9201c4f | EXP-straight_boundary-coast-north | Spatial one-to-one match |
| exp-main-coast | tile_seam | TP | a857ec396790 | EXP-tile_seam-coast-south | Spatial one-to-one match |
| exp-main-coast | tile_seam | TP | 4b640e5718fe | EXP-tile_seam-coast-north | Spatial one-to-one match |
| exp-main-fen | straight_boundary | FP | adfa49850037 | - | No unmatched annotated target |
| exp-main-fen | straight_boundary | FN | - | EXP-straight_boundary-fen-east | 습지 동쪽 작은 바위. 나무에 오른편이 가려졌으나 왼쪽 두 사선 절단과 검은 사각 반복이 보임. |
| exp-main-fen | tile_seam | FN | - | EXP-tile_seam-fen-east | 습지 동쪽 작은 바위. 나무에 오른편이 가려졌으나 왼쪽 두 사선 절단과 검은 사각 반복이 보임. |
| exp-main-forest | straight_boundary | TP | 3cab279ede0d | EXP-straight_boundary-forest-north | Spatial one-to-one match |
| exp-main-forest | tile_seam | TP | 2f54806c2178 | EXP-tile_seam-forest-north | Spatial one-to-one match |
| exp-holdout-forest-s2 | straight_boundary | TP | cda84e722659 | EXP-axis-forest-s2-east | Spatial one-to-one match |
| exp-holdout-forest-s2 | straight_boundary | TP | 0bcbd62277d0 | EXP-axis-forest-s2-west-middle | Spatial one-to-one match |
| exp-holdout-forest-s2 | straight_boundary | FN | - | EXP-axis-forest-s2-west-bottom | 숲 지도2 서남쪽 쓰러진 나무 옆 흙 판의 세로 직각 절단 |
| exp-recall-chalk | straight_boundary | TP | dbaee1c29569 | EXP-straight_boundary-chalk-east-reused | Spatial one-to-one match |
| exp-recall-chalk | tile_seam | TP | a25ffc872668 | EXP-tile_seam-chalk-east-reused | Spatial one-to-one match |
| exp-main-chalk-wide | straight_boundary | TP | ce5c09f606d1 | EXP-straight_boundary-chalk-west-new | Spatial one-to-one match |
| exp-main-chalk-wide | tile_seam | TP | e09132ec7417 | EXP-tile_seam-chalk-west-new | Spatial one-to-one match |
| exp-prenat2-city-confirm | stationary_person | TP | exp-prenat2-city-confirm:stationary_person:figure:0 | QA002-visible-1 | Spatial one-to-one match |
| exp-prenat2-city-confirm | stationary_person | TP | exp-prenat2-city-confirm:stationary_person:figure:1 | QA002-visible-4 | Spatial one-to-one match |
| exp-prenat2-city-confirm | stationary_person | TP | exp-prenat2-city-confirm:stationary_person:figure:2 | QA002-visible-8 | Spatial one-to-one match |
| exp-prenat2-city-confirm | stationary_person | TP | exp-prenat2-city-confirm:stationary_person:figure:5 | QA002-visible-19 | Spatial one-to-one match |
| exp-prenat2-city-confirm | stationary_person | TP | exp-prenat2-city-confirm:stationary_person:figure:15 | EXP-QA002-visible-54 | Spatial one-to-one match |
| exp-prenat2-city-confirm | stationary_person | TP | exp-prenat2-city-confirm:stationary_person:figure:23 | EXP-QA002-visible-82 | Spatial one-to-one match |
| exp-prenat2-city-confirm | stationary_person | TP | exp-prenat2-city-confirm:stationary_person:figure:72 | QA002-visible-6 | Spatial one-to-one match |
| exp-prenat1-city-confirm | roof_overlap | TP | exp-prenat1-city-confirm:roof_overlap:figure:81 | PRENAT1-static-roof-4 | Spatial one-to-one match |
| exp-prenat1-city-confirm | roof_overlap | TP | exp-prenat1-city-confirm:roof_overlap:figure:82 | PRENAT1-static-roof-19 | Spatial one-to-one match |
| exp-prenat1-city-confirm | roof_overlap | TP | exp-prenat1-city-confirm:roof_overlap:figure:83 | EXP-QA005-static-roof-36 | Spatial one-to-one match |
| exp-prenat1-city-confirm | roof_overlap | TP | exp-prenat1-city-confirm:roof_overlap:figure:87 | EXP-QA005-static-roof-54 | Spatial one-to-one match |
| exp-prenat1-city-confirm | roof_overlap | TP | exp-prenat1-city-confirm:roof_overlap:figure:95 | EXP-QA005-static-roof-82 | Spatial one-to-one match |
| exp-prenat1-roof-confirm | roof_overlap | TP | 4835cd53be86 | QA005-NW-wall-moving-figure | Spatial one-to-one match |
| exp-prenat1-city | scale_ratio | TP | exp-prenat1-city:scale_ratio:0 | scale-seed2-rain-barrel | Spatial one-to-one match |
| exp-prenat1-city | scale_ratio | TP | exp-prenat1-city:scale_ratio:1 | scale-seed2-upright-barrel | Spatial one-to-one match |
| exp-prenat1-city | scale_ratio | TP | exp-prenat1-city:scale_ratio:2 | scale-seed2-grain-sack | Spatial one-to-one match |
| exp-seed4-middle | scale_ratio | TP | exp-seed4-middle:scale_ratio:0 | scale-seed4-rain-barrel | Spatial one-to-one match |
| exp-seed4-middle | scale_ratio | FN | - | scale-seed4-cottage-door | Fresh blind. Cottage usable doorway opening about14-16px vs adult20-24px, below1.15-1.40H with10percent tolerance. One independent door, not all repeated cottages counted. |
| exp-prenat1-city | repeat_density | TP | exp-prenat1-city:repeat_density:0 | yarn-seed2-north | Spatial one-to-one match |
| exp-prenat1-city | repeat_density | TP | exp-prenat1-city:repeat_density:1 | yarn-seed2-south | Spatial one-to-one match |
| exp-seed1-ch5-detail | repeat_density | TP | exp-seed1-ch5-detail:repeat_density:0 | yarn-seed1-east | Spatial one-to-one match |
| exp-seed1-ch5-detail | repeat_density | TP | exp-seed1-ch5-detail:repeat_density:1 | yarn-seed1-south | Spatial one-to-one match |
| exp-seed1-ch5-detail | repeat_density | FP | exp-seed1-ch5-detail:repeat_density:2 | - | No unmatched annotated target |
| exp-seed1-ch5-detail | repeat_density | FN | - | yarn-seed1-middle | Fresh blind: five conspicuous identical coils in central residential street; excludes southern row. |
