# 시각 검사기 (tools/vision-check) — 저장소에서 쓰는 법

Astra가 만든 화면 자연스러움 검사기(Python·uv)를 2026-10-02에 저장소 도구로 들였다. 원본은 재현율 2차 회차 묶음 `astra-vision-recall-20261002.zip`의 `tools/vision-check/`(개선판)다. 같은 묶음의 `baseline-tool/`(개선 전 기준선, 첫 회차 `astra-raw/qa/vision-check-20261002/`와 거의 같음)은 들이지 않았다.

- **보조 도구다.** `npm test`와 병합 전 검사(`check:merge`)에 들어가지 않는다. 파이썬 시험(`tests/`)은 `tests/*.test.ts`에 걸리지 않고, ESLint는 `tools/**`를 보지 않으며, typecheck 범위 밖이다.
- **진입점**: `npm run vision:check -- <명령> …` → 검출기 상태를 찍고 `uv run python -m vision_check.cli <명령> …`를 이 폴더에서 돌린다. 인자가 없으면 CLI 도움말.
  - 처음 한 번: `cd tools/vision-check && uv sync --group dev && uv run playwright install chromium`.
  - 파이썬 시험: `cd tools/vision-check && uv run pytest -q`(2026-10-02 Mac 98/98).
  - 게임 화면 수집(`replay`·`replay-land`)은 **포트 4470**에서 도는 개발 서버를 쓴다(코드에 고정). 수집할 커밋의 체크아웃에서 `FLS_TELEMETRY=0 npm run dev -- --host 127.0.0.1 --port 4470 --strictPort`를 먼저 띄운다. 다른 세션의 서버·포트는 쓰지 않는다. 수집은 계측을 포함해 성능 측정이 아니다.
- **검출기 상태**: `config/detectors.json`. 문턱은 `config/recall.json`이다.

  | 상태 | 검출기 | 정답지 재현율 / 정밀도 |
  |---|---|---|
  | 사용 | `straight_boundary` 경계 | 85.7 % / 85.7 % |
  | 사용 | `tile_seam` 이음새 | 100 % / 100 % |
  | 사용 | `stationary_person` 멈춘 사람 | 100 % / 100 % |
  | 사용 | `roof_overlap` 겹침(지붕 위 사람) | 100 % / 100 % |
  | 실험 | `scale_ratio` 크기 | 50 % / 100 % |
  | 실험 | `repeat_density` 반복 | 100 % / 50 % |

  - **사용**: 그 검출은 사람이 확인해 고칠 결함 후보로 다룬다.
  - **실험**: 사람이 볼 단서일 뿐 관문이 아니다.
  - 수치는 보정용 정답지에서 잰 것이다(같은 장면으로 문턱을 맞췄음). 독립 시험이 아니다.
- **동결 정답 시험지**: `testdata/frozen-truth-20261002/`.
  - 알려진 양성 19개, 정상 대조 주석 12개, 13개 시퀀스. Astra가 후보를 보기 전에 사람이 고정했다.
  - 함께 든 것: `truth-*.json`·`truth-combined.json`, 기록된 해시(`truth-*.sha256`), 사람이 의미 오탐으로 뺀 목록(`human-rejections.json`), 두 판의 검출 결과(`enhanced-findings.json`·`baseline-findings.json`)와 채점(`score-*`), 장면 목록·출처(`scene-manifest.json`·`PROVENANCE.json`), `PRECISION.md`.
  - 폴더 전체 해시는 `SHA256SUMS`다. 고치지 말 것.
  - 다시 채점: `npm run vision:check -- benchmark testdata/frozen-truth-20261002/enhanced-findings.json testdata/frozen-truth-20261002/truth-combined.json <출력 폴더> --human-rejections testdata/frozen-truth-20261002/human-rejections.json`.
    - 2026-10-02 Mac에서 저장된 채점(`score-enhanced/metrics.json`)과 같게 나왔다: 17 TP · 2 FP · 2 FN.
