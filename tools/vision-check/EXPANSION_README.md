# 부위 크기·정상 재고·양성 확장 회차

이번 회차의 기준 문서다. 이전 `RECALL_README.md`와 `PRECISION.md`의 작은 시험지는 보존하지만 새 성능 주장은 배포물 `report/expansion/PRECISION.md`를 따른다.

## 시험지와 범위

검출 전에 사람이 원본 프레임·QA 기록으로 정답을 고정했다. 경계9, 이음새6, 멈춤7, 겹침6, 크기5, 반복5, 합계38개의 **검출 속성별 양성 단위**다. 같은 사람/바위가 서로 다른 검출 속성에서 등장하므로 38개의 고유 버그 원인이라는 뜻이 아니다. 같은 물건을 다른 줌·계절로 촬영해 양성 수를 늘리지 않았다.

다른 땅(해안·습지·숲·백악), 지도1·2, QA round01과 round03–14의 사람 기록, round17의 지면 기록, 다른 도시 저장 seed1·2·4를 사용했다. 모든 검출기에서 별개의 QA 원인 다섯 종류를 재현했다는 뜻은 아니다. 사람 사례는 기존 도시의 서로 다른 인물이고, 이음새는 같은 바위 테두리 원인의 다른 덩어리다. 신규 판독과 기존 교정 자료를 출처표에서 구분한다.

동결 파일은 `truth-ground-frozen.json`, `truth-humans-frozen.json`, `truth-objects-frozen.json`, `truth-repeat-frozen.json`이다. 합본은 위치·문구를 바꾸지 않고 같은 scene/detector의 영역만 합친다. 새 후보에 맞춰 정답 상자를 옮기지 않는다. 문턱/코드 개선 후 같은 시험지를 다시 쓴 성능은 교정 세트 결과다. 외부 독립 holdout 보장이 아니다.

정밀도는 **주석 ROI 안의 조건부 정밀도**다. 밖의 후보를 정상으로 간주하지 않는다. TP/FP/FN 및 제외된 후보 수를 모두 공개한다. 바퀴 이상 양성·실제 빗줄기 양성은 확보하지 못했으므로 크기 검출기 전체 수치가 그 하위 유형의 재현율을 보장하지 않는다.

## 부위 크기 측정

복합 그림을 통째로 통/자루/바퀴로 재지 않는다. 소스 PNG의 SHA256·크기와 부위 다각형을 고정한 카탈로그를 사용한다. 소스 주석에는 화면 정답 좌표나 장면 ID를 넣지 않는다. 통은 세로 보관통, 자루는 독립 자루, 바퀴는 바깥 테두리를 측정한다. 양조의 교반용 큰 mash tub을 일반 보관통 규격으로 재지 않는다.

과거 캡처의 draw AABB는 좌우반전 정보를 잃었다. 전체 부모 그림을 원본/반전 방향으로 화면 RGB와 대조한 뒤 부위 좌표를 투영하고, 실제 부위 픽셀 가시성을 다시 검사한다. 가려진 부위를 원본 크기만 보고 결함으로 세지 않는다. 자산 SHA가 바뀌면 그 주석을 그대로 쓰지 않고 보류한다. 이는 명시적으로 주석한 자산에 한정된 부위 분리이며 모든 복합 그림을 이해하는 범용 모델은 아니다.

## 정상 재고 반복

에일 통·작업장 장작·창고 짐상자·상품 재고는 경로 및 게임 자산 용도에 근거한 좁은 의미 분류로 반복 검사에서 제외한다. 통이라는 단어나 pile 디렉터리 전체를 무조건 제외하지 않는다. 흰 실타래 장식과 집 그림의 과다반복은 유지한다. 반복 제외는 크기 정상 판정을 뜻하지 않으며 크기 검사에는 영향을 주지 않는다.

## 재실행

```sh
cd tools/vision-check
uv sync --frozen
uv run playwright install chromium
uv run vision-check --help
uv run pytest -q
uv run ruff check .
uv run basedpyright
```

실제 캡처는 해당 커밋의 own worktree에서 npm ci 후 포트4470 서버를 실행하고 `vision-check replay REPO SAVE REPORT NAME --zoom Z --tx X --ty Y`를 쓴다. `--no-confirm`은 20×100ms 한 묶음, 기본 confirm은 추가20×600ms 묶음이다. 멈춤 정답은 후자의11.4초를 사용한다. 증명 모드는 쓰지 않는다. 재현 저장·카메라·커밋은 `report/expansion/SCENE_PROVENANCE.md`와 각 `replay.json`을 따른다. 모르는 스키마의 저장 버전을 숫자만 고쳐 옛 게임에 넣지 않는다.

분석은 소스 PNG가 실제 촬영 커밋과 맞아야 하므로 current/prenat1/prenat2를 분리해 실행한다. 이전 도구는 `config/recall.json`, 개선 도구는 `config/expansion.json`을 사용한다. 개선 실행은 `vision-check analyze REPO DATASET --config config/expansion.json --name enhanced-final`이다. 같은 시험지에서 문턱을 조정했으므로 교정 성능으로 보고한다. 합친 후보와 동결 정답은 `vision-check benchmark FINDINGS TRUTH OUTPUT`으로 채점한다. `--human-rejections`는 공간은 맞아도 다른 물건을 검출한 경우처럼 사람 확인으로 제외할 정확한 후보 ID 목록이며 삭제 내역을 보고한다.

ZIP에는 소스·카탈로그·시험지·모든 후보와 채점 JSON·대표 JPEG·원본 메타데이터 압축본·입력 해시를 담는다. 20프레임 전체 PNG와 게임 자산은 용량 때문에 별도 로컬 보존한다. JPEG로 분석을 재실행하면 픽셀 증거가 달라지므로 사용하지 않는다. 모든 PNG를 얻으려면 명시된 저장과 카메라로 다시 캡처하거나 원래 로컬 raw를 사용한다.

DGX는 기존과 동일한 headless Chromium/CPU 이미지 분석 경로를 지원하도록 작성했으나 이번에도 실기 실행은 하지 않았다. 카탈로그와 분석에 CUDA/추가 학습 모델은 필요하지 않다. 브라우저 가상 시간 캡처는 게임 성능 벤치마크가 아니다. 실제 소요 시간은 실행 결과 run.json에 기록한다.

닫힌 갈색 목재 문은 어두운 열린 문 구멍을 찾는 기존 추론으로 분리하지 못한다. seed4의 해당 문은 FN으로 남긴다. 결과가 없는 부위를 정상으로 바꾸지 않는다.
