# 알려진 결함 재현율 회차

이번 회차는 이전 정밀도 회차의 독립 클론 안에서 detached worktree 세 개를 실행했다. 게임 소스·기존 자산·잠금 파일은 수정하지 않았고 커밋·푸시하지 않았다. 포트는 4470만 사용했다. 증명 모드는 사용하지 않았다.

## 커밋과 시험지

| 실행 | 커밋 | 목적 |
|---|---|---|
| 현재 본선 | d6ae15498a45c2202a10f3ce8f20a543dd305c3f | QA039/040, 정상 대조, QA008 이후 |
| NAT-1 직전 | ce941ebeb3e567f498f2709e5989d08f39f6d370 | 지붕의 장식 손님, 원래 QA005 이동 인물/성벽, 실타래 반복 |
| 사용자 지정 NAT-2 전 | 653af2e29bd7ebd51b061fb70c97c81c300a8b12 | QA002 고정 손님, QA008 흰 도형 |

NAT-1 구현 97dbcfe의 바로 앞 부모를 사용했다. NAT-1 보고서의 비교 기준 4a30c717과는 구분한다. 현재 본선은 이전 3e3192c와 src/public 차이가 없는 문서 갱신 HEAD다. QA005라는 이름에는 회차에 따라 고정 장식 손님의 지붕 겹침과 실제 이동 인물의 성벽 가림이 섞여 있어 별개 정답으로 남겼다.

도시 저장은 fixtures/perf-gate/ch4-1380.save.json.gz, 틱320000의 봄 저장이다. 게임의 일반 저장 슬롯에 넣어 이어하기로 열었다. 파일 바이트 SHA와 압축해제 상태 SHA를 provenance에 각각 남긴다. 새 땅에는 해당 회차의 완전한 저장이 없어 같은 땅/씨앗1을 UI에서 시작하고 실제 틱을 진행했다. 정확히 같은 틱의 바람·인물 위치까지 재현된다고 주장하지 않는다.

1600×1100, DPR1. 현재 백악 (51,30)/1.332, 숲 (44,38)/1.001, 강가 (32,32)/1.0. 도시 (46,42)/1.0, preNAT1 반복 장면1.3. QA005는 줌2, pan(544,-2277). QA008 전후는 (44,32)/0.6. 정확한 관측값은 report/repro/<scene>/capture.json.gz 및 scene-manifest.json을 따른다.

## 다시 실행

독립 클론에서 필요한 커밋을 가져와 worktree를 만든다. 한 번에 하나만 서버를 띄운다. 다른 세션의 서버나 포트를 사용하지 않는다.

```sh
git worktree add --detach wt-prenat1 ce941ebeb3e567f498f2709e5989d08f39f6d370
cd wt-prenat1
npm ci
FLS_TELEMETRY=0 npm run dev -- --host 127.0.0.1 --port 4470 --strictPort
```

각 worktree는 자기 커밋의 public/src를 사용해야 한다. 이 저장소의 Vite 자산 파이프라인은 assets-inbox 원본도 읽으므로 일반 전체 체크아웃을 권장한다. 별도 셸에서:

```sh
cd tools/vision-check
uv sync --group dev
uv run playwright install chromium
uv run python -m vision_check.cli replay "$REPO" "$SAVE" "$OUT" prenat1-roof \
  --zoom 2 --pan-x 544 --pan-y -2277
uv run python -m vision_check.cli analyze "$REPO" "$OUT" \
  --config config/recall.json --name enhanced
uv run python -m vision_check.cli benchmark findings.json truth-combined.json score \
  --human-rejections human-rejections.json
```

`REPO`, `SAVE`, `OUT`는 호출자가 자기 경로로 지정한다. `replay`는 이미 실행 중인4470서버를 사용하므로 먼저 해당 worktree가 포트를 소유하는지 확인한다. `--zoom`, `--tx`, `--ty`로 표의 다른 도시 장면을 수집한다. 기본으로 0.1초20장과 추가0.6초20장을 수집한다. 1.9초의 정지는 정상 손님의5–8초 대기를 구별하지 못하므로, 고정 손님 판정에는11.4초 확인 시퀀스만 사용한다. Playwright clock의 모의시간이며 실제 벽시계 간격과 성능 수치는 별개다.

현재 본선의 새 땅은 `uv run python -m vision_check.cli replay-land "$OUT"`로 수집한다. `replay`의 저장 로더는 현재와 두 과거 커밋에서 실측했다. 미래 게임 API가 바뀌면 어댑터도 검증해야 한다. `baseline-tool/`은 수정 전 검사기 스냅샷이며, 다른 작업 디렉터리에서 PYTHONPATH를 그 폴더로 지정하면 동일 캡처를 기준선으로 다시 분석할 수 있다.

## 채점 원칙

후보를 보기 전에 사람이 실제 이미지와 시간 접촉판으로 정답을 고정하고 해시를 남겼다. 결과는 그 정답에 대한 재현율TP/(TP+FN), 정밀도TP/(TP+FP)다. 0/0은N/A다. 같은 결함을 여러 상자로 알리면 추가 상자는FP다. 의미가 다른 통 더미가 실타래 정답 상자에 들어갔다고TP로 인정하지 않는다. 수동 의미 오탐 ID를 별도 입력해 공간 매칭에서 제외한다.

부분 주석 ROI만 채점한다. 그 밖의 후보는 참으로 간주하지 않고 excluded로 남긴다. 관측 표본에서 문턱을 넘었다는 것은 전 화면·모든 커밋의 성능 보장이 아니다. 정답을 이용해 개선했으므로 대부분 보정용 시험지이며 독립 검증 성능이 아니다. 정상 대조는 FP만 검증하고 양성 수를 늘리지 않는다. 결함군 당1건뿐인 항목은 특히 불확실하다.

QA008은 여섯 항목에 억지로 넣지 않고 별도 흰 평면 도형 보조 검사로 보고한다. 여러 흰 다각형을 독립 결함 수십 건으로 세지 않는다. 현재 영주관의 흰 도형 잔존도 명시한다.

## 경량 배포와 헤드리스

ZIP에는 소스·설정·시험지·양쪽 결과·원본 메타데이터 gzip·대표JPEG·시간 접촉판·SHA256SUMS가 있다. 전체20장 무손실PNG는 로컬 report/recall에 보존하고 ZIP에서 생략한다. JPEG로 재분석하면 픽셀이 달라지므로 결과 재채점은 포함JSON, 영상 재검출은 원본 로컬PNG 또는 새 수집을 사용한다.

로컬 Chromium headless에서 실제 실행했다. Linux/DGX에서는 Python3.12+, uv, Node, Chromium 런타임 및 시스템 라이브러리가 필요하다(`uv run playwright install --with-deps chromium`). GPU 추론이나 외부 모델 호출은 없다. DGX/aarch64에서 직접 실행하지 않았으므로 플랫폼 지원·실행 시간은 미검증이다. 캡처는 계측·스택 수집을 포함하여 게임 성능 벤치마크로 사용할 수 없다.