- 아래는 Astra의 원래 설명이다(경로는 Astra의 독립 클론 기준).

---

# Charter & Kin 시각 자연스러움 검사기

**재현율 후속 회차:** [RECALL_README.md](RECALL_README.md)의 커밋·카메라·채점법을 우선 적용한다. 아래 기존 실행 수치는 첫 정밀도 회차 설명이다.

일반 게임 화면을 수집하고, 여섯 종류의 **검토 후보**를 JSON과 빨간 상자 JPEG로 남기는 도구다. 자동 후보와 사람이 확정한 결함은 구분한다. 검출 0건이나 관측 불가능은 통과·정밀도 100%를 뜻하지 않는다. 이번 실행의 실제 발견 수·정밀도·소요 시간은 배포물의 `report/` 및 `PRECISION.md`를 따른다.

대상 저장소는 `hyunlord/feudal-lord-simulator`, 가지는 `codex/phase15-organic-ground`, 이번 조사 기준 커밋은 `3e3192c56ba62f172d965d9b0840d9c0e1928f22`다. 기존 게임 소스 수정, 커밋, 푸시는 필요하지 않다. 이 디렉터리와 보고서만 독립 클론에 추가한다.

## 설치와 실행

필수 환경은 Node/npm, Python 3.12 이상, `uv`, Playwright Chromium이다. 게임의 `public/` 실제 PNG와 큰 도시 저장 파일이 필요하다. Git LFS 포인터만 남은 파일은 사용할 수 없다.

독립 클론에서 게임 의존성을 설치하고 지정 서버를 실행한다. 이미 같은 클론이 있으면 다시 복제하지 않는다.

```sh
git clone --branch codex/phase15-organic-ground --single-branch https://github.com/hyunlord/feudal-lord-simulator.git ~/fls-astra-vision
cd ~/fls-astra-vision
npm ci
FLS_TELEMETRY=0 npm run dev -- --host 127.0.0.1 --port 4470 --strictPort
```

위 서버 터미널을 유지하고 별도 터미널에서 실행한다. `--strictPort` 오류는 다른 포트로 우회하지 말고 4470의 소유 프로세스를 확인한다. 다른 세션 서버를 종료하지 않는다.

```sh
cd ~/fls-astra-vision/tools/vision-check
uv sync --frozen
uv run playwright install chromium
uv run vision-check capture ~/fls-astra-vision ~/fls-astra-vision/report/main --seed 1
uv run vision-check analyze ~/fls-astra-vision ~/fls-astra-vision/report/main --config config/calibrated.json --name calibrated
```

중단된 수집을 재개하려면 같은 명령에 `--resume`을 붙인다. 여름·겨울 × 세 줌의 6개 메타데이터와 각 20장 이미지, QA JPEG가 완전한 땅만 건너뛴다. 일부만 수집된 땅은 처음부터 다시 수집하므로 불완전한 다른 실행과 섞지 않는다. 과거 설정의 결과와 비교할 때는 새 출력 디렉터리를 쓴다.

특정 땅만 실행하는 예:

```sh
uv run vision-check capture ~/fls-astra-vision ~/fls-astra-vision/report/forest-only --terrains forest --seed 1
```

문턱을 확정한 뒤 **아직 보지 않은** 별도 지도에서 검증하려면 다음처럼 새 디렉터리를 쓴다. 지도 2는 게임의 실제 지도 번호 버튼으로 고르며 ID에 `-s2`를 붙인다. 강가와 저장된 큰 도시는 지도 번호를 바꿀 수 없다.

```sh
uv run vision-check capture ~/fls-astra-vision ~/fls-astra-vision/report/holdout --terrains forest --seed 2
uv run vision-check analyze ~/fls-astra-vision ~/fls-astra-vision/report/holdout --config config/calibrated.json --name frozen
```

