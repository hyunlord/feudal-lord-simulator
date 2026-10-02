# 최종 물건 매칭 육안 검토

`baseline-datasets/{prenat1,current,prenat2}/enhanced-final/findings.json`를 원본 화면·동결 ROI와 대조했다. 자동 공간 매칭을 뒤집어야 할 의미 오류는 발견하지 않았다. **추가 수동 거부 ID 없음**(`final-object-rejections.json`). 같은 남쪽 군집의 중복 경보는 FP로 유지한다.

| 검출기 | TP | FP | FN | 정밀도 | 재현율 |
|---|---:|---:|---:|---:|---:|
| scale_ratio |4|0|1|100%|80%|
| repeat_density |4|1|1|80%|80%|

위 값은 동결 ROI에 한정하며 전체 화면 정밀도가 아니다. 새 양성/음성을 최종 후보에 맞추어 추가하거나 GT를 이동하지 않았다.

## scale_ratio 전수 대조

| 후보 ID | 판정 | 직접 확인한 표적 |
|---|---|---|
| exp-prenat1-city:scale_ratio:0 |TP|seed2 세로 빗물통 몸체. 좌측 여백이 줄고 실제통을 둘러쌈|
| exp-prenat1-city:scale_ratio:1 |TP|brewery 중앙 세로 보관통. 큰 교반 vat와 다름|
| exp-prenat1-city:scale_ratio:2 |TP|통 옆 곡물 자루. 좌우반전 원본의 실제 자루 위치|
| exp-seed4-middle:scale_ratio:0 |TP|작은집 좌측 빗물통. 544,570,26,33 검출이 동결표적을 둘러쌈|
| scale-seed4-cottage-door |FN|578,568,12,16 문은 여전히 작지만 경보 없음|

정상 크기 ROI3(작은 통·수레바퀴2)에는 후보가 없다. seed4 scale:1의 다른 통 및 current의 scale0–2는 정답 coverage 밖이므로 이 표의 TP/FP가 아니다. 이미 본 같은 물건의 다른 커밋·줌으로 표본 수를 늘리지 않는다.

## repeat_density 전수 대조

| 후보 ID / 표적 | 판정 | 직접 확인한 의미 |
|---|---|---|
| exp-prenat1-city:repeat_density:0 |TP|북쪽 흰 실타래 주택열. 에일통 더미로 잘못 매칭하지 않음|
| exp-prenat1-city:repeat_density:1 |TP|남서 흰 실타래 주택열|
| exp-seed1-ch5-detail:repeat_density:0 |TP|동쪽 주택열의 실타래|
| exp-seed1-ch5-detail:repeat_density:1 |TP|남쪽 군집의 왼쪽 부분을 포함. 상자가 중앙 일부까지 걸치지만 고정 match조건 만족하며 실타래라는 의미도 일치|
| exp-seed1-ch5-detail:repeat_density:2 |FP|남쪽 군집 오른쪽을 별도 경보. 실제 실타래 문제지만 같은 고정 군집의 두번째 경보여서 중복 FP|
| yarn-seed1-middle |FN|중앙 군집이 독립 표적으로 회수되지 않음. 왼쪽/북쪽 고리를 놓치고 남쪽과 일부 섞음|

`:2`를 정상 재고 오탐이라고 쓰지 않으며, 실제 문제를 담았다는 이유로 두번째 TP로 세지도 않는다. `:1`의 중심/포함영역을 이유로 중앙 FN을 회수한 것으로 바꾸지 않는다. 이 분할·병합 한계가 남는다. 중앙 note의 five→four 계수 정정은 OBJECT_MATCH_REVIEW.md에 기록했으며 동결 GT를 변경하지 않았다.

## 정상 재고 다섯 ROI

current 원본의 북쪽 에일재고, 남쪽 에일재고, 작업장 장작/물품, 창고 상자, 시장 물품은 여전히 정상 반복이다. **최종 current repeat_density 후보 전체 0개**, 따라서 지정5ROI 후보도0이다. normal 음성5는 같은 도시의 다섯영역이며 독립 도시 다섯개로 해석하지 않는다.

## 눈으로 확인한 이미지

- FINAL_OBJECT_REVIEW_exp-prenat1-city.jpg
- FINAL_OBJECT_REVIEW_exp-seed1-ch5-detail.jpg
- FINAL_OBJECT_REVIEW_exp-seed4-middle.jpg
- FINAL_OBJECT_REVIEW_exp-current-city.jpg

초록은 동결 표적, 빨강은 최종 후보. 원본 화면을 먼저 확인했던 동일 물건에 최종 상자를 겹쳐 다시 보았다. 코드·동결정답 수정 없음.

입력 `baseline-datasets/current/enhanced-final/findings.json` SHA256 `500337ba025fe136f792d0ebb49fe6873114e87bcd1a7cac69833f78a3011780`.

입력 `baseline-datasets/prenat1/enhanced-final/findings.json` SHA256 `e1e23cd9c1596f2cabcb05e55a9e7f3d8358bfacadf794ef4de5b1a45e4b59d5`.

입력 `baseline-datasets/prenat2/enhanced-final/findings.json` SHA256 `07ac03222a0105917d8680a6840fa9917362ff700fa9649b64852db55a091f72`.
