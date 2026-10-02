# 최종 대응 직접 확인

FINAL_MATCH_REVIEW.jpg의 번호와 일치. 녹색은 정답, 빨간색은 검출. TP17개는 실제 같은 대상을 확인했다. FP2개는 중복 숲 경계와 정상 통 재고, FN2개는 짧은 경계와 복합 그림 통이다.

|번호|결과|장면|검출기|정답/후보|근거|
|---|---|---|---|---|---|
|1|FP|prenat1-city|repeat_density|prenat1-city:repeat_density:1|Human semantic rejection; spatial match forbidden|
|2|TP|current-chalk|straight_boundary|QA039-rock-mass|Spatial one-to-one match|
|3|TP|current-chalk|tile_seam|QA039-black-stamps|Spatial one-to-one match|
|4|TP|current-forest|straight_boundary|QA040-north-middle|Spatial one-to-one match|
|5|TP|current-forest|straight_boundary|QA040-bottom|Spatial one-to-one match|
|6|TP|current-forest|straight_boundary|QA040-north-right|Spatial one-to-one match|
|7|TP|current-forest|straight_boundary|QA040-south-left|Spatial one-to-one match|
|8|TP|current-forest|straight_boundary|QA040-north-left|Spatial one-to-one match|
|9|FP|current-forest|straight_boundary|2526fd42422a|No unmatched annotated target|
|10|FN|current-forest|straight_boundary|QA040-north-step|중앙 수직 계단|
|11|TP|prenat2-city-confirm|stationary_person|QA002-visible-1|Spatial one-to-one match|
|12|TP|prenat2-city-confirm|stationary_person|QA002-visible-4|Spatial one-to-one match|
|13|TP|prenat2-city-confirm|stationary_person|QA002-visible-8|Spatial one-to-one match|
|14|TP|prenat2-city-confirm|stationary_person|QA002-visible-19|Spatial one-to-one match|
|15|TP|prenat2-city-confirm|stationary_person|QA002-visible-6|Spatial one-to-one match|
|16|TP|prenat1-city-confirm|roof_overlap|PRENAT1-static-roof-4|Spatial one-to-one match|
|17|TP|prenat1-city-confirm|roof_overlap|PRENAT1-static-roof-19|Spatial one-to-one match|
|18|TP|prenat1-city|repeat_density|OBJ-YARN-01|Spatial one-to-one match|
|19|TP|prenat1-city|scale_ratio|OBJ-BARREL-02|Spatial one-to-one match|
|20|FN|prenat1-city|scale_ratio|OBJ-BARREL-01|중앙 주택 앞 세로 나무통. 성인 약17.6px에 비해 통 몸통 약30px, 통 기준0.45–0.65H 초과. 왼쪽 넓은 곡물통은 용도 불명으로 별도 제외.|
|21|TP|prenat1-roof-confirm|roof_overlap|QA005-NW-wall-moving-figure|Spatial one-to-one match|