`seed=1`은 calibration, `seed>1`은 holdout이라는 메타데이터를 기록한다. 이름만으로 독립 검증이 성립하지 않는다. holdout 화면이나 판정을 보고 문턱을 다시 바꿨다면 그 자료는 더 이상 미관측 검증 자료가 아니다.

작업 후 서버를 실행했던 터미널에서 **Ctrl+C**로 종료한다. 백그라운드 실행했다면 자신이 기록한 서버 PID만 종료한다. `killall node`처럼 다른 세션을 포함하는 종료 명령은 쓰지 않는다.

## 장면 계약

기본 행렬은 새 게임 5종 `river,coast,chalk,forest,fen` × 여름·겨울 × 줌 `0.6,1.0,1.4`의 30장면, 그리고 `fixtures/perf-gate/ch4-1380.save.json.gz` 큰 도시의 같은 계절·줌 6장면이다. 총 36장면에 각 20프레임, 즉 월드 PNG 720장을 수집한다. 큰 도시 파일은 복제본 브라우저의 IndexedDB 수동 저장 슬롯으로 불러오며 파일 자체를 고치지 않는다.

화면은 1600×1000, DPR 1, 모든 본 행렬의 목표 중심은 칸 `(32,32)`다. 확대·축소와 중심 이동은 게임의 입력 의도 버스를 이용한다. 각 카메라 설정 후 실제 pan/zoom으로 역산한 월드 중심이 목표에서 1 world px 이상 벗어나면 실패한다. pan 값 자체는 줌에 따라 달라져도 같은 월드 중심을 가리킨다. 초기 탐색용 다른 중심 화면은 본 행렬과 분리해야 한다.

일반 새 게임·이어하기를 사용한다. `phase10-proof` URL은 거부하며, 매 프레임 proof 상태도 검사한다. 백틱 키로 QA 표시를 켜고 `qa.jpg`에 HUD를 보존한다. 분석용 PNG는 DOM HUD를 제외한 첫 월드 canvas다.

계절을 얻기 위해 실제 고정 틱 루프를 진행한다. 달력·틱·사람 위치·날씨를 직접 덮어쓰지 않는다. `page.clock.run_for(100)`으로 프레임 사이 브라우저 시간을 100ms씩 진행시키므로 20프레임의 첫 장과 마지막 장 사이는 1.9초다. **실제 벽시계 촬영 간격이나 10 FPS 성능 측정은 아니다.** PNG 인코딩, 전송, 파일 저장, 렌더링 계측 비용은 `wall_elapsed_ms`에 포함된다. 계절 진행 중에는 500틱마다 진행 상태를 출력한다.

수집 시간은 게임 틱 진행 비용과 CPU에 크게 좌우된다. 분석 시간은 `<분석명>/run.json`의 `seconds`, 장면 수집 시간은 `capture.json` 각 프레임의 `wall_elapsed_ms`와 콘솔 로그를 확인한다. 36장면 행렬이나 DGX에 대해 측정하지 않은 소요 시간을 추정값으로 보장하지 않는다.

## 검출 방법과 오탐 경계

