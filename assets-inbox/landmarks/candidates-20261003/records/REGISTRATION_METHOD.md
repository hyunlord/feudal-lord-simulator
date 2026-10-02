# 통짜 랜드마크 계절 등록 방식

관문: **합성 입력 정합·잔차 실패·클리핑 실패·불투명 배경 거부 검사 통과**. 실제 최종22쌍 실행은 종료0,22/22쌍 IoU≥0.95,44개 모두 클리핑 없음. 상세값은 registration-result.json. 내부 구조·엄격한 투영 각도는 별도 GEOMETRY_AUDIT.md의 제한을 따른다.

## 인터페이스

기존 Python 환경의 Pillow·NumPy·SciPy만 사용한다. 새 패키지 설치 없음. PEP723 선언은 재현을 위한 것이며 이번 실행은 환경 재설치 없는 `python3`를 사용한다.

```sh
python3 records/tools/register_assets.py --root /tmp/astra-landmark-growth-20261003-work
```

- `--root`: `raw/`와 `records/registration.json`을 가진 입력 루트. 기본값은 위 작업 경로.
- `--output-root`: 결과 루트. 생략하면 입력 루트와 같다. 독립 검사에는 반드시 별도 임시 루트를 지정할 수 있다.
- `--expected-count`: registration 항목 수, 기본22. 합성검사에만1을 사용했다.
- 종료0: 입력 항목 전체 처리, 모든 쌍 IoU≥0.95, clipping 없음.
- 종료2: 결과를 기록했으나 한 쌍 이상 IoU 또는 clipping 실패. 실패 PNG도 남으므로 파일 존재를 합격으로 취급하지 않는다.
- 입력 누락/규격 위반은 예외로 중단한다. 그런 실행의 기존 결과 파일은 새 전체 검증으로 해석하지 않는다.

입력 `records/registration.json`은 다음 정확 필드를 가진22항목 배열이다. family/stage는 고유해야 한다.

```json
[{"family":"church","stage":0,"anchor_x":600,"anchor_y":1080,"source_scale":1.0,"footprint_w":2,"footprint_d":2,"expansion_rule":"fixed_anchor","anchor_kind":"front_ground_vertex"}]
```

각 항목은 `raw/{family}_s{stage:02d}_summer.png`와 대응 winter PNG를 읽는다. 원본크기는혼합허용(예:1254×1254,1774×887). 여름anchor는실제여름원본절대픽셀이다. 알파채널이있고비어있지않은PNG여야한다. alpha가완전불투명하거나alpha>32가원본캔버스가장자리에닿으면중단한다. alpha≤32의가장자리접지그림자노이즈는허용한다. 배경제거·흰 픽셀 삭제를 하지 않으므로 눈과 흰 회벽을 보존한다. 이 검사는 구조적 투명도 검사이며 건물 안에 그려진 배경/색 오염을 완전 자동 판별하지 않는다.

## 변환

모든 최종 캔버스는2048×2048, 공통 피벗(768,1536), world_scale=0.25이다. world_scale는 메타데이터이며 출력PNG를 추가로0.25배 축소하지 않는다.

여름 원본 좌표p에서 등록좌표q:

`q = source_scale × p + ((768,1536) − source_scale × (anchor_x,anchor_y))`

겨울은 여름의 알파 실루엣을 목표로 다음 절차를 쓴다.

1. 양쪽 알파를각자긴변256에맞춰균일축소하고256×256에좌상단정렬하여 alpha bbox의 면적비로 균일scale를 초기화하고 bbox 중심으로translation을 초기화한다.
2. Powell 최적화로 soft alpha IoU를 최대화한다. 자유도는 **uniform scale 1개 + x/y translation 2개**뿐이다. scale 범위는초기값의0.7–1.3배,translation은저해상도초기위치±40px이다.
3. 초기값과 최적화 결과 중목적함수가 더 나은 것을 채택한다. 각원본의별도축소율을반영해scale/translation을실제원본단위로환산한다(가로세로를독립적으로눌러정합하지않음).
4. 겨울→여름 transform과 여름→등록 transform을 합성하고, 원본 전체에 최종 affine 변환을 한 번 적용한다. premultiplied RGBa 상태에서 bicubic 보간 후 RGBA로 복귀해 투명 경계의 RGB 오염을 줄인다.

