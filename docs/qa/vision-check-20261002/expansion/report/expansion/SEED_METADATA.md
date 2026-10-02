# 재생 캡처의 지도 번호 메타데이터 정정

기존 `vision_check/replay.py`의 `_frames`가 `Capture.seed=1`을 고정해 기록했다. 따라서 이 수정 전에 만든 역사 재생 `raw/*/capture.json`의 `seed`는 실제 원본 지도의 번호를 입증하지 않는다. 게임에 넣은 저장 바이트와 화면은 이 값으로 바꾸지 않았으므로, 잘못된 것은 캡처 메타데이터이며 저장 변조나 지도 교체가 아니다.

기존 raw 파일은 보존했고 소급 수정하지 않았다. 실제 번호는 각 `replay.json`의 `save` 및 `save_sha256`에 해당하는 저장의 `state.seed`로 확인해야 한다. 확인된 대표 원본:

| 원본 | 스키마 | 실제 seed |
|---|---:|---:|
| `fixtures/perf-gate/ch4-1380.save.json.gz` | 30 | 2 |
| `fixtures/saves/v31/chapter-five-town.save.json` | 31 | 1 |
| `docs/qa/round01/repro/saves/middle1340.json.gz` | 32 | 4 |

수정 뒤에는 압축을 푼 원본 저장에 최소 Pydantic 경계를 적용한다. 양의 정수 `schemaVersion` 및 엄격한 정수 `state.seed`를 요구하고, 누락·문자열·불리언·비정상 JSON은 브라우저를 열기 전에 거부한다. 원본을 고치지 않으며 게임 상태 전체의 호환성·체크섬은 게임의 일반 불러오기가 검증한다. 헤더의 요약 `seed`가 아닌 실제 세계의 `state.seed`를 본 캡처와 확인용 캡처에 전달한다. 새 본 캡처 `replay.json`에는 `seed`, `seed_source: save.state.seed`, `save_schema_version`을 남긴다.

회귀 검사: seed2/요약 헤더 불일치, 불필요한 게임 필드 허용, 누락·잘못된 형식 10종을 포함한 12개 통과. 지정 파일 Ruff 및 Basedpyright 통과. 세 실제 원본의 메타데이터 추출도 위 표대로 확인했다. 이 작업은 브라우저 전체 재생을 별도로 실행하지 않았으며, 이후 본 실행의 새 캡처로 통합 확인한다.

탐색: `graft callers _frames --depth all`은 이 별도 클론에 graph가 없어 실패했다. 알려진 `replay.py`와 직접 호출 두 곳을 읽어 수정했다. 기존 게임 소스·기존 raw는 변경하지 않았다.

## 최종 브라우저 통합 확인

수정한 replay CLI로 원래 seed4 middle1340 저장을 포트4470의 wt-current에서 정상 이어하기로 다시 캡처했다. `seed-verification/raw/verified-seed4/capture.json` 20프레임 seed=4, replay.json seed=4/save_schema_version=32를 확인했다. 이 추가 캡처는 도구 메타데이터 검증이며 동결 시험지에는 더하지 않는다. 검증 후 소유 서버를 종료했다.