| 검출 ID | 영상 증거 | 주요 제한과 보류 조건 |
| --- | --- | --- |
| `straight_boundary` | 지면 마스크 안 Canny/Hough 선분, ±26.565° 방향, 길이·경계 양쪽 색 대비 | 도로·건물·물 등 의도된 직선은 마스크로 제외한다. 농경지의 정상 경계나 자연 능선도 후보가 될 수 있다. 가려진 경계는 검출하지 못한다. |
| `tile_seam` | 등각 축 방향 밝기 프로파일의 1·2주기 자기상관과 예상 칸 간격, 화면 패치 반복 상관 | 정상 밭고랑·재료 패턴과 실제 이음새를 완전히 구별하지 못한다. 반복 증거를 사람에게 제시하며, 자산 파일명이 같다는 이유만으로 확정하지 않는다. |
| `stationary_person` | 20프레임의 동일 인물 발 위치와 RGB 패치, 실제 틱 진행 | 전체 관측 정지 비율은 따로 기록한다. 경로가 남은 걷기 기대 인물만 후보로 삼지만, 정상 줄서기·일시 대기·막힘을 최종 구별하려면 더 긴 관찰이 필요하다. 상태 정보나 안정된 ID 대응이 없으면 보류한다. |
| `roof_overlap` | 나중에 그려진 사람의 발이 지붕 후보 마스크 안에 있고 해당 영역 픽셀이 시간에 따라 변함 | 건물 전체 사각형 겹침을 오류로 취급하지 않는다. 따뜻한 색의 상부 지붕 마스크는 부분적 추정이다. 회색·눈 덮인 지붕, 애매한 지붕, 정지 인물은 놓칠 수 있다. |
| `scale_ratio` | 실제 알파 실루엣·픽셀 가시성, 사람 표본 중앙값과 통·자루·문 개구부·수레 바퀴 크기 비교 | 통 더미·적재물·수레 전체 높이를 단일 통/바퀴로 재지 않는다. 어두운 문과 타원 바퀴의 의미 분류는 가설이므로 수동 판정이 필요하다. 빗줄기는 아래 별도 제한을 따른다. |
| `repeat_density` | 근접 영역의 동일 자산 중 실제 RGB 패치까지 유사한 소품·집의 개수 | 숲 나무 밀도를 집 반복 오류로 취급하지 않는다. 지붕·정면 오버레이는 제외한다. 의도된 동일 건물 열이나 소품 배치는 사람이 구분해야 한다. |

Canvas 그리기 호출의 자산 경로·크롭·사각형·순서를 브라우저 안에서 기록한다. 이 정보는 후보 위치를 찾는 보조 증거다. 알파 실루엣이나 시뮬레이션 좌표만으로 최종 가시성·결함을 확정하지 않는다. 가림, 투명도, 원근이 없는 등각 투영, 저줌 보간에 따른 오차를 함께 고려한다.

비는 `rain.py`의 시간 변화·낙하 궤적·긴 밝은 성분으로 빗줄기 **후보 마스크**를 만들고 `objects.rain_scale`에서 사람 화면 키와 비교한다. 밝은 낙하 파편이 비로 오인될 수 있고 화면 전체가 크게 변하면 보류한다. 비가 없는 장면이나 사람 기준을 얻지 못한 장면은 검증 성공이 아니다. 실제 비 장면에 대한 검증 여부는 이번 `PRECISION.md`를 따른다.

현재 여섯 검출기는 광원 방향 역전 자체를 분류하지 않는다. 바이블의 낮 좌상광·우하 그림자 규칙은 사람 검토 기준이며, 재료 밝기만으로 광원 결함을 자동 확정하지 않는다. UI 넘침 검사나 기존 사람 QA도 대체하지 않는다.

## 비율 기준과 문턱

기준은 `docs/design/art-bible.md` v2의 맨발 성인 정수리–발바닥 높이 `H=1.00`이다. 모자·도구·그림자는 기준에서 제외해야 한다. 스프라이트 알파 경계에서 이 부분을 완전히 분리할 수 없는 경우는 측정 한계로 남는다.

| 비교 대상 | 바이블 범위 |
| --- | --- |
| 일반 문 개구부 높이 | 1.15–1.40 H |
| 수레 바퀴 지름 | 0.45–0.70 H |
| 통 | 0.45–0.65 H |
| 자루 | 0.30–0.50 H |
| 빗줄기 | 해당 줌의 사람 **화면** 키보다 길게 읽히지 않음 |