부품 추출/이동,재색칠,소실점 변경,회전,비균일 신축,alpha를여름으로 강제치환하는 처리는 없다. 원래 겨울 생성물이 다른 탑·문·부속동을 가졌다면 그 차이를 덮지 못하고 잔차로 남는다.

## 출력과 판정

- `assets/`:44개의 등록PNG.
- `assets/manifest.csv`: filename,family,stage,season,canvas_width,canvas_height,pivot_x,pivot_y,world_scale,footprint_w,footprint_d,expansion_rule,anchor_kind.
- `records/registration-result.json`: 각 쌍 `winter_to_summer`(겨울원본→여름원본절대픽셀좌표), `source_to_registered`(여름,겨울 순서), `silhouette_iou`, `silhouette_residual`, `silhouette_pass`, `clipping`(여름,겨울 순서), `passed`, 각원본크기와원본SHA256.

IoU는최종2048캔버스의alpha≥128이진마스크를비교한다. 잔차는1−IoU. **IoU<0.95는fail**이며 임계값이나 알파를고쳐합격시키지 않는다. 알파IoU는실루엣정합만 측정하고 창·문·지붕선같은내부구조동일성은증명하지 않는다. 후보별육안검수를별도로해야한다.

clipping은 원본의alpha>32 bbox를실제최종transform으로옮겨검사하며 bicubic 가장자리여유2px를확보한다. 잘린겨울/여름의공통부분이IoU를부풀려도clipping이별도로전체판정을실패시킨다.

## 검증 기록

별도 시스템 임시루트에 만든 실제PNG를 CLI로 실행했다. 생산raw/asset에는 쓰지 않았다.

| 검사 | 결과 |
|---|---|
| 동일 비대칭건물에겨울1.11배·x+35·y−55이동 | 역정합scale0.89963581,x−30.97936,y50.53748,최종IoU0.99792643,exit0 |
| 겨울을전혀다른원형실루엣으로대체 | IoU0.82945734,실패JSON보존,exit2 |
| source_scale2로캔버스밖이동유발 | clipping 실패JSON보존,exit2 |
| 완전불투명흰배경 | 입력오류로거부,흰색삭제없음 |
| Python compile()/CLI --help | 통과 |

코드180순수라인(주석/빈줄제외). 책임은계절이미지등록하나이다. 입력은Registration으로경계에서검증하고내부에서는그타입을사용한다. 의도적으로stdlib argparse를사용해새CLI의존성을추가하지않았다. ruff/basedpyright는환경에없어실행하지않았으며설치하지않았다. 자동test suite 파일은쓰기범위밖이라추가하지않았고위합성실행으로동작을확인했다.

혼합크기후속회귀: 여름1774×887,겨울1254×1254(동일비대칭건물을0.7배·x+8·y+120이동),여름좌상단alpha16노이즈를허용하여실행했다. 최종IoU0.98763633,clipping false/false,exit0. 각source_sizes와원본좌표transform기록확인.

최종캔버스보완: 부모지시에따라2048×2048,pivot(768,1536),world_scale0.25로변경했다. 이는투명여백과정렬점만변경하며source_scale를임의로줄이거나건물을확대하지않는다. 위최초검사IoU는당시1536캔버스에서의기록이며최종상수회귀는별도확인한다.

최종2048상수에서별도임시출력으로혼합크기정합(실루엣IoU≥0.98),canvas/pivot메타데이터와PNG크기,다른실루엣exit2,강제클리핑exit2,불투명흰배경입력거부를모두재실행해통과했다. 실제44개후보의IoU합격은이합성검사로대체하지않는다.
