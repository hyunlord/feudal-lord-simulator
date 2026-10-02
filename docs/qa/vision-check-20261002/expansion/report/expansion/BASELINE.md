# 이전 도구 확장 시험 기준선

이전 납품 snapshot `baseline-tool`을 수정하지 않고 실제 14개 raw 장면(20프레임씩)에 실행했다. 4개 동결 정답 파일을 19개 scene/detector annotation, 총 38개 결함으로 병합했다. 중복인 exp-prenat1-city / scale_ratio의 양성·음성 ROI만 합쳤으며 정답 좌표와 원본 파일은 변경하지 않았다.

## 실행과 출처

- 실행 모듈: `baseline-tool/vision_check/analyze.py` (PYTHONPATH로 경로 검증).
- 고정 설정: `baseline-tool/config/recall.json`; axis_boundary_length_tiles=1.0.
- 최초 calibrated 설정 실행과 seed1 장면을 current로 잘못 분류한 실행은 `*-discarded` 디렉터리에 격리했으며 아래 결과와 배포 대상에서 제외한다. 최종 실행은 replay.json의 ce941 출처를 반영했다.
- 실행 명령: `PYTHONPATH=<expansion>/baseline-tool <tool>/.venv/bin/python -m vision_check.cli analyze <repo> <dataset> --config <expansion>/baseline-tool/config/recall.json --name baseline`

| 자산 저장소 | HEAD | 장면 | 후보 | 분석 시간 |
|---|---|---:|---:|---:|
| wt-current | d6ae15498a45c2202a10f3ce8f20a543dd305c3f | 8 | 26 | 19.37s |
| wt-prenat1 | ce941ebeb3e567f498f2709e5989d08f39f6d370 | 5 | 225 | 16.20s |
| wt-prenat2 | 653af2e29bd7ebd51b061fb70c97c81c300a8b12 | 1 | 100 | 4.41s |

총 351개 후보. 병렬 실행이므로 위 시간의 합은 벽시계 총시간이 아니다. 각 실행 정상 종료. 3개 worktree의 tracked diff는 비어 있다. snapshot 소스/설정 및 4개 정답 원본 SHA를 실행 후 재확인했다. 자세한 파일별 SHA와 데이터셋 연결은 `baseline-provenance.json`에 있다.

## 동결 ROI 평가

| 검출기 | TP | FP | FN | 재현율 | 정밀도 | ROI 밖/미평가 후보 |
|---|---:|---:|---:|---:|---:|---:|
| straight_boundary | 1 | 0 | 8 | 11.1% | 100.0% | 24 |
| tile_seam | 1 | 0 | 5 | 16.7% | 100.0% | 1 |
| stationary_person | 7 | 0 | 0 | 100.0% | 100.0% | 211 |
| roof_overlap | 6 | 0 | 0 | 100.0% | 100.0% | 72 |
| scale_ratio | 1 | 0 | 4 | 20.0% | 100.0% | 4 |
| repeat_density | 2 | 4 | 3 | 40.0% | 33.3% | 17 |

목표는 재현율 70%·정밀도 80%. 이 정답 범위에서는 사람 정지/겹침 두 행만 충족한다. 모든 행에 양성 정답이 5개 이상 있지만, 같은 장면·렌더링 원인의 서로 다른 인물이나 위치이므로 독립 결함 계열 5종이라는 뜻은 아니다.

## 의미 판정 및 한계

- `baseline-human-rejections.json`의 exp-prenat1-city repeat_density:0/1은 ale_barrels_3 후보인데 정답은 yarn_skeins다. 기하학적으로 겹쳐도 같은 대상이 아니므로 TP 연결에서 제외했다. 실제 실타래 후보 :2/3이 해당 정답에 연결된다. 거부 전후 합계는 우연히 같지만 TP 정체가 달랐다. MATCHES.json에 최종 거부/연결을 보존한다.
- 위 정밀도는 동결 ROI 안의 후보에 한정된다. 총 329개 후보는 평가 범위 밖이다. 예를 들어 stationary 211개와 roof 72개는 FP가 없다는 증거가 아니다. 화면 전체 정밀도 100%로 확대 해석하면 안 된다.
- 0분모는 null/not_demonstrated 처리한다. 이번 여섯 행에는 0분모가 없다.
- 원 QA005의 정적 건물 인물과 후속 NW벽 이동 인물은 서로 다른 하위 유형이다. NW벽 정답은 20프레임 중 frame16에서 보인 위치이며 반복 프레임을 별도 정답으로 부풀리지 않았다.
- exp-seed1-ch5의 hedgerow_b_summer.png#crop=0,0,0.2,64 자산 1개는 마스크 수집에서 누락된다. 해당 장면은 동결 양성/음성 annotation이 없어 성능 분모에 포함되지 않는다. 다른 13개 장면의 누락 자산은 0개다.
- 참고용 JPEG는 각 dataset/baseline/annotated에 있다. 원본 캡처는 symlink로 연결했으며 변경하지 않았다.

## 장면 연결

- `exp-current-city` → `wt-current`
- `exp-holdout-forest-s2` → `wt-current`
- `exp-main-chalk-wide` → `wt-current`
- `exp-main-coast` → `wt-current`
- `exp-main-fen` → `wt-current`
- `exp-main-forest` → `wt-current`
- `exp-prenat1-city` → `wt-prenat1`
- `exp-prenat1-city-confirm` → `wt-prenat1`
- `exp-prenat1-roof-confirm` → `wt-prenat1`
- `exp-prenat2-city-confirm` → `wt-prenat2`
- `exp-recall-chalk` → `wt-current`
- `exp-seed1-ch5` → `wt-prenat1`
- `exp-seed1-ch5-detail` → `wt-prenat1`
- `exp-seed4-middle` → `wt-current`