성인 코드 기준은 17.6 world px지만, 저줌에는 가독성 최소 크기 14.08 screen px 보정이 있으므로 `17.6×zoom`만으로 모든 화면을 판정하지 않는다. 사람이 3명 이상 측정되는 화면에서는 실측 중앙값을 쓴다. 문·통·자루·바퀴는 바이블 범위 바깥에 추가 20% 검출 여유를 두고, 빗줄기도 사람 키의 1.2배를 넘는 후보를 알린다. 이는 오탐을 줄이는 **검출 문턱**이며 바이블의 허용 규격을 20% 완화했다는 뜻이 아니다.

`config/baseline.json`과 `config/calibrated.json`은 비교 가능한 설정이다. 사용된 정확한 값은 매 분석의 `run.json.thresholds`에 기록된다. 근거 없는 장면별 예외나 결과를 좋게 보이게 하는 후보 삭제 대신, 보편적인 마스크·길이·대비·주기·유사도 규칙을 조정하고 조정 전후 후보를 함께 보존한다.

## 출력과 사람 판정

```text
report/main/
  raw/<scene-id>/
    00.png ... 19.png   원본 월드 프레임
    qa.jpg             QA HUD가 있는 전체 화면
    capture.json       원시 틱·카메라·그리기·사람·경과 시간
  calibrated/
    findings.json      모든 후보 목록
    coverage.json      장면별 관측 범위·정지 비율·마스크 누락
    run.json           실행 시간·설정·장면 수·후보 수
    <scene-id>.json     정규화된 장면
    annotated/*.jpg    빨간 검출 상자와 ID 종류
```

`Finding`에는 `id`, `scene`, `detector`, `box{x,y,width,height}`, `score`, `reason`, `metrics[{name,value,unit}]`가 있다. 좌표 단위는 분석 PNG의 화면 픽셀이고 왼쪽 위가 원점이다. `score`는 사람이 확인한 참일 확률이 아니다. 지붕 겹침은 마지막 프레임에서 측정하므로 `-last.jpg`, 다른 검출기는 첫 프레임 JPEG를 확인한다.

`capture.json`은 `Capture`/`Reading` 계약, 정규화된 장면은 `Scene`/`Frame` 계약을 따른다. 캡처마다 20프레임을 검증한다. 누락 자산, 관측 정지 비율의 분모, 진행 틱 수, 사용 가능한 지붕/알파 마스크 수 등은 `coverage.json`을 확인한다. 후보 JSON만으로 관측 범위가 충분했다고 판단하지 않는다.

각 후보를 실제 영상에서 확인한 뒤 별도 JSON에 다음 형식으로 판정한다. 아래는 **형식 예시이며 실제 발견·판정이 아니다**.

```json
[
  {"id": "findings.json에 있는 정확한 후보 ID", "verdict": "FP", "note": "의도된 밭고랑으로 확인"}
]
```

```sh
uv run vision-check review ~/fls-astra-vision/report/main/calibrated/findings.json ~/fls-astra-vision/report/main/human-review.json ~/fls-astra-vision/report/main/reviewed
```

`review`는 모든 후보마다 정확히 하나의 `TP` 또는 `FP`와 비어 있지 않은 메모를 요구한다. 누락·중복·모르는 ID는 실패한다. 판단 불가능한 후보를 임의 TP/FP로 채우거나 삭제하지 않는다. 추가 관찰 전에는 완결된 정밀도 산정을 보류한다.

결과 `precision.json`과 `PRECISION.md`에는 여섯 검출기의 TP·FP·분모와 `TP/(TP+FP)`가 들어간다. 분모 0은 `precision:null`, `N/A`, `not_demonstrated`다. 80%를 넘더라도 표시 의미는 **그 판정된 후보에서 달성**이며, 재현율·모든 결함 검출·통계적 보장·독립 holdout 검증을 뜻하지 않는다. 같은 결함의 다른 줌·계절·카메라 화면은 상관된 표본이므로 독립 결함 개수와 함께 보고해야 한다.

## 커밋마다 사용하는 흐름

1. 대상 커밋 SHA와 설정을 고정하고 새 보고서 디렉터리에 일반 게임 행렬을 수집한다.
2. 동일 설정으로 분석하고 이전 커밋 결과와 후보 위치·종류·관측 범위를 비교한다.
3. CI 아티팩트로 후보 JSON·대표 JPEG·coverage·run 기록을 남겨 사람이 먼저 볼 대상을 줄인다.
4. 새 후보를 사람이 판정하고 `review`로 정밀도를 산정한다. 문턱 변경은 calibration에서 하고 별도 지도 holdout을 유지한다.
5. 계측·자산·카메라·틱 검증 실패는 수집 실패로 처리한다. 검출 0건을 자동 성공으로 바꾸지 않는다.

현재 CLI는 후보 생성과 판정 집계 도구다. 정밀도나 후보 수를 근거로 제품 빌드를 자동 차단하는 CI 정책은 내장하지 않았다. 저장소 통합 시 관측 불가와 참 결함을 구분하는 게이트를 별도로 정해야 한다. 이전 커밋의 캡처를 새 커밋의 실화면 증거로 재사용하면 안 된다.

## DGX 헤드리스와 한계

Playwright Chromium의 headless 모드와 OpenCV/NumPy를 쓰며, 이 도구 자체는 화면 서버·CUDA·학습 모델을 요구하지 않는다. Linux에서 브라우저 시스템 의존성까지 설치할 수 있는 환경이라면 다음을 사용한다.

```sh
uv sync --frozen
uv run playwright install --with-deps chromium
```

Linux 배포판·CPU 아키텍처에 맞는 Playwright 브라우저 바이너리와 시스템 패키지 설치 권한이 필요하다. 게임 서버를 같은 머신의 `127.0.0.1:4470`에서 실행하고 동일 CLI를 쓴다. **이번 작업에서 DGX 실행은 검증하지 않았다.** CPU 소프트웨어 렌더링이나 브라우저 버전에 따른 픽셀 차이도 재점검해야 한다. 이 결과로 Mac GPU 성능, DGX 성능, 사용자 체감 FPS가 검증됐다고 주장하지 않는다.

`adapter.js`는 현재 React 내부 fiber에서 GameStore를 찾아 읽고 정상 입력 버스에 연결한다. 안정된 공개 API가 아니므로 React·Provider·렌더러 구조가 바뀌면 깨질 수 있다. store를 못 찾으면 오류를 내며 proof 모드나 임의 상태 주입으로 우회하지 않는다. `browser.js`의 canvas 계측도 렌더러 변경 시 가림·크롭·draw 순서가 실제 화면과 맞는지 재검증해야 한다.

## 검증과 포장

```sh
uv run pytest -q
uv run ruff check .
uv run basedpyright
```

합성 테스트는 검출 규칙의 양성·음성 경계를 검증한다. 합성 양성 결과를 이번 본선의 TP나 정밀도 분모에 포함하지 않는다.

배포 ZIP은 소스·설정·잠금 파일·보고서 JSON·사람 판정표·대표 주석 JPEG와 `SHA256SUMS`를 담는다. `.venv`, `node_modules`, 브라우저 바이너리, 게임 자산, 저장 fixture gzip, 원본 프레임 전체는 경량 ZIP에서 제외한다. 원본 PNG와 자세한 캡처 메타데이터는 실행 클론의 로컬 보고서에 보존한다. ZIP만으로 재분석에 필요한 원본 프레임이 모두 제공된다고 해석하면 안 된다. 다시 실행하려면 위 커밋의 게임 자산·저장 파일을 별도로 준비한다.

참조 문서는 저장소의 `docs/qa/round17/FINDINGS.md`, `docs/qa/round03-14/history/*-CHECKLIST.md`, `docs/design/art-bible.md`, `docs/design/art-audit-20261002/`다. 구현 API 참고: [Playwright Clock](https://playwright.dev/python/docs/api/class-clock), [OpenCV Hough Lines](https://docs.opencv.org/4.13.0/d9/db0/tutorial_hough_lines.html).
